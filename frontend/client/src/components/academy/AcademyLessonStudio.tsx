import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Avatar,
  Box,
  Button,
  Checkbox,
  Chip,
  Divider,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  LinearProgress,
  Menu,
  MenuItem,
  Select,
  Slider,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import {
  Add,
  Campaign,
  CheckCircleOutline,
  Description,
  DragIndicator,
  Edit,
  Image as ImageIcon,
  Link as LinkIcon,
  MailOutline,
  MusicNote,
  Movie,
  NotificationsNone,
  Pause,
  PlayArrow,
  Save,
  Search,
  Subtitles,
  VideoLibrary,
} from "@mui/icons-material";
import { useLocation } from "wouter";
import {
  useAcademy,
  type Course,
  type Lesson,
  type LessonResource,
} from "@/contexts/AcademyContext";
import { useEnhancedMasterIntegration } from "@/integration/EnhancedMasterIntegrationProvider";
import { withUniversalIntegration } from "@/integration/UniversalIntegrationHOC";
import { useAcademyLocale } from "./academyLocale";
import AcademyLocaleSwitcher from "./AcademyLocaleSwitcher";
import AcademyLeftSidebar from "./AcademyLeftSidebar";
import AcademyPlayerStudio from "./AcademyPlayerStudio";
import { probeVideoDurationSeconds } from "./academyVideoSourceUtils";
import {
  buildUrlMediaFingerprint,
  normalizeMediaAssetId,
  normalizeMediaVersion,
  resolveLinkedVideoVersionState,
} from "@/utils/academyMediaLinkUtils";

interface AcademyLessonStudioProps {
  courseId?: string;
  lessonId?: string;
  onSave?: (payload: Record<string, unknown>) => void;
  onCancel?: () => void;
}

interface LessonChapter {
  id: string;
  title: string;
  duration: number;
  type: "video" | "pdf" | "quiz";
}

interface LessonResourceItem {
  id: string;
  title: string;
  type: "video" | "pdf" | "link" | "image" | "audio";
  url: string;
  duration?: number;
  mediaAssetId?: string;
  mediaVersion?: number;
  mediaUpdatedAt?: string;
  mediaFingerprint?: string;
}

interface MediaResourceOption {
  id: string;
  title: string;
  type: LessonResourceItem["type"];
  url: string;
  duration?: number;
  sourceLabel: string;
  mediaAssetId?: string;
  mediaVersion?: number;
  mediaUpdatedAt?: string;
  mediaFingerprint?: string;
}

type EngagementEntryType = "comment" | "question";

interface EngagementReply {
  id: string;
  author: string;
  text: string;
  createdAt: string;
}

interface EngagementEntry {
  id: string;
  type: EngagementEntryType;
  author: string;
  text: string;
  timestamp: number;
  createdAt: string;
  replies: EngagementReply[];
}

type CenterTab = "content" | "engagement";
type RightTab = "info" | "resources";

const VIDEO_PLACEHOLDER = "/assets/academy/intro-video.mp4";

const cinematicPanelSx = {
  borderRadius: 1.4,
  border: "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.08)",
  background:
    "linear-gradient(145deg, rgba(20,24,36,0.88), rgba(11,14,22,0.96))",
};

const lessonStudioSectionCardSx = {
  ...cinematicPanelSx,
  p: 1,
  display: "grid",
  gap: 0.9,
} as const;

const lessonStudioSectionLabelSx = {
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  color: "rgba(237,240,247,0.62)",
} as const;

const placeholderBackgrounds = [
  "linear-gradient(145deg, rgba(26,30,40,0.92), rgba(12,16,24,0.98)), radial-gradient(circle at 85% 14%, rgba(245,166,35,0.34), rgba(0,0,0,0))",
  "linear-gradient(145deg, rgba(18,23,34,0.94), rgba(9,13,20,0.98)), radial-gradient(circle at 20% 80%, rgba(245,166,35,0.22), rgba(0,0,0,0))",
  "linear-gradient(145deg, rgba(16,20,30,0.92), rgba(8,12,18,0.98)), radial-gradient(circle at 73% 10%, rgba(103,154,233,0.2), rgba(0,0,0,0))",
];

const createDefaultChapters = (): LessonChapter[] => [];

const formatTime = (seconds: number): string => {
  const safeSeconds =
    Number.isFinite(seconds) && seconds >= 0 ? Math.floor(seconds) : 0;
  const min = Math.floor(safeSeconds / 60);
  const sec = safeSeconds % 60;
  return `${min}:${sec.toString().padStart(2, "0")}`;
};

const extractLessonVideoDisplayName = (
  value: string | undefined,
  fallback: string,
): string => {
  const url = String(value || "").trim();
  if (!url) return fallback;

  try {
    const normalized =
      typeof window !== "undefined"
        ? new URL(url, window.location.origin)
        : new URL(url, "https://academy.local");
    const pathname = normalized.pathname || "";
    const lastSegment = pathname.split("/").filter(Boolean).pop() || "";
    return decodeURIComponent(lastSegment || normalized.hostname || fallback);
  } catch {
    const lastSegment = url.split("/").filter(Boolean).pop() || fallback;
    try {
      return decodeURIComponent(lastSegment);
    } catch {
      return lastSegment;
    }
  }
};

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));
const normalizeZoom = (value: number): number =>
  clamp(Math.round(value), 100, 220);
const normalizeFocal = (value: number): number =>
  clamp(Math.round(value), 0, 100);
const normalizeTimestamp = (value: number, maxDuration: number): number =>
  clamp(
    Math.round(Number.isFinite(value) ? value : 0),
    0,
    Math.max(0, Math.round(maxDuration)),
  );

const lessonToChapterList = (lesson: Lesson | null): LessonChapter[] => {
  const description = String(lesson?.description || "");
  const lines = description
    .split("\n")
    .map((line) => line.replace(/^[-•]\s*/, "").trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return createDefaultChapters();
  }

  const lessonDuration = Number(lesson?.duration || 480);
  const chunk = Math.max(45, Math.round(lessonDuration / lines.length));

  return lines.map((line, index) => ({
    id: `chapter-from-lesson-${index + 1}`,
    title: line,
    duration: chunk,
    type: "video",
  }));
};

const lessonToResourceList = (lesson: Lesson | null): LessonResourceItem[] => {
  if (
    !lesson ||
    !Array.isArray(lesson.resources) ||
    lesson.resources.length === 0
  ) {
    return [];
  }

  return lesson.resources
    .filter((resource) => Boolean(resource.url))
    .map((resource) => {
      const resourceType: LessonResourceItem["type"] =
        resource.type === "audio"
          ? "audio"
          : resource.type === "image"
            ? "image"
            : resource.type === "video"
              ? "video"
              : resource.type === "pdf"
                ? "pdf"
                : "link";

      return {
        id: String(resource.id),
        mediaAssetId:
          normalizeMediaAssetId(resource.mediaAssetId) || String(resource.id),
        title: String(resource.title || "Resource"),
        type: resourceType,
        url: resource.url || "#",
        duration:
          resourceType === "video" ? Number(lesson.duration || 0) : undefined,
        mediaVersion: resource.mediaVersion
          ? normalizeMediaVersion(resource.mediaVersion, 1)
          : undefined,
        mediaUpdatedAt: resource.mediaUpdatedAt,
        mediaFingerprint: resource.mediaFingerprint,
      };
    });
};

const buildSummaryFromDescription = (description: string): string[] => {
  const lines = description
    .split("\n")
    .map((line) => line.replace(/^[-•]\s*/, "").trim())
    .filter(Boolean);

  if (lines.length > 0) return lines;
  return [];
};

const mapLessonResourceType = (
  type: Lesson["resources"][number]["type"],
  url: string | undefined,
): LessonResourceItem["type"] => {
  if (type === "audio") return "audio";
  if (type === "image") return "image";
  if (type === "video") return "video";
  if (type === "pdf") return "pdf";
  if (url && url.toLowerCase().endsWith(".pdf")) return "pdf";
  return "link";
};

const resourceListsEqual = (
  a: LessonResourceItem[],
  b: LessonResourceItem[],
): boolean => {
  if (a.length !== b.length) return false;
  return a.every((item, index) => {
    const other = b[index];
    return (
      item.id === other.id &&
      item.mediaAssetId === other.mediaAssetId &&
      item.title === other.title &&
      item.type === other.type &&
      item.url === other.url &&
      item.duration === other.duration &&
      item.mediaVersion === other.mediaVersion &&
      item.mediaUpdatedAt === other.mediaUpdatedAt &&
      item.mediaFingerprint === other.mediaFingerprint
    );
  });
};

function AcademyLessonStudio({
  courseId,
  lessonId,
  onSave,
  onCancel,
}: AcademyLessonStudioProps) {
  const [location, setLocation] = useLocation();
  const { state, getCourse, updateCourse, setCurrentCourse, setCurrentLesson } =
    useAcademy();
  const { analytics, debugging } = useEnhancedMasterIntegration();
  const { navLabel, tt } = useAcademyLocale();

  const [leftNav, setLeftNav] = useState("lessons");
  const [centerTab, setCenterTab] = useState<CenterTab>("content");
  const [rightTab, setRightTab] = useState<RightTab>("info");
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [selectedCourseId, setSelectedCourseId] = useState(courseId || "");
  const [saveMessage, setSaveMessage] = useState("");
  const [searchValue, setSearchValue] = useState("");
  const [summaryPoints, setSummaryPoints] = useState<string[]>([]);
  const [lessonTitle, setLessonTitle] = useState("");
  const [selectedLessonInstructorId, setSelectedLessonInstructorId] =
    useState("");
  const [lessonThumbnailUrl, setLessonThumbnailUrl] = useState("");
  const [lessonThumbnailZoom, setLessonThumbnailZoom] = useState(100);
  const [lessonThumbnailFocalX, setLessonThumbnailFocalX] = useState(50);
  const [lessonThumbnailFocalY, setLessonThumbnailFocalY] = useState(50);
  const [thumbnailMenuAnchorEl, setThumbnailMenuAnchorEl] =
    useState<HTMLElement | null>(null);
  const [chapterItems, setChapterItems] = useState<LessonChapter[]>(
    createDefaultChapters,
  );
  const [resourceItems, setResourceItems] = useState<LessonResourceItem[]>([]);
  const [resourcePickerOpen, setResourcePickerOpen] = useState(false);
  const [resourcePickerSearchValue, setResourcePickerSearchValue] =
    useState("");
  const [resourcePickerSelection, setResourcePickerSelection] = useState<
    string[]
  >([]);
  const [engagementItems, setEngagementItems] = useState<EngagementEntry[]>([]);
  const [newEngagementType, setNewEngagementType] =
    useState<EngagementEntryType>("question");
  const [newEngagementText, setNewEngagementText] = useState("");
  const [newEngagementTimestamp, setNewEngagementTimestamp] = useState(0);
  const [replyDraftByEntryId, setReplyDraftByEntryId] = useState<
    Record<string, string>
  >({});
  const thumbnailInputRef = useRef<HTMLInputElement | null>(null);

  const courseItems = useMemo(() => {
    if (Array.isArray(state.courses) && state.courses.length > 0) {
      return state.courses;
    }
    return [] as Course[];
  }, [state.courses]);

  const instructorItems = useMemo(() => {
    if (!Array.isArray(state.instructors)) return [];
    return [...state.instructors].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
    );
  }, [state.instructors]);

  const courseOptionIds = useMemo(
    () => courseItems.map((course) => String(course.id)),
    [courseItems],
  );

  const activeCourse = useMemo(() => {
    const fromParam = courseId ? getCourse(courseId) : null;
    if (fromParam) return fromParam;

    const fromSelected = selectedCourseId
      ? courseItems.find(
          (course) => String(course.id) === String(selectedCourseId),
        )
      : null;
    if (fromSelected) return fromSelected;

    return state.currentCourse || courseItems[0] || null;
  }, [courseId, courseItems, getCourse, selectedCourseId, state.currentCourse]);

  useEffect(() => {
    const nextCourseId = String(courseId || "").trim();
    if (!nextCourseId) return;
    setSelectedCourseId((previousCourseId) =>
      previousCourseId === nextCourseId ? previousCourseId : nextCourseId,
    );
  }, [courseId]);

  useEffect(() => {
    if (!activeCourse?.id) return;
    const inState = state.courses.some(
      (course) => String(course.id) === String(activeCourse.id),
    );
    if (!inState) return;
    if (String(state.currentCourse?.id || "") === String(activeCourse.id))
      return;
    setCurrentCourse(activeCourse);
  }, [activeCourse, setCurrentCourse, state.courses, state.currentCourse?.id]);

  const selectedCourseValue = useMemo(() => {
    const preferredId = String(selectedCourseId || activeCourse?.id || "");
    if (preferredId && courseOptionIds.includes(preferredId)) {
      return preferredId;
    }
    return courseOptionIds[0] || "";
  }, [activeCourse?.id, courseOptionIds, selectedCourseId]);

  const syncCourseIdInRoute = useCallback(
    (nextCourseId: string) => {
      const normalizedCourseId = String(nextCourseId || "").trim();
      const [pathname, rawQuery = ""] = location.split("?");
      const params = new URLSearchParams(rawQuery);

      if (normalizedCourseId) {
        params.set("courseId", normalizedCourseId);
      } else {
        params.delete("courseId");
      }
      params.delete("course_id");

      const suffix = params.toString();
      setLocation(suffix ? `${pathname}?${suffix}` : pathname);
    },
    [location, setLocation],
  );

  const courseLessons = useMemo(() => {
    if (
      Array.isArray(activeCourse?.lessons) &&
      activeCourse.lessons.length > 0
    ) {
      return activeCourse.lessons;
    }
    return [] as Lesson[];
  }, [activeCourse?.lessons]);

  const activeLesson = useMemo(() => {
    if (lessonId) {
      return (
        courseLessons.find(
          (lesson) => String(lesson.id) === String(lessonId),
        ) ||
        state.currentLesson ||
        courseLessons[0] ||
        null
      );
    }

    return state.currentLesson || courseLessons[0] || null;
  }, [courseLessons, lessonId, state.currentLesson]);

  const duration = Number(
    activeLesson?.duration || activeCourse?.duration || 588,
  );

  const lessonVideoState = useMemo(() => {
    const skillVideoUrl = String(activeLesson?.videoUrl || "").trim();
    const courseVideoUrl = String(activeCourse?.videoUrl || "").trim();
    const hasSkillVideo =
      skillVideoUrl.length > 0 && skillVideoUrl !== VIDEO_PLACEHOLDER;
    const hasCourseVideo =
      courseVideoUrl.length > 0 && courseVideoUrl !== VIDEO_PLACEHOLDER;

    if (hasSkillVideo) {
      return {
        source: "skill" as const,
        url: skillVideoUrl,
        duration: Number(activeLesson?.duration || 0),
      };
    }

    if (hasCourseVideo) {
      return {
        source: "course" as const,
        url: courseVideoUrl,
        duration: Number(activeCourse?.duration || 0),
      };
    }

    return {
      source: "none" as const,
      url: "",
      duration: 0,
    };
  }, [
    activeCourse?.duration,
    activeCourse?.videoUrl,
    activeLesson?.duration,
    activeLesson?.videoUrl,
  ]);

  const lessonVideoDisplayLabel = useMemo(
    () => {
      const explicitName =
        lessonVideoState.source === "skill"
          ? String(activeLesson?.linkedVideoAssetName || "").trim()
          : lessonVideoState.source === "course"
            ? String(activeCourse?.linkedVideoAssetName || "").trim()
            : "";
      if (explicitName) return explicitName;
      return extractLessonVideoDisplayName(
        lessonVideoState.url,
        tt("Video", "Video"),
      );
    },
    [
      activeCourse?.linkedVideoAssetName,
      activeLesson?.linkedVideoAssetName,
      lessonVideoState.source,
      lessonVideoState.url,
      tt,
    ],
  );

  const lessonVideoVersionState = useMemo(
    () =>
      resolveLinkedVideoVersionState({
        carrier:
          lessonVideoState.source === "skill"
            ? activeLesson
            : lessonVideoState.source === "course"
              ? activeCourse
              : null,
        course: activeCourse,
        fallbackName: tt("Video", "Video"),
      }),
    [activeCourse, activeLesson, lessonVideoState.source, tt],
  );

  const visibleResources = useMemo(() => {
    const query = searchValue.trim().toLowerCase();
    if (!query) return resourceItems;
    return resourceItems.filter((resource) => {
      return (
        resource.title.toLowerCase().includes(query) ||
        resource.type.toLowerCase().includes(query)
      );
    });
  }, [resourceItems, searchValue]);

  const curriculumLearningOutcomes = useMemo(() => {
    const values = Array.isArray(activeCourse?.learningOutcomes)
      ? activeCourse.learningOutcomes
      : [];
    return values
      .map((value) => String(value || "").trim())
      .filter(
        (value, index, array) =>
          value.length > 0 && array.indexOf(value) === index,
      );
  }, [activeCourse?.learningOutcomes]);

  const mediaResourceOptions = useMemo<MediaResourceOption[]>(() => {
    if (!activeCourse) return [];

    const options: MediaResourceOption[] = [];
    const seenByUrl = new Set<string>();
    const pushOption = (option: MediaResourceOption) => {
      if (!option.url || seenByUrl.has(option.url)) return;
      seenByUrl.add(option.url);
      options.push(option);
    };

    if (activeCourse.videoUrl) {
      pushOption({
        id:
          normalizeMediaAssetId(activeCourse.linkedVideoAssetId) ||
          `${String(activeCourse.id)}-course-video`,
        mediaAssetId:
          normalizeMediaAssetId(activeCourse.linkedVideoAssetId) || undefined,
        mediaVersion: activeCourse.linkedVideoAssetVersion
          ? normalizeMediaVersion(activeCourse.linkedVideoAssetVersion, 1)
          : undefined,
        mediaUpdatedAt: activeCourse.linkedVideoUpdatedAt,
        mediaFingerprint:
          activeCourse.linkedVideoFingerprint ||
          buildUrlMediaFingerprint(activeCourse.videoUrl),
        title:
          String(activeCourse.linkedVideoAssetName || "").trim() ||
          `${activeCourse.title} ${tt("introvideo", "intro video")}`,
        type: "video",
        url: activeCourse.videoUrl,
        duration: Number(activeCourse.duration || 0),
        sourceLabel: tt("Kursvideo", "Course video"),
      });
    }

    (Array.isArray(activeCourse.resources)
      ? activeCourse.resources
      : []
    ).forEach((resource, index) => {
      if (!resource.url) return;
      pushOption({
        id:
          normalizeMediaAssetId(resource.mediaAssetId) ||
          `${String(activeCourse.id)}-course-resource-${resource.id || index}`,
        mediaAssetId: normalizeMediaAssetId(resource.mediaAssetId) || undefined,
        mediaVersion: resource.mediaVersion
          ? normalizeMediaVersion(resource.mediaVersion, 1)
          : undefined,
        mediaUpdatedAt: resource.mediaUpdatedAt,
        mediaFingerprint:
          resource.mediaFingerprint || buildUrlMediaFingerprint(resource.url),
        title: resource.title || tt("Kursressurs", "Course resource"),
        type: mapLessonResourceType(resource.type, resource.url),
        url: resource.url,
        sourceLabel: tt("Media", "Media"),
      });
    });

    (Array.isArray(activeCourse.lessons) ? activeCourse.lessons : []).forEach(
      (lesson, lessonIndex) => {
        const lessonId = String(lesson.id || lessonIndex);
        if (lesson.videoUrl) {
          pushOption({
            id:
              normalizeMediaAssetId(lesson.linkedVideoAssetId) ||
              `${String(activeCourse.id)}-${lessonId}-video`,
            mediaAssetId:
              normalizeMediaAssetId(lesson.linkedVideoAssetId) || undefined,
            mediaVersion: lesson.linkedVideoAssetVersion
              ? normalizeMediaVersion(lesson.linkedVideoAssetVersion, 1)
              : undefined,
            mediaUpdatedAt: lesson.linkedVideoUpdatedAt,
            mediaFingerprint:
              lesson.linkedVideoFingerprint ||
              buildUrlMediaFingerprint(lesson.videoUrl),
            title:
              String(lesson.linkedVideoAssetName || "").trim() ||
              `${lesson.title || tt("Leksjon", "Lesson")} ${tt("video", "video")}`,
            type: "video",
            url: lesson.videoUrl,
            duration: Number(lesson.duration || 0),
            sourceLabel: tt("Leksjonsvideo", "Lesson video"),
          });
        }

        (Array.isArray(lesson.resources) ? lesson.resources : []).forEach(
          (resource, resourceIndex) => {
            if (!resource.url) return;
            pushOption({
              id:
                normalizeMediaAssetId(resource.mediaAssetId) ||
                `${String(activeCourse.id)}-${lessonId}-resource-${resource.id || resourceIndex}`,
              mediaAssetId:
                normalizeMediaAssetId(resource.mediaAssetId) || undefined,
              mediaVersion: resource.mediaVersion
                ? normalizeMediaVersion(resource.mediaVersion, 1)
                : undefined,
              mediaUpdatedAt: resource.mediaUpdatedAt,
              mediaFingerprint:
                resource.mediaFingerprint ||
                buildUrlMediaFingerprint(resource.url),
              title: resource.title || tt("Leksjonsressurs", "Lesson resource"),
              type: mapLessonResourceType(resource.type, resource.url),
              url: resource.url,
              duration:
                resource.type === "video"
                  ? Number(lesson.duration || 0)
                  : undefined,
              sourceLabel: tt("Media", "Media"),
            });
          },
        );
      },
    );

    return options;
  }, [activeCourse, tt]);

  const mediaResourceByUrl = useMemo(
    () => new Map(mediaResourceOptions.map((item) => [item.url, item])),
    [mediaResourceOptions],
  );

  const mediaResourceById = useMemo(
    () => new Map(mediaResourceOptions.map((item) => [item.id, item])),
    [mediaResourceOptions],
  );

  const filteredMediaResourceOptions = useMemo(() => {
    const query = resourcePickerSearchValue.trim().toLowerCase();
    if (!query) return mediaResourceOptions;
    return mediaResourceOptions.filter((item) => {
      const haystack =
        `${item.title} ${item.type} ${item.sourceLabel}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [mediaResourceOptions, resourcePickerSearchValue]);

  const thumbnailOptions = useMemo(() => {
    const options: Array<{ id: string; label: string; url: string }> = [];
    const seen = new Set<string>();
    const pushOption = (
      id: string,
      label: string,
      url: string | undefined | null,
    ) => {
      if (!url || seen.has(url)) return;
      seen.add(url);
      options.push({ id, label, url });
    };

    if (activeCourse?.thumbnail) {
      pushOption(
        "course-thumb",
        tt("Kursthumbnail", "Course thumbnail"),
        activeCourse.thumbnail,
      );
    }

    resourceItems
      .filter((resource) => resource.type === "image")
      .forEach((resource) => {
        pushOption(resource.id, resource.title, resource.url);
      });

    (activeCourse?.resources || [])
      .filter((resource) => resource.type === "image")
      .forEach((resource, index) => {
        pushOption(
          `course-resource-${resource.id || index}`,
          resource.title || tt("Kursbilde", "Course image"),
          resource.url,
        );
      });

    return options;
  }, [activeCourse?.resources, activeCourse?.thumbnail, resourceItems, tt]);

  useEffect(() => {
    if (!selectedCourseId && activeCourse?.id) {
      setSelectedCourseId(String(activeCourse.id));
    }
  }, [activeCourse?.id, selectedCourseId]);

  useEffect(() => {
    if (selectedCourseValue && selectedCourseId !== selectedCourseValue) {
      setSelectedCourseId(selectedCourseValue);
    }
  }, [selectedCourseId, selectedCourseValue]);

  useEffect(() => {
    setLessonTitle(String(activeLesson?.title || ""));
    const nextInstructorId = String(
      activeLesson?.videoInstructorId ||
        activeCourse?.competencyLeadInstructorId ||
        activeCourse?.instructor?.id ||
        instructorItems[0]?.id ||
        "",
    ).trim();
    setSelectedLessonInstructorId(nextInstructorId);
    const lessonObjectives = buildSummaryFromDescription(
      String(activeLesson?.description || ""),
    );
    if (curriculumLearningOutcomes.length > 0) {
      const normalizedLessonObjectives = new Set(
        lessonObjectives
          .map((value) => value.trim().toLowerCase())
          .filter(Boolean),
      );
      const linkedFromCurriculum = curriculumLearningOutcomes.filter((value) =>
        normalizedLessonObjectives.has(value.trim().toLowerCase()),
      );
      setSummaryPoints(linkedFromCurriculum);
    } else {
      setSummaryPoints(lessonObjectives);
    }
    setChapterItems(lessonToChapterList(activeLesson));
    setResourceItems(lessonToResourceList(activeLesson));
    setEngagementItems([]);
    setReplyDraftByEntryId({});
    setNewEngagementText("");
    setNewEngagementType("question");
    setNewEngagementTimestamp(0);
    const firstImageResource = (activeLesson?.resources || []).find(
      (resource) => resource.type === "image" && Boolean(resource.url),
    );
    const storedThumbnail =
      typeof activeLesson?.thumbnail === "string" &&
      activeLesson.thumbnail.trim().length > 0
        ? activeLesson.thumbnail
        : firstImageResource?.url || activeCourse?.thumbnail || "";
    setLessonThumbnailUrl(storedThumbnail);
    setLessonThumbnailZoom(
      typeof activeLesson?.thumbnailZoom === "number" &&
        Number.isFinite(activeLesson.thumbnailZoom)
        ? normalizeZoom(activeLesson.thumbnailZoom)
        : 100,
    );
    setLessonThumbnailFocalX(
      typeof activeLesson?.thumbnailFocalX === "number" &&
        Number.isFinite(activeLesson.thumbnailFocalX)
        ? normalizeFocal(activeLesson.thumbnailFocalX)
        : 50,
    );
    setLessonThumbnailFocalY(
      typeof activeLesson?.thumbnailFocalY === "number" &&
        Number.isFinite(activeLesson.thumbnailFocalY)
        ? normalizeFocal(activeLesson.thumbnailFocalY)
        : 50,
    );
  }, [
    activeCourse?.competencyLeadInstructorId,
    activeCourse?.instructor?.id,
    activeCourse?.thumbnail,
    activeLesson,
    curriculumLearningOutcomes,
    instructorItems,
    tt,
  ]);

  useEffect(() => {
    setResourceItems((current) => {
      if (current.length === 0) return current;

      const synced: LessonResourceItem[] = current.reduce<LessonResourceItem[]>(
        (acc, resource) => {
          const mediaMatch = mediaResourceByUrl.get(resource.url);
          if (!mediaMatch) return acc;

          acc.push({
            id: mediaMatch.id,
            mediaAssetId: mediaMatch.mediaAssetId || mediaMatch.id,
            title: mediaMatch.title,
            type: mediaMatch.type,
            url: mediaMatch.url,
            duration: mediaMatch.duration ?? resource.duration,
            mediaVersion: mediaMatch.mediaVersion ?? resource.mediaVersion,
            mediaUpdatedAt:
              mediaMatch.mediaUpdatedAt ?? resource.mediaUpdatedAt,
            mediaFingerprint:
              mediaMatch.mediaFingerprint ?? resource.mediaFingerprint,
          });
          return acc;
        },
        [],
      );

      if (resourceListsEqual(current, synced)) {
        return current;
      }

      return synced;
    });
  }, [mediaResourceByUrl]);

  useEffect(() => {
    analytics.trackEvent("academy_lesson_studio_opened", {
      courseId: activeCourse?.id || null,
      lessonId: activeLesson?.id || null,
      chapterCount: chapterItems.length,
      timestamp: Date.now(),
    });

    debugging.logIntegration("info", "AcademyLessonStudio opened", {
      courseId: activeCourse?.id || null,
      lessonId: activeLesson?.id || null,
      chapterCount: chapterItems.length,
    });
  }, [
    activeCourse?.id,
    activeLesson?.id,
    analytics,
    chapterItems.length,
    debugging,
  ]);

  useEffect(() => {
    if (!isPlaying) return;

    const timer = window.setInterval(() => {
      setCurrentTime((prev) => {
        const next = prev + 1;
        if (next >= duration) {
          return 0;
        }
        return next;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [duration, isPlaying]);

  const addChapter = useCallback(() => {
    setChapterItems((prev) => {
      const id = `chapter-${Date.now()}`;
      return [
        ...prev,
        {
          id,
          title: `New Chapter ${prev.length + 1}`,
          duration: 120,
          type: "video",
        },
      ];
    });
  }, []);

  const updateChapter = useCallback((chapterId: string, title: string) => {
    setChapterItems((prev) =>
      prev.map((chapter) => {
        if (chapter.id !== chapterId) return chapter;
        return { ...chapter, title };
      }),
    );
  }, []);

  const toggleLinkedLearningOutcome = useCallback((outcome: string) => {
    setSummaryPoints((current) =>
      current.includes(outcome)
        ? current.filter((entry) => entry !== outcome)
        : [...current, outcome],
    );
  }, []);

  const useCurrentPlaybackTimestamp = useCallback(() => {
    setNewEngagementTimestamp(normalizeTimestamp(currentTime, duration));
  }, [currentTime, duration]);

  const addEngagementEntry = useCallback(() => {
    const trimmed = newEngagementText.trim();
    if (!trimmed) {
      setSaveMessage(
        tt(
          "Skriv inn en kommentar eller et spørsmål først.",
          "Write a comment or question first.",
        ),
      );
      return;
    }

    const entryTimestamp = normalizeTimestamp(newEngagementTimestamp, duration);
    const nextEntry: EngagementEntry = {
      id: `engagement-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      type: newEngagementType,
      author: tt("Deg", "You"),
      text: trimmed,
      timestamp: entryTimestamp,
      createdAt: new Date().toISOString(),
      replies: [],
    };

    setEngagementItems((current) => [nextEntry, ...current]);
    setNewEngagementText("");
    setSaveMessage(
      newEngagementType === "question"
        ? tt(
            "Spørsmål lagt til med timestamp.",
            "Question added with timestamp.",
          )
        : tt(
            "Kommentar lagt til med timestamp.",
            "Comment added with timestamp.",
          ),
    );

    analytics.trackEvent("academy_lesson_engagement_entry_added", {
      type: newEngagementType,
      timestamp: entryTimestamp,
      courseId: activeCourse?.id || null,
      lessonId: activeLesson?.id || null,
      createdAt: Date.now(),
    });
  }, [
    activeCourse?.id,
    activeLesson?.id,
    analytics,
    duration,
    newEngagementText,
    newEngagementTimestamp,
    newEngagementType,
    tt,
  ]);

  const addReplyToEngagementEntry = useCallback(
    (entryId: string) => {
      const draft = (replyDraftByEntryId[entryId] || "").trim();
      if (!draft) return;

      const reply: EngagementReply = {
        id: `reply-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        author: tt("Deg", "You"),
        text: draft,
        createdAt: new Date().toISOString(),
      };

      setEngagementItems((current) =>
        current.map((entry) =>
          entry.id === entryId
            ? {
                ...entry,
                replies: [...entry.replies, reply],
              }
            : entry,
        ),
      );
      setReplyDraftByEntryId((current) => ({
        ...current,
        [entryId]: "",
      }));

      analytics.trackEvent("academy_lesson_engagement_reply_added", {
        entryId,
        courseId: activeCourse?.id || null,
        lessonId: activeLesson?.id || null,
        createdAt: Date.now(),
      });
    },
    [activeCourse?.id, activeLesson?.id, analytics, replyDraftByEntryId, tt],
  );

  const openResourcePicker = useCallback(() => {
    const currentlySelectedIds = resourceItems
      .map(
        (resource) =>
          mediaResourceByUrl.get(resource.url)?.id || resource.mediaAssetId,
      )
      .filter((id): id is string => Boolean(id));
    setResourcePickerSelection(Array.from(new Set(currentlySelectedIds)));
    setResourcePickerSearchValue("");
    setResourcePickerOpen(true);
  }, [mediaResourceByUrl, resourceItems]);

  const closeResourcePicker = useCallback(() => {
    setResourcePickerOpen(false);
    setResourcePickerSearchValue("");
  }, []);

  const toggleResourcePickerSelection = useCallback((id: string) => {
    setResourcePickerSelection((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
  }, []);

  const applyResourcePickerSelection = useCallback(() => {
    const nextResources = resourcePickerSelection
      .map((id) => mediaResourceById.get(id))
      .filter((item): item is MediaResourceOption => Boolean(item))
      .map(
        (item) =>
          ({
            id: item.id,
            mediaAssetId: item.mediaAssetId || item.id,
            title: item.title,
            type: item.type,
            url: item.url,
            duration: item.duration,
            mediaVersion: item.mediaVersion,
            mediaUpdatedAt: item.mediaUpdatedAt,
            mediaFingerprint: item.mediaFingerprint,
          }) satisfies LessonResourceItem,
      );

    setResourceItems(nextResources);
    setSaveMessage(
      nextResources.length === 0
        ? tt("Ingen ressurser valgt.", "No resources selected.")
        : tt(
            `${nextResources.length} ressurs(er) synkronisert fra Media.`,
            `${nextResources.length} resource(s) synced from Media.`,
          ),
    );

    analytics.trackEvent("academy_lesson_resources_added", {
      count: nextResources.length,
      lessonId: activeLesson?.id || null,
      courseId: activeCourse?.id || null,
      source: "media-library",
      timestamp: Date.now(),
    });

    closeResourcePicker();
  }, [
    activeCourse?.id,
    activeLesson?.id,
    analytics,
    closeResourcePicker,
    mediaResourceById,
    resourcePickerSelection,
    tt,
  ]);

  const bindVideoFromMediaToTarget = useCallback(
    async (mediaResourceId: string, target: "skill" | "course") => {
      const selectedMedia = mediaResourceById.get(mediaResourceId);
      if (!selectedMedia || selectedMedia.type !== "video") {
        setSaveMessage(
          tt("Velg en videoressurs først.", "Select a video resource first."),
        );
        return;
      }

      if (
        !activeCourse?.id ||
        !Array.isArray(state.courses) ||
        !state.courses.some(
          (course) => String(course.id) === String(activeCourse.id),
        )
      ) {
        setSaveMessage(
          tt(
            "Fant ikke aktivt kurs for videokobling.",
            "Could not find active course for video linking.",
          ),
        );
        return;
      }

      const detectedDuration = await probeVideoDurationSeconds(selectedMedia.url);
      const resolvedDuration =
        (Number.isFinite(Number(detectedDuration)) && Number(detectedDuration) > 0
          ? Number(detectedDuration)
          : Number.isFinite(Number(selectedMedia.duration)) && Number(selectedMedia.duration) > 0
            ? Number(selectedMedia.duration)
            : null) ?? null;
      const mediaAssetId =
        normalizeMediaAssetId(selectedMedia.mediaAssetId) ||
        normalizeMediaAssetId(selectedMedia.id);
      const mediaVersion = normalizeMediaVersion(selectedMedia.mediaVersion, 1);
      const mediaFingerprint =
        String(selectedMedia.mediaFingerprint || "").trim() ||
        buildUrlMediaFingerprint(selectedMedia.url);

      const nowIso = new Date().toISOString();

      try {
        if (target === "course") {
          const nextCourse: Course = {
            ...activeCourse,
            videoUrl: selectedMedia.url,
            linkedVideoAssetId: mediaAssetId || undefined,
            linkedVideoAssetVersion: mediaVersion,
            linkedVideoAssetName: selectedMedia.title,
            linkedVideoUpdatedAt: nowIso,
            linkedVideoFingerprint: mediaFingerprint,
            duration: resolvedDuration || activeCourse.duration,
            updatedAt: nowIso,
          };
          await updateCourse(nextCourse);
          setCurrentCourse(nextCourse);
          setSaveMessage(
            tt("Video koblet til kurs.", "Video linked to course."),
          );
          analytics.trackEvent("academy_video_binding_updated", {
            scope: "course",
            courseId: activeCourse.id,
            lessonId: activeLesson?.id || null,
            videoUrl: selectedMedia.url,
            timestamp: Date.now(),
          });
          return;
        }

        if (!activeLesson?.id) {
          setSaveMessage(
            tt("Velg en ferdighet først.", "Select a skill first."),
          );
          return;
        }

        const currentLessons = Array.isArray(activeCourse.lessons)
          ? activeCourse.lessons
          : [];
        const nextLessons = currentLessons.map((lesson) => {
          if (String(lesson.id) !== String(activeLesson.id)) return lesson;
          return {
            ...lesson,
            videoUrl: selectedMedia.url,
            linkedVideoAssetId: mediaAssetId || undefined,
            linkedVideoAssetVersion: mediaVersion,
            linkedVideoAssetName: selectedMedia.title,
            linkedVideoUpdatedAt: nowIso,
            linkedVideoFingerprint: mediaFingerprint,
            duration: resolvedDuration || lesson.duration,
          };
        });

        const nextCourse: Course = {
          ...activeCourse,
          lessons: nextLessons,
          updatedAt: nowIso,
        };

        await updateCourse(nextCourse);
        setCurrentCourse(nextCourse);

        const nextLesson =
          nextLessons.find(
            (lesson) => String(lesson.id) === String(activeLesson.id),
          ) || null;
        if (nextLesson) {
          setCurrentLesson(nextLesson);
        }

        setSaveMessage(
          tt("Video koblet til ferdighet.", "Video linked to skill."),
        );
        analytics.trackEvent("academy_video_binding_updated", {
          scope: "skill",
          courseId: activeCourse.id,
          lessonId: activeLesson.id,
          videoUrl: selectedMedia.url,
          timestamp: Date.now(),
        });
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : tt(
                "Kunne ikke koble video akkurat nå.",
                "Could not link video right now.",
              );
        setSaveMessage(message);
        debugging.logIntegration(
          "error",
          "Failed to bind media video in lesson studio",
          {
            message,
            target,
            mediaResourceId,
            courseId: activeCourse.id,
            lessonId: activeLesson?.id || null,
          },
        );
      }
    },
    [
      activeCourse,
      activeLesson?.id,
      analytics,
      debugging,
      mediaResourceById,
      setCurrentCourse,
      setCurrentLesson,
      state.courses,
      tt,
      updateCourse,
    ],
  );

  const syncLessonThumbnailPatch = useCallback(
    async (
      patch: Partial<
        Pick<
          Lesson,
          "thumbnail" | "thumbnailZoom" | "thumbnailFocalX" | "thumbnailFocalY"
        >
      >,
    ) => {
      if (
        !activeCourse?.id ||
        !activeLesson?.id ||
        !Array.isArray(state.courses) ||
        !state.courses.some(
          (course) => String(course.id) === String(activeCourse.id),
        )
      ) {
        return;
      }

      const currentLessons = Array.isArray(activeCourse.lessons)
        ? activeCourse.lessons
        : [];
      const nextLessons = currentLessons.map((lesson) =>
        String(lesson.id) === String(activeLesson.id)
          ? { ...lesson, ...patch }
          : lesson,
      );

      await updateCourse({
        ...activeCourse,
        lessons: nextLessons,
        updatedAt: new Date().toISOString(),
      });
    },
    [activeCourse, activeLesson?.id, state.courses, updateCourse],
  );

  const openThumbnailMenu = useCallback(
    (event: React.MouseEvent<HTMLElement>) => {
      setThumbnailMenuAnchorEl(event.currentTarget);
    },
    [],
  );

  const closeThumbnailMenu = useCallback(() => {
    setThumbnailMenuAnchorEl(null);
  }, []);

  const setThumbnailFromVideo = useCallback(() => {
    const fallback = activeCourse?.thumbnail || lessonThumbnailUrl;
    if (fallback) {
      setLessonThumbnailUrl(fallback);
      void syncLessonThumbnailPatch({ thumbnail: fallback || undefined });
      setSaveMessage(
        tt(
          "Thumbnail satt fra video/kurs.",
          "Thumbnail set from video/course.",
        ),
      );
    } else {
      setSaveMessage(
        tt(
          "Ingen videothumbnail tilgjengelig ennå.",
          "No video thumbnail available yet.",
        ),
      );
    }
    setThumbnailMenuAnchorEl(null);
  }, [
    activeCourse?.thumbnail,
    lessonThumbnailUrl,
    syncLessonThumbnailPatch,
    tt,
  ]);

  const setThumbnailFromMedia = useCallback(
    (url: string) => {
      setLessonThumbnailUrl(url);
      void syncLessonThumbnailPatch({ thumbnail: url || undefined });
      setThumbnailMenuAnchorEl(null);
    },
    [syncLessonThumbnailPatch],
  );

  const pickThumbnailFile = useCallback(() => {
    thumbnailInputRef.current?.click();
    setThumbnailMenuAnchorEl(null);
  }, []);

  const handleThumbnailInputChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;
      const objectUrl = URL.createObjectURL(file);
      setLessonThumbnailUrl(objectUrl);
      void syncLessonThumbnailPatch({ thumbnail: objectUrl });
      setResourceItems((prev) => [
        ...prev,
        {
          id: `thumbnail-file-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          title: file.name,
          type: "image",
          url: objectUrl,
        },
      ]);
      setSaveMessage(
        tt("Thumbnail oppdatert for leksjonen.", "Lesson thumbnail updated."),
      );
      event.target.value = "";
    },
    [syncLessonThumbnailPatch, tt],
  );

  const handleThumbnailZoomCommitted = useCallback(
    (
      _event: Event | React.SyntheticEvent<Element, Event>,
      value: number | number[],
    ) => {
      const next = normalizeZoom(Array.isArray(value) ? value[0] : value);
      setLessonThumbnailZoom(next);
      void syncLessonThumbnailPatch({ thumbnailZoom: next });
    },
    [syncLessonThumbnailPatch],
  );

  const handleThumbnailFocalXCommitted = useCallback(
    (
      _event: Event | React.SyntheticEvent<Element, Event>,
      value: number | number[],
    ) => {
      const next = normalizeFocal(Array.isArray(value) ? value[0] : value);
      setLessonThumbnailFocalX(next);
      void syncLessonThumbnailPatch({ thumbnailFocalX: next });
    },
    [syncLessonThumbnailPatch],
  );

  const handleThumbnailFocalYCommitted = useCallback(
    (
      _event: Event | React.SyntheticEvent<Element, Event>,
      value: number | number[],
    ) => {
      const next = normalizeFocal(Array.isArray(value) ? value[0] : value);
      setLessonThumbnailFocalY(next);
      void syncLessonThumbnailPatch({ thumbnailFocalY: next });
    },
    [syncLessonThumbnailPatch],
  );

  const resetThumbnailCrop = useCallback(() => {
    setLessonThumbnailZoom(100);
    setLessonThumbnailFocalX(50);
    setLessonThumbnailFocalY(50);
    void syncLessonThumbnailPatch({
      thumbnailZoom: 100,
      thumbnailFocalX: 50,
      thumbnailFocalY: 50,
    });
  }, [syncLessonThumbnailPatch]);

  const saveLesson = useCallback(
    async (publish: boolean) => {
      if (!activeCourse?.id) {
        setSaveMessage(
          tt(
            "Velg et kurs før du lagrer leksjonen.",
            "Select a course before saving the lesson.",
          ),
        );
        return;
      }

      const selectedObjectives =
        curriculumLearningOutcomes.length > 0
          ? summaryPoints.filter((point) =>
              curriculumLearningOutcomes.includes(point),
            )
          : summaryPoints;
      const lessonDescription = selectedObjectives
        .map((point) => `• ${point}`)
        .join("\n");
      const lessonResources: LessonResource[] = resourceItems.map(
        (resource) => ({
          id: resource.id,
          title: resource.title,
          type: resource.type,
          url: resource.url,
          description: resource.title,
          mediaAssetId: resource.mediaAssetId,
          mediaVersion: resource.mediaVersion,
          mediaUpdatedAt: resource.mediaUpdatedAt,
          mediaFingerprint: resource.mediaFingerprint,
        }),
      );
      const normalizedThumbnailUrl = lessonThumbnailUrl.trim();
      const normalizedThumbnailZoom = normalizeZoom(lessonThumbnailZoom);
      const normalizedThumbnailFocalX = normalizeFocal(lessonThumbnailFocalX);
      const normalizedThumbnailFocalY = normalizeFocal(lessonThumbnailFocalY);
      const lessonInstructorId = String(
        selectedLessonInstructorId ||
          activeLesson?.videoInstructorId ||
          activeCourse?.competencyLeadInstructorId ||
          activeCourse?.instructor?.id ||
          "",
      ).trim();
      const lessonResourcesWithThumbnail = [...lessonResources];
      if (
        normalizedThumbnailUrl &&
        !lessonResourcesWithThumbnail.some(
          (resource) =>
            resource.type === "image" &&
            resource.url === normalizedThumbnailUrl,
        )
      ) {
        lessonResourcesWithThumbnail.unshift({
          id: `lesson-thumbnail-${activeLesson?.id || Date.now()}`,
          title: `${lessonTitle || "Lesson"} thumbnail`,
          type: "image",
          url: normalizedThumbnailUrl,
          description: tt("Leksjons-thumbnail", "Lesson thumbnail"),
        });
      }

      const lessonDraft: Lesson = {
        id: String(activeLesson?.id || `lesson-${Date.now()}`),
        courseId: String(activeCourse.id),
        title: lessonTitle || "Untitled Lesson",
        description: lessonDescription,
        videoUrl:
          activeLesson?.videoUrl || activeCourse?.videoUrl || VIDEO_PLACEHOLDER,
        linkedVideoAssetId: activeLesson?.linkedVideoAssetId,
        linkedVideoAssetVersion: activeLesson?.linkedVideoAssetVersion,
        linkedVideoAssetName: activeLesson?.linkedVideoAssetName,
        linkedVideoUpdatedAt: activeLesson?.linkedVideoUpdatedAt,
        linkedVideoFingerprint:
          activeLesson?.linkedVideoFingerprint ||
          buildUrlMediaFingerprint(activeLesson?.videoUrl),
        videoInstructorId: lessonInstructorId || undefined,
        thumbnail: normalizedThumbnailUrl || undefined,
        thumbnailZoom: normalizedThumbnailZoom,
        thumbnailFocalX: normalizedThumbnailFocalX,
        thumbnailFocalY: normalizedThumbnailFocalY,
        duration,
        order: Number(activeLesson?.order || 1),
        isPreview: Boolean(activeLesson?.isPreview),
        resources: lessonResourcesWithThumbnail,
      };

      const currentLessons =
        Array.isArray(activeCourse.lessons) && activeCourse.lessons.length > 0
          ? activeCourse.lessons
          : [lessonDraft];

      const hasActive = currentLessons.some(
        (lesson) => String(lesson.id) === String(lessonDraft.id),
      );
      const nextLessons = hasActive
        ? currentLessons.map((lesson) => {
            if (String(lesson.id) !== String(lessonDraft.id)) return lesson;
            return {
              ...lesson,
              title: lessonTitle || "Untitled Lesson",
              description: lessonDescription,
              linkedVideoAssetId:
                activeLesson?.linkedVideoAssetId || lesson.linkedVideoAssetId,
              linkedVideoAssetVersion:
                activeLesson?.linkedVideoAssetVersion ||
                lesson.linkedVideoAssetVersion,
              linkedVideoAssetName:
                activeLesson?.linkedVideoAssetName || lesson.linkedVideoAssetName,
              linkedVideoUpdatedAt:
                activeLesson?.linkedVideoUpdatedAt || lesson.linkedVideoUpdatedAt,
              linkedVideoFingerprint:
                activeLesson?.linkedVideoFingerprint ||
                lesson.linkedVideoFingerprint ||
                buildUrlMediaFingerprint(activeLesson?.videoUrl || lesson.videoUrl),
              videoInstructorId: lessonInstructorId || undefined,
              thumbnail: normalizedThumbnailUrl || undefined,
              thumbnailZoom: normalizedThumbnailZoom,
              thumbnailFocalX: normalizedThumbnailFocalX,
              thumbnailFocalY: normalizedThumbnailFocalY,
              duration,
              resources: lessonResourcesWithThumbnail,
            };
          })
        : [...currentLessons, lessonDraft];

      const payload = {
        id: activeCourse.id,
        lessonId: lessonDraft.id,
        title: lessonTitle,
        description: lessonDescription,
        chapters: chapterItems,
        thumbnail: normalizedThumbnailUrl || null,
        thumbnailZoom: normalizedThumbnailZoom,
        thumbnailFocalX: normalizedThumbnailFocalX,
        thumbnailFocalY: normalizedThumbnailFocalY,
        videoInstructorId: lessonInstructorId || null,
        resources: lessonResourcesWithThumbnail,
        publish,
        updatedAt: new Date().toISOString(),
      };

      try {
        if (
          activeCourse?.id &&
          state.courses.some(
            (course) => String(course.id) === String(activeCourse.id),
          )
        ) {
          await updateCourse({
            ...activeCourse,
            lessons: nextLessons,
            isPublished: publish ? true : activeCourse.isPublished,
            updatedAt: new Date().toISOString(),
          });
        }

        onSave?.(payload);
        setSaveMessage(
          publish
            ? tt("Leksjon publisert.", "Lesson published.")
            : tt("Leksjon lagret.", "Lesson saved."),
        );

        analytics.trackEvent(
          publish ? "academy_lesson_publish" : "academy_lesson_save",
          {
            courseId: activeCourse?.id || null,
            lessonId: lessonDraft.id,
            instructorId: lessonInstructorId || null,
            chapterCount: chapterItems.length,
            resourceCount: lessonResourcesWithThumbnail.length,
            timestamp: Date.now(),
          },
        );
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : tt("Kunne ikke lagre leksjon.", "Failed to save lesson.");
        setSaveMessage(message);
        debugging.logIntegration("error", "Academy lesson save failed", {
          message,
          courseId: activeCourse?.id || null,
          lessonId: lessonDraft.id,
        });
      }
    },
    [
      activeCourse,
      activeLesson?.id,
      activeLesson?.isPreview,
      activeLesson?.order,
      activeLesson?.videoInstructorId,
      activeLesson?.videoUrl,
      activeCourse?.competencyLeadInstructorId,
      activeCourse?.videoUrl,
      analytics,
      chapterItems,
      debugging,
      curriculumLearningOutcomes,
      duration,
      lessonTitle,
      lessonThumbnailUrl,
      lessonThumbnailZoom,
      lessonThumbnailFocalX,
      lessonThumbnailFocalY,
      onSave,
      resourceItems,
      selectedLessonInstructorId,
      state.courses,
      summaryPoints,
      tt,
      updateCourse,
    ],
  );

  const renderResourceIcon = useCallback((type: LessonResourceItem["type"]) => {
    if (type === "pdf")
      return <Description sx={{ fontSize: 18, color: "#f8d56f" }} />;
    if (type === "image")
      return <ImageIcon sx={{ fontSize: 18, color: "#8ec6ff" }} />;
    if (type === "audio")
      return <MusicNote sx={{ fontSize: 18, color: "#93d6b3" }} />;
    if (type === "link")
      return <LinkIcon sx={{ fontSize: 18, color: "#9db4ff" }} />;
    return <VideoLibrary sx={{ fontSize: 18, color: "#8ec6ff" }} />;
  }, []);

  const handleLessonQuickAction = useCallback(
    (action: "player" | "lower-thirds" | "cta-overlay") => {
      if (action === "player") {
        setLocation("/academy/player-studio");
      } else if (action === "lower-thirds") {
        setLocation("/academy/lower-thirds");
      } else if (action === "cta-overlay") {
        const query = new URLSearchParams();
        if (activeCourse?.id) query.set("courseId", String(activeCourse.id));
        if (activeLesson?.id) query.set("lessonId", String(activeLesson.id));
        const suffix = query.toString();
        setLocation(
          suffix ? `/academy/cta-overlay?${suffix}` : "/academy/cta-overlay",
        );
      }

      analytics.trackEvent("academy_lesson_quick_action_clicked", {
        action,
        courseId: activeCourse?.id || null,
        lessonId: activeLesson?.id || null,
        timestamp: Date.now(),
      });
    },
    [activeCourse?.id, activeLesson?.id, analytics, setLocation],
  );

  const courseBuilderSkillsRoute = useMemo(() => {
    const query = new URLSearchParams();
    if (activeCourse?.id) query.set("courseId", String(activeCourse.id));
    if (activeLesson?.id) {
      query.set("lessonId", String(activeLesson.id));
      query.set("skillId", String(activeLesson.id));
    }
    const suffix = query.toString();
    return suffix
      ? `/academy/course-creator?${suffix}`
      : "/academy/course-creator";
  }, [activeCourse?.id, activeLesson?.id]);

  const goToCourseBuilderSkills = useCallback(() => {
    setLocation(courseBuilderSkillsRoute);
  }, [courseBuilderSkillsRoute, setLocation]);

  return (
    <Box
      sx={{
        minHeight: "100vh",
        color: "#edf0f7",
        bgcolor: "#06080d",
        fontFamily: '"Manrope", "Barlow", "Segoe UI", sans-serif',
        position: "relative",
        overflow: "hidden",
      }}
    >
      <Box
        sx={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          background:
            "radial-gradient(circle at 74% 12%, rgba(248,179,33,0.24), rgba(5,8,13,0) 42%), radial-gradient(circle at 16% 74%, rgba(82,121,204,0.14), rgba(6,8,14,0) 44%), linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0) 32%)",
        }}
      />

      <Box
        sx={{
          display: "flex",
          flexDirection: { xs: "column", lg: "row" },
          minHeight: "100vh",
          position: "relative",
          zIndex: 1,
          width: "min(100%, var(--academy-shell-max-width, 1920px))",
          mx: "auto",
        }}
      >
        <AcademyLeftSidebar
          activeNav={leftNav}
          onNavigate={(navId, route) => {
            setLeftNav(navId);
            setLocation(route);
          }}
          onCreateCourse={() => {
            setLeftNav("curriculum");
            setLocation("/academy/curriculum?createCompetency=1");
          }}
          tt={tt}
          navLabel={navLabel}
          currentLessonLabel={
            lessonTitle || tt("Leksjon uten tittel", "Untitled lesson")
          }
          bottomAction={{
            label: tt("Nytt kapittel", "New Chapter"),
            onClick: addChapter,
          }}
        />

        <Box
          sx={{
            flex: 1,
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <Box
            sx={{
              height: 74,
              px: 3,
              borderBottom:
                "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.08)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              background:
                "linear-gradient(180deg, rgba(13,16,25,0.95), rgba(10,13,20,0.9))",
            }}
          >
            <Stack direction="row" spacing={2} alignItems="center">
              <Typography
                sx={{
                  letterSpacing: "0.16em",
                  fontSize: 15,
                  color: "rgba(237,240,247,0.82)",
                }}
              >
                ACADEMY
              </Typography>
              <Chip
                label={tt("Leksjonsstudio", "Lesson Studio")}
                size="small"
                sx={{
                  bgcolor: "rgba(255,255,255,0.08)",
                  color: "#edf0f7",
                  fontWeight: 700,
                  border:
                    "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.14)",
                }}
              />
              <Chip
                label={
                  activeCourse?.isPublished
                    ? tt("Publisert", "Published")
                    : tt("Utkast", "Draft")
                }
                size="small"
                sx={{
                  bgcolor: "rgba(255,255,255,0.08)",
                  color: "#edf0f7",
                  fontWeight: 600,
                }}
              />
            </Stack>

            <Stack direction="row" spacing={1.2} alignItems="center">
              <AcademyLocaleSwitcher />
              <IconButton
                size="small"
                onClick={() =>
                  setLocation("/academy/settings?tab=notifications")
                }
                aria-label={tt("Varsler", "Notifications")}
                sx={{ color: "rgba(237,240,247,0.75)" }}
              >
                <NotificationsNone fontSize="small" />
              </IconButton>
              <IconButton
                size="small"
                onClick={() => setLocation("/academy/settings?tab=messages")}
                aria-label={tt("Meldinger", "Messages")}
                sx={{ color: "rgba(237,240,247,0.75)" }}
              >
                <MailOutline fontSize="small" />
              </IconButton>
              <IconButton
                size="small"
                onClick={() => setLocation("/academy/settings?tab=profile")}
                aria-label={tt("Profil", "Profile")}
                sx={{ p: 0 }}
              >
                <Avatar
                  sx={{
                    width: 34,
                    height: 34,
                    bgcolor: "#f8b321",
                    color: "#111",
                  }}
                >
                  {String(activeCourse?.instructor?.name || "N")
                    .charAt(0)
                    .toUpperCase()}
                </Avatar>
              </IconButton>
            </Stack>
          </Box>

          <Box
            sx={{
              flex: 1,
              minHeight: 0,
              display: "grid",
              gridTemplateColumns: {
                xs: "1fr",
                lg: "minmax(0, 1fr) var(--academy-right-panel-width, 390px)",
              },
              gap: 2,
              px: 2,
              py: 2,
            }}
          >
            <Box
              sx={{
                minHeight: 0,
                display: "flex",
                flexDirection: "column",
                gap: 1.4,
              }}
            >
              <Stack
                direction={{ xs: "column", lg: "row" }}
                spacing={1.2}
                justifyContent="space-between"
                alignItems={{ xs: "stretch", lg: "center" }}
              >
                <Stack
                  direction="row"
                  spacing={1.2}
                  alignItems="center"
                  flexWrap="wrap"
                  useFlexGap
                >
                  <Typography
                    sx={{
                      fontSize: "clamp(1.5rem, 1.15rem + 1vw, 2.1rem)",
                      fontWeight: 600,
                      letterSpacing: "0.02em",
                    }}
                  >
                    {tt("Leksjonsstudio", "Lesson Studio")}
                  </Typography>
                  <Select
                    size="small"
                    value={selectedCourseValue}
                    onChange={(event) => {
                      const nextCourseId = String(event.target.value);
                      setSelectedCourseId(nextCourseId);
                      syncCourseIdInRoute(nextCourseId);
                    }}
                    sx={{
                      minWidth: 200,
                      color: "#edf0f7",
                      bgcolor: "rgba(255,255,255,0.05)",
                      "& .MuiOutlinedInput-notchedOutline": {
                        borderColor: "rgba(255,255,255,0.14)",
                      },
                    }}
                  >
                    {courseItems.map((course) => (
                      <MenuItem key={course.id} value={course.id}>
                        {course.title}
                      </MenuItem>
                    ))}
                  </Select>
                </Stack>

                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  <Button
                    variant="outlined"
                    onClick={goToCourseBuilderSkills}
                    sx={{
                      textTransform: "none",
                      borderColor: "rgba(248,179,33,0.34)",
                      color: "#f8d56f",
                      borderRadius: 1,
                    }}
                  >
                    {tt("Til ferdighetsbygger", "Back to Skills Builder")}
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={<Save />}
                    onClick={() => void saveLesson(false)}
                    sx={{
                      textTransform: "none",
                      borderColor: "rgba(255,255,255,0.2)",
                      color: "#edf0f7",
                      borderRadius: 1,
                    }}
                  >
                    {tt("Lagre", "Save")}
                  </Button>
                </Stack>
              </Stack>

              <Box
                sx={{
                  ...cinematicPanelSx,
                  px: 1.1,
                  py: 0.9,
                  bgcolor: "rgba(10,14,22,0.84)",
                  borderColor: "rgba(255,255,255,0.12)",
                }}
              >
                <Typography
                  sx={{
                    fontSize: 13,
                    color: "rgba(237,240,247,0.76)",
                    lineHeight: 1.4,
                  }}
                >
                  {tt(
                    "Primærflyten er Ferdighetsbygger → Ferdigheter. Bruk denne siden for avansert redigering av valgt ferdighet.",
                    "Primary workflow is Skills Builder → Skills. Use this page for advanced editing of the selected skill.",
                  )}
                </Typography>
              </Box>

              {!!saveMessage && (
                <Typography
                  sx={{
                    px: 1.2,
                    py: 0.85,
                    borderRadius: 1,
                    border:
                      "var(--academy-hairline-width, 1px) solid rgba(248,179,33,0.34)",
                    color: "#f8d56f",
                    bgcolor: "rgba(248,179,33,0.08)",
                  }}
                >
                  {saveMessage}
                </Typography>
              )}

              <Box sx={{ ...cinematicPanelSx, p: 1.2 }}>
                <Stack
                  direction={{ xs: "column", md: "row" }}
                  spacing={1}
                  alignItems={{ xs: "stretch", md: "center" }}
                  justifyContent="space-between"
                  sx={{ mb: 1.2 }}
                >
                  <Stack direction="row" spacing={1} alignItems="center">
                    <DragIndicator sx={{ color: "#f8b321" }} />
                    <Typography sx={{ fontSize: 34, fontWeight: 600 }}>
                      {lessonTitle ||
                        tt("Leksjon uten tittel", "Untitled lesson")}
                    </Typography>
                  </Stack>

                  <Button
                    startIcon={<Add />}
                    onClick={addChapter}
                    sx={{
                      textTransform: "none",
                      color: "#0f0f0f",
                      background: "linear-gradient(180deg, #ffd44e, #f2a616)",
                      fontWeight: 700,
                    }}
                  >
                    {tt("Legg til kapittel", "Add Chapter")}
                  </Button>
                </Stack>

                <Box
                  sx={{
                    borderRadius: 1,
                    border:
                      "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.08)",
                    overflow: "hidden",
                    background:
                      "linear-gradient(145deg, rgba(18,22,32,0.96), rgba(10,13,20,0.95))",
                  }}
                >
                  <Box
                    sx={{
                      display: "grid",
                      gridTemplateColumns: {
                        xs: "1fr",
                        lg: "minmax(0, 1fr) 235px",
                      },
                      gap: 1,
                      p: 1,
                    }}
                  >
                    <AcademyPlayerStudio
                      src={
                        activeLesson?.videoUrl ||
                        activeCourse?.videoUrl ||
                        VIDEO_PLACEHOLDER
                      }
                      poster={
                        lessonThumbnailUrl ||
                        activeCourse?.thumbnail ||
                        undefined
                      }
                      posterZoom={lessonThumbnailZoom}
                      objectPosition={`${lessonThumbnailFocalX}% ${lessonThumbnailFocalY}%`}
                      muted
                      loop
                      containerSx={{
                        background:
                          "radial-gradient(circle at 72% 20%, rgba(248,179,33,0.18), rgba(10,13,20,0) 46%), linear-gradient(145deg, rgba(20,24,35,0.96), rgba(9,12,18,0.96))",
                      }}
                    >
                      <Box
                        sx={{
                          position: "absolute",
                          left: "50%",
                          top: "50%",
                          transform: "translate(-50%, -50%)",
                        }}
                      >
                        <IconButton
                          onClick={() => setIsPlaying((prev) => !prev)}
                          disableRipple
                          disableFocusRipple
                          sx={{
                            width: 84,
                            height: 84,
                            border: "2px solid rgba(255,255,255,0.45)",
                            color: "#f7f8fb",
                            bgcolor: "rgba(4,5,8,0.42)",
                            transition: "background-color 0.2s ease",
                            transform: "none !important",
                            "&:hover": {
                              bgcolor: "rgba(0,0,0,0.56)",
                              transform: "none !important",
                            },
                            "&:active": {
                              transform: "none !important",
                            },
                          }}
                        >
                          {isPlaying ? (
                            <Pause sx={{ fontSize: 42 }} />
                          ) : (
                            <PlayArrow sx={{ fontSize: 42 }} />
                          )}
                        </IconButton>
                      </Box>

                      <Box
                        sx={{
                          position: "absolute",
                          left: 14,
                          right: 14,
                          bottom: 12,
                        }}
                      >
                        <Stack direction="row" alignItems="center" spacing={1}>
                          <Typography
                            sx={{
                              fontSize: 13,
                              color: "rgba(237,240,247,0.78)",
                            }}
                          >
                            {formatTime(currentTime)}
                          </Typography>
                          <Slider
                            value={currentTime}
                            onChange={(_, value) => {
                              const next = Array.isArray(value)
                                ? value[0]
                                : value;
                              setCurrentTime(
                                clamp(next, 0, Math.max(duration, 1)),
                              );
                            }}
                            min={0}
                            max={Math.max(duration, 1)}
                            sx={{
                              flex: 1,
                              color: "#f8b321",
                              "& .MuiSlider-thumb": { width: 10, height: 10 },
                            }}
                          />
                          <Typography
                            sx={{
                              fontSize: 13,
                              color: "rgba(237,240,247,0.78)",
                            }}
                          >
                            {formatTime(duration)}
                          </Typography>
                        </Stack>
                      </Box>
                    </AcademyPlayerStudio>

                    <Stack spacing={1}>
                      <Box sx={{ ...cinematicPanelSx, p: 0.9 }}>
                        <Stack
                          direction="row"
                          alignItems="center"
                          justifyContent="space-between"
                        >
                          <Typography
                            sx={{
                              fontSize: 13,
                              textTransform: "uppercase",
                              letterSpacing: "0.08em",
                              color: "rgba(237,240,247,0.62)",
                            }}
                          >
                            Thumbnail
                          </Typography>
                          <Button
                            size="small"
                            onClick={openThumbnailMenu}
                            startIcon={<Add sx={{ fontSize: 16 }} />}
                            sx={{
                              textTransform: "none",
                              minWidth: 0,
                              color: "#edf0f7",
                              border:
                                "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.18)",
                              borderRadius: 0.9,
                              px: 1,
                              py: 0.28,
                            }}
                          >
                            {lessonThumbnailUrl
                              ? tt("Endre", "Change")
                              : tt("Legg til", "Add")}
                          </Button>
                        </Stack>

                        <Box
                          sx={{
                            mt: 0.8,
                            p: 0.55,
                            borderRadius: 1.1,
                            border:
                              "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.1)",
                            background: "rgba(9,12,20,0.62)",
                          }}
                        >
                          <Box
                            sx={{
                              borderRadius: 1,
                              aspectRatio: "16 / 9",
                              minHeight: 108,
                              ...(lessonThumbnailUrl
                                ? {
                                    backgroundImage: `linear-gradient(180deg, rgba(8,11,18,0.16), rgba(8,11,18,0.44)), url(${lessonThumbnailUrl})`,
                                    backgroundPosition: `center, ${lessonThumbnailFocalX}% ${lessonThumbnailFocalY}%`,
                                    backgroundSize: `cover, ${lessonThumbnailZoom}%`,
                                    backgroundRepeat: "no-repeat, no-repeat",
                                  }
                                : {
                                    background: placeholderBackgrounds[1],
                                  }),
                              position: "relative",
                              overflow: "hidden",
                            }}
                          >
                            {!lessonThumbnailUrl && (
                              <Stack
                                spacing={0.2}
                                alignItems="center"
                                justifyContent="center"
                                sx={{
                                  position: "absolute",
                                  inset: 0,
                                  px: 1,
                                  textAlign: "center",
                                  background:
                                    "linear-gradient(180deg, rgba(6,8,14,0.24), rgba(6,8,14,0.62))",
                                }}
                              >
                                <Typography
                                  sx={{
                                    fontSize: 12,
                                    color: "rgba(237,240,247,0.9)",
                                    fontWeight: 600,
                                  }}
                                >
                                  {tt(
                                    "Ingen thumbnail valgt",
                                    "No thumbnail selected",
                                  )}
                                </Typography>
                                <Typography
                                  sx={{
                                    fontSize: 11,
                                    color: "rgba(237,240,247,0.62)",
                                  }}
                                >
                                  {tt(
                                    "Velg fra video, media eller last opp",
                                    "Choose from video, media or upload",
                                  )}
                                </Typography>
                              </Stack>
                            )}
                            {lessonThumbnailUrl && (
                              <Box
                                sx={{
                                  position: "absolute",
                                  left: `calc(${lessonThumbnailFocalX}% - 7px)`,
                                  top: `calc(${lessonThumbnailFocalY}% - 7px)`,
                                  width: 14,
                                  height: 14,
                                  borderRadius: "50%",
                                  border: "2px solid rgba(248,179,33,0.95)",
                                  background: "rgba(8,11,18,0.2)",
                                  boxShadow: "0 0 0 2px rgba(8,11,18,0.45)",
                                  pointerEvents: "none",
                                }}
                              />
                            )}
                          </Box>

                          {lessonThumbnailUrl && (
                            <Stack
                              direction="row"
                              alignItems="center"
                              justifyContent="space-between"
                              sx={{ mt: 0.55, px: 0.2 }}
                            >
                              <Typography
                                sx={{
                                  fontSize: 11,
                                  color: "rgba(237,240,247,0.62)",
                                  textTransform: "uppercase",
                                  letterSpacing: "0.04em",
                                }}
                              >
                                {tt("Utsnitt", "Framing")}
                              </Typography>
                              <Typography
                                sx={{
                                  fontSize: 11,
                                  color: "rgba(237,240,247,0.72)",
                                }}
                              >
                                {lessonThumbnailZoom}% · X{" "}
                                {lessonThumbnailFocalX}% · Y{" "}
                                {lessonThumbnailFocalY}%
                              </Typography>
                            </Stack>
                          )}
                        </Box>
                        <Menu
                          anchorEl={thumbnailMenuAnchorEl}
                          open={Boolean(thumbnailMenuAnchorEl)}
                          onClose={closeThumbnailMenu}
                          PaperProps={{
                            sx: {
                              bgcolor: "rgba(12,16,24,0.98)",
                              color: "#edf0f7",
                              border:
                                "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.14)",
                            },
                          }}
                        >
                          <MenuItem onClick={setThumbnailFromVideo}>
                            {tt(
                              "Bruk thumbnail fra video",
                              "Use thumbnail from video",
                            )}
                          </MenuItem>
                          <MenuItem onClick={pickThumbnailFile}>
                            {tt("Last opp bilde", "Upload image")}
                          </MenuItem>
                          {thumbnailOptions.length > 0 && (
                            <Divider
                              sx={{ borderColor: "rgba(255,255,255,0.12)" }}
                            />
                          )}
                          {thumbnailOptions.slice(0, 8).map((option) => (
                            <MenuItem
                              key={option.id}
                              onClick={() => setThumbnailFromMedia(option.url)}
                            >
                              {option.label}
                            </MenuItem>
                          ))}
                        </Menu>
                        <input
                          ref={thumbnailInputRef}
                          type="file"
                          accept="image/*"
                          hidden
                          onChange={handleThumbnailInputChange}
                        />
                        {lessonThumbnailUrl && (
                          <Box
                            sx={{
                              mt: 0.8,
                              p: 0.75,
                              borderRadius: 1,
                              border:
                                "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.1)",
                              background: "rgba(9,12,20,0.56)",
                            }}
                          >
                            <Stack spacing={0.7}>
                              <Stack
                                direction="row"
                                justifyContent="space-between"
                                alignItems="center"
                              >
                                <Typography
                                  sx={{
                                    fontSize: 12,
                                    color: "rgba(237,240,247,0.74)",
                                  }}
                                >
                                  {tt("Zoom", "Zoom")}
                                </Typography>
                                <Typography
                                  sx={{
                                    fontSize: 12,
                                    color: "rgba(237,240,247,0.64)",
                                  }}
                                >
                                  {lessonThumbnailZoom}%
                                </Typography>
                              </Stack>
                              <Slider
                                size="small"
                                min={100}
                                max={220}
                                step={1}
                                value={lessonThumbnailZoom}
                                onChange={(_, value) =>
                                  setLessonThumbnailZoom(
                                    normalizeZoom(
                                      Array.isArray(value) ? value[0] : value,
                                    ),
                                  )
                                }
                                onChangeCommitted={handleThumbnailZoomCommitted}
                                sx={{
                                  color: "#f8b321",
                                  "& .MuiSlider-thumb": {
                                    width: 10,
                                    height: 10,
                                  },
                                }}
                              />

                              <Stack
                                direction="row"
                                justifyContent="space-between"
                                alignItems="center"
                              >
                                <Typography
                                  sx={{
                                    fontSize: 12,
                                    color: "rgba(237,240,247,0.74)",
                                  }}
                                >
                                  {tt("Fokus X", "Focus X")}
                                </Typography>
                                <Typography
                                  sx={{
                                    fontSize: 12,
                                    color: "rgba(237,240,247,0.64)",
                                  }}
                                >
                                  {lessonThumbnailFocalX}%
                                </Typography>
                              </Stack>
                              <Slider
                                size="small"
                                min={0}
                                max={100}
                                step={1}
                                value={lessonThumbnailFocalX}
                                onChange={(_, value) =>
                                  setLessonThumbnailFocalX(
                                    normalizeFocal(
                                      Array.isArray(value) ? value[0] : value,
                                    ),
                                  )
                                }
                                onChangeCommitted={
                                  handleThumbnailFocalXCommitted
                                }
                                sx={{
                                  color: "#f8b321",
                                  "& .MuiSlider-thumb": {
                                    width: 10,
                                    height: 10,
                                  },
                                }}
                              />

                              <Stack
                                direction="row"
                                justifyContent="space-between"
                                alignItems="center"
                              >
                                <Typography
                                  sx={{
                                    fontSize: 12,
                                    color: "rgba(237,240,247,0.74)",
                                  }}
                                >
                                  {tt("Fokus Y", "Focus Y")}
                                </Typography>
                                <Typography
                                  sx={{
                                    fontSize: 12,
                                    color: "rgba(237,240,247,0.64)",
                                  }}
                                >
                                  {lessonThumbnailFocalY}%
                                </Typography>
                              </Stack>
                              <Slider
                                size="small"
                                min={0}
                                max={100}
                                step={1}
                                value={lessonThumbnailFocalY}
                                onChange={(_, value) =>
                                  setLessonThumbnailFocalY(
                                    normalizeFocal(
                                      Array.isArray(value) ? value[0] : value,
                                    ),
                                  )
                                }
                                onChangeCommitted={
                                  handleThumbnailFocalYCommitted
                                }
                                sx={{
                                  color: "#f8b321",
                                  "& .MuiSlider-thumb": {
                                    width: 10,
                                    height: 10,
                                  },
                                }}
                              />

                              <Button
                                size="small"
                                onClick={resetThumbnailCrop}
                                sx={{
                                  alignSelf: "flex-start",
                                  textTransform: "none",
                                  color: "#edf0f7",
                                  border:
                                    "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.18)",
                                }}
                              >
                                {tt("Nullstill utsnitt", "Reset crop")}
                              </Button>
                            </Stack>
                          </Box>
                        )}
                      </Box>
                    </Stack>
                  </Box>

                  <Tabs
                    value={centerTab}
                    onChange={(_, value: CenterTab) => setCenterTab(value)}
                    textColor="inherit"
                    sx={{
                      mt: 0.2,
                      px: 0.6,
                      borderTop:
                        "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.08)",
                      borderBottom:
                        "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.08)",
                      "& .MuiTabs-indicator": { backgroundColor: "#f8b321" },
                      "& .MuiTab-root": {
                        color: "rgba(237,240,247,0.74)",
                        textTransform: "none",
                        minHeight: 42,
                        fontSize: 14,
                      },
                      "& .Mui-selected": { color: "#f7f8fb" },
                    }}
                  >
                    <Tab label={tt("Innhold", "Content")} value="content" />
                    <Tab
                      label={tt("Engasjement", "Engagement")}
                      value="engagement"
                    />
                  </Tabs>

                  <Box sx={{ p: 1 }}>
                    {centerTab === "content" && (
                      <Stack spacing={0.8}>
                        {chapterItems.map((chapter, index) => (
                          <Stack
                            key={chapter.id}
                            direction="row"
                            alignItems="center"
                            spacing={1}
                            sx={{
                              px: 1,
                              py: 1,
                              borderRadius: 1,
                              border:
                                "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.11)",
                              bgcolor: "rgba(11,15,24,0.74)",
                            }}
                          >
                            <DragIndicator
                              sx={{ color: "rgba(237,240,247,0.48)" }}
                            />
                            <Chip
                              label={chapter.type.toUpperCase()}
                              size="small"
                              sx={{
                                bgcolor: "rgba(248,179,33,0.2)",
                                color: "#f7f8fb",
                                fontWeight: 700,
                              }}
                            />
                            <TextField
                              size="small"
                              value={chapter.title}
                              onChange={(event) =>
                                updateChapter(chapter.id, event.target.value)
                              }
                              sx={{
                                flex: 1,
                                "& .MuiInputBase-root": {
                                  color: "#edf0f7",
                                  bgcolor: "rgba(255,255,255,0.03)",
                                },
                              }}
                            />
                            <Typography
                              sx={{
                                minWidth: 60,
                                textAlign: "right",
                                color: "rgba(237,240,247,0.72)",
                              }}
                            >
                              {formatTime(chapter.duration)}
                            </Typography>
                            <IconButton
                              size="small"
                              sx={{ color: "rgba(237,240,247,0.7)" }}
                            >
                              <Edit fontSize="small" />
                            </IconButton>
                            <Typography
                              sx={{ fontWeight: 700, color: "#f8d56f" }}
                            >
                              {index + 1}
                            </Typography>
                          </Stack>
                        ))}
                      </Stack>
                    )}

                    {centerTab === "engagement" && (
                      <Stack spacing={1}>
                        <Box sx={{ ...cinematicPanelSx, p: 1.2 }}>
                          <Typography
                            sx={{ fontSize: 18, fontWeight: 600, mb: 1 }}
                          >
                            {tt("Leksjonssynlighet", "Lesson Visibility")}
                          </Typography>
                          <Stack spacing={0.9}>
                            <Stack
                              direction="row"
                              justifyContent="space-between"
                            >
                              <Typography>
                                Completion Heatmap Coverage
                              </Typography>
                              <Typography sx={{ color: "#f8d56f" }}>
                                82%
                              </Typography>
                            </Stack>
                            <LinearProgress
                              variant="determinate"
                              value={82}
                              sx={{
                                height: 7,
                                borderRadius: 999,
                                bgcolor: "rgba(255,255,255,0.12)",
                                "& .MuiLinearProgress-bar": {
                                  borderRadius: 999,
                                  background:
                                    "linear-gradient(90deg, #8de270 0%, #f8b321 100%)",
                                },
                              }}
                            />
                            <Stack
                              direction="row"
                              justifyContent="space-between"
                            >
                              <Typography>Avg Watch Retention</Typography>
                              <Typography sx={{ color: "#f8d56f" }}>
                                74%
                              </Typography>
                            </Stack>
                            <LinearProgress
                              variant="determinate"
                              value={74}
                              sx={{
                                height: 7,
                                borderRadius: 999,
                                bgcolor: "rgba(255,255,255,0.12)",
                                "& .MuiLinearProgress-bar": {
                                  borderRadius: 999,
                                  background:
                                    "linear-gradient(90deg, #7fb4ff 0%, #f8b321 100%)",
                                },
                              }}
                            />
                          </Stack>
                        </Box>

                        <Box sx={{ ...cinematicPanelSx, p: 1.2 }}>
                          <Stack
                            direction="row"
                            justifyContent="space-between"
                            alignItems="center"
                            sx={{ mb: 1 }}
                          >
                            <Typography sx={{ fontSize: 18, fontWeight: 600 }}>
                              {tt(
                                "Kommentarer og spørsmål",
                                "Comments & Questions",
                              )}
                            </Typography>
                            <Button
                              onClick={useCurrentPlaybackTimestamp}
                              size="small"
                              sx={{
                                textTransform: "none",
                                color: "#edf0f7",
                                border:
                                  "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.16)",
                              }}
                            >
                              {tt("Bruk nåværende tid", "Use current time")} (
                              {formatTime(currentTime)})
                            </Button>
                          </Stack>

                          <Stack spacing={0.8} sx={{ mb: 1 }}>
                            <Stack
                              direction={{ xs: "column", sm: "row" }}
                              spacing={0.8}
                            >
                              <Select
                                size="small"
                                value={newEngagementType}
                                onChange={(event) =>
                                  setNewEngagementType(
                                    event.target.value as EngagementEntryType,
                                  )
                                }
                                sx={{
                                  minWidth: 170,
                                  color: "#edf0f7",
                                  bgcolor: "rgba(255,255,255,0.04)",
                                  "& .MuiOutlinedInput-notchedOutline": {
                                    borderColor: "rgba(255,255,255,0.16)",
                                  },
                                }}
                              >
                                <MenuItem value="question">
                                  {tt("Spørsmål", "Question")}
                                </MenuItem>
                                <MenuItem value="comment">
                                  {tt("Kommentar", "Comment")}
                                </MenuItem>
                              </Select>
                              <TextField
                                size="small"
                                type="number"
                                label={tt("Timestamp (sek)", "Timestamp (sec)")}
                                value={newEngagementTimestamp}
                                onChange={(event) =>
                                  setNewEngagementTimestamp(
                                    normalizeTimestamp(
                                      Number(event.target.value || 0),
                                      duration,
                                    ),
                                  )
                                }
                                sx={{
                                  width: { xs: "100%", sm: 170 },
                                  "& .MuiInputBase-root": { color: "#edf0f7" },
                                }}
                              />
                            </Stack>
                            <TextField
                              size="small"
                              multiline
                              minRows={2}
                              value={newEngagementText}
                              onChange={(event) =>
                                setNewEngagementText(event.target.value)
                              }
                              placeholder={tt(
                                "Skriv spørsmål eller kommentar knyttet til denne tiden i videoen...",
                                "Write a question or comment tied to this timestamp...",
                              )}
                              sx={{
                                "& .MuiInputBase-root": {
                                  color: "#edf0f7",
                                  bgcolor: "rgba(255,255,255,0.03)",
                                },
                              }}
                            />
                            <Stack
                              direction="row"
                              justifyContent="space-between"
                              alignItems="center"
                            >
                              <Typography
                                sx={{
                                  color: "rgba(237,240,247,0.62)",
                                  fontSize: 12,
                                }}
                              >
                                {tt("Valgt tid", "Selected time")}:{" "}
                                {formatTime(newEngagementTimestamp)}
                              </Typography>
                              <Button
                                onClick={addEngagementEntry}
                                sx={{
                                  textTransform: "none",
                                  color: "#0f0f0f",
                                  background:
                                    "linear-gradient(180deg, #ffd44e, #f2a616)",
                                }}
                              >
                                {tt("Publiser", "Post")}
                              </Button>
                            </Stack>
                          </Stack>

                          <Divider
                            sx={{ borderColor: "rgba(255,255,255,0.1)", mb: 1 }}
                          />

                          <Stack spacing={0.8}>
                            {engagementItems.length === 0 && (
                              <Typography
                                sx={{ color: "rgba(237,240,247,0.62)" }}
                              >
                                {tt(
                                  "Ingen kommentarer eller spørsmål ennå.",
                                  "No comments or questions yet.",
                                )}
                              </Typography>
                            )}
                            {engagementItems.map((entry) => (
                              <Box
                                key={entry.id}
                                sx={{
                                  p: 1,
                                  borderRadius: 1,
                                  border:
                                    "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.11)",
                                  bgcolor: "rgba(11,15,24,0.78)",
                                }}
                              >
                                <Stack
                                  direction="row"
                                  spacing={0.7}
                                  alignItems="center"
                                  sx={{ mb: 0.55 }}
                                >
                                  <Avatar
                                    sx={{
                                      width: 28,
                                      height: 28,
                                      bgcolor: "rgba(248,179,33,0.75)",
                                      color: "#111",
                                      fontSize: 13,
                                    }}
                                  >
                                    {entry.author.charAt(0).toUpperCase()}
                                  </Avatar>
                                  <Typography
                                    sx={{ fontWeight: 700, fontSize: 14 }}
                                  >
                                    {entry.author}
                                  </Typography>
                                  <Chip
                                    label={
                                      entry.type === "question"
                                        ? tt("Spørsmål", "Question")
                                        : tt("Kommentar", "Comment")
                                    }
                                    size="small"
                                    sx={{
                                      bgcolor:
                                        entry.type === "question"
                                          ? "rgba(126,174,255,0.2)"
                                          : "rgba(248,179,33,0.2)",
                                      color: "#edf0f7",
                                    }}
                                  />
                                  <Button
                                    size="small"
                                    onClick={() => {
                                      setCurrentTime(
                                        normalizeTimestamp(
                                          entry.timestamp,
                                          duration,
                                        ),
                                      );
                                      setIsPlaying(false);
                                    }}
                                    sx={{
                                      ml: "auto",
                                      minWidth: 0,
                                      textTransform: "none",
                                      color: "#f8d56f",
                                      px: 0.8,
                                    }}
                                  >
                                    {formatTime(entry.timestamp)}
                                  </Button>
                                </Stack>

                                <Typography
                                  sx={{
                                    color: "rgba(237,240,247,0.84)",
                                    mb: 0.8,
                                  }}
                                >
                                  {entry.text}
                                </Typography>

                                <Stack spacing={0.5} sx={{ pl: 1 }}>
                                  {entry.replies.map((reply) => (
                                    <Box
                                      key={reply.id}
                                      sx={{
                                        px: 0.8,
                                        py: 0.55,
                                        borderRadius: 0.8,
                                        border:
                                          "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.09)",
                                        bgcolor: "rgba(8,11,18,0.72)",
                                      }}
                                    >
                                      <Typography
                                        sx={{
                                          fontSize: 12,
                                          fontWeight: 700,
                                          color: "rgba(237,240,247,0.92)",
                                        }}
                                      >
                                        {reply.author}
                                      </Typography>
                                      <Typography
                                        sx={{
                                          fontSize: 13,
                                          color: "rgba(237,240,247,0.76)",
                                        }}
                                      >
                                        {reply.text}
                                      </Typography>
                                    </Box>
                                  ))}
                                </Stack>

                                <Stack
                                  direction="row"
                                  spacing={0.6}
                                  sx={{ mt: 0.8 }}
                                >
                                  <TextField
                                    size="small"
                                    value={replyDraftByEntryId[entry.id] || ""}
                                    onChange={(event) =>
                                      setReplyDraftByEntryId((current) => ({
                                        ...current,
                                        [entry.id]: event.target.value,
                                      }))
                                    }
                                    placeholder={tt(
                                      "Skriv et svar...",
                                      "Write a reply...",
                                    )}
                                    sx={{
                                      flex: 1,
                                      "& .MuiInputBase-root": {
                                        color: "#edf0f7",
                                        bgcolor: "rgba(255,255,255,0.03)",
                                      },
                                    }}
                                  />
                                  <Button
                                    onClick={() =>
                                      addReplyToEngagementEntry(entry.id)
                                    }
                                    sx={{
                                      textTransform: "none",
                                      color: "#edf0f7",
                                      border:
                                        "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.16)",
                                    }}
                                  >
                                    {tt("Svar", "Reply")}
                                  </Button>
                                </Stack>
                              </Box>
                            ))}
                          </Stack>
                        </Box>
                      </Stack>
                    )}
                  </Box>
                </Box>

                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  spacing={1}
                  alignItems={{ xs: "stretch", sm: "center" }}
                  justifyContent="space-between"
                >
                  <Typography sx={{ color: "rgba(237,240,247,0.72)" }}>
                    {tt("Kapitler", "Chapters")}: {chapterItems.length}
                  </Typography>

                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography sx={{ color: "rgba(237,240,247,0.72)" }}>
                      {tt("Leksjonssynlighet", "Lesson Visibility")}
                    </Typography>
                    <Chip
                      label={
                        activeCourse?.isPublished
                          ? tt("Publisert", "Published")
                          : tt("Utkast", "Draft")
                      }
                      size="small"
                      sx={{
                        bgcolor: activeCourse?.isPublished
                          ? "rgba(127,214,153,0.22)"
                          : "rgba(248,179,33,0.18)",
                        color: "#f7f8fb",
                      }}
                    />
                  </Stack>
                </Stack>
              </Box>
            </Box>

            <Box
              sx={{
                ...cinematicPanelSx,
                minHeight: 0,
                minWidth: 0,
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <Tabs
                value={rightTab}
                onChange={(_, value: RightTab) => setRightTab(value)}
                textColor="inherit"
                variant="scrollable"
                scrollButtons="auto"
                allowScrollButtonsMobile
                sx={{
                  borderBottom:
                    "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.08)",
                  "& .MuiTabs-indicator": { backgroundColor: "#f8b321" },
                  "& .MuiTab-root": {
                    color: "rgba(237,240,247,0.78)",
                    textTransform: "none",
                    minHeight: 44,
                    minWidth: "fit-content",
                    px: 1.2,
                  },
                  "& .Mui-selected": { color: "#f7f8fb" },
                }}
              >
                <Tab label={tt("Info", "Info")} value="info" />
                <Tab label={tt("Ressurser", "Resources")} value="resources" />
              </Tabs>

              {rightTab === "info" && (
                <Box
                  sx={{
                    p: 1.3,
                    display: "flex",
                    flexDirection: "column",
                    gap: 1.2,
                  }}
                >
                  <Box sx={lessonStudioSectionCardSx}>
                    <Typography sx={lessonStudioSectionLabelSx}>
                      {tt("Innhold", "Content")}
                    </Typography>
                    <TextField
                      label={tt("Ferdighetstittel", "Skill title")}
                      value={lessonTitle}
                      onChange={(event) => setLessonTitle(event.target.value)}
                      size="small"
                      sx={{ "& .MuiInputBase-root": { color: "#edf0f7" } }}
                    />
                  </Box>

                  <Box sx={lessonStudioSectionCardSx}>
                    <Typography sx={lessonStudioSectionLabelSx}>
                      {tt("Instruktør", "Instructor")}
                    </Typography>
                    <Stack
                      direction={{ xs: "column", md: "row" }}
                      spacing={0.7}
                      alignItems={{ xs: "stretch", md: "center" }}
                    >
                      <Select
                        size="small"
                        value={selectedLessonInstructorId}
                        onChange={(event) =>
                          setSelectedLessonInstructorId(String(event.target.value))
                        }
                        sx={{
                          minWidth: { xs: "100%", md: 250 },
                          color: "#edf0f7",
                          bgcolor: "rgba(255,255,255,0.04)",
                          "& .MuiOutlinedInput-notchedOutline": {
                            borderColor: "rgba(255,255,255,0.16)",
                          },
                        }}
                        displayEmpty
                      >
                        <MenuItem value="">
                          {tt(
                            "Velg instruktør for ferdighet",
                            "Select skill instructor",
                          )}
                        </MenuItem>
                        {instructorItems.map((instructor) => (
                          <MenuItem
                            key={`lesson-instructor-${instructor.id}`}
                            value={instructor.id}
                          >
                            {instructor.name}
                          </MenuItem>
                        ))}
                      </Select>
                      <Button
                        onClick={() => setLocation("/academy/instructors")}
                        sx={{
                          textTransform: "none",
                          color: "#edf0f7",
                          border:
                            "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.16)",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {tt("Administrer instruktører", "Manage instructors")}
                      </Button>
                    </Stack>
                    <Typography
                      sx={{ color: "rgba(237,240,247,0.66)", fontSize: 12 }}
                    >
                      {tt(
                        "Instruktørrollen lagres sammen med ferdigheten når du lagrer/publiserer.",
                        "Instructor role is saved with this skill when you save/publish.",
                      )}
                    </Typography>
                  </Box>

                  <Box sx={lessonStudioSectionCardSx}>
                    <Typography sx={lessonStudioSectionLabelSx}>
                      {tt("Video", "Video")}
                    </Typography>
                    <Stack
                      direction="row"
                      spacing={0.8}
                      alignItems="center"
                      useFlexGap
                      flexWrap="wrap"
                    >
                      <Chip
                        size="small"
                        icon={<PlayArrow fontSize="small" />}
                        label={
                          lessonVideoState.source === "skill"
                            ? tt("Ferdighetsvideo", "Skill video")
                            : lessonVideoState.source === "course"
                              ? tt("Kursvideo", "Course video")
                              : tt("Ingen video", "No video")
                        }
                        sx={{
                          height: 22,
                          bgcolor:
                            lessonVideoState.source === "none"
                              ? "rgba(255,255,255,0.08)"
                              : lessonVideoState.source === "skill"
                                ? "rgba(92,180,128,0.14)"
                                : "rgba(248,179,33,0.14)",
                          color:
                            lessonVideoState.source === "none"
                              ? "#edf0f7"
                              : lessonVideoState.source === "skill"
                                ? "#d8f4df"
                                : "#f8d56f",
                          border:
                            lessonVideoState.source === "none"
                              ? "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.14)"
                              : lessonVideoState.source === "skill"
                                ? "var(--academy-hairline-width, 1px) solid rgba(92,180,128,0.24)"
                                : "var(--academy-hairline-width, 1px) solid rgba(248,179,33,0.24)",
                          fontWeight: 700,
                          ".MuiChip-icon": {
                            color:
                              lessonVideoState.source === "none"
                                ? "rgba(237,240,247,0.72)"
                                : lessonVideoState.source === "skill"
                                  ? "#9ee2ae"
                                  : "#f8d56f",
                          },
                        }}
                      />
                      {lessonVideoState.source === "none" ? (
                        <Typography
                          sx={{
                            color: "rgba(237,240,247,0.64)",
                            fontSize: 12.5,
                          }}
                        >
                          {tt(
                            "Koble video fra Media for å sette riktig lengde og kilde.",
                            "Link a video from Media to set the correct duration and source.",
                          )}
                        </Typography>
                      ) : (
                        <Typography
                          sx={{
                            minWidth: 0,
                            flex: 1,
                            color: "rgba(237,240,247,0.76)",
                            fontSize: 12.5,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {`${lessonVideoDisplayLabel} · ${formatTime(
                            Number(lessonVideoState.duration || 0),
                          )}`}
                        </Typography>
                      )}
                    </Stack>
                    {lessonVideoVersionState.hasUpdate ? (
                      <Box
                        sx={{
                          mt: 0.15,
                          px: 0.9,
                          py: 0.75,
                          borderRadius: 1,
                          border:
                            "var(--academy-hairline-width, 1px) solid rgba(255,170,66,0.26)",
                          bgcolor: "rgba(255,170,66,0.08)",
                        }}
                      >
                        <Typography
                          sx={{
                            fontSize: 12.5,
                            fontWeight: 700,
                            color: "#ffd8aa",
                          }}
                        >
                          {tt(
                            "Nyere videoversjon er tilgjengelig.",
                            "A newer video version is available.",
                          )}
                        </Typography>
                        <Typography
                          sx={{
                            mt: 0.25,
                            fontSize: 12,
                            color: "rgba(237,240,247,0.72)",
                          }}
                        >
                          {`v${lessonVideoVersionState.linkedVersion} -> v${lessonVideoVersionState.currentVersion}`}
                        </Typography>
                      </Box>
                    ) : null}
                  </Box>

                  <Box sx={lessonStudioSectionCardSx}>
                    <Typography sx={lessonStudioSectionLabelSx}>
                      {tt("Studio", "Studio")}
                    </Typography>
                    <Stack
                      direction="row"
                      spacing={0.5}
                      flexWrap="wrap"
                      useFlexGap
                    >
                      <IconButton
                        size="small"
                        onClick={() => handleLessonQuickAction("player")}
                        aria-label={tt(
                          "Åpne spillerstudio",
                          "Open player studio",
                        )}
                        title={tt("Åpne spillerstudio", "Open player studio")}
                        sx={{
                          color: "rgba(237,240,247,0.74)",
                          border:
                            "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.12)",
                        }}
                      >
                        <Movie fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => handleLessonQuickAction("lower-thirds")}
                        aria-label={tt(
                          "Åpne nedre tredeler",
                          "Open lower thirds",
                        )}
                        title={tt("Åpne nedre tredeler", "Open lower thirds")}
                        sx={{
                          color: "rgba(237,240,247,0.74)",
                          border:
                            "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.12)",
                        }}
                      >
                        <Subtitles fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => handleLessonQuickAction("cta-overlay")}
                        aria-label={tt("Åpne CTA-overlegg", "Open CTA overlay")}
                        title={tt("Åpne CTA-overlegg", "Open CTA overlay")}
                        sx={{
                          color: "rgba(237,240,247,0.74)",
                          border:
                            "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.12)",
                        }}
                      >
                        <Campaign fontSize="small" />
                      </IconButton>
                    </Stack>
                  </Box>

                  <Box sx={lessonStudioSectionCardSx}>
                    <Typography sx={lessonStudioSectionLabelSx}>
                      {tt(
                        "Læringsmål (fra læreplan)",
                        "Learning objectives (from curriculum)",
                      )}
                    </Typography>

                    {curriculumLearningOutcomes.length === 0 ? (
                      <Box
                        sx={{
                          p: 1,
                          borderRadius: 1,
                          border:
                            "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.12)",
                          bgcolor: "rgba(255,255,255,0.02)",
                        }}
                      >
                        <Typography
                          sx={{
                            color: "rgba(237,240,247,0.68)",
                            fontSize: 13,
                            mb: 0.8,
                          }}
                        >
                          {tt(
                            "Ingen læringsmål er definert i læreplanen ennå.",
                            "No learning objectives are defined in curriculum yet.",
                          )}
                        </Typography>
                        <Button
                          onClick={() => setLocation("/academy/curriculum")}
                          sx={{
                            textTransform: "none",
                            color: "#edf0f7",
                            border:
                              "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.16)",
                          }}
                        >
                          {tt("Åpne læreplan", "Open curriculum")}
                        </Button>
                      </Box>
                    ) : (
                      <>
                        <Stack spacing={0.55}>
                          {curriculumLearningOutcomes.map((outcome) => {
                            const checked = summaryPoints.includes(outcome);
                            return (
                              <Stack
                                key={`curriculum-outcome-${outcome}`}
                                direction="row"
                                spacing={0.7}
                                alignItems="center"
                                sx={{
                                  px: 0.55,
                                  py: 0.35,
                                  borderRadius: 0.8,
                                  border:
                                    "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.1)",
                                  bgcolor: checked
                                    ? "rgba(245,166,35,0.12)"
                                    : "rgba(255,255,255,0.02)",
                                }}
                              >
                                <Checkbox
                                  checked={checked}
                                  onChange={() =>
                                    toggleLinkedLearningOutcome(outcome)
                                  }
                                  sx={{
                                    p: 0.45,
                                    color: "rgba(237,240,247,0.6)",
                                    "&.Mui-checked": { color: "#f8b321" },
                                  }}
                                />
                                <Typography
                                  sx={{
                                    color: "rgba(237,240,247,0.84)",
                                    fontSize: 13,
                                    lineHeight: 1.35,
                                  }}
                                >
                                  {outcome}
                                </Typography>
                              </Stack>
                            );
                          })}
                        </Stack>

                        <Stack
                          direction="row"
                          justifyContent="space-between"
                          alignItems="center"
                        >
                          <Typography
                            sx={{
                              color: "rgba(237,240,247,0.6)",
                              fontSize: 12,
                            }}
                          >
                            {tt("Koblet til ferdighet", "Linked to skill")}:{" "}
                            {summaryPoints.length}
                          </Typography>
                          <Button
                            onClick={() => setLocation("/academy/curriculum")}
                            sx={{
                              textTransform: "none",
                              color: "#edf0f7",
                              border:
                                "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.16)",
                            }}
                          >
                            {tt("Rediger i læreplan", "Edit in curriculum")}
                          </Button>
                        </Stack>
                      </>
                    )}
                  </Box>

                  <Box sx={lessonStudioSectionCardSx}>
                    <Typography sx={lessonStudioSectionLabelSx}>
                      {tt("Ressurssamling", "Resource Set")}
                    </Typography>
                    <Box
                      sx={{
                        borderRadius: 1,
                        border: "1px dashed rgba(255,255,255,0.2)",
                        px: 1,
                        py: 1.1,
                        cursor: "pointer",
                        transition: "all 0.18s ease",
                        color: "rgba(237,240,247,0.68)",
                        backgroundColor: "rgba(255,255,255,0.02)",
                        "&:hover": {
                          borderColor: "rgba(248,179,33,0.48)",
                          backgroundColor: "rgba(245,166,35,0.1)",
                        },
                      }}
                      onClick={openResourcePicker}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          openResourcePicker();
                        }
                      }}
                      role="button"
                      tabIndex={0}
                      aria-label={tt(
                        "Velg ressurser fra media",
                        "Select resources from media",
                      )}
                    >
                      <Typography sx={{ color: "rgba(237,240,247,0.86)" }}>
                        {tt(
                          "Velg ressurser fra Media-biblioteket.",
                          "Select resources from the Media library.",
                        )}
                      </Typography>
                      <Typography
                        sx={{
                          mt: 0.45,
                          fontSize: 12,
                          color: "rgba(237,240,247,0.58)",
                        }}
                      >
                        {tt(
                          "Klikk for å åpne Media-velger.",
                          "Click to open the media picker.",
                        )}
                      </Typography>
                    </Box>

                    <Box sx={{ ...cinematicPanelSx, p: 1 }}>
                      <Stack spacing={0.8}>
                        {resourceItems.length === 0 && (
                          <Typography
                            sx={{ fontSize: 13, color: "rgba(237,240,247,0.6)" }}
                          >
                            {tt(
                              "Ingen ressurser valgt fra Media ennå.",
                              "No resources selected from Media yet.",
                            )}
                          </Typography>
                        )}
                        {resourceItems.map((resource) => (
                          <Stack
                            key={`resource-info-${resource.id}`}
                            direction="row"
                            alignItems="center"
                            spacing={0.8}
                            sx={{
                              px: 0.9,
                              py: 0.75,
                              borderRadius: 1,
                              border:
                                "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.1)",
                              bgcolor: "rgba(9,12,19,0.74)",
                            }}
                          >
                            {renderResourceIcon(resource.type)}
                            <Typography sx={{ flex: 1, fontSize: 14 }} noWrap>
                              {resource.title}
                            </Typography>
                            <IconButton
                              size="small"
                              onClick={openResourcePicker}
                              sx={{ color: "rgba(237,240,247,0.7)" }}
                              aria-label={tt(
                                "Rediger ressursvalg",
                                "Edit resource selection",
                              )}
                            >
                              <Edit fontSize="small" />
                            </IconButton>
                          </Stack>
                        ))}
                      </Stack>
                    </Box>
                  </Box>
                </Box>
              )}

              {rightTab === "resources" && (
                <Box
                  sx={{
                    p: 1.3,
                    display: "flex",
                    flexDirection: "column",
                    gap: 1.2,
                  }}
                >
                  <Box sx={lessonStudioSectionCardSx}>
                    <Typography sx={lessonStudioSectionLabelSx}>
                      {tt("Søk", "Search")}
                    </Typography>
                    <TextField
                      value={searchValue}
                      onChange={(event) => setSearchValue(event.target.value)}
                      placeholder={tt("Søk ressurser...", "Search resources...")}
                      size="small"
                      InputProps={{
                        startAdornment: (
                          <Search
                            fontSize="small"
                            sx={{ mr: 0.7, color: "rgba(237,240,247,0.6)" }}
                          />
                        ),
                      }}
                      sx={{
                        "& .MuiInputBase-root": {
                          bgcolor: "rgba(11,14,22,0.8)",
                          color: "#edf0f7",
                        },
                      }}
                    />
                  </Box>

                  <Box sx={lessonStudioSectionCardSx}>
                    <Typography sx={lessonStudioSectionLabelSx}>
                      {tt("Tilgjengelige ressurser", "Available resources")}
                    </Typography>
                    <Stack spacing={0.8}>
                      {visibleResources.length === 0 ? (
                        <Typography
                          sx={{ fontSize: 13, color: "rgba(237,240,247,0.6)" }}
                        >
                          {tt(
                            "Ingen ressurser matcher søket ennå.",
                            "No resources match the current search yet.",
                          )}
                        </Typography>
                      ) : (
                        visibleResources.map((resource) => (
                          <Stack
                            key={`resource-tab-${resource.id}`}
                            direction="row"
                            alignItems="center"
                            spacing={0.8}
                            sx={{
                              px: 0.9,
                              py: 0.75,
                              borderRadius: 1,
                              border:
                                "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.1)",
                              bgcolor: "rgba(11,15,24,0.74)",
                            }}
                          >
                            <Chip
                              label={resource.type.toUpperCase()}
                              size="small"
                              sx={{
                                bgcolor: "rgba(255,255,255,0.12)",
                                color: "#edf0f7",
                              }}
                            />
                            <Typography sx={{ flex: 1 }} noWrap>
                              {resource.title}
                            </Typography>
                            <Typography
                              sx={{
                                fontSize: 12,
                                color: "rgba(237,240,247,0.66)",
                              }}
                            >
                              {resource.duration
                                ? formatTime(resource.duration)
                                : "--"}
                            </Typography>
                          </Stack>
                        ))
                      )}
                    </Stack>
                  </Box>

                  <Box sx={lessonStudioSectionCardSx}>
                    <Typography sx={lessonStudioSectionLabelSx}>
                      {tt("Handling", "Action")}
                    </Typography>
                    <Button
                      startIcon={<Add />}
                      onClick={openResourcePicker}
                      sx={{
                        textTransform: "none",
                        color: "#0f0f0f",
                        background: "linear-gradient(180deg, #ffd44e, #f2a616)",
                        alignSelf: "flex-start",
                      }}
                    >
                      {tt("Velg fra Media", "Choose from Media")}
                    </Button>
                  </Box>
                </Box>
              )}

              <Divider sx={{ borderColor: "rgba(255,255,255,0.08)" }} />

              <Stack direction="row" spacing={1} sx={{ p: 1.1, pt: 0 }}>
                <Button
                  onClick={() => {
                    if (onCancel) {
                      onCancel();
                    } else {
                      goToCourseBuilderSkills();
                    }
                  }}
                  sx={{
                    textTransform: "none",
                    color: "rgba(237,240,247,0.78)",
                    border:
                      "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.16)",
                  }}
                >
                  {tt("Til ferdighetsbygger", "Back to Skills Builder")}
                </Button>
              </Stack>
            </Box>
          </Box>
        </Box>
      </Box>

      <Dialog
        open={resourcePickerOpen}
        onClose={closeResourcePicker}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            bgcolor: "rgba(10,14,22,0.98)",
            color: "#edf0f7",
            border:
              "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.14)",
          },
        }}
      >
        <DialogTitle sx={{ pb: 1 }}>
          {tt("Velg ressurser fra Media", "Select resources from Media")}
        </DialogTitle>
        <DialogContent sx={{ pt: "8px !important" }}>
          <TextField
            value={resourcePickerSearchValue}
            onChange={(event) =>
              setResourcePickerSearchValue(event.target.value)
            }
            placeholder={tt("Søk i media...", "Search media...")}
            size="small"
            fullWidth
            sx={{
              mb: 1.2,
              "& .MuiInputBase-root": {
                bgcolor: "rgba(11,14,22,0.9)",
                color: "#edf0f7",
              },
            }}
          />
          <Typography
            sx={{ mb: 1, fontSize: 12, color: "rgba(237,240,247,0.65)" }}
          >
            {tt(
              "Tips: Bruk «Ferdighet» for aktiv leksjon eller «Kurs» for alle ferdigheter uten egen video.",
              "Tip: Use “Skill” for the active lesson, or “Course” for all skills without their own video.",
            )}
          </Typography>
          <Stack
            spacing={0.7}
            sx={{ maxHeight: 360, overflowY: "auto", pr: 0.4 }}
          >
            {filteredMediaResourceOptions.length === 0 && (
              <Typography sx={{ fontSize: 13, color: "rgba(237,240,247,0.6)" }}>
                {tt(
                  "Ingen mediaressurser funnet.",
                  "No media resources found.",
                )}
              </Typography>
            )}
            {filteredMediaResourceOptions.map((item) => {
              const isChecked = resourcePickerSelection.includes(item.id);
              const alreadyInLesson = resourceItems.some(
                (resource) => resource.url === item.url,
              );
              return (
                <Stack
                  key={item.id}
                  direction="row"
                  alignItems="center"
                  spacing={0.8}
                  sx={{
                    px: 0.9,
                    py: 0.75,
                    borderRadius: 1,
                    border:
                      "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.12)",
                    bgcolor: isChecked
                      ? "rgba(245,166,35,0.14)"
                      : "rgba(11,15,24,0.72)",
                    cursor: "pointer",
                  }}
                  onClick={() => toggleResourcePickerSelection(item.id)}
                >
                  <Checkbox
                    checked={isChecked}
                    onClick={(event) => {
                      event.stopPropagation();
                      toggleResourcePickerSelection(item.id);
                    }}
                    sx={{
                      color: "rgba(237,240,247,0.7)",
                      "&.Mui-checked": { color: "#f8b321" },
                    }}
                  />
                  {renderResourceIcon(item.type)}
                  <Stack sx={{ flex: 1, minWidth: 0 }}>
                    <Typography noWrap sx={{ fontSize: 14 }}>
                      {item.title}
                    </Typography>
                    <Typography
                      noWrap
                      sx={{ fontSize: 12, color: "rgba(237,240,247,0.58)" }}
                    >
                      {item.sourceLabel}
                    </Typography>
                  </Stack>
                  {alreadyInLesson && (
                    <CheckCircleOutline
                      sx={{ fontSize: 16, color: "rgba(141,226,112,0.85)" }}
                    />
                  )}
                  {item.type === "video" && (
                    <Stack direction="row" spacing={0.5}>
                      <Button
                        size="small"
                        onClick={(event) => {
                          event.stopPropagation();
                          void bindVideoFromMediaToTarget(item.id, "skill");
                        }}
                        sx={{
                          minWidth: 0,
                          px: 0.8,
                          py: 0.3,
                          lineHeight: 1.1,
                          textTransform: "none",
                          fontSize: 11,
                          color: "#edf0f7",
                          border:
                            "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.16)",
                        }}
                      >
                        {tt("Ferdighet", "Skill")}
                      </Button>
                      <Button
                        size="small"
                        onClick={(event) => {
                          event.stopPropagation();
                          void bindVideoFromMediaToTarget(item.id, "course");
                        }}
                        sx={{
                          minWidth: 0,
                          px: 0.8,
                          py: 0.3,
                          lineHeight: 1.1,
                          textTransform: "none",
                          fontSize: 11,
                          color: "#edf0f7",
                          border:
                            "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.16)",
                        }}
                      >
                        {tt("Kurs", "Course")}
                      </Button>
                    </Stack>
                  )}
                </Stack>
              );
            })}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: 1.4 }}>
          <Button
            onClick={closeResourcePicker}
            sx={{
              textTransform: "none",
              color: "rgba(237,240,247,0.84)",
            }}
          >
            {tt("Avbryt", "Cancel")}
          </Button>
          <Button
            onClick={() => {
              const query = new URLSearchParams();
              if (activeCourse?.id)
                query.set("courseId", String(activeCourse.id));
              if (activeLesson?.id)
                query.set("lessonId", String(activeLesson.id));
              query.set("bind", "skill");
              query.set(
                "returnTo",
                location ||
                  `/academy/lesson-editor?courseId=${encodeURIComponent(String(activeCourse?.id || ""))}${
                    activeLesson?.id
                      ? `&lessonId=${encodeURIComponent(String(activeLesson.id))}`
                      : ""
                  }`,
              );
              const suffix = query.toString();
              setLocation(
                suffix ? `/academy/media?${suffix}` : "/academy/media",
              );
            }}
            sx={{
              textTransform: "none",
              color: "#f8d56f",
              border:
                "var(--academy-hairline-width, 1px) solid rgba(248,179,33,0.35)",
            }}
          >
            {tt("Åpne full Media", "Open full Media")}
          </Button>
          <Button
            onClick={applyResourcePickerSelection}
            variant="contained"
            sx={{
              textTransform: "none",
              color: "#0f0f0f",
              background: "linear-gradient(180deg, #ffd44e, #f2a616)",
            }}
          >
            {tt("Bruk valgte ressurser", "Use selected resources")}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default withUniversalIntegration(AcademyLessonStudio, {
  componentId: "academy-lesson-studio",
  componentName: "Academy Lesson Studio",
  componentType: "editor",
  componentCategory: "academy",
  featureIds: [
    "lesson-editor",
    "chapter-management",
    "resource-panel",
    "academy-curriculum",
  ],
});
