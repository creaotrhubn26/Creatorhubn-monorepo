import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  alpha,
  Avatar,
  Box,
  Button,
  Chip,
  Divider,
  IconButton,
  LinearProgress,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import {
  Add,
  ArrowBack,
  Delete,
  DragIndicator,
  Edit,
  MailOutline,
  NotificationsNone,
  PlayArrow,
  Publish,
  Save,
  Search,
  Visibility,
} from "@mui/icons-material";
import { useLocation } from "wouter";
import {
  useAcademy,
  type Lesson,
  type PedagogicalCompetencyLevel,
  type PedagogicalCompetencyMapItem,
  type PedagogicalSkillSuggestion,
  type PedagogicalStudioSuggestions,
} from "@/contexts/AcademyContext";
import { useEnhancedMasterIntegration } from "@/integration/EnhancedMasterIntegrationProvider";
import { withUniversalIntegration } from "@/integration/UniversalIntegrationHOC";
import { useAcademyLocale } from "./academyLocale";
import AcademyLocaleSwitcher from "./AcademyLocaleSwitcher";
import AcademyLeftSidebar from "./AcademyLeftSidebar";
import AcademyVideoPlayerStudio from "./AcademyVideoPlayerStudio";
import {
  resolveLinkedVideoVersionState,
} from "@/utils/academyMediaLinkUtils";

interface CourseCreatorProps {
  courseId?: string;
  onSave?: (course: any) => void;
  onCancel?: () => void;
}

interface CreatorLesson {
  id: string;
  title: string;
  description: string;
  suggestedLevel?: PedagogicalCompetencyLevel;
  competencyTitle?: string;
  duration: number;
  videoUrl: string;
  linkedVideoAssetId?: string;
  linkedVideoAssetVersion?: number;
  linkedVideoAssetName?: string;
  linkedVideoUpdatedAt?: string;
  linkedVideoFingerprint?: string;
  videoInstructorId?: string;
  thumbnail: string;
  isPreview: boolean;
  resources: any[];
}

interface CreatorModule {
  id: string;
  title: string;
  collapsed: boolean;
  lessons: CreatorLesson[];
}

type CourseArchitectureDraft = {
  competencies?: unknown;
  skills?: unknown;
  competencyMap?: unknown;
  studioSuggestions?: unknown;
};

type AcademyTextFn = (no: string, en: string) => string;
const DEFAULT_LESSON_VIDEO_URL = "/assets/academy/intro-video.mp4";

const formatLessonDurationLabel = (seconds: number): string => {
  const safeSeconds =
    Number.isFinite(seconds) && seconds > 0 ? Math.round(seconds) : 0;
  const minutes = Math.floor(safeSeconds / 60);
  const remainingSeconds = safeSeconds % 60;
  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
};

const extractVideoDisplayName = (value: string, tt: AcademyTextFn): string => {
  const url = String(value || "").trim();
  if (!url) return tt("Video", "Video");

  try {
    const normalized =
      typeof window !== "undefined"
        ? new URL(url, window.location.origin)
        : new URL(url, "https://academy.local");
    const pathname = normalized.pathname || "";
    const lastSegment = pathname.split("/").filter(Boolean).pop() || "";
    return decodeURIComponent(lastSegment || normalized.hostname || url);
  } catch {
    const fallback = url.split("/").filter(Boolean).pop() || url;
    try {
      return decodeURIComponent(fallback);
    } catch {
      return fallback;
    }
  }
};

const hasLinkedSkillVideo = (lesson: CreatorLesson): boolean => {
  const url = String(lesson.videoUrl || "").trim();
  return url.length > 0 && url !== DEFAULT_LESSON_VIDEO_URL;
};

const editorSectionCardSx = {
  border: "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.12)",
  borderRadius: "8px",
  p: 1.1,
  background: "rgba(10,14,22,0.9)",
} as const;

const editorSectionLabelSx = {
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  color: "rgba(237,240,247,0.62)",
  mb: 0.75,
} as const;

const createLesson = (title: string, durationMin: number): CreatorLesson => ({
  id: `lesson-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  title,
  description: "",
  duration: durationMin * 60,
  videoUrl: DEFAULT_LESSON_VIDEO_URL,
  linkedVideoAssetId: undefined,
  linkedVideoAssetVersion: undefined,
  linkedVideoAssetName: undefined,
  linkedVideoUpdatedAt: undefined,
  linkedVideoFingerprint: undefined,
  videoInstructorId: "",
  thumbnail: "",
  isPreview: false,
  resources: [],
});

const createDefaultModules = (_tt: AcademyTextFn): CreatorModule[] => [];

const normalizeStringList = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter((entry) => entry.length > 0);
};

const normalizeTitleKey = (value: string): string =>
  String(value || "").trim().toLowerCase();

const normalizeCompetencyMapItems = (
  value: unknown,
): PedagogicalCompetencyMapItem[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const row = entry as Record<string, unknown>;
      const title = String(row.title || "").trim();
      if (!title) return null;
      const normalizeLevelItems = (items: unknown): string[] =>
        Array.isArray(items)
          ? items
              .map((item) => String(item || "").trim())
              .filter((item) => item.length > 0)
              .slice(0, 6)
          : [];
      return {
        id:
          String(row.id || "").trim() ||
          `competency-map-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
        title,
        description: String(row.description || "").trim(),
        basic: normalizeLevelItems(row.basic),
        operational: normalizeLevelItems(row.operational),
        advanced: normalizeLevelItems(row.advanced),
      } satisfies PedagogicalCompetencyMapItem;
    })
    .filter((entry): entry is PedagogicalCompetencyMapItem => Boolean(entry));
};

const normalizeStudioSkillSuggestions = (
  value: unknown,
): PedagogicalSkillSuggestion[] => {
  const record =
    value && typeof value === "object"
      ? (value as PedagogicalStudioSuggestions)
      : undefined;
  const skills = Array.isArray(record?.skills) ? record.skills : [];
  return skills
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const title = String(entry.title || "").trim();
      const competency = String(entry.competency || "").trim();
      const objective = String(entry.objective || "").trim();
      if (!title || !competency || !objective) return null;
      const levelRaw = String(entry.level || "").trim().toLowerCase();
      const level: PedagogicalCompetencyLevel =
        levelRaw === "basic"
          ? "basic"
          : levelRaw === "advanced"
            ? "advanced"
            : "operational";
      return {
        id:
          String(entry.id || "").trim() ||
          `studio-skill-${`${competency}-${title}-${level}`.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
        title,
        competency,
        level,
        objective,
        recommendedDurationMinutes: Math.max(
          2,
          Math.min(45, Number(entry.recommendedDurationMinutes || 8) || 8),
        ),
      } satisfies PedagogicalSkillSuggestion;
    })
    .filter((entry): entry is PedagogicalSkillSuggestion => Boolean(entry))
    .slice(0, 18);
};

const competencyLevelChipLabel = (
  level: PedagogicalCompetencyLevel | undefined,
  tt: AcademyTextFn,
): string => {
  if (level === "basic") return tt("Grunnleggende", "Basic");
  if (level === "advanced") return tt("Avansert", "Advanced");
  return tt("Operativ", "Operational");
};

const toCreatorLesson = (
  lesson: Partial<Lesson> | undefined,
  fallbackTitle: string,
): CreatorLesson => ({
  id: String(
    lesson?.id || `lesson-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  ),
  title: String(lesson?.title || fallbackTitle || "").trim(),
  description: String(lesson?.description || ""),
  suggestedLevel: undefined,
  competencyTitle: undefined,
  duration: Number(lesson?.duration || 8 * 60),
  videoUrl: String(lesson?.videoUrl || DEFAULT_LESSON_VIDEO_URL),
  linkedVideoAssetId: String(lesson?.linkedVideoAssetId || "").trim() || undefined,
  linkedVideoAssetVersion: Number.isFinite(Number(lesson?.linkedVideoAssetVersion))
    ? Math.max(1, Math.round(Number(lesson?.linkedVideoAssetVersion)))
    : undefined,
  linkedVideoAssetName: String(lesson?.linkedVideoAssetName || "").trim() || undefined,
  linkedVideoUpdatedAt: String(lesson?.linkedVideoUpdatedAt || "").trim() || undefined,
  linkedVideoFingerprint: String(lesson?.linkedVideoFingerprint || "").trim() || undefined,
  videoInstructorId: String(lesson?.videoInstructorId || "").trim() || undefined,
  thumbnail: String(lesson?.thumbnail || ""),
  isPreview: Boolean(lesson?.isPreview),
  resources: Array.isArray(lesson?.resources) ? lesson.resources : [],
});

const buildModulesFromArchitecture = (
  architecture: CourseArchitectureDraft | undefined,
  existingLessons: Lesson[] | undefined,
  tt: AcademyTextFn,
): CreatorModule[] => {
  const sortedExistingLessons = Array.isArray(existingLessons)
    ? [...existingLessons].sort(
        (left, right) => Number(left.order || 0) - Number(right.order || 0),
      )
    : [];
  const fallbackLessons = sortedExistingLessons.map((lesson) =>
    toCreatorLesson(
      lesson,
      tt("Ferdighet uten tittel", "Untitled Skill"),
    ),
  );

  if (!architecture) {
    if (fallbackLessons.length === 0) return [];
    return [
      {
        id: `module-${Date.now()}-imported`,
        title: tt(
          "Kompetanse 1: Importerte ferdigheter",
          "Competency 1: Imported Skills",
        ),
        collapsed: false,
        lessons: fallbackLessons,
      },
    ];
  }

  const competencyMap = normalizeCompetencyMapItems(architecture.competencyMap);
  const studioSkillSuggestions = normalizeStudioSkillSuggestions(
    architecture.studioSuggestions,
  );
  const competencies = normalizeStringList(architecture.competencies);
  const competencyTitles =
    competencies.length > 0
      ? competencies
      : competencyMap.map((entry) => entry.title).filter((entry) => entry.length > 0);
  const skills = normalizeStringList(architecture.skills);

  if (
    competencyTitles.length === 0 &&
    skills.length === 0 &&
    studioSkillSuggestions.length === 0
  ) {
    if (fallbackLessons.length === 0) return [];
    return [
      {
        id: `module-${Date.now()}-imported`,
        title: tt(
          "Kompetanse 1: Importerte ferdigheter",
          "Competency 1: Imported Skills",
        ),
        collapsed: false,
        lessons: fallbackLessons,
      },
    ];
  }

  const usedLessonIds = new Set<string>();
  const firstUnusedLessonByOrder = () =>
    sortedExistingLessons.find(
      (lesson) => !usedLessonIds.has(String(lesson.id)),
    );

  const resolveSkillLesson = (skill: string, skillIndex: number): CreatorLesson => {
    const skillKey = normalizeTitleKey(skill);
    const exactMatch = sortedExistingLessons.find(
      (lesson) =>
        !usedLessonIds.has(String(lesson.id)) &&
        normalizeTitleKey(String(lesson.title || "")) === skillKey,
    );
    if (exactMatch) {
      usedLessonIds.add(String(exactMatch.id));
      return toCreatorLesson(exactMatch, skill);
    }

    const byIndexCandidate =
      sortedExistingLessons[skillIndex] &&
      !usedLessonIds.has(String(sortedExistingLessons[skillIndex].id))
        ? sortedExistingLessons[skillIndex]
        : undefined;
    if (byIndexCandidate) {
      usedLessonIds.add(String(byIndexCandidate.id));
      return {
        ...toCreatorLesson(byIndexCandidate, skill),
        title: skill || String(byIndexCandidate.title || ""),
      };
    }

    const byOrder = firstUnusedLessonByOrder();
    if (byOrder) {
      usedLessonIds.add(String(byOrder.id));
      return {
        ...toCreatorLesson(byOrder, skill),
        title: skill || String(byOrder.title || ""),
      };
    }

    return createLesson(skill, 8);
  };

  const resolvedSkillLessons = skills.map((skill, index) =>
    resolveSkillLesson(skill, index),
  );

  if (studioSkillSuggestions.length > 0) {
    const effectiveCompetencies =
      competencyTitles.length > 0
        ? competencyTitles
        : Array.from(
            new Set(
              studioSkillSuggestions
                .map((entry) => String(entry.competency || "").trim())
                .filter((entry) => entry.length > 0),
            ),
          );
    const lessonsByCompetency = new Map<string, CreatorLesson[]>();
    let suggestionSkillIndex = 0;

    studioSkillSuggestions.forEach((suggestion) => {
      const competency =
        String(suggestion.competency || "").trim() ||
        effectiveCompetencies[0] ||
        tt("Kompetanse", "Competency");
      const resolved = resolveSkillLesson(suggestion.title, suggestionSkillIndex);
      suggestionSkillIndex += 1;
      const nextLesson: CreatorLesson = {
        ...resolved,
        title: suggestion.title,
        description: suggestion.objective || resolved.description,
        duration: Math.max(
          resolved.duration,
          (Number(suggestion.recommendedDurationMinutes || 8) || 8) * 60,
        ),
        suggestedLevel: suggestion.level,
        competencyTitle: competency,
      };
      lessonsByCompetency.set(competency, [
        ...(lessonsByCompetency.get(competency) || []),
        nextLesson,
      ]);
    });

    const moduleTitles = effectiveCompetencies.length > 0
      ? effectiveCompetencies
      : [tt("Kompetanse 1: Læringsfokus", "Competency 1: Learning Focus")];

    return moduleTitles.map((competency, index) => ({
      id: `module-${Date.now()}-suggested-${index + 1}`,
      title:
        effectiveCompetencies.length > 0
          ? `${tt("Kompetanse", "Competency")} ${index + 1}: ${competency}`
          : competency,
      collapsed: index > 0,
      lessons:
        lessonsByCompetency.get(competency) ||
        resolvedSkillLessons.filter((_, lessonIndex) => lessonIndex % moduleTitles.length === index) ||
        [],
    }));
  }

  if (competencyTitles.length === 0) {
    return [
      {
        id: `module-${Date.now()}-skills`,
        title: tt("Kompetanse 1: Læringsfokus", "Competency 1: Learning Focus"),
        collapsed: false,
        lessons:
          resolvedSkillLessons.length > 0
            ? resolvedSkillLessons
            : fallbackLessons,
      },
    ];
  }

  const skillsByCompetency: CreatorLesson[][] = competencyTitles.map(() => []);
  const lessonsToDistribute =
    resolvedSkillLessons.length > 0 ? resolvedSkillLessons : fallbackLessons;
  lessonsToDistribute.forEach((lesson, index) => {
    skillsByCompetency[index % competencyTitles.length].push(lesson);
  });

  return competencyTitles.map((competency, index) => ({
    id: `module-${Date.now()}-${index + 1}`,
    title: `${tt("Kompetanse", "Competency")} ${index + 1}: ${competency}`,
    collapsed: index > 0,
    lessons: skillsByCompetency[index],
  }));
};

const flattenModulesToLessons = (
  sourceModules: CreatorModule[],
  currentCourseId: string,
): Lesson[] => {
  const safeCourseId = String(currentCourseId || "").trim() || "temp-course";
  return sourceModules.flatMap((module, moduleIndex) =>
    module.lessons.map((lesson, lessonIndex) => ({
      id: String(lesson.id),
      courseId: safeCourseId,
      title: String(lesson.title || ""),
      description: String(lesson.description || ""),
      videoUrl: String(lesson.videoUrl || DEFAULT_LESSON_VIDEO_URL),
      linkedVideoAssetId:
        String(lesson.linkedVideoAssetId || "").trim() || undefined,
      linkedVideoAssetVersion: Number.isFinite(Number(lesson.linkedVideoAssetVersion))
        ? Math.max(1, Math.round(Number(lesson.linkedVideoAssetVersion)))
        : undefined,
      linkedVideoAssetName:
        String(lesson.linkedVideoAssetName || "").trim() || undefined,
      linkedVideoUpdatedAt:
        String(lesson.linkedVideoUpdatedAt || "").trim() || undefined,
      linkedVideoFingerprint:
        String(lesson.linkedVideoFingerprint || "").trim() || undefined,
      videoInstructorId: String(lesson.videoInstructorId || "").trim() || undefined,
      thumbnail: lesson.thumbnail || "",
      duration: Number(lesson.duration || 0),
      order: moduleIndex * 100 + lessonIndex,
      isPreview: Boolean(lesson.isPreview),
      resources: Array.isArray(lesson.resources) ? lesson.resources : [],
    })),
  );
};

const placeholderBackgrounds = [
  "linear-gradient(145deg, rgba(22,28,40,0.92), rgba(10,14,22,0.98)), radial-gradient(circle at 82% 14%, rgba(108,141,214,0.22), rgba(0,0,0,0))",
  "linear-gradient(145deg, rgba(18,24,35,0.94), rgba(9,13,21,0.98)), radial-gradient(circle at 18% 78%, rgba(84,118,188,0.18), rgba(0,0,0,0))",
  "linear-gradient(145deg, rgba(17,22,33,0.94), rgba(8,12,20,0.98)), radial-gradient(circle at 78% 10%, rgba(243,189,74,0.14), rgba(0,0,0,0))",
];

function CourseCreator({ courseId, onSave, onCancel }: CourseCreatorProps) {
  const [location, setLocation] = useLocation();
  const {
    state,
    createCourse,
    updateCourse,
    getCourse,
    setCurrentCourse,
    setCurrentLesson,
  } = useAcademy();
  const { analytics, debugging } = useEnhancedMasterIntegration();
  const { tt, navLabel } = useAcademyLocale();

  const [leftNav, setLeftNav] = useState("course-creator");
  const [rightTab, setRightTab] = useState<
    "skill" | "settings" | "details" | "pricing"
  >("skill");
  const [selectedSkillId, setSelectedSkillId] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string>("");
  const [previewMode, setPreviewMode] = useState(false);
  const initializedModulesCourseIdRef = useRef<string>("");
  const previousRequestedSkillIdRef = useRef<string>("");

  const [course, setCourse] = useState<any>({
    id: courseId || "",
    title: "",
    description: "",
    instructor: {
      id: "current-user",
      name: "CreatorHub Instructor",
      avatar: "",
      bio: "Creative director and filmmaker",
      profession: "videographer",
    },
    thumbnail: "",
    videoUrl: DEFAULT_LESSON_VIDEO_URL,
    duration: 0,
    level: "advanced",
    category: "videography",
    tags: [],
    price: 0,
    isFree: false,
    isPublished: false,
    rating: 0,
    studentCount: 0,
    competencyLeadInstructorId: "current-user",
    lessons: [],
    prerequisites: [],
    learningOutcomes: [],
    resources: [],
  });

  const [modules, setModules] = useState<CreatorModule[]>(() =>
    createDefaultModules(tt),
  );
  const routeSearch =
    typeof window !== "undefined" ? window.location.search : "";
  const routeQuery = useMemo(
    () => new URLSearchParams(routeSearch),
    [location, routeSearch],
  );
  const routeSection = routeQuery.get("section") || "";
  const requestedSkillId =
    routeQuery.get("skillId") || routeQuery.get("lessonId") || "";
  const resolvedCourseId = useMemo(
    () => String(course.id || courseId || "").trim(),
    [course.id, courseId],
  );
  const syncCourseCreatorQuery = useCallback(
    (skillId: string) => {
      if (typeof window === "undefined") return;
      const path = window.location.pathname;
      const search = window.location.search;
      if (path !== "/academy/course-creator" && path !== "/academy/courses")
        return;

      const params = new URLSearchParams(search);
      const currentCourseId = params.get("courseId") || "";
      const currentSkillId = params.get("skillId") || "";

      const nextCourseId = resolvedCourseId || "";
      const nextSkillId = skillId || "";

      if (currentCourseId === nextCourseId && currentSkillId === nextSkillId) {
        return;
      }

      if (nextCourseId) params.set("courseId", nextCourseId);
      else params.delete("courseId");

      if (nextSkillId) params.set("skillId", nextSkillId);
      else params.delete("skillId");
      params.delete("section");

      const nextQuery = params.toString();
      const nextUrl = nextQuery ? `${path}?${nextQuery}` : path;
      const currentUrl = search ? `${path}${search}` : path;
      if (nextUrl !== currentUrl) {
        window.history.replaceState(window.history.state, "", nextUrl);
      }
    },
    [resolvedCourseId],
  );

  useEffect(() => {
    const sourceCourseId = String(
      courseId || state.currentCourse?.id || "",
    ).trim();
    if (!sourceCourseId) return;
    if (initializedModulesCourseIdRef.current === sourceCourseId) return;
    const existing = getCourse(sourceCourseId);
    if (!existing) return;

    if (String(state.currentCourse?.id || "") !== String(existing.id)) {
      setCurrentCourse(existing);
    }

    setCourse((prev: any) => ({
      ...prev,
      ...existing,
      instructor: existing.instructor || prev.instructor,
      tags: Array.isArray(existing.tags) ? existing.tags : prev.tags,
    }));

    const architectureModules = buildModulesFromArchitecture(
      existing.pedagogicalArchitecture,
      Array.isArray(existing.lessons) ? existing.lessons : [],
      tt,
    );
    if (architectureModules.length > 0) {
      setModules(architectureModules);
      initializedModulesCourseIdRef.current = sourceCourseId;
      return;
    }

    const existingLessons = Array.isArray(existing.lessons)
      ? existing.lessons
      : [];
    if (existingLessons.length > 0) {
      const moduleFromExisting: CreatorModule = {
        id: `module-${existing.id}`,
        title: tt(
          "Kompetanse 1: Importerte ferdigheter",
          "Competency 1: Imported Skills",
        ),
        collapsed: false,
        lessons: existingLessons.map((lesson: any) => ({
          id: String(lesson.id),
          title: String(
            lesson.title || tt("Ferdighet uten tittel", "Untitled Skill"),
          ),
          description: String(lesson.description || ""),
          duration: Number(lesson.duration || 0),
          videoUrl: lesson.videoUrl || DEFAULT_LESSON_VIDEO_URL,
          linkedVideoAssetId:
            String(lesson.linkedVideoAssetId || "").trim() || undefined,
          linkedVideoAssetVersion: Number.isFinite(Number(lesson.linkedVideoAssetVersion))
            ? Math.max(1, Math.round(Number(lesson.linkedVideoAssetVersion)))
            : undefined,
          linkedVideoAssetName:
            String(lesson.linkedVideoAssetName || "").trim() || undefined,
          linkedVideoUpdatedAt:
            String(lesson.linkedVideoUpdatedAt || "").trim() || undefined,
          linkedVideoFingerprint:
            String(lesson.linkedVideoFingerprint || "").trim() || undefined,
          thumbnail: "",
          isPreview: Boolean(lesson.isPreview),
          resources: Array.isArray(lesson.resources) ? lesson.resources : [],
        })),
      };
      setModules([moduleFromExisting]);
    }
    initializedModulesCourseIdRef.current = sourceCourseId;
  }, [courseId, getCourse, setCurrentCourse, state.currentCourse?.id, tt]);

  useEffect(() => {
    const activeCourseId = String(state.currentCourse?.id || "").trim();
    if (!activeCourseId || activeCourseId !== resolvedCourseId) return;
    const currentLessons = Array.isArray(state.currentCourse?.lessons)
      ? state.currentCourse.lessons
      : [];
    if (currentLessons.length === 0) return;

    const lessonsById = new Map(
      currentLessons.map((lesson) => [String(lesson.id), lesson]),
    );

    setModules((prev) => {
      let changed = false;
      const nextModules = prev.map((module) => {
        let moduleChanged = false;
        const nextLessons = module.lessons.map((lesson) => {
          const latestLesson = lessonsById.get(String(lesson.id));
          if (!latestLesson) return lesson;

          const nextDuration = Number(latestLesson.duration || 0);
          const nextVideoUrl = String(
            latestLesson.videoUrl || DEFAULT_LESSON_VIDEO_URL,
          );
          const nextResources = Array.isArray(latestLesson.resources)
            ? latestLesson.resources
            : [];
          const currentResources = Array.isArray(lesson.resources)
            ? lesson.resources
            : [];

          const sameResources =
            currentResources.length === nextResources.length &&
            currentResources.every((resource, index) => {
              const candidate = nextResources[index];
              return (
                String(resource?.id || "") === String(candidate?.id || "") &&
                String(resource?.type || "") ===
                  String(candidate?.type || "") &&
                String(resource?.title || "") ===
                  String(candidate?.title || "") &&
                String(resource?.url || "") === String(candidate?.url || "") &&
                String(resource?.mediaAssetId || "") ===
                  String(candidate?.mediaAssetId || "") &&
                Number(resource?.mediaVersion || 0) ===
                  Number(candidate?.mediaVersion || 0) &&
                String(resource?.description || "") ===
                  String(candidate?.description || "")
              );
            });

          const nextLesson: CreatorLesson = {
            ...lesson,
            duration: nextDuration,
            videoUrl: nextVideoUrl,
            linkedVideoAssetId:
              String(latestLesson.linkedVideoAssetId || "").trim() || undefined,
            linkedVideoAssetVersion: Number.isFinite(Number(latestLesson.linkedVideoAssetVersion))
              ? Math.max(1, Math.round(Number(latestLesson.linkedVideoAssetVersion)))
              : undefined,
            linkedVideoAssetName:
              String(latestLesson.linkedVideoAssetName || "").trim() || undefined,
            linkedVideoUpdatedAt:
              String(latestLesson.linkedVideoUpdatedAt || "").trim() || undefined,
            linkedVideoFingerprint:
              String(latestLesson.linkedVideoFingerprint || "").trim() || undefined,
            isPreview: Boolean(latestLesson.isPreview),
            resources: nextResources,
          };

          const sameLesson =
            Number(lesson.duration || 0) === nextDuration &&
            String(lesson.videoUrl || "") === nextVideoUrl &&
            String(lesson.linkedVideoAssetId || "") ===
              String(latestLesson.linkedVideoAssetId || "") &&
            Number(lesson.linkedVideoAssetVersion || 0) ===
              Number(latestLesson.linkedVideoAssetVersion || 0) &&
            Boolean(lesson.isPreview) === Boolean(latestLesson.isPreview) &&
            sameResources;

          if (sameLesson) return lesson;
          changed = true;
          moduleChanged = true;
          return nextLesson;
        });

        return !moduleChanged
          ? module
          : {
              ...module,
              lessons: nextLessons,
            };
      });

      return changed ? nextModules : prev;
    });

    setCourse((prev: any) => ({
      ...prev,
      videoUrl: state.currentCourse?.videoUrl || prev.videoUrl,
      linkedVideoAssetId:
        state.currentCourse?.linkedVideoAssetId || prev.linkedVideoAssetId,
      linkedVideoAssetVersion:
        state.currentCourse?.linkedVideoAssetVersion ||
        prev.linkedVideoAssetVersion,
      linkedVideoAssetName:
        state.currentCourse?.linkedVideoAssetName || prev.linkedVideoAssetName,
      linkedVideoUpdatedAt:
        state.currentCourse?.linkedVideoUpdatedAt || prev.linkedVideoUpdatedAt,
      linkedVideoFingerprint:
        state.currentCourse?.linkedVideoFingerprint ||
        prev.linkedVideoFingerprint,
      duration: Number(state.currentCourse?.duration || prev.duration || 0),
      resources: Array.isArray(state.currentCourse?.resources)
        ? state.currentCourse.resources
        : prev.resources,
      updatedAt: state.currentCourse?.updatedAt || prev.updatedAt,
    }));
  }, [
    resolvedCourseId,
    state.currentCourse?.duration,
    state.currentCourse?.id,
    state.currentCourse?.linkedVideoAssetId,
    state.currentCourse?.linkedVideoAssetName,
    state.currentCourse?.linkedVideoAssetVersion,
    state.currentCourse?.linkedVideoFingerprint,
    state.currentCourse?.linkedVideoUpdatedAt,
    state.currentCourse?.lessons,
    state.currentCourse?.resources,
    state.currentCourse?.updatedAt,
    state.currentCourse?.videoUrl,
  ]);

  useEffect(() => {
    if (routeSection === "skills") {
      setLeftNav("course-creator");
      setRightTab("skill");
      return;
    }
    if (
      location.startsWith("/academy/course-creator") ||
      location.startsWith("/academy/courses")
    ) {
      setLeftNav((prev) => (prev === "lessons" ? prev : "course-creator"));
    }
  }, [location, routeSection]);

  const flattenedLessons = useMemo(() => {
    return modules.flatMap((module, moduleIndex) =>
      module.lessons.map((lesson, lessonIndex) => ({
        ...lesson,
        courseId: course.id || courseId || "temp-course",
        order: moduleIndex * 100 + lessonIndex,
      })),
    );
  }, [modules, course.id, courseId]);

  const selectedSkillContext = useMemo(() => {
    if (!selectedSkillId) return null;

    for (let moduleIndex = 0; moduleIndex < modules.length; moduleIndex += 1) {
      const module = modules[moduleIndex];
      const lessonIndex = module.lessons.findIndex(
        (lesson) => String(lesson.id) === String(selectedSkillId),
      );
      if (lessonIndex >= 0) {
        return {
          module,
          moduleIndex,
          lesson: module.lessons[lessonIndex],
          lessonIndex,
        };
      }
    }

    return null;
  }, [modules, selectedSkillId]);

  useEffect(() => {
    if (flattenedLessons.length === 0) {
      if (selectedSkillId) setSelectedSkillId("");
      previousRequestedSkillIdRef.current = requestedSkillId;
      return;
    }

    const requestedChanged =
      previousRequestedSkillIdRef.current !== requestedSkillId;
    previousRequestedSkillIdRef.current = requestedSkillId;

    const requestedExists = requestedSkillId
      ? flattenedLessons.some(
          (lesson) => String(lesson.id) === String(requestedSkillId),
        )
      : false;
    const selectedExists = flattenedLessons.some(
      (lesson) => String(lesson.id) === String(selectedSkillId),
    );

    // Follow URL selection only when it changed externally, or when we do not have a valid local selection yet.
    if (requestedExists && (requestedChanged || !selectedExists)) {
      if (String(selectedSkillId) !== String(requestedSkillId)) {
        setSelectedSkillId(String(requestedSkillId));
      }
      return;
    }

    if (!selectedExists) {
      setSelectedSkillId(String(flattenedLessons[0].id));
    }
  }, [flattenedLessons, requestedSkillId, selectedSkillId]);

  useEffect(() => {
    if (!selectedSkillContext) return;
    const nextLesson: Lesson = {
      id: String(selectedSkillContext.lesson.id),
      courseId: resolvedCourseId || "temp-course",
      title: String(selectedSkillContext.lesson.title || ""),
      description: String(selectedSkillContext.lesson.description || ""),
      videoUrl: String(
        selectedSkillContext.lesson.videoUrl ||
          DEFAULT_LESSON_VIDEO_URL,
      ),
      linkedVideoAssetId:
        String(selectedSkillContext.lesson.linkedVideoAssetId || "").trim() ||
        undefined,
      linkedVideoAssetVersion: Number.isFinite(
        Number(selectedSkillContext.lesson.linkedVideoAssetVersion),
      )
        ? Math.max(
            1,
            Math.round(Number(selectedSkillContext.lesson.linkedVideoAssetVersion)),
          )
        : undefined,
      linkedVideoAssetName:
        String(selectedSkillContext.lesson.linkedVideoAssetName || "").trim() ||
        undefined,
      linkedVideoUpdatedAt:
        String(selectedSkillContext.lesson.linkedVideoUpdatedAt || "").trim() ||
        undefined,
      linkedVideoFingerprint:
        String(selectedSkillContext.lesson.linkedVideoFingerprint || "").trim() ||
        undefined,
      duration: Number(selectedSkillContext.lesson.duration || 0),
      order:
        selectedSkillContext.moduleIndex * 100 +
        selectedSkillContext.lessonIndex,
      isPreview: Boolean(selectedSkillContext.lesson.isPreview),
      resources: Array.isArray(selectedSkillContext.lesson.resources)
        ? selectedSkillContext.lesson.resources
        : [],
    };

    const currentLesson = state.currentLesson;
    const currentResources = Array.isArray(currentLesson?.resources)
      ? currentLesson.resources
      : [];
    const nextResources = Array.isArray(nextLesson.resources)
      ? nextLesson.resources
      : [];
    const sameResources =
      currentResources.length === nextResources.length &&
      currentResources.every((resource, index) => {
        const candidate = nextResources[index];
        return (
          String(resource?.id || "") === String(candidate?.id || "") &&
          String(resource?.type || "") === String(candidate?.type || "") &&
          String(resource?.title || "") === String(candidate?.title || "") &&
          String(resource?.url || "") === String(candidate?.url || "") &&
          String(resource?.mediaAssetId || "") ===
            String(candidate?.mediaAssetId || "") &&
          Number(resource?.mediaVersion || 0) ===
            Number(candidate?.mediaVersion || 0) &&
          String(resource?.description || "") ===
            String(candidate?.description || "")
        );
      });

    const sameLesson =
      currentLesson &&
      String(currentLesson.id || "") === String(nextLesson.id || "") &&
      String(currentLesson.courseId || "") ===
        String(nextLesson.courseId || "") &&
      String(currentLesson.title || "") === String(nextLesson.title || "") &&
      String(currentLesson.description || "") ===
        String(nextLesson.description || "") &&
      String(currentLesson.videoUrl || "") ===
        String(nextLesson.videoUrl || "") &&
      String(currentLesson.linkedVideoAssetId || "") ===
        String(nextLesson.linkedVideoAssetId || "") &&
      Number(currentLesson.linkedVideoAssetVersion || 0) ===
        Number(nextLesson.linkedVideoAssetVersion || 0) &&
      Number(currentLesson.duration || 0) ===
        Number(nextLesson.duration || 0) &&
      Number(currentLesson.order || 0) === Number(nextLesson.order || 0) &&
      Boolean(currentLesson.isPreview) === Boolean(nextLesson.isPreview) &&
      sameResources;

    if (sameLesson) return;
    setCurrentLesson(nextLesson);
  }, [
    resolvedCourseId,
    selectedSkillContext,
    setCurrentLesson,
    state.currentLesson,
  ]);

  useEffect(() => {
    if (!selectedSkillId) return;
    syncCourseCreatorQuery(selectedSkillId);
  }, [selectedSkillId, syncCourseCreatorQuery]);

  const completionRate = useMemo(() => {
    if (flattenedLessons.length === 0) return 0;
    return Math.min(
      100,
      Math.round((flattenedLessons.length * 17 + course.tags.length * 4) % 100),
    );
  }, [flattenedLessons.length, course.tags.length]);

  const totalDurationMinutes = useMemo(() => {
    return Math.round(
      flattenedLessons.reduce(
        (sum, lesson) => sum + Number(lesson.duration || 0),
        0,
      ) / 60,
    );
  }, [flattenedLessons]);

  const previewCourse = useMemo(() => {
    return {
      ...course,
      lessons: flattenedLessons,
      duration: totalDurationMinutes,
      isPublished: course.isPublished,
    };
  }, [course, flattenedLessons, totalDurationMinutes]);

  const previewLesson = flattenedLessons[0] || null;
  const selectedSkill = selectedSkillContext?.lesson || null;
  const selectedSkillModuleTitle = selectedSkillContext?.module.title || "";
  const selectedSkillHasLinkedVideo = selectedSkill
    ? hasLinkedSkillVideo(selectedSkill)
    : false;
  const selectedSkillVideoVersionState = useMemo(
    () =>
      resolveLinkedVideoVersionState({
        carrier: selectedSkill,
        course: previewCourse,
        fallbackName: tt("Video", "Video"),
      }),
    [previewCourse, selectedSkill, tt],
  );
  const selectedSkillVideoLabel =
    selectedSkill && selectedSkillHasLinkedVideo
      ? selectedSkillVideoVersionState.displayName ||
        extractVideoDisplayName(selectedSkill.videoUrl, tt)
      : "";
  const hasSkills = flattenedLessons.length > 0;
  const rightPanelDisabled = !hasSkills;
  const rightPanelPrimaryTitle = useMemo(() => {
    if (rightTab === "skill") {
      const skillTitle = String(selectedSkill?.title || "").trim();
      return skillTitle.length > 0
        ? skillTitle
        : tt("Ferdighetstittel", "Skill Title");
    }

    const courseTitle = String(course.title || "").trim();
    return courseTitle.length > 0 ? courseTitle : tt("Kurstittel", "Course Title");
  }, [course.title, rightTab, selectedSkill?.title, tt]);

  useEffect(() => {
    if (rightPanelDisabled && rightTab !== "skill") {
      setRightTab("skill");
    }
  }, [rightPanelDisabled, rightTab]);

  const persistCourseStructure = useCallback(
    async (
      moduleSnapshot: CreatorModule[],
      options?: {
        forceCreate?: boolean;
        successMessage?: string;
        courseOverride?: Partial<any>;
      },
    ) => {
      try {
        const shouldForceCreate = options?.forceCreate === true;
        const baseCourseState = {
          ...course,
          ...(options?.courseOverride || {}),
        };
        const existingCourseId = shouldForceCreate
          ? ""
          : String(baseCourseState.id || courseId || "").trim();
        const courseIdForLessons = existingCourseId || "temp-course";
        const snapshotLessons = flattenModulesToLessons(
          moduleSnapshot,
          courseIdForLessons,
        );
        const snapshotDurationMinutes = Math.round(
          snapshotLessons.reduce(
            (sum, lesson) => sum + Number(lesson.duration || 0),
            0,
          ) / 60,
        );

        const competencyTitles = moduleSnapshot
          .map((module) =>
            String(module.title || "")
              .replace(/^(Kompetanse|Competency)\s*\d+\s*:\s*/i, "")
              .trim(),
          )
          .filter((title) => title.length > 0);

        const skillTitles = snapshotLessons
          .map((lesson) => String(lesson.title || "").trim())
          .filter((title) => title.length > 0);

        const nextArchitecture = {
          ...(baseCourseState.pedagogicalArchitecture || {}),
          competencies: competencyTitles,
          skills: skillTitles,
        };

        const basePayload = {
          ...baseCourseState,
          id: shouldForceCreate ? "" : baseCourseState.id,
          title:
            typeof baseCourseState.title === "string" &&
            baseCourseState.title.trim().length > 0
              ? baseCourseState.title.trim()
              : tt("Nytt kurs", "New Course"),
          lessons: snapshotLessons,
          pedagogicalArchitecture: nextArchitecture,
          duration: snapshotDurationMinutes,
          isPublished: shouldForceCreate ? false : baseCourseState.isPublished,
          updatedAt: new Date().toISOString(),
        };

        if (existingCourseId) {
          const updatedCourse = {
            ...basePayload,
            id: existingCourseId,
            createdAt: basePayload.createdAt || new Date().toISOString(),
          };
          await updateCourse(updatedCourse);
          setCurrentCourse(updatedCourse);
          setCourse((prev: any) => ({ ...prev, ...updatedCourse }));
        } else {
          const {
            id: _discardedId,
            createdAt: _discardedCreatedAt,
            updatedAt: _discardedUpdatedAt,
            ...createPayload
          } = basePayload;
          const created = await createCourse(createPayload);
          setCurrentCourse(created);
          setCourse((prev: any) => ({ ...prev, ...created }));
          setLocation(
            `/academy/course-creator?courseId=${encodeURIComponent(String(created.id || ""))}`,
          );
        }

        if (options?.successMessage) {
          setSaveMessage(options.successMessage);
        }
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : tt(
                "Kunne ikke lagre kursstruktur.",
                "Failed to save course structure.",
              );
        setSaveMessage(message);
        debugging.logIntegration(
          "error",
          "Course creator structure persistence failed",
          {
            error: message,
          },
        );
      }
    },
    [
      course,
      courseId,
      createCourse,
      debugging,
      setCurrentCourse,
      setLocation,
      tt,
      updateCourse,
    ],
  );

  const openCreateCompetencyInCurriculum = useCallback(() => {
    setLeftNav("curriculum");
    const params = new URLSearchParams();
    if (resolvedCourseId) {
      params.set("courseId", resolvedCourseId);
    }
    params.set("createCompetency", "1");
    setLocation(`/academy/curriculum?${params.toString()}`);
  }, [resolvedCourseId, setLocation]);

  const addLessonToModule = useCallback(
    (moduleId: string) => {
      const nextLesson = createLesson(tt("Ny ferdighet", "New Skill"), 7);
      setModules((prev) => {
        const nextModules = prev.map((module) => {
          if (module.id !== moduleId) return module;
          return {
            ...module,
            collapsed: false,
            lessons: [...module.lessons, nextLesson],
          };
        });
        void persistCourseStructure(nextModules, {
          successMessage: tt("Ny ferdighet lagret.", "New skill saved."),
        });
        return nextModules;
      });
      setSelectedSkillId(nextLesson.id);
      setRightTab("skill");
      syncCourseCreatorQuery(nextLesson.id);
      setSaveMessage(tt("Ny ferdighet lagt til.", "New skill added."));
    },
    [persistCourseStructure, syncCourseCreatorQuery, tt],
  );

  const updateLessonField = useCallback(
    (
      moduleId: string,
      lessonId: string,
      field: keyof CreatorLesson,
      value: string | number | boolean,
    ) => {
      setModules((prev) =>
        prev.map((module) => {
          if (module.id !== moduleId) return module;
          return {
            ...module,
            lessons: module.lessons.map((lesson) => {
              if (lesson.id !== lessonId) return lesson;
              return { ...lesson, [field]: value };
            }),
          };
        }),
      );
    },
    [],
  );

  const removeLesson = useCallback((moduleId: string, lessonId: string) => {
    setModules((prev) =>
      prev.map((module) => {
        if (module.id !== moduleId) return module;
        return {
          ...module,
          lessons: module.lessons.filter((lesson) => lesson.id !== lessonId),
        };
      }),
    );
    setSelectedSkillId((prev) =>
      String(prev) === String(lessonId) ? "" : prev,
    );
  }, []);

  const toggleModuleCollapsed = useCallback((moduleId: string) => {
    setModules((prev) =>
      prev.map((module) =>
        module.id === moduleId
          ? { ...module, collapsed: !module.collapsed }
          : module,
      ),
    );
  }, []);

  const handleSkillSelect = useCallback(
    (lessonId: string) => {
      setSelectedSkillId(lessonId);
      setRightTab("skill");
      syncCourseCreatorQuery(lessonId);
    },
    [syncCourseCreatorQuery],
  );

  const openMediaVideoBinding = useCallback(
    (lessonId: string) => {
      if (!resolvedCourseId) {
        setSaveMessage(
          tt(
            "Lagre kurset først for å koble video.",
            "Save the course first to link video.",
          ),
        );
        return;
      }

      const existingCourse = getCourse(resolvedCourseId);
      if (existingCourse) {
        setCurrentCourse(existingCourse);
        const nextLesson =
          existingCourse.lessons.find(
            (lesson) => String(lesson.id) === String(lessonId),
          ) || null;
        setCurrentLesson(nextLesson);
      }

      const query = new URLSearchParams();
      query.set("courseId", resolvedCourseId);
      query.set("lessonId", String(lessonId));
      query.set("bind", "skill");
      const fallbackReturnTo = `/academy/course-creator?courseId=${encodeURIComponent(resolvedCourseId)}&skillId=${encodeURIComponent(String(lessonId))}`;
      const exactReturnTo =
        typeof window !== "undefined"
          ? `${window.location.pathname}${window.location.search}`
          : "";
      query.set(
        "returnTo",
        exactReturnTo.startsWith("/academy/")
          ? exactReturnTo
          : fallbackReturnTo,
      );
      setLocation(`/academy/media?${query.toString()}`);

      analytics.trackEvent("course_creator_media_binding_opened", {
        courseId: resolvedCourseId,
        lessonId,
        timestamp: Date.now(),
      });
    },
    [
      analytics,
      getCourse,
      location,
      resolvedCourseId,
      setCurrentCourse,
      setCurrentLesson,
      setLocation,
      tt,
    ],
  );

  const saveCourse = useCallback(
    async (publish: boolean) => {
      setSaving(true);
      setSaveMessage("");
      try {
        const competencyTitles = modules
          .map((module) =>
            String(module.title || "")
              .replace(/^(Kompetanse|Competency)\s*\d+\s*:\s*/i, "")
              .trim(),
          )
          .filter((title) => title.length > 0);
        const skillTitles = flattenedLessons
          .map((lesson) => String(lesson.title || "").trim())
          .filter((title) => title.length > 0);

        const nextArchitecture = {
          ...(course.pedagogicalArchitecture || {}),
          competencies: competencyTitles,
          skills: skillTitles,
        };

        const payload = {
          ...course,
          title:
            typeof course.title === "string" && course.title.trim().length > 0
              ? course.title.trim()
              : tt("Nytt kurs", "New Course"),
          lessons: flattenedLessons,
          pedagogicalArchitecture: nextArchitecture,
          duration: totalDurationMinutes,
          isPublished: publish ? true : course.isPublished,
          updatedAt: new Date().toISOString(),
        };

        if (courseId || course.id) {
          const id = course.id || courseId;
          const updatedCourse = {
            ...payload,
            id,
            createdAt: payload.createdAt || new Date().toISOString(),
          };
          await updateCourse(updatedCourse);
          setCurrentCourse(updatedCourse);
          setCourse((prev: any) => ({
            ...prev,
            id,
            isPublished: publish ? true : prev.isPublished,
          }));
        } else {
          const created = await createCourse(payload);
          setCurrentCourse(created);
          setCourse((prev: any) => ({ ...prev, ...created }));
        }

        const message = publish
          ? tt("Kurs publisert.", "Course published.")
          : tt("Utkast lagret.", "Draft saved.");
        setSaveMessage(message);
        analytics.trackEvent(
          publish ? "course_creator_publish" : "course_creator_save",
          {
            courseTitle: payload.title,
            competencyCount: modules.length,
            skillCount: payload.lessons.length,
            lessonCount: payload.lessons.length,
            moduleCount: modules.length,
          },
        );
        onSave?.(payload);
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : tt("Kunne ikke lagre kurs.", "Failed to save course.");
        setSaveMessage(message);
        debugging.logIntegration("error", "Course creator save failed", {
          error: message,
        });
      } finally {
        setSaving(false);
      }
    },
    [
      analytics,
      course,
      courseId,
      createCourse,
      debugging,
      flattenedLessons,
      modules.length,
      onSave,
      setCurrentCourse,
      totalDurationMinutes,
      tt,
      updateCourse,
    ],
  );

  const addTag = useCallback(() => {
    const newTag = window.prompt(tt("Skriv inn ny tagg", "Enter new tag"));
    if (!newTag) return;
    setCourse((prev: any) => {
      if (prev.tags.includes(newTag.trim().toLowerCase())) return prev;
      return { ...prev, tags: [...prev.tags, newTag.trim().toLowerCase()] };
    });
  }, [tt]);

  if (previewMode && previewLesson) {
    return (
      <Box sx={{ minHeight: "100vh", bgcolor: "#05080f" }}>
        <Box sx={{ px: 2, py: 1.5 }}>
          <Button
            startIcon={<ArrowBack />}
            onClick={() => setPreviewMode(false)}
            sx={{
              color: "#edf0f7",
              textTransform: "none",
              borderRadius: "8px",
              border:
                "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.18)",
            }}
          >
            {tt("Tilbake til ferdighetsbygger", "Back to Skills Builder")}
          </Button>
        </Box>
        <AcademyVideoPlayerStudio
          courseId={previewCourse.id}
          lessonId={previewLesson.id}
        />
      </Box>
    );
  }

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
          display: "grid",
          gridTemplateColumns: {
            xs: "1fr",
            lg: "minmax(220px, 260px) minmax(0, 1fr)",
            xl: "minmax(220px, 260px) minmax(0, 1fr) minmax(300px, var(--academy-right-panel-width, 360px))",
          },
          minHeight: "100vh",
          position: "relative",
          zIndex: 1,
          width: "min(100%, var(--academy-shell-max-width, 1920px))",
          mx: "auto",
          overflowX: "hidden",
        }}
      >
        <AcademyLeftSidebar
          activeNav={leftNav}
          onNavigate={(navId, route) => {
            setLeftNav(navId);
            setLocation(route);
          }}
          onCreateCourse={openCreateCompetencyInCurriculum}
          tt={tt}
          navLabel={navLabel}
        />

        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            minWidth: 0,
          }}
        >
          <Box
            sx={{
              px: { xs: 2, md: 3 },
              py: 1.4,
              borderBottom:
                "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.08)",
              background:
                "linear-gradient(180deg, rgba(13,16,25,0.95), rgba(10,13,20,0.9))",
            }}
          >
            <Stack
              direction="row"
              justifyContent="space-between"
              alignItems="center"
              sx={{ gap: 1, flexWrap: "wrap" }}
            >
              <Stack
                direction="row"
                spacing={1.4}
                alignItems="center"
                sx={{ minWidth: 260, flex: 1 }}
              >
                <Stack direction="row" spacing={0.9} alignItems="center">
                  <Typography
                    sx={{
                      fontFamily: "Barlow Condensed, sans-serif",
                      letterSpacing: "0.16em",
                      fontSize: 15,
                      color: "rgba(237,240,247,0.8)",
                    }}
                  >
                    ACADEMY
                  </Typography>
                  <Chip
                    size="small"
                    label={tt("Ferdighetsbygger", "Skills Builder")}
                    sx={{
                      height: 28,
                      bgcolor: "rgba(255,255,255,0.08)",
                      color: "#edf0f7",
                      border:
                        "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.14)",
                      fontWeight: 700,
                    }}
                  />
                </Stack>
                <TextField
                  size="small"
                  placeholder={tt(
                    "Søk kompetanser...",
                    "Search competencies...",
                  )}
                  InputProps={{
                    startAdornment: (
                      <Box
                        sx={{ display: "flex", alignItems: "center", mr: 0.8 }}
                      >
                        <Search
                          sx={{ fontSize: 18, color: "rgba(237,240,247,0.65)" }}
                        />
                      </Box>
                    ),
                  }}
                  sx={{
                    minWidth: 210,
                    "& .MuiOutlinedInput-root": {
                      color: "#edf0f7",
                      borderRadius: "12px",
                      background: "rgba(10,14,22,0.8)",
                      "& fieldset": { borderColor: "rgba(255,255,255,0.14)" },
                      "&:hover fieldset": {
                        borderColor: "rgba(255,255,255,0.22)",
                      },
                    },
                  }}
                />
              </Stack>

              <Stack direction="row" spacing={1} alignItems="center">
                <AcademyLocaleSwitcher />
                <IconButton
                  onClick={() =>
                    setLocation("/academy/settings?tab=notifications")
                  }
                  aria-label={tt("Varsler", "Notifications")}
                  sx={{ color: "rgba(237,240,247,0.75)" }}
                >
                  <NotificationsNone />
                </IconButton>
                <IconButton
                  onClick={() => setLocation("/academy/settings?tab=messages")}
                  aria-label={tt("Meldinger", "Messages")}
                  sx={{ color: "rgba(237,240,247,0.75)" }}
                >
                  <MailOutline />
                </IconButton>
                <IconButton
                  onClick={() => setLocation("/academy/settings?tab=profile")}
                  aria-label={tt("Profil", "Profile")}
                  sx={{ p: 0 }}
                >
                  <Avatar
                    sx={{
                      width: 32,
                      height: 32,
                      bgcolor: "rgba(255,255,255,0.08)",
                      color: "#edf0f7",
                      border: "1px solid rgba(255,255,255,0.16)",
                    }}
                  >
                    C
                  </Avatar>
                </IconButton>
              </Stack>
            </Stack>
          </Box>

          <Box
            sx={{
              px: { xs: 2, md: 3 },
              py: 1.5,
              borderBottom:
                "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.08)",
            }}
          >
            <Stack
              direction="row"
              justifyContent="space-between"
              alignItems={{ xs: "flex-start", xl: "center" }}
              sx={{ gap: 1, flexWrap: "wrap", minWidth: 0 }}
            >
              <Stack
                direction="row"
                spacing={1.4}
                alignItems="center"
                sx={{ minWidth: 260, flex: "1 1 320px" }}
              >
                {hasSkills ? (
                  <>
                    <TextField
                      value={course.title}
                      placeholder={tt("Skriv ferdighetstittel", "Enter skill title")}
                      onChange={(event) =>
                        setCourse((prev: any) => ({
                          ...prev,
                          title: event.target.value,
                        }))
                      }
                      variant="standard"
                      InputProps={{ disableUnderline: true }}
                      sx={{
                        "& .MuiInputBase-input": {
                          fontFamily: "Barlow Condensed, sans-serif",
                          fontSize: "clamp(1.22rem, 1.05rem + 0.45vw, 1.6rem)",
                          color: "#edf0f7",
                          lineHeight: 1,
                        },
                      }}
                    />
                    <Chip
                      size="small"
                      label={
                        course.isPublished
                          ? tt("Publisert", "Published")
                          : tt("Utkast", "Draft")
                      }
                      sx={{
                        bgcolor: course.isPublished
                          ? alpha("#f5a623", 0.26)
                          : alpha("#9aa5b6", 0.2),
                        color: "#edf0f7",
                        border:
                          "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.2)",
                        fontFamily: "Rajdhani, sans-serif",
                        fontWeight: 700,
                      }}
                    />
                  </>
                ) : (
                  <Stack spacing={0.8} sx={{ py: 0.2 }}>
                    <Typography
                      sx={{
                        fontFamily: "Barlow Condensed, sans-serif",
                        fontSize: "clamp(1.1rem, 1rem + 0.35vw, 1.4rem)",
                        color: "#edf0f7",
                      }}
                    >
                      {tt(
                        "Ingen ferdigheter opprettet ennå",
                        "No skills created yet",
                      )}
                    </Typography>
                    <Typography
                      sx={{
                        fontFamily: "Rajdhani, sans-serif",
                        color: "rgba(237,240,247,0.72)",
                      }}
                    >
                      {tt(
                        "Opprett ferdighet i Kompetansegrunnlag før du bruker Ferdighetsbygger.",
                        "Create a skill in Competency Foundation before using Skills Builder.",
                      )}
                    </Typography>
                  </Stack>
                )}
              </Stack>

              <Stack
                direction="row"
                spacing={1}
                alignItems="center"
                sx={{
                  flex: "1 1 420px",
                  minWidth: 0,
                  justifyContent: { xs: "flex-start", xl: "flex-end" },
                  py: 0.2,
                  rowGap: 0.4,
                  flexWrap: "wrap",
                  "& > *": { flexShrink: 0 },
                }}
              >
                <Button
                  startIcon={<Visibility />}
                  onClick={() => setPreviewMode(true)}
                  sx={{
                    textTransform: "none",
                    color: "#edf0f7",
                    minWidth: 112,
                    borderRadius: "12px",
                    border:
                      "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.22)",
                    px: 2,
                  }}
                >
                  {tt("Forhåndsvis (student)", "Preview (learner)")}
                </Button>
                <Button
                  startIcon={<Save />}
                  onClick={() => void saveCourse(false)}
                  disabled={saving}
                  sx={{
                    textTransform: "none",
                    color: "#edf0f7",
                    minWidth: 112,
                    borderRadius: "12px",
                    border:
                      "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.22)",
                    px: 2,
                  }}
                >
                  {tt("Lagre", "Save")}
                </Button>
                <Button
                  startIcon={<Publish />}
                  onClick={() => void saveCourse(true)}
                  disabled={saving}
                  sx={{
                    textTransform: "none",
                    minWidth: 112,
                    borderRadius: "12px",
                    px: 2.1,
                    color: "#1f1304",
                    fontWeight: 700,
                    background:
                      "linear-gradient(180deg, #ffd36d 0%, #f5a623 100%)",
                    "&:hover": {
                      background:
                        "linear-gradient(180deg, #ffe08d 0%, #f6b640 100%)",
                    },
                  }}
                >
                  {tt("Publiser", "Publish")}
                </Button>
              </Stack>
            </Stack>
          </Box>

          <Box
            sx={{
              p: { xs: 2, md: 3 },
              flex: 1,
              overflow: "auto",
              background:
                "linear-gradient(180deg, rgba(8,12,18,0.84) 0%, rgba(7,10,16,0.9) 100%)",
            }}
          >
            <Typography
              sx={{
                mb: 1.4,
                color: "rgba(237,240,247,0.88)",
                fontFamily: "Rajdhani, sans-serif",
                fontWeight: 700,
                letterSpacing: "0.01em",
              }}
            >
              {tt("Ferdigheter", "Skills")}
            </Typography>

            {!!saveMessage && (
              <Typography
                sx={{
                  mb: 1.4,
                  px: 1.1,
                  py: 0.8,
                  borderRadius: "8px",
                  border:
                    "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.12)",
                  background: "rgba(16,21,31,0.82)",
                  color: "#edf0f7",
                  fontFamily: "Rajdhani, sans-serif",
                }}
              >
                {saveMessage}
              </Typography>
            )}

            {!hasSkills && (
              <Box
                sx={{
                  mb: 1.4,
                  border:
                    "var(--academy-hairline-width, 1px) dashed rgba(255,255,255,0.18)",
                  borderRadius: "10px",
                  p: 1.4,
                  background: "rgba(14,19,28,0.86)",
                }}
              >
                <Typography
                  sx={{
                    color: "#edf0f7",
                    fontFamily: "Barlow Condensed, sans-serif",
                    fontSize: "clamp(1.05rem, 0.96rem + 0.2vw, 1.16rem)",
                  }}
                >
                  {tt(
                    "Ingen ferdigheter finnes i Kompetansegrunnlag ennå.",
                    "No skills exist in Competency Foundation yet.",
                  )}
                </Typography>
                <Typography
                  sx={{
                    mt: 0.6,
                    color: "rgba(237,240,247,0.82)",
                    fontFamily: "Rajdhani, sans-serif",
                  }}
                >
                  {tt(
                    "Legg til ferdigheter i Kompetansegrunnlag for å aktivere redigering i Ferdighetsbygger.",
                    "Add skills in Competency Foundation to enable editing in Skills Builder.",
                  )}
                </Typography>
                <Button
                  onClick={openCreateCompetencyInCurriculum}
                  sx={{
                    mt: 1,
                    textTransform: "none",
                    color: "#1f1304",
                    fontWeight: 700,
                    borderRadius: "8px",
                    background:
                      "linear-gradient(180deg, #ffd36d 0%, #f5a623 100%)",
                    "&:hover": {
                      background:
                        "linear-gradient(180deg, #ffe08d 0%, #f6b640 100%)",
                    },
                  }}
                >
                  {tt("Åpne Kompetansegrunnlag", "Open Competency Foundation")}
                </Button>
              </Box>
            )}

            <Stack spacing={1.3}>
              {modules.map((module, moduleIndex) => {
                const moduleProgress = Math.max(
                  12,
                  Math.round(
                    (module.lessons.length * 100) /
                      Math.max(flattenedLessons.length, 1),
                  ),
                );
                return (
                  <Box
                    key={module.id}
                    sx={{
                      border:
                        "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.14)",
                      borderRadius: "10px",
                      overflow: "hidden",
                      background: "rgba(8,12,18,0.78)",
                    }}
                  >
                    <Stack
                      direction="row"
                      alignItems="center"
                      justifyContent="space-between"
                      sx={{ px: 1.35, py: 0.95, gap: 1 }}
                    >
                      <Stack
                        direction="row"
                        alignItems="center"
                        spacing={1.1}
                        sx={{ minWidth: 0, flex: 1 }}
                      >
                        <Button
                          onClick={() => toggleModuleCollapsed(module.id)}
                          sx={{
                            minWidth: 0,
                            px: 0.6,
                            flexShrink: 0,
                            color: "rgba(237,240,247,0.8)",
                            textTransform: "none",
                          }}
                        >
                          {module.collapsed ? "▸" : "▾"}
                        </Button>
                        <TextField
                          variant="standard"
                          value={module.title}
                          onChange={(event) => {
                            const value = event.target.value;
                            setModules((prev) =>
                              prev.map((item) =>
                                item.id === module.id
                                  ? { ...item, title: value }
                                  : item,
                              ),
                            );
                          }}
                          InputProps={{ disableUnderline: true }}
                          sx={{
                            flex: 1,
                            minWidth: 0,
                            "& .MuiInputBase-input": {
                              width: "100%",
                              color: "#edf0f7",
                              fontSize:
                                "clamp(1rem, 0.93rem + 0.16vw, 1.08rem)",
                              fontFamily: "Barlow Condensed, sans-serif",
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            },
                          }}
                        />
                      </Stack>

                      <Stack
                        direction="row"
                        spacing={0.9}
                        alignItems="center"
                        sx={{ flexShrink: 0 }}
                      >
                        <Typography
                          sx={{
                            fontFamily: "Rajdhani, sans-serif",
                            fontWeight: 700,
                            color: "#f8c551",
                            minWidth: 42,
                            textAlign: "right",
                          }}
                        >
                          {moduleProgress}%
                        </Typography>
                        <LinearProgress
                          variant="determinate"
                          value={moduleProgress}
                          sx={{
                            width: 110,
                            height: 6,
                            borderRadius: 999,
                            bgcolor: "rgba(255,255,255,0.18)",
                            "& .MuiLinearProgress-bar": {
                              borderRadius: 999,
                              background:
                                "linear-gradient(90deg, #f5a623 0%, #ffd26a 100%)",
                            },
                          }}
                        />
                      </Stack>
                    </Stack>

                    {!module.collapsed && (
                      <Box
                        sx={{
                          borderTop:
                            "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.08)",
                        }}
                      >
                        {module.lessons.map((lesson, lessonIndex) => {
                          const isSelectedSkill =
                            String(selectedSkillId) === String(lesson.id);
                          const hasLinkedVideo = hasLinkedSkillVideo(lesson);
                          const lessonVideoVersionState =
                            resolveLinkedVideoVersionState({
                              carrier: lesson,
                              course: previewCourse,
                              fallbackName: tt("Video", "Video"),
                            });
                          const linkedVideoLabel = hasLinkedVideo
                            ? lessonVideoVersionState.displayName ||
                              extractVideoDisplayName(lesson.videoUrl, tt)
                            : "";
                          return (
                            <Stack
                              key={lesson.id}
                              direction="row"
                              spacing={1.2}
                              alignItems="center"
                              onClick={() =>
                                handleSkillSelect(String(lesson.id))
                              }
                              sx={{
                                px: 1.4,
                                py: 1.05,
                                cursor: "pointer",
                                background: isSelectedSkill
                                  ? "linear-gradient(90deg, rgba(89,118,184,0.16), rgba(89,118,184,0.04))"
                                  : "transparent",
                                borderBottom:
                                  lessonIndex === module.lessons.length - 1
                                    ? "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.06)"
                                    : "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.08)",
                              }}
                            >
                              <DragIndicator
                                sx={{
                                  fontSize: 17,
                                  color: "rgba(237,240,247,0.4)",
                                }}
                              />
                              <Box
                                sx={{
                                  width: 156,
                                  minWidth: 156,
                                  height: 72,
                                  borderRadius: "7px",
                                  border:
                                    "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.12)",
                                  background: lesson.thumbnail
                                    ? `url(${lesson.thumbnail}) center / cover no-repeat`
                                    : placeholderBackgrounds[
                                        (moduleIndex + lessonIndex) %
                                          placeholderBackgrounds.length
                                      ],
                                }}
                              />

                              <Box sx={{ flex: 1, minWidth: 0 }}>
                                <TextField
                                  variant="standard"
                                  value={lesson.title}
                                  onChange={(event) =>
                                    updateLessonField(
                                      module.id,
                                      lesson.id,
                                      "title",
                                      event.target.value,
                                    )
                                  }
                                  InputProps={{ disableUnderline: true }}
                                  sx={{
                                    width: "100%",
                                    "& .MuiInputBase-input": {
                                      color: "#edf0f7",
                                      fontFamily:
                                        "Barlow Condensed, sans-serif",
                                      fontSize:
                                        "clamp(0.98rem, 0.92rem + 0.12vw, 1.05rem)",
                                      lineHeight: 1,
                                    },
                                  }}
                                />

                                {hasLinkedVideo ? (
                                  <Stack
                                    direction="row"
                                    spacing={0.8}
                                    alignItems="center"
                                    useFlexGap
                                    flexWrap="wrap"
                                    sx={{ mt: 0.55, minWidth: 0 }}
                                  >
                                    <Chip
                                      size="small"
                                      icon={<PlayArrow fontSize="small" />}
                                      label={
                                        lessonVideoVersionState.hasUpdate
                                          ? tt(
                                              "Ny versjon",
                                              "New version",
                                            )
                                          : tt(
                                              "Video koblet",
                                              "Video linked",
                                            )
                                      }
                                      sx={{
                                        height: 22,
                                        bgcolor: lessonVideoVersionState.hasUpdate
                                          ? "rgba(255,170,66,0.14)"
                                          : "rgba(92,180,128,0.14)",
                                        color: lessonVideoVersionState.hasUpdate
                                          ? "#ffd8aa"
                                          : "#d8f4df",
                                        border: lessonVideoVersionState.hasUpdate
                                          ? "var(--academy-hairline-width, 1px) solid rgba(255,170,66,0.28)"
                                          : "var(--academy-hairline-width, 1px) solid rgba(92,180,128,0.24)",
                                        fontFamily: "Rajdhani, sans-serif",
                                        fontWeight: 700,
                                        ".MuiChip-icon": {
                                          color: lessonVideoVersionState.hasUpdate
                                            ? "#ffd8aa"
                                            : "#9ee2ae",
                                        },
                                      }}
                                    />
                                    <Typography
                                      sx={{
                                        minWidth: 0,
                                        maxWidth: { xs: "100%", md: 320 },
                                        color: "rgba(237,240,247,0.7)",
                                        fontSize: 12,
                                        whiteSpace: "nowrap",
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                      }}
                                    >
                                      {lessonVideoVersionState.hasUpdate
                                        ? `${linkedVideoLabel} · v${lessonVideoVersionState.linkedVersion} -> v${lessonVideoVersionState.currentVersion}`
                                        : `${linkedVideoLabel} · ${formatLessonDurationLabel(
                                            Number(lesson.duration || 0),
                                          )}`}
                                    </Typography>
                                  </Stack>
                                ) : null}

                                <Stack
                                  direction="row"
                                  spacing={1}
                                  alignItems="center"
                                  useFlexGap
                                  flexWrap="wrap"
                                  sx={{ mt: 0.4 }}
                                >
                                  <TextField
                                    size="small"
                                    value={Math.round(lesson.duration / 60)}
                                    onChange={(event) => {
                                      const minutes = Number(
                                        event.target.value || 0,
                                      );
                                      updateLessonField(
                                        module.id,
                                        lesson.id,
                                        "duration",
                                        Math.max(0, minutes) * 60,
                                      );
                                    }}
                                    sx={{
                                      width: 72,
                                      "& .MuiOutlinedInput-root": {
                                        color: "#edf0f7",
                                        borderRadius: "7px",
                                        fontFamily: "Rajdhani, sans-serif",
                                        "& fieldset": {
                                          borderColor: "rgba(255,255,255,0.2)",
                                        },
                                      },
                                    }}
                                  />
                                  <Typography
                                    sx={{
                                      opacity: 0.7,
                                      fontFamily: "Rajdhani, sans-serif",
                                    }}
                                  >
                                    min
                                  </Typography>
                                  <Chip
                                    size="small"
                                    label={`${tt("Ferdighet", "Skill")} ${lessonIndex + 1}`}
                                    sx={{
                                      bgcolor: "rgba(255,255,255,0.08)",
                                      color: "#edf0f7",
                                      border:
                                        "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.14)",
                                      fontFamily: "Rajdhani, sans-serif",
                                      fontWeight: 700,
                                    }}
                                  />
                                  {lesson.suggestedLevel ? (
                                    <Chip
                                      size="small"
                                      label={competencyLevelChipLabel(
                                        lesson.suggestedLevel,
                                        tt,
                                      )}
                                      sx={{
                                        bgcolor: "rgba(248,179,33,0.12)",
                                        color: "#f8d56f",
                                        border:
                                          "var(--academy-hairline-width, 1px) solid rgba(248,179,33,0.24)",
                                        fontFamily: "Rajdhani, sans-serif",
                                        fontWeight: 700,
                                      }}
                                    />
                                  ) : null}
                                </Stack>
                              </Box>

                              <Typography
                                sx={{
                                  width: 48,
                                  textAlign: "right",
                                  opacity: 0.86,
                                  fontSize: 13,
                                  fontFamily: "Rajdhani, sans-serif",
                                }}
                              >
                                {formatLessonDurationLabel(
                                  Number(lesson.duration || 0),
                                )}
                              </Typography>

                              <Stack direction="row" spacing={0.6}>
                                <IconButton
                                  size="small"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    handleSkillSelect(String(lesson.id));
                                    setRightTab("skill");
                                    syncCourseCreatorQuery(String(lesson.id));
                                  }}
                                  title={tt(
                                    "Rediger ferdighet i høyrepanel",
                                    "Edit skill in right panel",
                                  )}
                                  sx={{
                                    color: "rgba(237,240,247,0.86)",
                                    border:
                                      "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.2)",
                                    borderRadius: "7px",
                                  }}
                                >
                                  <Edit fontSize="small" />
                                </IconButton>

                                <IconButton
                                  size="small"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    handleSkillSelect(String(lesson.id));
                                    openMediaVideoBinding(lesson.id);
                                  }}
                                  title={tt(
                                    "Velg media",
                                    "Choose media",
                                  )}
                                  sx={{
                                    color: hasLinkedVideo
                                      ? "#9ee2ae"
                                      : "rgba(237,240,247,0.86)",
                                    border:
                                      "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.2)",
                                    borderRadius: "7px",
                                    bgcolor: hasLinkedVideo
                                      ? "rgba(92,180,128,0.08)"
                                      : "transparent",
                                  }}
                                >
                                  <PlayArrow fontSize="small" />
                                </IconButton>
                              </Stack>

                              <IconButton
                                size="small"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  removeLesson(module.id, lesson.id);
                                }}
                                sx={{ color: "rgba(255,120,120,0.86)" }}
                              >
                                <Delete fontSize="small" />
                              </IconButton>
                            </Stack>
                          );
                        })}

                        <Button
                          startIcon={<Add />}
                          onClick={() => addLessonToModule(module.id)}
                          sx={{
                            justifyContent: "flex-start",
                            width: "100%",
                            px: 1.4,
                            py: 1,
                            textTransform: "none",
                            color: "rgba(237,240,247,0.82)",
                            borderRadius: 0,
                            fontFamily: "Rajdhani, sans-serif",
                          }}
                        >
                          {tt("Ny ferdighet", "New Skill")}
                        </Button>
                      </Box>
                    )}
                  </Box>
                );
              })}
            </Stack>

            <Box
              sx={{
                mt: 2,
                border:
                  "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.14)",
                borderRadius: "10px",
                overflow: "hidden",
                background: "rgba(8,12,18,0.75)",
              }}
            >
              <Box
                sx={{
                  px: 1.4,
                  py: 1,
                  borderBottom:
                    "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.1)",
                }}
              >
                <Typography
                  sx={{
                    fontFamily: "Barlow Condensed, sans-serif",
                    fontSize: "clamp(1.4rem, 1.18rem + 0.42vw, 1.65rem)",
                  }}
                >
                  {tt("Ytelsesanalyse", "Performance Analytics")}
                </Typography>
              </Box>

              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: { xs: "1fr", md: "repeat(4, 1fr)" },
                  gap: 1.2,
                  p: 1.2,
                }}
              >
                {[
                  {
                    label: tt("Totalt antall deltakere", "Total Learners"),
                    value: String(
                      Math.max(0, Number(course.studentCount || 0)),
                    ),
                  },
                  {
                    label: tt("Gj.sn. seertid", "Avg Watch Time"),
                    value: `${Math.max(0, Math.min(100, completionRate))}%`,
                  },
                  {
                    label: tt("Fullføringsrate", "Completion Rate"),
                    value: `${completionRate}%`,
                  },
                  {
                    label: tt("Inntekt", "Revenue"),
                    value: `$${((Number(course.price || 0) * Number(course.studentCount || 0)) / 1000).toFixed(1)}k`,
                  },
                ].map((card, index) => (
                  <Box
                    key={card.label}
                    sx={{
                      border:
                        "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.12)",
                      borderRadius: "8px",
                      p: 1.2,
                      minHeight: 130,
                      background:
                        placeholderBackgrounds[
                          index % placeholderBackgrounds.length
                        ],
                    }}
                  >
                    <Typography
                      sx={{ opacity: 0.84, fontFamily: "Rajdhani, sans-serif" }}
                    >
                      {card.label}
                    </Typography>
                    <Typography
                      sx={{
                        fontFamily: "Barlow Condensed, sans-serif",
                        fontSize: "clamp(1.45rem, 1.2rem + 0.55vw, 1.8rem)",
                        mt: 0.5,
                      }}
                    >
                      {card.value}
                    </Typography>
                    <Box
                      sx={{
                        mt: 1.2,
                        height: 36,
                        borderRadius: "6px",
                        background: "rgba(0,0,0,0.25)",
                      }}
                    />
                  </Box>
                ))}
              </Box>
            </Box>
          </Box>
        </Box>

        <Box
          className="academy-right-panel"
          sx={{
            gridColumn: { xs: "1", lg: "1 / -1", xl: "auto" },
            borderLeft: {
              xs: "none",
              xl: "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.08)",
            },
            borderTop: {
              xs: "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.08)",
              xl: "none",
            },
            background:
              "linear-gradient(180deg, rgba(7,10,16,0.96) 0%, rgba(6,8,13,0.96) 100%)",
            p: { xs: 2, lg: 2, xl: 1.5 },
            minWidth: 0,
            minHeight: 0,
            display: "flex",
            flexDirection: "column",
            width: "100%",
            overflowY: { xs: "visible", xl: "auto" },
            maxHeight: { xl: "100vh" },
          }}
        >
          <Stack direction="row" spacing={1} sx={{ mb: 1.1 }}>
            {(["skill", "settings", "details", "pricing"] as const).map(
              (tab) => {
                const tabDisabled = rightPanelDisabled;
                return (
                <Button
                  key={tab}
                  onClick={() => {
                    if (!tabDisabled) setRightTab(tab);
                  }}
                  disabled={tabDisabled}
                  sx={{
                    textTransform: "none",
                    color:
                      rightTab === tab ? "#edf0f7" : "rgba(237,240,247,0.62)",
                    borderBottom:
                      rightTab === tab
                        ? "2px solid #f8b321"
                        : "2px solid transparent",
                    borderRadius: 0,
                    minWidth: 0,
                    px: 0,
                    mr: 1.5,
                    fontFamily: "Rajdhani, sans-serif",
                    fontWeight: rightTab === tab ? 700 : 500,
                    opacity: tabDisabled ? 0.45 : 1,
                    "&.Mui-disabled": {
                      color: "rgba(237,240,247,0.5)",
                    },
                  }}
                >
                  {tab === "skill"
                    ? tt("Ferdighet", "Skill")
                    : tab === "settings"
                      ? navLabel("Settings")
                      : tab === "details"
                        ? tt("Detaljer", "Details")
                        : tt("Prising", "Pricing")}
                </Button>
                );
              },
            )}
          </Stack>

          <Box
            sx={{
              border:
                "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.14)",
              borderRadius: "10px",
              overflow: "hidden",
              background: "rgba(8,12,18,0.85)",
            }}
          >
            <Box sx={{ height: 172, background: placeholderBackgrounds[0] }} />
            <Box sx={{ p: 1.2 }}>
              <Typography
                sx={{
                  fontFamily: "Barlow Condensed, sans-serif",
                  fontSize: "clamp(1.55rem, 1.28rem + 0.55vw, 1.95rem)",
                  lineHeight: 0.95,
                }}
              >
                {rightPanelPrimaryTitle}
              </Typography>
              <Stack
                direction="row"
                spacing={0.8}
                alignItems="center"
                sx={{ mt: 1 }}
              >
                <Typography
                  sx={{ opacity: 0.72, fontFamily: "Rajdhani, sans-serif" }}
                >
                  NOK
                </Typography>
                <Typography
                  sx={{ fontFamily: "Rajdhani, sans-serif", fontWeight: 700 }}
                >
                  {course.price}
                </Typography>
              </Stack>
            </Box>
          </Box>

          <Stack spacing={1.2} sx={{ mt: 1.5 }}>
            {rightPanelDisabled ? (
              <Box
                sx={{
                  border:
                    "var(--academy-hairline-width, 1px) dashed rgba(255,255,255,0.2)",
                  borderRadius: "8px",
                  p: 1.4,
                  background: "rgba(8,12,18,0.84)",
                }}
              >
                <Typography
                  sx={{ fontFamily: "Rajdhani, sans-serif", opacity: 0.86 }}
                >
                  {tt(
                    "Innstillinger blir tilgjengelige når minst én ferdighet er opprettet i Kompetansegrunnlag.",
                    "Settings become available once at least one skill is created in Competency Foundation.",
                  )}
                </Typography>
                <Button
                  onClick={openCreateCompetencyInCurriculum}
                  sx={{
                    mt: 1,
                    textTransform: "none",
                    color: "#1f1304",
                    fontWeight: 700,
                    borderRadius: "8px",
                    background:
                      "linear-gradient(180deg, #ffd36d 0%, #f5a623 100%)",
                    "&:hover": {
                      background:
                        "linear-gradient(180deg, #ffe08d 0%, #f6b640 100%)",
                    },
                  }}
                >
                  {tt("Gå til Kompetansegrunnlag", "Go to Competency Foundation")}
                </Button>
              </Box>
            ) : (
              <>
            {rightTab === "skill" && (
              <>
                {selectedSkill && selectedSkillContext ? (
                  <>
                    <Box sx={editorSectionCardSx}>
                      <Typography sx={editorSectionLabelSx}>
                        {tt("Kompetanse", "Competency")}
                      </Typography>
                      <Typography
                        sx={{ fontFamily: "Rajdhani, sans-serif", opacity: 0.78 }}
                      >
                        {tt("Valgt spor", "Selected track")}
                      </Typography>
                      <Typography
                        sx={{
                          mt: 0.35,
                          fontFamily: "Barlow Condensed, sans-serif",
                          fontSize: "1.24rem",
                        }}
                      >
                        {selectedSkillModuleTitle}
                      </Typography>
                    </Box>

                    <Box sx={editorSectionCardSx}>
                      <Typography sx={editorSectionLabelSx}>
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
                            selectedSkillHasLinkedVideo
                              ? selectedSkillVideoVersionState.hasUpdate
                                ? tt("Ny versjon", "New version")
                                : tt("Video koblet", "Video linked")
                              : tt("Ingen video", "No video")
                          }
                          sx={{
                            height: 22,
                            bgcolor: selectedSkillHasLinkedVideo
                              ? selectedSkillVideoVersionState.hasUpdate
                                ? "rgba(255,170,66,0.14)"
                                : "rgba(92,180,128,0.14)"
                              : "rgba(255,255,255,0.08)",
                            color: selectedSkillHasLinkedVideo
                              ? selectedSkillVideoVersionState.hasUpdate
                                ? "#ffd8aa"
                                : "#d8f4df"
                              : "#edf0f7",
                            border: selectedSkillHasLinkedVideo
                              ? selectedSkillVideoVersionState.hasUpdate
                                ? "var(--academy-hairline-width, 1px) solid rgba(255,170,66,0.28)"
                                : "var(--academy-hairline-width, 1px) solid rgba(92,180,128,0.24)"
                              : "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.14)",
                            fontFamily: "Rajdhani, sans-serif",
                            fontWeight: 700,
                            ".MuiChip-icon": {
                              color: selectedSkillHasLinkedVideo
                                ? selectedSkillVideoVersionState.hasUpdate
                                  ? "#ffd8aa"
                                  : "#9ee2ae"
                                : "rgba(237,240,247,0.72)",
                            },
                          }}
                        />
                        {selectedSkillHasLinkedVideo ? (
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
                            {selectedSkillVideoVersionState.hasUpdate
                              ? `${selectedSkillVideoLabel} · v${selectedSkillVideoVersionState.linkedVersion} -> v${selectedSkillVideoVersionState.currentVersion}`
                              : `${selectedSkillVideoLabel} · ${formatLessonDurationLabel(
                                  Number(selectedSkill.duration || 0),
                                )}`}
                          </Typography>
                        ) : (
                          <Typography
                            sx={{
                              color: "rgba(237,240,247,0.64)",
                              fontSize: 12.5,
                            }}
                          >
                            {tt(
                              "Koble video i Media for at varigheten skal synkes automatisk.",
                              "Link a video in Media to sync duration automatically.",
                            )}
                          </Typography>
                        )}
                      </Stack>
                      {selectedSkillVideoVersionState.hasUpdate ? (
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
                              "Denne ferdigheten har en nyere videoversjon tilgjengelig.",
                              "This skill has a newer video version available.",
                            )}
                          </Typography>
                        </Box>
                      ) : null}
                    </Box>

                    <Box sx={editorSectionCardSx}>
                      <Typography sx={editorSectionLabelSx}>
                        {tt("Innhold", "Content")}
                      </Typography>
                      <Stack spacing={1}>
                        <TextField
                          label={tt("Ferdighetstittel", "Skill Title")}
                          value={selectedSkill.title}
                          onChange={(event) =>
                            updateLessonField(
                              selectedSkillContext.module.id,
                              selectedSkill.id,
                              "title",
                              event.target.value,
                            )
                          }
                          size="small"
                          sx={{
                            "& .MuiOutlinedInput-root": {
                              color: "#edf0f7",
                              borderRadius: "8px",
                              "& fieldset": {
                                borderColor: "rgba(255,255,255,0.2)",
                              },
                            },
                            "& .MuiInputLabel-root": {
                              color: "rgba(237,240,247,0.68)",
                            },
                          }}
                        />

                        <TextField
                          label={tt("Beskrivelse", "Description")}
                          value={selectedSkill.description || ""}
                          onChange={(event) =>
                            updateLessonField(
                              selectedSkillContext.module.id,
                              selectedSkill.id,
                              "description",
                              event.target.value,
                            )
                          }
                          multiline
                          minRows={4}
                          size="small"
                          sx={{
                            "& .MuiOutlinedInput-root": {
                              color: "#edf0f7",
                              borderRadius: "8px",
                              "& fieldset": {
                                borderColor: "rgba(255,255,255,0.2)",
                              },
                            },
                            "& .MuiInputLabel-root": {
                              color: "rgba(237,240,247,0.68)",
                            },
                          }}
                        />
                      </Stack>
                    </Box>

                    <Box sx={editorSectionCardSx}>
                      <Typography sx={editorSectionLabelSx}>
                        {tt("Timing", "Timing")}
                      </Typography>
                      <TextField
                        label={tt("Varighet (min)", "Duration (min)")}
                        value={Math.max(
                          0,
                          Math.round(Number(selectedSkill.duration || 0) / 60),
                        )}
                        onChange={(event) => {
                          const minutes = Math.max(
                            0,
                            Number(event.target.value || 0),
                          );
                          updateLessonField(
                            selectedSkillContext.module.id,
                            selectedSkill.id,
                            "duration",
                            Math.round(minutes * 60),
                          );
                        }}
                        size="small"
                        sx={{
                          "& .MuiOutlinedInput-root": {
                            color: "#edf0f7",
                            borderRadius: "8px",
                            "& fieldset": {
                              borderColor: "rgba(255,255,255,0.2)",
                            },
                          },
                          "& .MuiInputLabel-root": {
                            color: "rgba(237,240,247,0.68)",
                          },
                        }}
                      />
                    </Box>

                    <Button
                      startIcon={<PlayArrow />}
                      onClick={() => openMediaVideoBinding(selectedSkill.id)}
                      sx={{
                        textTransform: "none",
                        color: "#edf0f7",
                        borderRadius: "8px",
                        border:
                          "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.22)",
                      }}
                    >
                      {tt("Velg media", "Choose media")}
                    </Button>
                  </>
                ) : (
                  <Box
                    sx={{
                      border:
                        "var(--academy-hairline-width, 1px) dashed rgba(255,255,255,0.2)",
                      borderRadius: "8px",
                      p: 1.4,
                      background: "rgba(8,12,18,0.84)",
                    }}
                  >
                    <Typography
                      sx={{ fontFamily: "Rajdhani, sans-serif", opacity: 0.82 }}
                    >
                      {hasSkills
                        ? tt(
                            "Velg en ferdighet i midtpanelet for å redigere innhold.",
                            "Select a skill in the center panel to edit content.",
                          )
                        : tt(
                            "Ingen ferdighet finnes ennå. Opprett ferdighet i Kompetansegrunnlag først.",
                            "No skill exists yet. Create a skill in Competency Foundation first.",
                          )}
                    </Typography>
                    {!hasSkills && (
                      <Button
                        onClick={openCreateCompetencyInCurriculum}
                        sx={{
                          mt: 1,
                          textTransform: "none",
                          color: "#1f1304",
                          fontWeight: 700,
                          borderRadius: "8px",
                          background:
                            "linear-gradient(180deg, #ffd36d 0%, #f5a623 100%)",
                          "&:hover": {
                            background:
                              "linear-gradient(180deg, #ffe08d 0%, #f6b640 100%)",
                          },
                        }}
                      >
                        {tt(
                          "Opprett i Kompetansegrunnlag",
                          "Create in Competency Foundation",
                        )}
                      </Button>
                    )}
                  </Box>
                )}
              </>
            )}

            {rightTab === "settings" && (
              <>
                <TextField
                  label={tt("Kategori", "Category")}
                  value={course.category}
                  onChange={(event) =>
                    setCourse((prev: any) => ({
                      ...prev,
                      category: event.target.value,
                    }))
                  }
                  select
                  size="small"
                  sx={{
                    "& .MuiOutlinedInput-root": {
                      color: "#edf0f7",
                      borderRadius: "8px",
                      "& fieldset": { borderColor: "rgba(255,255,255,0.2)" },
                    },
                    "& .MuiInputLabel-root": {
                      color: "rgba(237,240,247,0.68)",
                    },
                  }}
                >
                  <MenuItem value="photography">
                    {tt("Fotografi", "Photography")}
                  </MenuItem>
                  <MenuItem value="videography">
                    {tt("Video", "Videography")}
                  </MenuItem>
                  <MenuItem value="music_production">
                    {tt("Musikkproduksjon", "Music Production")}
                  </MenuItem>
                  <MenuItem value="lighting">
                    {tt("Lyssetting", "Lighting")}
                  </MenuItem>
                  <MenuItem value="business">
                    {tt("Forretning", "Business")}
                  </MenuItem>
                </TextField>

                <TextField
                  label={tt("Nivå", "Skill Level")}
                  value={course.level}
                  onChange={(event) =>
                    setCourse((prev: any) => ({
                      ...prev,
                      level: event.target.value,
                    }))
                  }
                  select
                  size="small"
                  sx={{
                    "& .MuiOutlinedInput-root": {
                      color: "#edf0f7",
                      borderRadius: "8px",
                      "& fieldset": { borderColor: "rgba(255,255,255,0.2)" },
                    },
                    "& .MuiInputLabel-root": {
                      color: "rgba(237,240,247,0.68)",
                    },
                  }}
                >
                  <MenuItem value="beginner">
                    {tt("Nybegynner", "Beginner")}
                  </MenuItem>
                  <MenuItem value="intermediate">
                    {tt("Middels", "Intermediate")}
                  </MenuItem>
                  <MenuItem value="advanced">
                    {tt("Avansert", "Advanced")}
                  </MenuItem>
                </TextField>

                <Select
                  value={course.isPublished ? "published" : "draft"}
                  size="small"
                  onChange={(event) =>
                    setCourse((prev: any) => ({
                      ...prev,
                      isPublished: event.target.value === "published",
                    }))
                  }
                  sx={{
                    color: "#edf0f7",
                    borderRadius: "8px",
                    "& .MuiOutlinedInput-notchedOutline": {
                      borderColor: "rgba(255,255,255,0.2)",
                    },
                  }}
                >
                  <MenuItem value="draft">{tt("Utkast", "Draft")}</MenuItem>
                  <MenuItem value="published">
                    {tt("Publisert", "Published")}
                  </MenuItem>
                </Select>

                <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                  <Button
                    variant="outlined"
                    onClick={() =>
                      setCourse((prev: any) => ({
                        ...prev,
                        isPublished: false,
                      }))
                    }
                    sx={{
                      textTransform: "none",
                      color: "#edf0f7",
                      borderColor: "rgba(255,255,255,0.2)",
                      borderRadius: "8px",
                      flex: 1,
                    }}
                  >
                    {tt("Avpubliser", "Unpublish")}
                  </Button>
                  <Button
                    variant="outlined"
                    onClick={() =>
                      setCourse((prev: any) => ({
                        ...prev,
                        title: `${prev.title} (Copy)`,
                      }))
                    }
                    sx={{
                      textTransform: "none",
                      color: "#edf0f7",
                      borderColor: "rgba(255,255,255,0.2)",
                      borderRadius: "8px",
                      flex: 1,
                    }}
                  >
                    {tt("Dupliser", "Duplicate")}
                  </Button>
                  <Button
                    variant="outlined"
                    onClick={() => {
                      setModules(createDefaultModules(tt));
                      setCourse((prev: any) => ({ ...prev, lessons: [] }));
                    }}
                    sx={{
                      textTransform: "none",
                      color: "#ffb2b2",
                      borderColor: "rgba(255,120,120,0.3)",
                      borderRadius: "8px",
                      flex: 1,
                    }}
                  >
                    {tt("Slett", "Delete")}
                  </Button>
                </Stack>
              </>
            )}

            {rightTab === "details" && (
              <>
                <TextField
                  label={tt("Kurstittel", "Course Title")}
                  value={course.title}
                  onChange={(event) =>
                    setCourse((prev: any) => ({
                      ...prev,
                      title: event.target.value,
                    }))
                  }
                  size="small"
                  sx={{
                    "& .MuiOutlinedInput-root": {
                      color: "#edf0f7",
                      borderRadius: "8px",
                      "& fieldset": { borderColor: "rgba(255,255,255,0.2)" },
                    },
                    "& .MuiInputLabel-root": {
                      color: "rgba(237,240,247,0.68)",
                    },
                  }}
                />

                <TextField
                  label={tt("Beskrivelse", "Description")}
                  value={course.description || ""}
                  onChange={(event) =>
                    setCourse((prev: any) => ({
                      ...prev,
                      description: event.target.value,
                    }))
                  }
                  multiline
                  minRows={4}
                  size="small"
                  sx={{
                    "& .MuiOutlinedInput-root": {
                      color: "#edf0f7",
                      borderRadius: "8px",
                      "& fieldset": { borderColor: "rgba(255,255,255,0.2)" },
                    },
                    "& .MuiInputLabel-root": {
                      color: "rgba(237,240,247,0.68)",
                    },
                  }}
                />

                <Box>
                  <Stack
                    direction="row"
                    spacing={0.8}
                    flexWrap="wrap"
                    sx={{ mb: 0.9 }}
                  >
                    {course.tags.map((tag: string) => (
                      <Chip
                        key={tag}
                        label={tag}
                        onDelete={() =>
                          setCourse((prev: any) => ({
                            ...prev,
                            tags: prev.tags.filter(
                              (item: string) => item !== tag,
                            ),
                          }))
                        }
                        sx={{
                          height: 24,
                          bgcolor: "rgba(255,255,255,0.08)",
                          color: "#edf0f7",
                          border:
                            "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.15)",
                          fontFamily: "Rajdhani, sans-serif",
                        }}
                      />
                    ))}
                  </Stack>
                  <Button
                    startIcon={<Add />}
                    onClick={addTag}
                    sx={{
                      textTransform: "none",
                      color: "#edf0f7",
                      border:
                        "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.2)",
                      borderRadius: "8px",
                      px: 1.2,
                    }}
                  >
                    {tt("Legg til tagg", "Add Tag")}
                  </Button>
                </Box>
              </>
            )}

            {rightTab === "pricing" && (
              <>
                <TextField
                  label={tt("Pris (NOK)", "Price (NOK)")}
                  value={course.price}
                  onChange={(event) =>
                    setCourse((prev: any) => ({
                      ...prev,
                      price: Number(event.target.value || 0),
                    }))
                  }
                  size="small"
                  sx={{
                    "& .MuiOutlinedInput-root": {
                      color: "#edf0f7",
                      borderRadius: "8px",
                      "& fieldset": { borderColor: "rgba(255,255,255,0.2)" },
                    },
                    "& .MuiInputLabel-root": {
                      color: "rgba(237,240,247,0.68)",
                    },
                  }}
                />

                <Select
                  value={course.isFree ? "free" : "paid"}
                  size="small"
                  onChange={(event) =>
                    setCourse((prev: any) => {
                      const isFree = event.target.value === "free";
                      return {
                        ...prev,
                        isFree,
                        price: isFree ? 0 : prev.price || 1000,
                      };
                    })
                  }
                  sx={{
                    color: "#edf0f7",
                    borderRadius: "8px",
                    "& .MuiOutlinedInput-notchedOutline": {
                      borderColor: "rgba(255,255,255,0.2)",
                    },
                  }}
                >
                  <MenuItem value="paid">
                    {tt("Betalt kurs", "Paid Course")}
                  </MenuItem>
                  <MenuItem value="free">
                    {tt("Gratis kurs", "Free Course")}
                  </MenuItem>
                </Select>

                <Stack direction="row" spacing={0.8}>
                  {[990, 1990, 3990].map((preset) => (
                    <Button
                      key={preset}
                      onClick={() =>
                        setCourse((prev: any) => ({
                          ...prev,
                          isFree: false,
                          price: preset,
                        }))
                      }
                      sx={{
                        textTransform: "none",
                        color: "#edf0f7",
                        border:
                          "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.2)",
                        borderRadius: "8px",
                        flex: 1,
                      }}
                    >
                      NOK {preset}
                    </Button>
                  ))}
                </Stack>

                <Box
                  sx={{
                    border:
                      "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.12)",
                    borderRadius: "8px",
                    p: 1.1,
                    background: "rgba(8,12,18,0.9)",
                  }}
                >
                  <Stack
                    direction="row"
                    justifyContent="space-between"
                    alignItems="center"
                  >
                    <Typography
                      sx={{ fontFamily: "Rajdhani, sans-serif", opacity: 0.8 }}
                    >
                      {tt(
                        "Estimert månedlig inntekt",
                        "Estimated Monthly Revenue",
                      )}
                    </Typography>
                    <Typography
                      sx={{
                        fontFamily: "Barlow Condensed, sans-serif",
                        fontSize: "1.6rem",
                      }}
                    >
                      NOK{" "}
                      {Math.max(
                        0,
                        Math.round(
                          Number(course.price || 0) *
                            Number(course.studentCount || 0) *
                            0.12,
                        ),
                      )}
                    </Typography>
                  </Stack>
                </Box>
              </>
            )}

            <Divider sx={{ borderColor: "rgba(255,255,255,0.08)" }} />

            <Box
              sx={{
                border:
                  "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.12)",
                borderRadius: "8px",
                p: 1.1,
                background: "rgba(8,12,18,0.9)",
              }}
            >
              <Stack
                direction="row"
                justifyContent="space-between"
                alignItems="center"
              >
                <Typography
                  sx={{ fontFamily: "Rajdhani, sans-serif", opacity: 0.8 }}
                >
                  {navLabel("Lessons")}
                </Typography>
                <Typography
                  sx={{
                    fontFamily: "Barlow Condensed, sans-serif",
                    fontSize: "1.6rem",
                  }}
                >
                  {flattenedLessons.length}
                </Typography>
              </Stack>
              <Stack
                direction="row"
                justifyContent="space-between"
                alignItems="center"
                sx={{ mt: 0.8 }}
              >
                <Typography
                  sx={{ fontFamily: "Rajdhani, sans-serif", opacity: 0.8 }}
                >
                  {tt("Deltakere", "Learners")}
                </Typography>
                <Typography
                  sx={{
                    fontFamily: "Barlow Condensed, sans-serif",
                    fontSize: "1.6rem",
                  }}
                >
                  {Math.max(0, Number(course.studentCount || 0))}
                </Typography>
              </Stack>
              <Stack
                direction="row"
                justifyContent="space-between"
                alignItems="center"
                sx={{ mt: 0.8 }}
              >
                <Typography
                  sx={{ fontFamily: "Rajdhani, sans-serif", opacity: 0.8 }}
                >
                  {tt("Fullføring", "Completion")}
                </Typography>
                <Typography
                  sx={{
                    fontFamily: "Barlow Condensed, sans-serif",
                    fontSize: "1.6rem",
                  }}
                >
                  {completionRate}%
                </Typography>
              </Stack>
            </Box>
              </>
            )}
          </Stack>

          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1.1}
            sx={{ mt: 2 }}
          >
            <Button
              startIcon={<ArrowBack />}
              onClick={onCancel}
              sx={{
                textTransform: "none",
                color: "#edf0f7",
                border:
                  "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.2)",
                borderRadius: "8px",
                flex: { xs: "1 1 auto", sm: 1 },
              }}
            >
              {tt("Tilbake", "Back")}
            </Button>
          </Stack>
        </Box>
      </Box>
    </Box>
  );
}

export default withUniversalIntegration(CourseCreator, {
  componentId: "academy-course-creator",
  componentName: "Academy Course Creator",
  componentType: "editor",
  componentCategory: "academy",
  featureIds: ["course-creation", "lesson-creation", "course-management"],
});
