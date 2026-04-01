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
  Chip,
  Divider,
  IconButton,
  LinearProgress,
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
  Assessment,
  DeleteOutline,
  Download,
  Edit,
  MailOutline,
  MoreHoriz,
  NotificationsNone,
  PlayArrow,
  Publish,
  Save,
  Search,
  TrendingUp,
} from "@mui/icons-material";
import { useLocation } from "wouter";
import { useAcademy, type Course } from "@/contexts/AcademyContext";
import { useEnhancedMasterIntegration } from "@/integration/EnhancedMasterIntegrationProvider";
import { withUniversalIntegration } from "@/integration/UniversalIntegrationHOC";
import { academyPdfExportService } from "@/services/academyPdfExportService";
import { useAcademyLocale } from "./academyLocale";
import AcademyLocaleSwitcher from "./AcademyLocaleSwitcher";
import AcademyLeftSidebar from "./AcademyLeftSidebar";
import AcademyStudentSidebar from "./AcademyStudentSidebar";
import {
  buildAcademyStudentNextAction,
  describeAcademyStudentAssignmentStatus,
} from "./academyStudentExperience";

interface AcademyAssignmentsStudioProps {
  courseId?: string;
  onSave?: (payload: Record<string, unknown>) => void;
  onCancel?: () => void;
}

type AssignmentStatus =
  | "active"
  | "in_review"
  | "completed"
  | "overdue"
  | "draft";
type AssignmentScope = "course" | "skill";
type AssignmentType =
  | "replication"
  | "analysis"
  | "decision"
  | "scenario"
  | "production";
type MasteryEvidenceType =
  | "artifact"
  | "before_after"
  | "mentor_review"
  | "peer_feedback"
  | "demo_video"
  | "quiz_pass";
type TransformationStage = "discover" | "practice" | "perform" | "prove";
type AssignmentLevel = 1 | 2 | 3 | 4 | 5;
type AssignmentPlacement =
  | "bottom-center"
  | "bottom-right"
  | "center"
  | "top-right";
type AssignmentOverlayAnimationType = "slide-up" | "fade" | "zoom";
type AssignmentOverlayAnimationEasing =
  | "ease-out"
  | "ease-in-out"
  | "ease-in"
  | "linear";

type StatusFilter = "all" | AssignmentStatus;

type RangeFilter = "7d" | "30d" | "90d";
type AssignmentsViewTab = "assignments" | "followup" | "transformation";

interface AssignmentItem {
  id: string;
  courseId: string;
  title: string;
  subtitle: string;
  scope: AssignmentScope;
  competency: string;
  skillId?: string;
  skillTitle: string;
  assignmentType: AssignmentType;
  masteryEvidence: MasteryEvidenceType;
  transformationStage: TransformationStage;
  level: AssignmentLevel;
  overlayEnabled: boolean;
  triggerAt: number;
  endAt: number;
  placement: AssignmentPlacement;
  overlayBackground: string;
  overlayTextColor: string;
  overlayPrimaryButtonColor: string;
  overlayPrimaryButtonTextColor: string;
  overlayFontFamily: string;
  overlayAnimationEnabled: boolean;
  overlayAnimationType: AssignmentOverlayAnimationType;
  overlayAnimationEasing: AssignmentOverlayAnimationEasing;
  overlayAnimationDuration: number;
  overlayAnimationDelay: number;
  overlayRadius: number;
  overlayOpacity: number;
  overlayTitleSize: number;
  requiresThinking: boolean;
  feedbackRequired: boolean;
  retryEnabled: boolean;
  transformationObjective: string;
  reflectionPrompt: string;
  startDate: string;
  dueDate: string;
  submissions: number;
  targetSubmissions: number;
  completionRate: number;
  avgScore: number;
  status: AssignmentStatus;
  tags: string[];
  revenueImpact: number;
  imageTheme: number;
}

interface FeedbackItem {
  id: string;
  author: string;
  recipient?: string;
  message: string;
  timestamp: string;
}

interface AssignmentAnalyticsFlags {
  earlyAccess: boolean;
  invitationOnly: boolean;
  closed: boolean;
  dripRelease: boolean;
}

interface AssignmentStudioPersistedState {
  assignments: AssignmentItem[];
  feedback: FeedbackItem[];
  selectedCourseId: string;
  statusFilter: StatusFilter;
  rangeFilter: RangeFilter;
  analyticsFlags: AssignmentAnalyticsFlags;
  updatedAt: string;
}

type CourseWithAssignmentStudio = Course & {
  assignmentStudio?: AssignmentStudioPersistedState;
};

const panelSx = {
  borderRadius: 1.4,
  border: "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.08)",
  background:
    "linear-gradient(145deg, rgba(20,24,36,0.88), rgba(11,14,22,0.96))",
};

const placeholderBackgrounds = [
  "linear-gradient(145deg, rgba(24,30,42,0.92), rgba(12,16,24,0.98)), radial-gradient(circle at 85% 16%, rgba(245,166,35,0.34), rgba(0,0,0,0))",
  "linear-gradient(145deg, rgba(18,23,34,0.95), rgba(10,14,21,0.98)), radial-gradient(circle at 12% 82%, rgba(245,166,35,0.24), rgba(0,0,0,0))",
  "linear-gradient(145deg, rgba(17,21,31,0.94), rgba(8,12,18,0.98)), radial-gradient(circle at 72% 10%, rgba(114,158,225,0.2), rgba(0,0,0,0))",
  "linear-gradient(145deg, rgba(19,24,36,0.93), rgba(11,14,22,0.98)), radial-gradient(circle at 70% 22%, rgba(248,179,33,0.22), rgba(0,0,0,0))",
];

const formatDateRange = (
  startDate: string,
  dueDate: string,
  locale: string,
): string => {
  const format = (value: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat(locale, {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(date);
  };

  return `${format(startDate)} - ${format(dueDate)}`;
};

const formatMinuteSecond = (seconds: number): string => {
  const safe = Number.isFinite(seconds) && seconds >= 0 ? seconds : 0;
  const min = Math.floor(safe / 60);
  const sec = Math.floor(safe % 60);
  return `${min}:${sec.toString().padStart(2, "0")}`;
};

const parseMinuteSecond = (value: string, fallback: number): number => {
  const raw = String(value || "").trim();
  if (!raw) return fallback;
  if (raw.includes(":")) {
    const [minPart, secPart = "0"] = raw.split(":");
    const min = Number.parseInt(minPart.trim(), 10);
    const sec = Number.parseInt(secPart.trim(), 10);
    if (!Number.isFinite(min) || !Number.isFinite(sec)) return fallback;
    return Math.max(0, min * 60 + sec);
  }
  const asSeconds = Number.parseInt(raw, 10);
  if (!Number.isFinite(asSeconds)) return fallback;
  return Math.max(0, asSeconds);
};

const toNok = (value: number): string =>
  new Intl.NumberFormat("nb-NO", {
    style: "currency",
    currency: "NOK",
    maximumFractionDigits: 0,
  }).format(Math.max(0, value));

const defaultAnalyticsFlags = (): AssignmentAnalyticsFlags => ({
  earlyAccess: true,
  invitationOnly: true,
  closed: false,
  dripRelease: false,
});

const defaultAssignmentType: AssignmentType = "replication";
const defaultMasteryEvidence: MasteryEvidenceType = "artifact";
const defaultTransformationStage: TransformationStage = "practice";
const defaultAssignmentLevel: AssignmentLevel = 1;
const defaultOverlayFontFamily = 'Barlow Condensed, "Manrope", sans-serif';

const toDisplayName = (value: string, fallback = "Student"): string => {
  const normalized = String(value || "").trim();
  if (!normalized) return fallback;
  const base = normalized.includes("@") ? normalized.split("@")[0] : normalized;
  const parts = base
    .replace(/[._]+/g, "-")
    .split("-")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .slice(0, 2);

  if (parts.length === 0) return fallback;
  return parts.map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
};

function AcademyAssignmentsStudio({
  courseId,
  onSave,
  onCancel,
}: AcademyAssignmentsStudioProps) {
  const [location, setLocation] = useLocation();
  const { state, getCourse, updateCourse, setCurrentCourse } = useAcademy();
  const { analytics, debugging, auth } = useEnhancedMasterIntegration();

  const { navLabel, tt, language } = useAcademyLocale();
  const dateLocale = language === "no" ? "nb-NO" : "en-US";
  const routeParams = useMemo(() => {
    if (typeof window === "undefined") {
      return {
        view: "",
        courseId: "",
        courseIdLegacy: "",
        assignmentId: "",
        audience: "",
        returnTo: "",
      };
    }
    const params = new URLSearchParams(window.location.search);
    const returnToRaw = String(params.get("returnTo") || "").trim();
    return {
      view: String(params.get("view") || "").trim(),
      courseId: String(params.get("courseId") || "").trim(),
      courseIdLegacy: String(params.get("course_id") || "").trim(),
      assignmentId: String(params.get("assignmentId") || "").trim(),
      audience: String(params.get("audience") || "").trim().toLowerCase(),
      returnTo: /^\/academy(\/|$)/.test(returnToRaw) ? returnToRaw : "",
    };
  }, [location]);
  const routeView = routeParams.view;
  const routeCourseId = routeParams.courseId || routeParams.courseIdLegacy;

  const [leftNav, setLeftNav] = useState(() =>
    routeView === "follow-up"
      ? "assignments-followup"
      : routeView === "transformation-pulse"
        ? "assignments-transformation"
        : "assignments",
  );
  const [selectedCourseId, setSelectedCourseId] = useState(() => {
    const preferred = String(courseId || routeCourseId || "all").trim();
    return preferred || "all";
  });
  const [selectedCompetencyFilter, setSelectedCompetencyFilter] =
    useState("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [rangeFilter, setRangeFilter] = useState<RangeFilter>("7d");
  const [searchValue, setSearchValue] = useState("");
  const [saveMessage, setSaveMessage] = useState("");
  const [analyticsFlags, setAnalyticsFlags] =
    useState<AssignmentAnalyticsFlags>(defaultAnalyticsFlags);
  const [rightPanelTab, setRightPanelTab] = useState<
    "assignment" | "analytics" | "leaderboard"
  >("assignment");
  const [assignmentEditorTab, setAssignmentEditorTab] = useState<
    "type" | "settings" | "linking" | "player"
  >("type");

  const [assignmentItems, setAssignmentItems] = useState<AssignmentItem[]>([]);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState("");
  const [feedbackItems, setFeedbackItems] = useState<FeedbackItem[]>([]);
  const [feedbackAuthor, setFeedbackAuthor] = useState(() => tt("Du", "You"));
  const [feedbackRecipient, setFeedbackRecipient] = useState("all");
  const [feedbackDraft, setFeedbackDraft] = useState("");
  const [triggerAtInput, setTriggerAtInput] = useState("0:00");
  const [endAtInput, setEndAtInput] = useState("0:30");
  const [previewTime, setPreviewTime] = useState(0);
  const [previewTimeInput, setPreviewTimeInput] = useState("0:00");
  const upcomingSectionRef = useRef<HTMLDivElement | null>(null);
  const transformationPulseSectionRef = useRef<HTMLDivElement | null>(null);
  const routeSelectionAppliedRef = useRef(false);
  const isFollowUpView = routeView === "follow-up";
  const isTransformationPulseView = routeView === "transformation-pulse";
  const routeAssignmentId = routeParams.assignmentId;

  const courseItems = useMemo(() => {
    if (Array.isArray(state.courses) && state.courses.length > 0) {
      return state.courses;
    }
    return [];
  }, [state.courses]);

  const activeCourse = useMemo(() => {
    if (selectedCourseId !== "all") {
      const fromSelected = courseItems.find(
        (course) => String(course.id) === String(selectedCourseId),
      );
      if (fromSelected) return fromSelected;
    }

    const fromParam = courseId ? getCourse(courseId) : null;
    if (fromParam) return fromParam;

    return state.currentCourse || courseItems[0] || null;
  }, [courseId, courseItems, getCourse, selectedCourseId, state.currentCourse]);

  const isStudentMode = useMemo(() => {
    if (routeParams.audience === "student") return true;
    return (
      /\/academy\/student-dashboard(?:\?|$)/.test(routeParams.returnTo) ||
      /\/academy\/player-studio(?:\?|$)/.test(routeParams.returnTo) ||
      /audience=student/.test(routeParams.returnTo)
    );
  }, [routeParams.audience, routeParams.returnTo]);

  const studentBaseReturnTo = routeParams.returnTo || "/academy/student-dashboard";
  const buildStudentRoute = useCallback(
    (
      path: string,
      extra?: Record<string, string | number | null | undefined>,
      overrideReturnTo = studentBaseReturnTo,
    ) => {
      const params = new URLSearchParams();
      const safeCourseId = String(activeCourse?.id || courseId || routeCourseId || "").trim();
      if (safeCourseId) {
        params.set("courseId", safeCourseId);
      }
      params.set("audience", "student");

      const safeReturnTo = String(overrideReturnTo || "").trim();
      if (safeReturnTo) {
        params.set("returnTo", safeReturnTo);
      }

      Object.entries(extra || {}).forEach(([key, value]) => {
        if (value === undefined || value === null || value === "") return;
        params.set(key, String(value));
      });

      const query = params.toString();
      return query ? `${path}?${query}` : path;
    },
    [activeCourse?.id, courseId, routeCourseId, studentBaseReturnTo],
  );

  useEffect(() => {
    const nextCourseId = String(courseId || routeCourseId || "").trim();
    if (!nextCourseId) return;
    setSelectedCourseId((previousCourseId) =>
      previousCourseId === nextCourseId ? previousCourseId : nextCourseId,
    );
  }, [courseId, routeCourseId]);
  const activeCourseWithAssignmentStudio =
    activeCourse as CourseWithAssignmentStudio | null;
  const persistedStudioState = useMemo(
    () => activeCourseWithAssignmentStudio?.assignmentStudio ?? null,
    [activeCourseWithAssignmentStudio],
  );

  const statusLabel = useCallback(
    (status: AssignmentStatus): string => {
      if (status === "in_review") return tt("Under vurdering", "In Review");
      if (status === "completed") return tt("Fullført", "Completed");
      if (status === "overdue") return tt("Forfalt", "Overdue");
      if (status === "draft") return tt("Utkast", "Draft");
      return tt("Aktiv", "Active");
    },
    [tt],
  );

  const assignmentTypeLabel = useCallback(
    (type: AssignmentType): string => {
      if (type === "analysis")
        return tt("Analyseoppgave", "Analysis Assignment");
      if (type === "decision")
        return tt("Beslutningsoppgave", "Decision Assignment");
      if (type === "scenario")
        return tt("Scenario-oppgave", "Scenario Assignment");
      if (type === "production")
        return tt("Produksjonsoppgave", "Production Assignment");
      return tt("Replikeringsoppgave", "Replication Assignment");
    },
    [tt],
  );

  const assignmentTypeDescription = useCallback(
    (type: AssignmentType): string => {
      if (type === "analysis") {
        return tt(
          "Studenten analyserer hvorfor et resultat fungerer (lys, linse, komposisjon).",
          "Learner analyzes why a result works (lighting, lens, composition).",
        );
      }
      if (type === "decision") {
        return tt(
          "Studenten må velge riktige produksjonsvalg under begrensninger.",
          "Learner must choose the right production decisions under constraints.",
        );
      }
      if (type === "scenario") {
        return tt(
          "Studenten løser en tidspresset virkelighetssituasjon.",
          "Learner solves a time-pressured real-world situation.",
        );
      }
      if (type === "production") {
        return tt(
          "Studenten produserer en leveranse som viser helhetlig mestring.",
          "Learner produces a deliverable showing end-to-end mastery.",
        );
      }
      return tt(
        "Studenten reproduserer et resultat for å trene observasjon og teknikk.",
        "Learner reproduces a result to train observation and technique.",
      );
    },
    [tt],
  );

  const masteryEvidenceLabel = useCallback(
    (value: MasteryEvidenceType): string => {
      if (value === "before_after") return tt("Før / etter", "Before / after");
      if (value === "mentor_review")
        return tt("Mentorvurdering", "Mentor review");
      if (value === "peer_feedback")
        return tt("Medstudent-feedback", "Peer feedback");
      if (value === "demo_video") return tt("Demovideo", "Demo video");
      if (value === "quiz_pass") return tt("Quiz-bestått", "Quiz pass");
      return tt("Artefakt", "Artifact");
    },
    [tt],
  );

  const transformationStageLabel = useCallback(
    (value: TransformationStage): string => {
      if (value === "discover") return tt("Oppdage", "Discover");
      if (value === "perform") return tt("Utføre", "Perform");
      if (value === "prove") return tt("Bevise", "Prove");
      return tt("Øve", "Practice");
    },
    [tt],
  );

  const assignmentLevelLabel = useCallback(
    (value: AssignmentLevel): string => {
      if (value === 2)
        return tt("Nivå 2 · Begrensninger", "Level 2 · Constraints");
      if (value === 3)
        return tt("Nivå 3 · Reell situasjon", "Level 3 · Real scenario");
      if (value === 4)
        return tt("Nivå 4 · Mini-prosjekt", "Level 4 · Mini project");
      if (value === 5)
        return tt("Nivå 5 · Master challenge", "Level 5 · Master challenge");
      return tt("Nivå 1 · Repliker", "Level 1 · Replicate");
    },
    [tt],
  );

  const competencyOptions = useMemo(() => {
    const architecture = activeCourse?.pedagogicalArchitecture;
    const fromCompetencies = Array.isArray(architecture?.competencies)
      ? architecture?.competencies || []
      : [];
    const fromSkillMap = Array.isArray(architecture?.skillMap)
      ? architecture.skillMap
          .map((item) => String(item?.title || "").trim())
          .filter(Boolean)
      : [];
    const unique = Array.from(
      new Set(
        [...fromCompetencies, ...fromSkillMap]
          .map((value) => String(value).trim())
          .filter(Boolean),
      ),
    );
    if (unique.length > 0) return unique;
    return [tt("Generell kompetanse", "General competency")];
  }, [activeCourse?.pedagogicalArchitecture, tt]);
  const competencyFilterOptions = useMemo(() => {
    const fromAssignments = assignmentItems
      .map((assignment) => String(assignment.competency || "").trim())
      .filter(Boolean);
    const fromCourseTitles = courseItems
      .map((course) => String(course.title || "").trim())
      .filter(Boolean);
    const merged = Array.from(
      new Set(
        [...competencyOptions, ...fromAssignments, ...fromCourseTitles]
          .map((value) => String(value).trim())
          .filter(Boolean),
      ),
    );
    return merged;
  }, [assignmentItems, competencyOptions, courseItems]);

  const skillOptions = useMemo(
    () =>
      (activeCourse?.lessons || []).map((lesson) => ({
        id: String(lesson.id),
        title: String(lesson.title || "").trim() || tt("Uten navn", "Untitled"),
      })),
    [activeCourse?.lessons, tt],
  );

  const normalizeAssignment = useCallback(
    (assignment: AssignmentItem, index: number): AssignmentItem => {
      const resolvedScope: AssignmentScope =
        assignment.scope === "skill" || assignment.scope === "course"
          ? assignment.scope
          : assignment.skillId
            ? "skill"
            : "course";
      const resolvedSkillId = assignment.skillId
        ? String(assignment.skillId)
        : "";
      const skillFromId = skillOptions.find(
        (skill) => String(skill.id) === resolvedSkillId,
      );
      const firstSkill = skillOptions[0];
      const fallbackSkillTitle = tt("Hele kurset", "Entire course");

      const resolvedSkillTitle =
        resolvedScope === "skill"
          ? String(
              assignment.skillTitle ||
                assignment.title ||
                skillFromId?.title ||
                firstSkill?.title ||
                tt("Ny ferdighet", "New skill"),
            )
          : fallbackSkillTitle;

      const rawLevel = Number((assignment as Partial<{ level: number }>).level);
      const legacyLevel = String(
        (assignment as Partial<{ challengeLevel: string }>).challengeLevel ||
          "",
      ).toLowerCase();
      const mappedLegacyLevel: AssignmentLevel =
        legacyLevel === "advanced"
          ? 4
          : legacyLevel === "intermediate"
            ? 2
            : defaultAssignmentLevel;
      const resolvedLevel: AssignmentLevel =
        rawLevel >= 1 && rawLevel <= 5
          ? (rawLevel as AssignmentLevel)
          : mappedLegacyLevel;
      const rawAssignmentType = String(
        (assignment as Partial<{ assignmentType: string }>).assignmentType ||
          "",
      ).toLowerCase();
      const resolvedAssignmentType: AssignmentType =
        rawAssignmentType === "replication" ||
        rawAssignmentType === "analysis" ||
        rawAssignmentType === "decision" ||
        rawAssignmentType === "scenario" ||
        rawAssignmentType === "production"
          ? (rawAssignmentType as AssignmentType)
          : defaultAssignmentType;
      const maxDuration = Math.max(45, Number(activeCourse?.duration || 300));
      const fallbackTrigger = Math.max(
        5,
        Math.min(maxDuration - 10, 24 + index * 12),
      );
      const safeTrigger = Number.isFinite(
        Number((assignment as Partial<{ triggerAt: number }>).triggerAt),
      )
        ? Math.max(
            0,
            Number((assignment as Partial<{ triggerAt: number }>).triggerAt),
          )
        : fallbackTrigger;
      const safeEnd = Number.isFinite(
        Number((assignment as Partial<{ endAt: number }>).endAt),
      )
        ? Math.max(
            safeTrigger,
            Number((assignment as Partial<{ endAt: number }>).endAt),
          )
        : Math.min(maxDuration, safeTrigger + 24);
      const rawPlacement = String(
        (assignment as Partial<{ placement: string }>).placement || "",
      );
      const safePlacement: AssignmentPlacement =
        rawPlacement === "bottom-center" ||
        rawPlacement === "bottom-right" ||
        rawPlacement === "center" ||
        rawPlacement === "top-right"
          ? (rawPlacement as AssignmentPlacement)
          : "bottom-right";
      const rawAnimationType = String(
        (assignment as Partial<{ overlayAnimationType: string }>)
          .overlayAnimationType || "",
      ).toLowerCase();
      const safeAnimationType: AssignmentOverlayAnimationType =
        rawAnimationType === "slide-up" ||
        rawAnimationType === "fade" ||
        rawAnimationType === "zoom"
          ? (rawAnimationType as AssignmentOverlayAnimationType)
          : "slide-up";
      const rawAnimationEasing = String(
        (assignment as Partial<{ overlayAnimationEasing: string }>)
          .overlayAnimationEasing || "",
      ).toLowerCase();
      const safeAnimationEasing: AssignmentOverlayAnimationEasing =
        rawAnimationEasing === "ease-out" ||
        rawAnimationEasing === "ease-in-out" ||
        rawAnimationEasing === "ease-in" ||
        rawAnimationEasing === "linear"
          ? (rawAnimationEasing as AssignmentOverlayAnimationEasing)
          : "ease-out";
      const safeOverlayDuration = Number.isFinite(
        Number(
          (assignment as Partial<{ overlayAnimationDuration: number }>)
            .overlayAnimationDuration,
        ),
      )
        ? Math.max(
            0,
            Math.min(
              8,
              Number(
                (assignment as Partial<{ overlayAnimationDuration: number }>)
                  .overlayAnimationDuration,
              ),
            ),
          )
        : 0.45;
      const safeOverlayDelay = Number.isFinite(
        Number(
          (assignment as Partial<{ overlayAnimationDelay: number }>)
            .overlayAnimationDelay,
        ),
      )
        ? Math.max(
            0,
            Math.min(
              8,
              Number(
                (assignment as Partial<{ overlayAnimationDelay: number }>)
                  .overlayAnimationDelay,
              ),
            ),
          )
        : 0;
      const safeOverlayRadius = Number.isFinite(
        Number(
          (assignment as Partial<{ overlayRadius: number }>).overlayRadius,
        ),
      )
        ? Math.max(
            0,
            Math.min(
              48,
              Number(
                (assignment as Partial<{ overlayRadius: number }>)
                  .overlayRadius,
              ),
            ),
          )
        : 16;
      const safeOverlayOpacity = Number.isFinite(
        Number(
          (assignment as Partial<{ overlayOpacity: number }>).overlayOpacity,
        ),
      )
        ? Math.max(
            0.2,
            Math.min(
              1,
              Number(
                (assignment as Partial<{ overlayOpacity: number }>)
                  .overlayOpacity,
              ),
            ),
          )
        : 1;
      const safeOverlayTitleSize = Number.isFinite(
        Number(
          (assignment as Partial<{ overlayTitleSize: number }>)
            .overlayTitleSize,
        ),
      )
        ? Math.max(
            14,
            Math.min(
              72,
              Number(
                (assignment as Partial<{ overlayTitleSize: number }>)
                  .overlayTitleSize,
              ),
            ),
          )
        : 32;

      return {
        ...assignment,
        scope: resolvedScope,
        competency: String(
          assignment.competency ||
            competencyOptions[0] ||
            tt("Generell kompetanse", "General competency"),
        ),
        skillId:
          resolvedScope === "skill"
            ? String(resolvedSkillId || skillFromId?.id || firstSkill?.id || "")
            : "",
        skillTitle: resolvedSkillTitle,
        assignmentType: resolvedAssignmentType,
        masteryEvidence: assignment.masteryEvidence || defaultMasteryEvidence,
        transformationStage:
          assignment.transformationStage || defaultTransformationStage,
        level: resolvedLevel,
        overlayEnabled:
          typeof assignment.overlayEnabled === "boolean"
            ? assignment.overlayEnabled
            : true,
        triggerAt: Math.min(maxDuration, safeTrigger),
        endAt: Math.min(maxDuration, safeEnd),
        placement: safePlacement,
        overlayBackground: String(
          assignment.overlayBackground || "rgba(10,15,25,0.84)",
        ),
        overlayTextColor: String(assignment.overlayTextColor || "#f5f1e7"),
        overlayPrimaryButtonColor: String(
          assignment.overlayPrimaryButtonColor || "#d99622",
        ),
        overlayPrimaryButtonTextColor: String(
          assignment.overlayPrimaryButtonTextColor || "#1a1306",
        ),
        overlayFontFamily: String(
          assignment.overlayFontFamily || defaultOverlayFontFamily,
        ),
        overlayAnimationEnabled:
          typeof assignment.overlayAnimationEnabled === "boolean"
            ? assignment.overlayAnimationEnabled
            : true,
        overlayAnimationType: safeAnimationType,
        overlayAnimationEasing: safeAnimationEasing,
        overlayAnimationDuration: safeOverlayDuration,
        overlayAnimationDelay: safeOverlayDelay,
        overlayRadius: safeOverlayRadius,
        overlayOpacity: safeOverlayOpacity,
        overlayTitleSize: safeOverlayTitleSize,
        requiresThinking:
          typeof assignment.requiresThinking === "boolean"
            ? assignment.requiresThinking
            : true,
        feedbackRequired:
          typeof assignment.feedbackRequired === "boolean"
            ? assignment.feedbackRequired
            : true,
        retryEnabled:
          typeof assignment.retryEnabled === "boolean"
            ? assignment.retryEnabled
            : true,
        transformationObjective:
          assignment.transformationObjective ||
          tt(
            "Studenten skal demonstrere observerbar ferdighetsforbedring.",
            "Learner should demonstrate observable skill improvement.",
          ),
        reflectionPrompt:
          assignment.reflectionPrompt ||
          tt(
            "Hva endret du i praksis, og hvorfor fungerte det bedre?",
            "What did you change in practice, and why did it work better?",
          ),
        imageTheme:
          typeof assignment.imageTheme === "number"
            ? assignment.imageTheme
            : index % placeholderBackgrounds.length,
      };
    },
    [activeCourse?.duration, competencyOptions, skillOptions, tt],
  );

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

  useEffect(() => {
    if (!selectedAssignmentId && assignmentItems.length > 0) {
      setSelectedAssignmentId(assignmentItems[0].id);
    }
  }, [assignmentItems, selectedAssignmentId]);

  useEffect(() => {
    if (selectedCompetencyFilter === "all") return;
    const exists = competencyFilterOptions.some(
      (option) =>
        option.trim().toLowerCase() === selectedCompetencyFilter.toLowerCase(),
    );
    if (exists) return;
    setSelectedCompetencyFilter("all");
  }, [competencyFilterOptions, selectedCompetencyFilter]);

  useEffect(() => {
    if (routeSelectionAppliedRef.current) return;
    if (!routeAssignmentId) return;
    if (assignmentItems.length === 0) return;
    const fromRoute = assignmentItems.find(
      (assignment) => String(assignment.id) === routeAssignmentId,
    );
    if (!fromRoute) {
      routeSelectionAppliedRef.current = true;
      return;
    }
    routeSelectionAppliedRef.current = true;
    setSelectedAssignmentId(fromRoute.id);
    setSelectedCourseId("all");
    setSelectedCompetencyFilter(
      String(fromRoute.competency || "").trim() || "all",
    );
  }, [assignmentItems, routeAssignmentId]);

  useEffect(() => {
    if (persistedStudioState) {
      const normalizedAssignments = Array.isArray(
        persistedStudioState.assignments,
      )
        ? persistedStudioState.assignments.map((assignment, index) =>
            normalizeAssignment(assignment, index),
          )
        : [];
      setAssignmentItems(normalizedAssignments);
      setFeedbackItems(
        Array.isArray(persistedStudioState.feedback)
          ? persistedStudioState.feedback
          : [],
      );
      setSelectedCompetencyFilter("all");
      setStatusFilter(persistedStudioState.statusFilter || "all");
      setRangeFilter(persistedStudioState.rangeFilter || "7d");
      setAnalyticsFlags({
        ...defaultAnalyticsFlags(),
        ...(persistedStudioState.analyticsFlags || {}),
      });
      setSelectedCourseId("all");
      return;
    }

    setAssignmentItems([]);
    setFeedbackItems([]);
    setSelectedCompetencyFilter("all");
    setStatusFilter("all");
    setRangeFilter("7d");
    setAnalyticsFlags(defaultAnalyticsFlags());
    setSelectedCourseId("all");
  }, [
    courseItems,
    normalizeAssignment,
    persistedStudioState,
  ]);

  useEffect(() => {
    analytics.trackEvent("academy_assignments_studio_opened", {
      courseId: activeCourse?.id || null,
      assignmentCount: assignmentItems.length,
      timestamp: Date.now(),
    });

    debugging.logIntegration("info", "AcademyAssignmentsStudio opened", {
      courseId: activeCourse?.id || null,
      assignmentCount: assignmentItems.length,
    });
  }, [activeCourse?.id, analytics, assignmentItems.length, debugging]);

  useEffect(() => {
    setLeftNav((prev) => {
      if (
        prev !== "assignments" &&
        prev !== "assignments-followup" &&
        prev !== "assignments-transformation"
      )
        return prev;
      if (isFollowUpView) return "assignments-followup";
      if (isTransformationPulseView) return "assignments-transformation";
      return "assignments";
    });
  }, [isFollowUpView, isTransformationPulseView]);

  useEffect(() => {
    if (!isFollowUpView) return;
    if (statusFilter === "all") {
      setStatusFilter("active");
    }
    if (typeof window === "undefined") return;
    const timer = window.setTimeout(() => {
      upcomingSectionRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 120);
    return () => window.clearTimeout(timer);
  }, [isFollowUpView, statusFilter]);

  useEffect(() => {
    if (!isTransformationPulseView) return;
    if (typeof window === "undefined") return;
    const timer = window.setTimeout(() => {
      transformationPulseSectionRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 120);
    return () => window.clearTimeout(timer);
  }, [isTransformationPulseView]);

  const selectedAssignment = useMemo(() => {
    return (
      assignmentItems.find(
        (assignment) => assignment.id === selectedAssignmentId,
      ) ||
      assignmentItems[0] ||
      null
    );
  }, [assignmentItems, selectedAssignmentId]);

  useEffect(() => {
    if (!selectedAssignment) return;
    setTriggerAtInput(formatMinuteSecond(selectedAssignment.triggerAt));
    setEndAtInput(formatMinuteSecond(selectedAssignment.endAt));
    const nextPreviewTime = Number(selectedAssignment.triggerAt || 0);
    setPreviewTime(nextPreviewTime);
    setPreviewTimeInput(formatMinuteSecond(nextPreviewTime));
  }, [
    selectedAssignment?.id,
    selectedAssignment?.triggerAt,
    selectedAssignment?.endAt,
  ]);

  useEffect(() => {
    setPreviewTimeInput(formatMinuteSecond(previewTime));
  }, [previewTime]);

  const scopeAssignments = useMemo(() => {
    return assignmentItems.filter((assignment) => {
      const matchesCourse =
        selectedCourseId === "all"
          ? true
          : String(assignment.courseId) === String(selectedCourseId);
      if (!matchesCourse) return false;

      const matchesCompetency =
        selectedCompetencyFilter === "all"
          ? true
          : String(assignment.competency || "").trim().toLowerCase() ===
            selectedCompetencyFilter.trim().toLowerCase();
      return matchesCompetency;
    });
  }, [assignmentItems, selectedCompetencyFilter, selectedCourseId]);

  const visibleAssignments = useMemo(() => {
    const query = searchValue.trim().toLowerCase();

    return scopeAssignments.filter((assignment) => {
      const matchesStatus =
        statusFilter === "all" ? true : assignment.status === statusFilter;
      if (!matchesStatus) return false;

      if (!query) return true;
      return (
        assignment.title.toLowerCase().includes(query) ||
        assignment.subtitle.toLowerCase().includes(query) ||
        assignment.tags.some((tag) => tag.toLowerCase().includes(query)) ||
        assignment.competency.toLowerCase().includes(query) ||
        assignment.skillTitle.toLowerCase().includes(query) ||
        assignment.transformationObjective.toLowerCase().includes(query)
      );
    });
  }, [
    searchValue,
    scopeAssignments,
    statusFilter,
  ]);

  const selectedAssignmentPreviewVisible = useMemo(() => {
    if (!selectedAssignment) return false;
    if (!selectedAssignment.overlayEnabled) return false;
    return (
      previewTime >= Number(selectedAssignment.triggerAt || 0) &&
      previewTime <=
        Number(
          selectedAssignment.endAt || Number(selectedAssignment.triggerAt || 0),
        )
    );
  }, [previewTime, selectedAssignment]);

  const selectedAssignmentPreviewMax = useMemo(() => {
    if (!selectedAssignment) return 300;
    const courseDuration = Number(activeCourse?.duration || 0);
    return Math.max(
      60,
      Math.ceil(selectedAssignment.endAt + 20),
      courseDuration,
    );
  }, [activeCourse?.duration, selectedAssignment]);

  const previewPlacementSx = useMemo(() => {
    if (!selectedAssignment) {
      return {
        right: 14,
        bottom: 14,
        "--overlay-translate-x": "0",
        "--overlay-translate-y": "0",
      } as const;
    }
    if (selectedAssignment.placement === "center") {
      return {
        left: "50%",
        top: "50%",
        "--overlay-translate-x": "-50%",
        "--overlay-translate-y": "-50%",
        transform:
          "translate(var(--overlay-translate-x), var(--overlay-translate-y))",
      } as const;
    }
    if (selectedAssignment.placement === "top-right") {
      return {
        right: 14,
        top: 14,
        "--overlay-translate-x": "0",
        "--overlay-translate-y": "0",
      } as const;
    }
    if (selectedAssignment.placement === "bottom-center") {
      return {
        left: "50%",
        bottom: 14,
        "--overlay-translate-x": "-50%",
        "--overlay-translate-y": "0",
        transform:
          "translate(var(--overlay-translate-x), var(--overlay-translate-y))",
      } as const;
    }
    return {
      right: 14,
      bottom: 14,
      "--overlay-translate-x": "0",
      "--overlay-translate-y": "0",
    } as const;
  }, [selectedAssignment]);

  const previewAnimationSx = useMemo(() => {
    if (!selectedAssignment || !selectedAssignment.overlayAnimationEnabled) {
      return {};
    }
    const duration = Math.max(
      0,
      Number(selectedAssignment.overlayAnimationDuration || 0),
    );
    const delay = Math.max(
      0,
      Number(selectedAssignment.overlayAnimationDelay || 0),
    );
    if (duration <= 0) {
      return {};
    }
    if (selectedAssignment.overlayAnimationType === "fade") {
      return {
        animation: `academyAssignmentFade ${duration}s ${selectedAssignment.overlayAnimationEasing} ${delay}s both`,
        "@keyframes academyAssignmentFade": {
          "0%": { opacity: 0 },
          "100%": { opacity: 1 },
        },
      };
    }
    if (selectedAssignment.overlayAnimationType === "zoom") {
      return {
        animation: `academyAssignmentZoom ${duration}s ${selectedAssignment.overlayAnimationEasing} ${delay}s both`,
        "@keyframes academyAssignmentZoom": {
          "0%": {
            opacity: 0,
            transform:
              "translate(var(--overlay-translate-x, 0), var(--overlay-translate-y, 0)) scale(0.92)",
          },
          "100%": {
            opacity: 1,
            transform:
              "translate(var(--overlay-translate-x, 0), var(--overlay-translate-y, 0)) scale(1)",
          },
        },
      };
    }
    return {
      animation: `academyAssignmentSlideUp ${duration}s ${selectedAssignment.overlayAnimationEasing} ${delay}s both`,
      "@keyframes academyAssignmentSlideUp": {
        "0%": {
          opacity: 0,
          transform:
            "translate(var(--overlay-translate-x, 0), calc(var(--overlay-translate-y, 0) + 18px))",
        },
        "100%": {
          opacity: 1,
          transform:
            "translate(var(--overlay-translate-x, 0), var(--overlay-translate-y, 0))",
        },
      },
    };
  }, [selectedAssignment]);

  const totals = useMemo(() => {
    const totalAssignments = scopeAssignments.length;
    const submissions = scopeAssignments.reduce(
      (sum, assignment) => sum + assignment.submissions,
      0,
    );
    const completed = scopeAssignments.filter(
      (assignment) => assignment.status === "completed",
    ).length;
    const avgScore =
      scopeAssignments.length === 0
        ? 0
        : Math.round(
            scopeAssignments.reduce(
              (sum, assignment) => sum + assignment.avgScore,
              0,
            ) / scopeAssignments.length,
          );

    return {
      totalAssignments,
      submissions,
      completed,
      avgScore,
    };
  }, [scopeAssignments]);

  const transformationPulse = useMemo(() => {
    const total = scopeAssignments.length;
    if (total === 0) {
      return {
        coveragePct: 0,
        proveStagePct: 0,
        deliberatePracticePct: 0,
      };
    }

    const linkedToSkill = scopeAssignments.filter(
      (assignment) => assignment.scope === "skill",
    ).length;
    const proveStage = scopeAssignments.filter(
      (assignment) => assignment.transformationStage === "prove",
    ).length;
    const deliberatePracticeReady = scopeAssignments.filter(
      (assignment) =>
        assignment.requiresThinking &&
        assignment.feedbackRequired &&
        assignment.retryEnabled &&
        String(assignment.reflectionPrompt || "").trim().length > 0,
    ).length;

    return {
      coveragePct: Math.round((linkedToSkill / total) * 100),
      proveStagePct: Math.round((proveStage / total) * 100),
      deliberatePracticePct: Math.round(
        (deliberatePracticeReady / total) * 100,
      ),
    };
  }, [scopeAssignments]);

  const distribution = useMemo(() => {
    const submitted = scopeAssignments.filter(
      (assignment) => assignment.status === "active",
    ).length;
    const inReview = scopeAssignments.filter(
      (assignment) => assignment.status === "in_review",
    ).length;
    const completed = scopeAssignments.filter(
      (assignment) => assignment.status === "completed",
    ).length;
    const overdue = scopeAssignments.filter(
      (assignment) => assignment.status === "overdue",
    ).length;

    const total = submitted + inReview + completed + overdue;

    return {
      total,
      submitted,
      inReview,
      completed,
      overdue,
      submittedPct: total === 0 ? 0 : Math.round((submitted / total) * 100),
      inReviewPct: total === 0 ? 0 : Math.round((inReview / total) * 100),
      completedPct: total === 0 ? 0 : Math.round((completed / total) * 100),
      overduePct: total === 0 ? 0 : Math.round((overdue / total) * 100),
    };
  }, [scopeAssignments]);

  const leaderboard = useMemo(() => {
    return [...scopeAssignments]
      .sort((a, b) => b.avgScore - a.avgScore)
      .slice(0, 3);
  }, [scopeAssignments]);

  const feedbackRecipients = useMemo(() => {
    const recipients = new Set<string>();
    feedbackItems.forEach((item) => {
      const candidate = String(item.author || "").trim();
      if (candidate) recipients.add(candidate);
    });
    const instructorName = String(activeCourse?.instructor?.name || "").trim();
    if (instructorName) recipients.add(instructorName);
    return Array.from(recipients).sort((a, b) => a.localeCompare(b));
  }, [activeCourse?.instructor?.name, feedbackItems]);

  const upcomingAssignments = useMemo(() => {
    return [...scopeAssignments]
      .filter(
        (assignment) =>
          assignment.status === "active" ||
          assignment.status === "draft" ||
          assignment.status === "in_review",
      )
      .sort(
        (a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime(),
      )
      .slice(0, 4);
  }, [scopeAssignments]);

  const studentName = useMemo(() => {
    const user = auth.state.user as
      | {
          email?: string;
          name?: string;
          firstName?: string;
          id?: string;
        }
      | undefined;
    return toDisplayName(
      String(user?.name || user?.firstName || user?.email || user?.id || ""),
      tt("Student", "Student"),
    );
  }, [auth.state.user, tt]);

  const studentProgressRows = useMemo(() => {
    if (!activeCourse?.id || !Array.isArray(state.progress)) return [];
    return state.progress.filter(
      (row) => String(row.courseId || "") === String(activeCourse.id),
    );
  }, [activeCourse?.id, state.progress]);

  const studentProgressStats = useMemo(() => {
    const lessons = Array.isArray(activeCourse?.lessons) ? activeCourse.lessons : [];
    const progressByLesson = new Map(
      studentProgressRows.map((row) => [String(row.lessonId || ""), Number(row.progress || 0)]),
    );
    const completedLessons = lessons.filter(
      (lesson) => (progressByLesson.get(String(lesson.id)) || 0) >= 100,
    ).length;
    const progressPercent =
      lessons.length > 0
        ? Math.round(
            lessons.reduce((sum, lesson) => sum + (progressByLesson.get(String(lesson.id)) || 0), 0) /
              lessons.length,
          )
        : Math.round(
            studentProgressRows.reduce((sum, row) => sum + Number(row.progress || 0), 0) /
              Math.max(1, studentProgressRows.length),
          );

    return {
      completedLessons,
      totalLessons: lessons.length,
      progressPercent: Math.max(0, Math.min(100, progressPercent)),
    };
  }, [activeCourse?.lessons, studentProgressRows]);

  const donutStyle = useMemo(() => {
    const submittedDeg = distribution.submittedPct * 3.6;
    const inReviewDeg = distribution.inReviewPct * 3.6;
    const completedDeg = distribution.completedPct * 3.6;
    const overdueDeg = distribution.overduePct * 3.6;

    return `conic-gradient(#8ea6d6 0deg ${submittedDeg}deg, #f8b321 ${submittedDeg}deg ${submittedDeg + inReviewDeg}deg, #f5d47a ${submittedDeg + inReviewDeg}deg ${submittedDeg + inReviewDeg + completedDeg}deg, #d2754a ${submittedDeg + inReviewDeg + completedDeg}deg ${submittedDeg + inReviewDeg + completedDeg + overdueDeg}deg, rgba(255,255,255,0.1) ${submittedDeg + inReviewDeg + completedDeg + overdueDeg}deg 360deg)`;
  }, [
    distribution.completedPct,
    distribution.inReviewPct,
    distribution.overduePct,
    distribution.submittedPct,
  ]);

  const upsertAssignment = useCallback(
    (assignmentId: string, patch: Partial<AssignmentItem>) => {
      setAssignmentItems((prev) =>
        prev.map((assignment) =>
          assignment.id === assignmentId
            ? {
                ...assignment,
                ...patch,
              }
            : assignment,
        ),
      );
    },
    [],
  );

  const duplicateAssignment = useCallback(
    (assignmentId: string) => {
      setAssignmentItems((prev) => {
        const source = prev.find((item) => item.id === assignmentId);
        if (!source) return prev;
        const copy: AssignmentItem = {
          ...source,
          id: `assignment-${Date.now()}`,
          title: `${source.title} (${tt("kopi", "copy")})`,
          status: "draft",
          tags: Array.from(
            new Set([...(source.tags || []), tt("Utkast", "Draft")]),
          ),
        };
        setSelectedAssignmentId(copy.id);
        return [copy, ...prev];
      });
      setSaveMessage(tt("Oppgave duplisert.", "Assignment duplicated."));
    },
    [tt],
  );

  const removeAssignment = useCallback(
    (assignmentId: string) => {
      setAssignmentItems((prev) =>
        prev.filter((assignment) => assignment.id !== assignmentId),
      );
      setSelectedAssignmentId((prevSelected) =>
        prevSelected === assignmentId ? "" : prevSelected,
      );
      setSaveMessage(tt("Oppgave slettet.", "Assignment deleted."));
    },
    [tt],
  );

  const addAssignment = useCallback(() => {
    const index = assignmentItems.length + 1;
    const start = new Date();
    start.setDate(start.getDate() + index);

    const due = new Date(start);
    due.setDate(due.getDate() + 12);

    const courseForAssignment =
      selectedCourseId !== "all"
        ? String(selectedCourseId)
        : activeCourse?.id
          ? String(activeCourse.id)
          : courseItems[0]?.id
            ? String(courseItems[0].id)
            : "all";

    const assignment: AssignmentItem = {
      id: `assignment-${Date.now()}`,
      courseId: String(courseForAssignment),
      title: `${tt("Ny oppgave", "New Assignment")} ${index}`,
      subtitle: tt(
        "Kreativ filmskapingsoppgave",
        "Creative filmmaking challenge",
      ),
      scope: skillOptions.length > 0 ? "skill" : "course",
      competency:
        selectedCompetencyFilter !== "all"
          ? selectedCompetencyFilter
          : competencyOptions[0] ||
            tt("Generell kompetanse", "General competency"),
      skillId: skillOptions[0]?.id || "",
      skillTitle: skillOptions[0]?.title || tt("Hele kurset", "Entire course"),
      assignmentType: defaultAssignmentType,
      masteryEvidence: defaultMasteryEvidence,
      transformationStage: defaultTransformationStage,
      level: defaultAssignmentLevel,
      overlayEnabled: true,
      triggerAt: Math.max(5, 20 + index * 10),
      endAt: Math.max(30, 20 + index * 10 + 24),
      placement: "bottom-right",
      overlayBackground: "rgba(10,15,25,0.84)",
      overlayTextColor: "#f5f1e7",
      overlayPrimaryButtonColor: "#d99622",
      overlayPrimaryButtonTextColor: "#1a1306",
      overlayFontFamily: defaultOverlayFontFamily,
      overlayAnimationEnabled: true,
      overlayAnimationType: "slide-up",
      overlayAnimationEasing: "ease-out",
      overlayAnimationDuration: 0.45,
      overlayAnimationDelay: 0,
      overlayRadius: 16,
      overlayOpacity: 1,
      overlayTitleSize: 32,
      requiresThinking: true,
      feedbackRequired: true,
      retryEnabled: true,
      transformationObjective: tt(
        "Studenten demonstrerer målbar forbedring i ferdigheten.",
        "Learner demonstrates measurable improvement in this skill.",
      ),
      reflectionPrompt: tt(
        "Hvilke konkrete valg gjorde du annerledes enn før?",
        "Which specific choices did you make differently than before?",
      ),
      startDate: start.toISOString().slice(0, 10),
      dueDate: due.toISOString().slice(0, 10),
      submissions: 0,
      targetSubmissions: 120,
      completionRate: 0,
      avgScore: 0,
      status: "draft",
      tags: [tt("Utkast", "Draft")],
      revenueImpact: 0,
      imageTheme: index % placeholderBackgrounds.length,
    };

    setAssignmentItems((prev) => [assignment, ...prev]);
    setSelectedAssignmentId(assignment.id);
    setSaveMessage(tt("Ny oppgave lagt til.", "New assignment added."));
  }, [
    activeCourse?.id,
    assignmentItems.length,
    competencyOptions,
    courseItems,
    selectedCompetencyFilter,
    selectedCourseId,
    skillOptions,
    tt,
  ]);

  const exportAssignments = useCallback(async () => {
    if (typeof window === "undefined" || visibleAssignments.length === 0) {
      setSaveMessage(
        tt("Ingen oppgaver å eksportere.", "No assignments to export."),
      );
      return;
    }

    const assignmentTypeLabel = (type: AssignmentType): string => {
      if (type === "replication")
        return tt("Replikeringsoppgave", "Replication Assignment");
      if (type === "analysis")
        return tt("Analyseoppgave", "Analysis Assignment");
      if (type === "decision")
        return tt("Beslutningsoppgave", "Decision Assignment");
      if (type === "scenario")
        return tt("Scenario-oppgave", "Scenario Assignment");
      return tt("Produksjonsoppgave", "Production Assignment");
    };

    const stageLabel = (stage: TransformationStage): string => {
      if (stage === "discover") return tt("Oppdag", "Discover");
      if (stage === "practice") return tt("Øv", "Practice");
      if (stage === "perform") return tt("Utfør", "Perform");
      return tt("Bevis", "Prove");
    };

    const completionAvg = Math.round(
      visibleAssignments.reduce((sum, item) => sum + item.completionRate, 0) /
        Math.max(visibleAssignments.length, 1),
    );
    const conversionAvg = Number(
      (
        visibleAssignments.reduce(
          (sum, item) =>
            sum +
            (item.submissions / Math.max(1, item.targetSubmissions)) * 100,
          0,
        ) / Math.max(visibleAssignments.length, 1)
      ).toFixed(1),
    );
    const totalRevenueImpact = visibleAssignments.reduce(
      (sum, item) => sum + item.revenueImpact,
      0,
    );

    await academyPdfExportService.exportReport({
      fileName: `academy-assignments-${new Date().toISOString().slice(0, 10)}.pdf`,
      title: tt("Oppgavestudio", "Assignments Studio"),
      subtitle: tt(
        "Pedagogiske oppgaver og transformasjonsflyt",
        "Pedagogical assignments and transformation flow",
      ),
      courseLabel:
        selectedCompetencyFilter === "all"
          ? tt("Alle kompetanser", "All competencies")
          : selectedCompetencyFilter,
      locale: language === "no" ? "nb-NO" : "en-US",
      sections: [
        {
          title: tt("Oversikt", "Overview"),
          metrics: [
            {
              label: tt("Synlige oppgaver", "Visible assignments"),
              value: visibleAssignments.length,
            },
            {
              label: tt("Gj.sn. fullføring", "Avg completion"),
              value: `${completionAvg}%`,
            },
            {
              label: tt("Gj.sn. konvertering", "Avg conversion"),
              value: `${conversionAvg}%`,
            },
            {
              label: tt("Inntektspåvirkning", "Revenue impact"),
              value: toNok(totalRevenueImpact),
            },
          ],
        },
        {
          title: tt("Oppgaveliste", "Assignments List"),
          table: {
            columns: [
              tt("Oppgave", "Assignment"),
              tt("Type", "Type"),
              tt("Nivå", "Level"),
              tt("Fase", "Stage"),
              tt("Område", "Scope"),
              tt("Trigger", "Trigger"),
              tt("Slutt", "End"),
              tt("Status", "Status"),
            ],
            rows: visibleAssignments.map((item) => [
              item.title,
              assignmentTypeLabel(item.assignmentType),
              item.level,
              stageLabel(item.transformationStage),
              item.scope === "skill"
                ? `${tt("Ferdighet", "Skill")}: ${item.skillTitle}`
                : tt("Kompetanse", "Competency"),
              formatMinuteSecond(item.triggerAt),
              formatMinuteSecond(item.endAt),
              item.status,
            ]),
          },
        },
      ],
    });

    analytics.trackEvent("academy_assignments_export_clicked", {
      courseId: selectedCourseId,
      competencyFilter: selectedCompetencyFilter,
      assignmentCount: visibleAssignments.length,
      timestamp: Date.now(),
    });
    setSaveMessage(tt("Oppgaver eksportert som PDF.", "Assignments exported as PDF."));
  }, [
    activeCourse?.title,
    analytics,
    language,
    selectedCompetencyFilter,
    selectedCourseId,
    tt,
    visibleAssignments,
  ]);

  const handleReports = useCallback(async () => {
    analytics.trackEvent("academy_assignments_reports_clicked", {
      courseId: selectedCourseId,
      competencyFilter: selectedCompetencyFilter,
      assignmentCount: visibleAssignments.length,
      timestamp: Date.now(),
    });
    await exportAssignments();
  }, [
    analytics,
    exportAssignments,
    selectedCompetencyFilter,
    selectedCourseId,
    visibleAssignments.length,
  ]);

  const toggleAnalyticsFlag = useCallback(
    (key: keyof typeof analyticsFlags) => {
      setAnalyticsFlags((prev) => ({ ...prev, [key]: !prev[key] }));
    },
    [],
  );

  const addFeedback = useCallback(() => {
    const message = feedbackDraft.trim();
    if (!message) {
      setSaveMessage(
        tt(
          "Skriv tilbakemelding før du legger til.",
          "Write feedback before adding.",
        ),
      );
      return;
    }

    const author = feedbackAuthor.trim() || tt("Du", "You");
    setFeedbackItems((prev) => [
      {
        id: `feedback-${Date.now()}`,
        author,
        recipient: feedbackRecipient === "all" ? undefined : feedbackRecipient,
        message,
        timestamp: tt("nå", "now"),
      },
      ...prev,
    ]);
    setFeedbackDraft("");
    setSaveMessage(tt("Tilbakemelding lagt til.", "Feedback added."));
  }, [feedbackAuthor, feedbackDraft, feedbackRecipient, tt]);

  const contentTab: AssignmentsViewTab = isFollowUpView
    ? "followup"
    : isTransformationPulseView
      ? "transformation"
      : "assignments";

  const setAssignmentsView = useCallback(
    (nextTab: AssignmentsViewTab) => {
      if (typeof window === "undefined") return;
      const params = new URLSearchParams(window.location.search);
      if (nextTab === "followup") {
        params.set("view", "follow-up");
      } else if (nextTab === "transformation") {
        params.set("view", "transformation-pulse");
      } else {
        params.delete("view");
      }
      const query = params.toString();
      const nextRoute = `/academy/assignments${query ? `?${query}` : ""}`;
      setLeftNav(
        nextTab === "followup"
          ? "assignments-followup"
          : nextTab === "transformation"
            ? "assignments-transformation"
            : "assignments",
      );
      setLocation(nextRoute);
    },
    [setLocation],
  );

  const saveAssignments = useCallback(
    async (publish: boolean) => {
      const persistedState: AssignmentStudioPersistedState = {
        assignments: assignmentItems,
        feedback: feedbackItems,
        selectedCourseId,
        statusFilter,
        rangeFilter,
        analyticsFlags,
        updatedAt: new Date().toISOString(),
      };

      const payload = {
        courseId: activeCourse?.id || null,
        assignmentCount: assignmentItems.length,
        assignments: assignmentItems,
        feedback: feedbackItems,
        rangeFilter,
        statusFilter,
        analyticsFlags,
        publish,
        updatedAt: persistedState.updatedAt,
      };

      try {
        if (
          activeCourse?.id &&
          state.courses.some(
            (course) => String(course.id) === String(activeCourse.id),
          )
        ) {
          const nextTags = Array.from(
            new Set([...(activeCourse.tags || []), "assignments"]),
          );
          const nextCourse: CourseWithAssignmentStudio = {
            ...activeCourse,
            tags: nextTags,
            isPublished: publish ? true : activeCourse.isPublished,
            assignmentStudio: persistedState,
            updatedAt: persistedState.updatedAt,
          };
          await updateCourse(nextCourse);
        }

        setSaveMessage(
          publish
            ? tt("Oppgaver publisert.", "Assignments published.")
            : tt("Oppgaver lagret.", "Assignments saved."),
        );
        onSave?.(payload);

        analytics.trackEvent(
          publish ? "academy_assignments_publish" : "academy_assignments_save",
          {
            courseId: activeCourse?.id || null,
            assignmentCount: assignmentItems.length,
            timestamp: Date.now(),
          },
        );
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : tt("Kunne ikke lagre oppgaver.", "Failed to save assignments.");
        setSaveMessage(message);
        debugging.logIntegration("error", "Academy assignments save failed", {
          courseId: activeCourse?.id || null,
          message,
        });
      }
    },
    [
      activeCourse,
      analytics,
      analyticsFlags,
      assignmentItems,
      debugging,
      feedbackItems,
      onSave,
      rangeFilter,
      selectedCourseId,
      state.courses,
      statusFilter,
      tt,
      updateCourse,
    ],
  );

  const studentVisibleAssignments = useMemo(
    () => visibleAssignments.filter((assignment) => assignment.status !== "draft"),
    [visibleAssignments],
  );
  const studentSelectedAssignment =
    selectedAssignment && selectedAssignment.status !== "draft"
      ? selectedAssignment
      : studentVisibleAssignments[0] || null;

  const selectedAssignmentLessonId =
    studentSelectedAssignment?.scope === "skill"
      ? String(studentSelectedAssignment.skillId || "").trim()
      : "";
  const studentPlayerRoute = useMemo(
    () =>
      buildStudentRoute(
        "/academy/player-studio",
        selectedAssignmentLessonId ? { lessonId: selectedAssignmentLessonId } : undefined,
      ),
    [buildStudentRoute, selectedAssignmentLessonId],
  );
  const studentResourcesRoute = useMemo(
    () =>
      buildStudentRoute(
        "/academy/media",
        selectedAssignmentLessonId ? { lessonId: selectedAssignmentLessonId } : undefined,
      ),
    [buildStudentRoute, selectedAssignmentLessonId],
  );
  const studentAssignmentsNeedingAttention = useMemo(() => {
    const now = Date.now();
    const nextWeek = now + 7 * 86400000;
    return studentVisibleAssignments.filter((assignment) => {
      if (assignment.status === "overdue") return true;
      const dueAt = new Date(String(assignment.dueDate || "")).getTime();
      return Number.isFinite(dueAt) && dueAt >= now && dueAt <= nextWeek;
    }).length;
  }, [studentVisibleAssignments]);
  const studentNextAction = useMemo(
    () =>
      buildAcademyStudentNextAction({
        tt,
        courseTitle: activeCourse?.title,
        lessonTitle: studentSelectedAssignment?.title,
        pendingAssignments: studentVisibleAssignments.length,
        dueSoonAssignments: studentAssignmentsNeedingAttention,
        feedbackCount: feedbackItems.length,
        progressPercent: studentProgressStats.progressPercent,
        resourceCount: visibleAssignments.length > 0 ? 1 : 0,
        isNewStudent: studentProgressStats.progressPercent <= 0,
      }),
    [
      activeCourse?.title,
      feedbackItems.length,
      studentAssignmentsNeedingAttention,
      studentProgressStats.progressPercent,
      studentSelectedAssignment?.title,
      studentVisibleAssignments.length,
      tt,
      visibleAssignments.length,
    ],
  );
  const studentSidebarNextActionRoute =
    studentNextAction.id === "feedback"
      ? `/academy/settings?tab=messages${studentSelectedAssignment ? `&assignmentId=${encodeURIComponent(studentSelectedAssignment.id)}` : ""}`
      : studentNextAction.id === "resources"
        ? studentResourcesRoute
        : studentPlayerRoute;
  const studentSidebarNextActionLabel =
    studentNextAction.id === "feedback"
      ? tt("Åpne dialog", "Open messages")
      : studentNextAction.id === "resources"
        ? tt("Se ressurser", "View resources")
        : tt("Arbeid i spiller", "Work in player");
  const selectedAssignmentStatusMeta = useMemo(
    () =>
      studentSelectedAssignment
        ? describeAcademyStudentAssignmentStatus(studentSelectedAssignment.status, tt)
        : null,
    [studentSelectedAssignment, tt],
  );
  const selectedAssignmentCriteria = useMemo(() => {
    if (!studentSelectedAssignment) return [];
    return [
      tt(
        `Vis konkret forbedring i ${studentSelectedAssignment.skillTitle || tt("denne ferdigheten", "this skill")}.`,
        `Show concrete improvement in ${studentSelectedAssignment.skillTitle || "this skill"}.`,
      ),
      studentSelectedAssignment.feedbackRequired
        ? tt(
            "Knytt refleksjonen til valgene du tok og resultatet du fikk.",
            "Tie the reflection to the choices you made and the result you achieved.",
          )
        : tt(
            "Forklar kort hvorfor du løste oppgaven slik du gjorde.",
            "Briefly explain why you solved the assignment the way you did.",
          ),
      studentSelectedAssignment.retryEnabled
        ? tt(
            "Lever noe som er lett å justere etter instruktørens feedback.",
            "Submit something that is easy to iterate on after instructor feedback.",
          )
        : tt(
            "Lever en tydelig versjon som kan vurderes uten ekstra kontekst.",
            "Submit a clear version that can be reviewed without extra context.",
          ),
    ];
  }, [studentSelectedAssignment, tt]);
  const strongSubmissionExample = useMemo(() => {
    if (!studentSelectedAssignment) return [];
    return [
      tt(
        "En kort levering med tydelig før/etter-effekt slår ofte en lang, uklar levering.",
        "A short submission with a clear before/after effect usually beats a long, unclear one.",
      ),
      tt(
        `Bruk ${studentSelectedAssignment.skillTitle || tt("ressursene", "the resources")} som støtte, ikke som hovedleveranse.`,
        `Use ${studentSelectedAssignment.skillTitle || "the resources"} as support, not as the main submission.`,
      ),
      tt(
        "Legg ved en refleksjon som forklarer hva du endret og hvorfor det fungerer bedre.",
        "Include a reflection that explains what you changed and why it works better.",
      ),
    ];
  }, [studentSelectedAssignment, tt]);

  if (isStudentMode) {
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
          <AcademyStudentSidebar
            activeNav="assignments"
            onNavigate={(_, route) => setLocation(route)}
            tt={tt}
            studentName={studentName}
            activeCourseId={activeCourse?.id ? String(activeCourse.id) : null}
            activeCourseTitle={activeCourse?.title || undefined}
            instructorName={activeCourse?.instructor?.name || undefined}
            progressPercent={studentProgressStats.progressPercent}
            completedLessons={studentProgressStats.completedLessons}
            totalLessons={studentProgressStats.totalLessons}
            returnTo={studentBaseReturnTo}
            continueRoute={studentPlayerRoute}
            nextActionTitle={studentNextAction.title}
            nextActionDetail={studentNextAction.detail}
            nextActionRoute={studentSidebarNextActionRoute}
            nextActionLabel={studentSidebarNextActionLabel}
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
                minHeight: { xs: 64, md: 74 },
                px: { xs: 1.4, md: 2.4 },
                py: 1.1,
                borderBottom:
                  "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.08)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: 1,
                background:
                  "linear-gradient(180deg, rgba(13,16,25,0.95), rgba(10,13,20,0.9))",
              }}
            >
              <Stack spacing={0.35}>
                <Typography
                  sx={{
                    fontSize: { xs: 24, md: 30 },
                    fontWeight: 700,
                    lineHeight: 1.05,
                  }}
                >
                  {tt("Mine oppgaver", "My assignments")}
                </Typography>
                <Typography sx={{ color: "rgba(237,240,247,0.64)", fontSize: 13 }}>
                  {activeCourse?.title || tt("Aktivt kurs", "Active course")}
                </Typography>
              </Stack>

              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <Button
                  variant="outlined"
                  startIcon={<Search />}
                  onClick={() => setLocation(studentResourcesRoute)}
                  sx={{
                    textTransform: "none",
                    borderColor: "rgba(255,255,255,0.2)",
                    color: "#edf0f7",
                  }}
                >
                  {tt("Ressurser", "Resources")}
                </Button>
                <Button
                  variant="contained"
                  startIcon={<PlayArrow />}
                  onClick={() => setLocation(studentPlayerRoute)}
                  sx={{
                    textTransform: "none",
                    color: "#0f0f0f",
                    background: "linear-gradient(180deg, #ffd44e, #f2a616)",
                    fontWeight: 700,
                  }}
                >
                  {tt("Fortsett i spiller", "Continue in player")}
                </Button>
              </Stack>
            </Box>

            <Box
              sx={{
                flex: 1,
                minHeight: 0,
                display: "grid",
                gridTemplateColumns: {
                  xs: "1fr",
                  xl: "minmax(0, 1fr) 380px",
                },
                gap: 1.4,
                px: { xs: 1.2, md: 2 },
                py: { xs: 1.2, md: 1.8 },
              }}
            >
              <Box sx={{ minHeight: 0, display: "flex", flexDirection: "column", gap: 1.2 }}>
                <Box sx={{ ...panelSx, p: 1.2 }}>
                  <Stack
                    direction={{ xs: "column", md: "row" }}
                    spacing={1}
                    justifyContent="space-between"
                    alignItems={{ xs: "stretch", md: "center" }}
                  >
                    <TextField
                      value={searchValue}
                      onChange={(event) => setSearchValue(event.target.value)}
                      placeholder={tt("Søk oppgaver...", "Search assignments...")}
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
                        flex: 1,
                        "& .MuiInputBase-root": {
                          bgcolor: "rgba(11,14,22,0.8)",
                          color: "#edf0f7",
                        },
                      }}
                    />
                    <Stack direction="row" spacing={0.8}>
                      <Chip
                        label={tt(`${studentVisibleAssignments.length} aktive`, `${studentVisibleAssignments.length} active`)}
                        sx={{ bgcolor: "rgba(248,179,33,0.16)", color: "#f8d56f" }}
                      />
                      <Chip
                        label={tt(`${totals.completed} fullført`, `${totals.completed} completed`)}
                        sx={{ bgcolor: "rgba(255,255,255,0.08)", color: "#edf0f7" }}
                      />
                    </Stack>
                  </Stack>

                  <Box
                    sx={{
                      mt: 1.1,
                      display: "grid",
                      gridTemplateColumns: {
                        xs: "repeat(2, minmax(0, 1fr))",
                        lg: "repeat(4, minmax(0, 1fr))",
                      },
                      gap: 1,
                    }}
                  >
                    {[
                      {
                        label: tt("Totalt", "Total"),
                        value: totals.totalAssignments,
                      },
                      {
                        label: tt("Snart forfall", "Due soon"),
                        value: upcomingAssignments.length,
                      },
                      {
                        label: tt("Tilbakemeldinger", "Feedback"),
                        value: feedbackItems.length,
                      },
                      {
                        label: tt("Snittscore", "Avg score"),
                        value: `${totals.avgScore}%`,
                      },
                    ].map((metric) => (
                      <Box
                        key={metric.label}
                        sx={{
                          ...panelSx,
                          p: 1,
                          borderColor: "rgba(255,255,255,0.1)",
                        }}
                      >
                        <Typography sx={{ fontSize: 22, fontWeight: 700, lineHeight: 1 }}>
                          {metric.value}
                        </Typography>
                        <Typography sx={{ color: "rgba(237,240,247,0.74)", fontSize: 13 }}>
                          {metric.label}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                </Box>

                <Box sx={{ ...panelSx, p: 1.2, minHeight: 0, display: "flex", flexDirection: "column" }}>
                  <Typography sx={{ fontSize: 18, fontWeight: 700, mb: 1 }}>
                    {tt("Oppgaveliste", "Assignment list")}
                  </Typography>
                  <Stack spacing={0.8} sx={{ minHeight: 0, overflowY: "auto", pr: 0.3 }}>
                    {studentVisibleAssignments.map((assignment) => {
                      const active = studentSelectedAssignment?.id === assignment.id;
                      return (
                        <Box
                          key={assignment.id}
                          onClick={() => setSelectedAssignmentId(assignment.id)}
                          sx={{
                            ...panelSx,
                            p: 1,
                            cursor: "pointer",
                            borderColor: active
                              ? "rgba(248,179,33,0.42)"
                              : "rgba(255,255,255,0.08)",
                            background: active
                              ? "linear-gradient(145deg, rgba(34,28,16,0.94), rgba(15,14,11,0.98))"
                              : panelSx.background,
                          }}
                        >
                          <Stack spacing={0.55}>
                            <Stack direction="row" spacing={0.7} flexWrap="wrap" useFlexGap>
                              <Chip
                                label={describeAcademyStudentAssignmentStatus(assignment.status, tt).label}
                                size="small"
                                sx={{
                                  bgcolor: describeAcademyStudentAssignmentStatus(assignment.status, tt).chipBg,
                                  color: describeAcademyStudentAssignmentStatus(assignment.status, tt).chipColor,
                                }}
                              />
                              <Chip
                                label={assignmentTypeLabel(assignment.assignmentType)}
                                size="small"
                                sx={{ bgcolor: "rgba(248,179,33,0.16)", color: "#f8d56f" }}
                              />
                              <Chip
                                label={assignment.scope === "skill" ? assignment.skillTitle : tt("Hele kurset", "Entire course")}
                                size="small"
                                sx={{ bgcolor: "rgba(120,187,255,0.14)", color: "#d8ecff" }}
                              />
                            </Stack>
                            <Typography sx={{ fontSize: 18, fontWeight: 700, lineHeight: 1.12 }}>
                              {assignment.title}
                            </Typography>
                            <Typography sx={{ color: "rgba(237,240,247,0.72)", fontSize: 13 }}>
                              {assignment.subtitle}
                            </Typography>
                            <Stack direction="row" justifyContent="space-between" spacing={1}>
                              <Typography sx={{ color: "rgba(237,240,247,0.58)", fontSize: 12 }}>
                                {formatDateRange(assignment.startDate, assignment.dueDate, dateLocale)}
                              </Typography>
                              <Typography sx={{ color: "#f8d56f", fontSize: 12, fontWeight: 700 }}>
                                {assignment.avgScore}%
                              </Typography>
                            </Stack>
                          </Stack>
                        </Box>
                      );
                    })}

                    {studentVisibleAssignments.length === 0 ? (
                      <Typography sx={{ color: "rgba(237,240,247,0.66)", fontSize: 13 }}>
                        {tt("Ingen oppgaver matcher søket ditt.", "No assignments match your search.")}
                      </Typography>
                    ) : null}
                  </Stack>
                </Box>
              </Box>

              <Box sx={{ ...panelSx, p: 1.2, display: "flex", flexDirection: "column", gap: 1 }}>
                {studentSelectedAssignment ? (
                  <>
                    <Stack spacing={0.45}>
                      <Typography sx={{ fontSize: 22, fontWeight: 700, lineHeight: 1.1 }}>
                        {studentSelectedAssignment.title}
                      </Typography>
                      <Typography sx={{ color: "rgba(237,240,247,0.68)", fontSize: 13 }}>
                        {studentSelectedAssignment.subtitle}
                      </Typography>
                    </Stack>

                    <Stack direction="row" spacing={0.6} flexWrap="wrap" useFlexGap>
                      <Chip
                        label={assignmentLevelLabel(studentSelectedAssignment.level)}
                        sx={{ bgcolor: "rgba(255,255,255,0.08)", color: "#edf0f7" }}
                      />
                      <Chip
                        label={transformationStageLabel(studentSelectedAssignment.transformationStage)}
                        sx={{ bgcolor: "rgba(248,179,33,0.16)", color: "#f8d56f" }}
                      />
                      <Chip
                        label={selectedAssignmentStatusMeta?.label || statusLabel(studentSelectedAssignment.status)}
                        sx={{
                          bgcolor: selectedAssignmentStatusMeta?.chipBg || "rgba(120,187,255,0.14)",
                          color: selectedAssignmentStatusMeta?.chipColor || "#d8ecff",
                        }}
                      />
                    </Stack>

                    <Box sx={{ ...panelSx, p: 1, borderColor: "rgba(255,255,255,0.1)" }}>
                      <Typography sx={{ fontSize: 13, color: "rgba(237,240,247,0.62)" }}>
                        {tt("Neste handling", "Next action")}
                      </Typography>
                      <Typography sx={{ mt: 0.35, fontWeight: 700 }}>
                        {selectedAssignmentStatusMeta?.label || tt("Pågår", "In progress")}
                      </Typography>
                      <Typography sx={{ mt: 0.35, lineHeight: 1.5, color: "rgba(237,240,247,0.74)" }}>
                        {selectedAssignmentStatusMeta?.detail}
                      </Typography>
                      <Typography sx={{ mt: 0.55, fontSize: 12, color: "rgba(237,240,247,0.58)" }}>
                        {tt("Frist", "Due")}: {formatDateRange(studentSelectedAssignment.startDate, studentSelectedAssignment.dueDate, dateLocale)}
                      </Typography>
                    </Box>

                    <Box sx={{ ...panelSx, p: 1, borderColor: "rgba(255,255,255,0.1)" }}>
                      <Typography sx={{ fontSize: 13, color: "rgba(237,240,247,0.62)" }}>
                        {tt("Mål", "Objective")}
                      </Typography>
                      <Typography sx={{ mt: 0.35, lineHeight: 1.5 }}>
                        {studentSelectedAssignment.transformationObjective}
                      </Typography>
                    </Box>

                    <Box sx={{ ...panelSx, p: 1, borderColor: "rgba(255,255,255,0.1)" }}>
                      <Typography sx={{ fontSize: 13, color: "rgba(237,240,247,0.62)" }}>
                        {tt("Refleksjon", "Reflection")}
                      </Typography>
                      <Typography sx={{ mt: 0.35, lineHeight: 1.5 }}>
                        {studentSelectedAssignment.reflectionPrompt}
                      </Typography>
                    </Box>

                    <Box sx={{ ...panelSx, p: 1, borderColor: "rgba(255,255,255,0.1)" }}>
                      <Typography sx={{ fontSize: 13, color: "rgba(237,240,247,0.62)" }}>
                        {tt("Slik blir du vurdert", "How you will be assessed")}
                      </Typography>
                      <Stack spacing={0.65} sx={{ mt: 0.7 }}>
                        {selectedAssignmentCriteria.map((item) => (
                          <Box
                            key={item}
                            sx={{
                              borderRadius: 1,
                              border: "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.08)",
                              bgcolor: "rgba(10,14,22,0.64)",
                              px: 0.8,
                              py: 0.75,
                            }}
                          >
                            <Typography sx={{ fontSize: 13, color: "rgba(237,240,247,0.82)" }}>
                              {item}
                            </Typography>
                          </Box>
                        ))}
                      </Stack>
                    </Box>

                    <Box sx={{ ...panelSx, p: 1, borderColor: "rgba(255,255,255,0.1)" }}>
                      <Typography sx={{ fontSize: 13, color: "rgba(237,240,247,0.62)" }}>
                        {tt("Eksempel på sterk levering", "Example of a strong submission")}
                      </Typography>
                      <Stack spacing={0.65} sx={{ mt: 0.7 }}>
                        {strongSubmissionExample.map((item) => (
                          <Typography
                            key={item}
                            sx={{ fontSize: 13, color: "rgba(237,240,247,0.78)", lineHeight: 1.5 }}
                          >
                            {item}
                          </Typography>
                        ))}
                      </Stack>
                    </Box>

                    <Stack spacing={0.7}>
                      <Button
                        startIcon={<PlayArrow />}
                        onClick={() => setLocation(studentPlayerRoute)}
                        sx={{
                          justifyContent: "flex-start",
                          textTransform: "none",
                          color: "#0f0f0f",
                          background: "linear-gradient(180deg, #ffd44e, #f2a616)",
                          fontWeight: 700,
                        }}
                      >
                        {tt("Åpne i spiller", "Open in player")}
                      </Button>
                      <Button
                        startIcon={<Search />}
                        onClick={() => setLocation(studentResourcesRoute)}
                        sx={{
                          justifyContent: "flex-start",
                          textTransform: "none",
                          color: "#edf0f7",
                          border:
                            "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.16)",
                        }}
                      >
                        {tt("Se ressurser", "View resources")}
                      </Button>
                      <Button
                        startIcon={<MailOutline />}
                        onClick={() =>
                          setLocation(
                            `/academy/settings?tab=messages&assignmentId=${encodeURIComponent(studentSelectedAssignment.id)}`,
                          )
                        }
                        sx={{
                          justifyContent: "flex-start",
                          textTransform: "none",
                          color: "#edf0f7",
                          border:
                            "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.16)",
                        }}
                      >
                        {tt("Åpne dialog", "Open messages")}
                      </Button>
                    </Stack>

                    <Divider sx={{ borderColor: "rgba(255,255,255,0.08)" }} />
                    <Typography sx={{ fontSize: 17, fontWeight: 700 }}>
                      {tt("Tilbakemeldinger", "Feedback")}
                    </Typography>
                    <Stack spacing={0.7}>
                      {feedbackItems.slice(0, 5).map((item) => (
                        <Box
                          key={item.id}
                          sx={{
                            ...panelSx,
                            p: 0.9,
                            borderColor: "rgba(255,255,255,0.1)",
                          }}
                        >
                          <Stack direction="row" justifyContent="space-between" spacing={1}>
                            <Typography sx={{ fontWeight: 700 }}>{item.author}</Typography>
                            <Typography sx={{ color: "rgba(237,240,247,0.58)", fontSize: 12 }}>
                              {item.timestamp}
                            </Typography>
                          </Stack>
                          <Typography sx={{ mt: 0.45, color: "rgba(237,240,247,0.78)", fontSize: 13 }}>
                            {item.message}
                          </Typography>
                        </Box>
                      ))}
                      {feedbackItems.length === 0 ? (
                        <Typography sx={{ color: "rgba(237,240,247,0.66)", fontSize: 13 }}>
                          {tt("Ingen tilbakemeldinger ennå.", "No feedback yet.")}
                        </Typography>
                      ) : null}
                    </Stack>
                  </>
                ) : (
                  <Typography sx={{ color: "rgba(237,240,247,0.66)", fontSize: 13 }}>
                    {tt("Velg en oppgave for å se detaljer.", "Select an assignment to view details.")}
                  </Typography>
                )}
              </Box>
            </Box>
          </Box>
        </Box>
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
          display: "flex",
          flexDirection: { xs: "column", lg: "row" },
          minHeight: "100vh",
          position: "relative",
          zIndex: 1,
          width: "100%",
          maxWidth: "min(100%, var(--academy-shell-max-width, 3200px))",
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
          bottomAction={
            isFollowUpView || isTransformationPulseView
              ? undefined
              : {
                  label: tt("Ny oppgave", "New Assignment"),
                  onClick: addAssignment,
                }
          }
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
              minHeight: { xs: 64, md: 74 },
              px: { xs: 1.2, sm: 2, xl: 3 },
              py: { xs: 0.8, md: 0 },
              borderBottom:
                "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.08)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              rowGap: 0.7,
              background:
                "linear-gradient(180deg, rgba(13,16,25,0.95), rgba(10,13,20,0.9))",
            }}
          >
            <Stack direction="row" spacing={2} alignItems="center">
              <Typography
                sx={{
                  letterSpacing: "0.22em",
                  fontSize: { xs: 12, sm: 14, xl: 15 },
                  color: "rgba(237,240,247,0.82)",
                }}
              >
                CREATOR STUDIO
              </Typography>
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

            <Stack
              direction="row"
              spacing={{ xs: 0.5, sm: 1.2 }}
              alignItems="center"
            >
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
                    width: { xs: 30, sm: 34 },
                    height: { xs: 30, sm: 34 },
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
                lg: "minmax(0, 1fr) clamp(360px, 30vw, 500px)",
                xl: "minmax(0, 1fr) clamp(400px, 26vw, 620px)",
              },
              alignItems: "start",
              gap: { xs: 1, md: 1.4, xl: 2 },
              px: { xs: 1, sm: 1.3, md: 2, xl: 2.4 },
              py: { xs: 1, sm: 1.4, md: 2 },
              "@media (min-width: 2560px)": {
                gridTemplateColumns: "minmax(0, 1fr) minmax(520px, 680px)",
                gap: 2.4,
                px: 3,
              },
              "@media (min-width: 3840px)": {
                gridTemplateColumns: "minmax(0, 1fr) minmax(560px, 760px)",
                gap: 2.8,
                px: 3.5,
              },
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
                direction={{ xs: "column", md: "row" }}
                spacing={1.2}
                justifyContent="space-between"
                alignItems={{ xs: "stretch", md: "center" }}
              >
                <Stack spacing={0.35}>
                  <Typography
                    sx={{
                      fontSize: { xs: 22, md: 26, xl: 30 },
                      fontWeight: 600,
                      letterSpacing: "0.02em",
                      lineHeight: 1.08,
                    }}
                  >
                    {tt("Oppgaver", "Assignments")}
                  </Typography>
                  <Tabs
                    value={contentTab}
                    onChange={(_event, nextValue) =>
                      setAssignmentsView(nextValue as AssignmentsViewTab)
                    }
                    sx={{
                      minHeight: 34,
                      "& .MuiTab-root": {
                        minHeight: 34,
                        px: 1.2,
                        textTransform: "none",
                        color: "rgba(237,240,247,0.72)",
                        fontWeight: 600,
                      },
                      "& .Mui-selected": { color: "#f8d56f" },
                      "& .MuiTabs-indicator": {
                        backgroundColor: "#f8b321",
                        height: 2.5,
                      },
                    }}
                  >
                    <Tab
                      value="assignments"
                      label={tt("Alle oppgaver", "All assignments")}
                    />
                    <Tab
                      value="followup"
                      label={tt("Oppfølging", "Follow-up")}
                    />
                    <Tab
                      value="transformation"
                      label={tt("Transformasjonspuls", "Transformation Pulse")}
                    />
                  </Tabs>
                </Stack>

                {isFollowUpView || isTransformationPulseView ? (
                  <Button
                    variant="outlined"
                    onClick={() => setAssignmentsView("assignments")}
                    sx={{
                      textTransform: "none",
                      borderColor: "rgba(255,255,255,0.2)",
                      color: "#edf0f7",
                      borderRadius: 1,
                    }}
                  >
                    {tt("Gå til alle oppgaver", "Go to all assignments")}
                  </Button>
                ) : (
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    <Button
                      variant="outlined"
                      startIcon={<Download />}
                      onClick={exportAssignments}
                      sx={{
                        textTransform: "none",
                        borderColor: "rgba(255,255,255,0.2)",
                        color: "#edf0f7",
                        borderRadius: 1,
                      }}
                    >
                      {tt("Eksporter", "Export")}
                    </Button>
                    <Button
                      variant="outlined"
                      startIcon={<Assessment />}
                      onClick={handleReports}
                      sx={{
                        textTransform: "none",
                        borderColor: "rgba(255,255,255,0.2)",
                        color: "#edf0f7",
                        borderRadius: 1,
                      }}
                    >
                      {tt("Rapporter", "Reports")}
                    </Button>
                  </Stack>
                )}
              </Stack>

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

              {!isFollowUpView ? (
                <Box
                  sx={{
                    ...panelSx,
                    p: 1.2,
                  }}
                >
                  <Stack
                    direction={{ xs: "column", md: "row" }}
                    spacing={1}
                    justifyContent="space-between"
                    alignItems={{ xs: "stretch", md: "center" }}
                    sx={{ mb: 1 }}
                  >
                    <Stack
                      direction="row"
                      spacing={1}
                      flexWrap="wrap"
                      useFlexGap
                    >
                      <Select
                        size="small"
                        value={selectedCompetencyFilter}
                        onChange={(event) =>
                          setSelectedCompetencyFilter(
                            String(event.target.value),
                          )
                        }
                        sx={{
                          minWidth: { xs: "100%", sm: 180 },
                          flex: { xs: "1 1 100%", sm: "0 1 auto" },
                          color: "#edf0f7",
                          bgcolor: "rgba(255,255,255,0.05)",
                          "& .MuiOutlinedInput-notchedOutline": {
                            borderColor: "rgba(255,255,255,0.16)",
                          },
                        }}
                      >
                        <MenuItem value="all">
                          {tt("Alle kompetanser", "All competencies")}
                        </MenuItem>
                        {competencyFilterOptions.map((competency) => (
                          <MenuItem key={competency} value={competency}>
                            {competency}
                          </MenuItem>
                        ))}
                      </Select>
                      <Select
                        size="small"
                        value={statusFilter}
                        onChange={(event) =>
                          setStatusFilter(event.target.value as StatusFilter)
                        }
                        sx={{
                          minWidth: { xs: "100%", sm: 150 },
                          flex: { xs: "1 1 100%", sm: "0 1 auto" },
                          color: "#edf0f7",
                          bgcolor: "rgba(255,255,255,0.05)",
                          "& .MuiOutlinedInput-notchedOutline": {
                            borderColor: "rgba(255,255,255,0.16)",
                          },
                        }}
                      >
                        <MenuItem value="all">
                          {tt("Alle statuser", "All Status")}
                        </MenuItem>
                        <MenuItem value="active">
                          {tt("Aktiv", "Active")}
                        </MenuItem>
                        <MenuItem value="in_review">
                          {tt("Under vurdering", "In Review")}
                        </MenuItem>
                        <MenuItem value="completed">
                          {tt("Fullført", "Completed")}
                        </MenuItem>
                        <MenuItem value="overdue">
                          {tt("Forfalt", "Overdue")}
                        </MenuItem>
                        <MenuItem value="draft">
                          {tt("Utkast", "Draft")}
                        </MenuItem>
                      </Select>
                      <Select
                        size="small"
                        value={rangeFilter}
                        onChange={(event) =>
                          setRangeFilter(event.target.value as RangeFilter)
                        }
                        sx={{
                          minWidth: { xs: "100%", sm: 130 },
                          flex: { xs: "1 1 100%", sm: "0 1 auto" },
                          color: "#edf0f7",
                          bgcolor: "rgba(255,255,255,0.05)",
                          "& .MuiOutlinedInput-notchedOutline": {
                            borderColor: "rgba(255,255,255,0.16)",
                          },
                        }}
                      >
                        <MenuItem value="7d">
                          {tt("Siste 7 dager", "Last 7 days")}
                        </MenuItem>
                        <MenuItem value="30d">
                          {tt("Siste 30 dager", "Last 30 days")}
                        </MenuItem>
                        <MenuItem value="90d">
                          {tt("Siste 90 dager", "Last 90 days")}
                        </MenuItem>
                      </Select>
                    </Stack>
                    <Button
                      variant="contained"
                      startIcon={<Add />}
                      onClick={addAssignment}
                      sx={{
                        textTransform: "none",
                        borderRadius: 1,
                        color: "#0f0f0f",
                        background: "linear-gradient(180deg, #ffd44e, #f2a616)",
                        boxShadow: "0 10px 24px rgba(248,179,33,0.25)",
                        alignSelf: { xs: "stretch", md: "center" },
                        minWidth: { xs: "100%", md: 180 },
                      }}
                    >
                      {tt("Opprett oppgave", "Create Assignment")}
                    </Button>
                  </Stack>

                  <TextField
                    value={searchValue}
                    onChange={(event) => setSearchValue(event.target.value)}
                    placeholder={tt("Søk oppgaver...", "Search assignments...")}
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
                      width: "100%",
                      "& .MuiInputBase-root": {
                        bgcolor: "rgba(11,14,22,0.8)",
                        color: "#edf0f7",
                      },
                    }}
                  />

                  <Box
                    sx={{
                      mt: 1.1,
                      display: "grid",
                      gridTemplateColumns: {
                        xs: "1fr",
                        sm: "repeat(2, minmax(0, 1fr))",
                        lg: "repeat(4, minmax(0, 1fr))",
                      },
                      gap: 1,
                    }}
                  >
                    <Box
                      sx={{
                        ...panelSx,
                        p: 1,
                        borderColor: "rgba(255,255,255,0.1)",
                      }}
                    >
                      <Typography
                        sx={{ fontSize: 22, fontWeight: 700, lineHeight: 1 }}
                      >
                        {totals.totalAssignments}
                      </Typography>
                      <Typography sx={{ color: "rgba(237,240,247,0.8)" }}>
                        {tt("Totale oppgaver", "Total Assignments")}
                      </Typography>
                      <Stack
                        direction="row"
                        spacing={0.5}
                        alignItems="center"
                        sx={{ color: "#95d57e" }}
                      >
                        <TrendingUp sx={{ fontSize: 15 }} />
                        <Typography sx={{ fontSize: 12 }}>
                          {tt("+8.6% siste 30 dager", "+8.6% past 30 days")}
                        </Typography>
                      </Stack>
                    </Box>
                    <Box
                      sx={{
                        ...panelSx,
                        p: 1,
                        borderColor: "rgba(255,255,255,0.1)",
                      }}
                    >
                      <Typography
                        sx={{ fontSize: 22, fontWeight: 700, lineHeight: 1 }}
                      >
                        {totals.submissions}
                      </Typography>
                      <Typography sx={{ color: "rgba(237,240,247,0.8)" }}>
                        {tt("Innleveringer", "Submissions")}
                      </Typography>
                      <Typography
                        sx={{ fontSize: 12, color: "rgba(237,240,247,0.6)" }}
                      >
                        {tt("For periode", "Across")} {rangeFilter}
                      </Typography>
                    </Box>
                    <Box
                      sx={{
                        ...panelSx,
                        p: 1,
                        borderColor: "rgba(255,255,255,0.1)",
                      }}
                    >
                      <Typography
                        sx={{ fontSize: 22, fontWeight: 700, lineHeight: 1 }}
                      >
                        {totals.completed}
                      </Typography>
                      <Typography sx={{ color: "rgba(237,240,247,0.8)" }}>
                        {tt("Fullført", "Completed")}
                      </Typography>
                      <Typography
                        sx={{ fontSize: 12, color: "rgba(237,240,247,0.6)" }}
                      >
                        {tt("Teamdeltakere", "Team participants")}
                      </Typography>
                    </Box>
                    <Box
                      sx={{
                        ...panelSx,
                        p: 1,
                        borderColor: "rgba(255,255,255,0.1)",
                      }}
                    >
                      <Typography
                        sx={{ fontSize: 22, fontWeight: 700, lineHeight: 1 }}
                      >
                        {totals.avgScore}%
                      </Typography>
                      <Typography sx={{ color: "rgba(237,240,247,0.8)" }}>
                        {tt("Gj.sn. score", "Avg Score")}
                      </Typography>
                      <Typography sx={{ fontSize: 12, color: "#95d57e" }}>
                        {tt("Kvalitetsbenchmark", "Quality benchmark")}
                      </Typography>
                    </Box>
                  </Box>

                  <Box
                    ref={transformationPulseSectionRef}
                    sx={{
                      ...panelSx,
                      p: 1,
                      mt: 1,
                      borderColor: isTransformationPulseView
                        ? "rgba(248,179,33,0.46)"
                        : "rgba(255,255,255,0.08)",
                    }}
                  >
                    <Typography sx={{ fontSize: 18, fontWeight: 700 }}>
                      {tt("Transformasjonspuls", "Transformation Pulse")}
                    </Typography>
                    <Typography
                      sx={{
                        fontSize: 12,
                        color: "rgba(237,240,247,0.66)",
                        mb: 0.8,
                      }}
                    >
                      {tt(
                        "Viser hvor godt oppgavene er koblet til ferdigheter, mestringsbevis og refleksjon.",
                        "Shows how well assignments are tied to skills, proof of mastery, and reflection.",
                      )}
                    </Typography>
                    <Typography
                      sx={{
                        fontSize: 12,
                        color: "rgba(237,240,247,0.58)",
                        mb: 0.8,
                      }}
                    >
                      {tt(
                        "Målet er deliberate practice: krevende men mulig, tenking, feedback og nye forsøk.",
                        "Goal is deliberate practice: challenging but possible, thinking, feedback, and retries.",
                      )}
                    </Typography>
                    <Stack
                      direction={{ xs: "column", md: "row" }}
                      spacing={0.8}
                    >
                      <Box
                        sx={{
                          ...panelSx,
                          p: 0.9,
                          flex: 1,
                          borderColor: "rgba(255,255,255,0.1)",
                        }}
                      >
                        <Typography sx={{ fontSize: 22, fontWeight: 700 }}>
                          {transformationPulse.coveragePct}%
                        </Typography>
                        <Typography
                          sx={{ fontSize: 12, color: "rgba(237,240,247,0.7)" }}
                        >
                          {tt(
                            "Ferdighetskoblede oppgaver",
                            "Skill-linked assignments",
                          )}
                        </Typography>
                      </Box>
                      <Box
                        sx={{
                          ...panelSx,
                          p: 0.9,
                          flex: 1,
                          borderColor: "rgba(255,255,255,0.1)",
                        }}
                      >
                        <Typography sx={{ fontSize: 22, fontWeight: 700 }}>
                          {transformationPulse.proveStagePct}%
                        </Typography>
                        <Typography
                          sx={{ fontSize: 12, color: "rgba(237,240,247,0.7)" }}
                        >
                          {tt("Bevis-fase oppgaver", "Proof-stage assignments")}
                        </Typography>
                      </Box>
                      <Box
                        sx={{
                          ...panelSx,
                          p: 0.9,
                          flex: 1,
                          borderColor: "rgba(255,255,255,0.1)",
                        }}
                      >
                        <Typography sx={{ fontSize: 22, fontWeight: 700 }}>
                          {transformationPulse.deliberatePracticePct}%
                        </Typography>
                        <Typography
                          sx={{ fontSize: 12, color: "rgba(237,240,247,0.7)" }}
                        >
                          {tt(
                            "Deliberate Practice-klare",
                            "Deliberate Practice ready",
                          )}
                        </Typography>
                      </Box>
                    </Stack>
                  </Box>

                  <Box
                    sx={{
                      mt: 1.1,
                      borderRadius: 1,
                      overflowX: "auto",
                      overflowY: "hidden",
                      border:
                        "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.09)",
                    }}
                  >
                    <Box
                      sx={{
                        display: "grid",
                        gridTemplateColumns:
                          "minmax(240px, 1.6fr) 1fr 0.5fr 0.5fr",
                        minWidth: { xs: 700, md: 780, xl: 900 },
                        px: 1,
                        py: 0.8,
                        background: "rgba(255,255,255,0.04)",
                        borderBottom:
                          "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.1)",
                      }}
                    >
                      <Typography
                        sx={{ fontSize: 13, color: "rgba(237,240,247,0.7)" }}
                      >
                        {tt("Oppgave", "Assignment")}
                      </Typography>
                      <Typography
                        sx={{ fontSize: 13, color: "rgba(237,240,247,0.7)" }}
                      >
                        {tt("Progresjon", "Progress")}
                      </Typography>
                      <Typography
                        sx={{ fontSize: 13, color: "rgba(237,240,247,0.7)" }}
                      >
                        {tt("Gj.sn. score", "Avg Score")}
                      </Typography>
                      <Typography
                        sx={{
                          fontSize: 13,
                          color: "rgba(237,240,247,0.7)",
                          textAlign: "right",
                        }}
                      >
                        {tt("Handlinger", "Actions")}
                      </Typography>
                    </Box>

                    <Stack spacing={0}>
                      {visibleAssignments.length === 0 && (
                        <Box sx={{ p: 1.2, color: "rgba(237,240,247,0.68)" }}>
                          {tt(
                            "Ingen oppgaver funnet for valgt filter.",
                            "No assignments found for the selected filter.",
                          )}
                        </Box>
                      )}
                      {visibleAssignments.map((assignment) => {
                        const isSelected =
                          selectedAssignment?.id === assignment.id;
                        const progress = Math.round(
                          (assignment.submissions /
                            Math.max(assignment.targetSubmissions, 1)) *
                            100,
                        );

                        return (
                          <Box
                            key={assignment.id}
                            onClick={() =>
                              setSelectedAssignmentId(assignment.id)
                            }
                            sx={{
                              display: "grid",
                              gridTemplateColumns:
                                "minmax(240px, 1.6fr) 1fr 0.5fr 0.5fr",
                              minWidth: { xs: 700, md: 780, xl: 900 },
                              px: 1,
                              py: 1,
                              gap: 1,
                              cursor: "pointer",
                              background: isSelected
                                ? "linear-gradient(90deg, rgba(248,179,33,0.12), rgba(255,255,255,0.02))"
                                : "rgba(8,11,18,0.6)",
                              borderBottom:
                                "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.08)",
                              "&:hover": {
                                background:
                                  "linear-gradient(90deg, rgba(248,179,33,0.12), rgba(255,255,255,0.02))",
                              },
                            }}
                          >
                            <Stack
                              direction="row"
                              spacing={1}
                              alignItems="center"
                              minWidth={0}
                            >
                              <Box
                                sx={{
                                  width: 82,
                                  height: 48,
                                  borderRadius: 1,
                                  border:
                                    "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.1)",
                                  background:
                                    placeholderBackgrounds[
                                      assignment.imageTheme %
                                        placeholderBackgrounds.length
                                    ],
                                  flexShrink: 0,
                                }}
                              />
                              <Box minWidth={0}>
                                <Typography sx={{ fontWeight: 600 }} noWrap>
                                  {assignment.title}
                                </Typography>
                                <Typography
                                  sx={{
                                    fontSize: 12,
                                    color: "rgba(237,240,247,0.66)",
                                  }}
                                  noWrap
                                >
                                  {assignment.subtitle}
                                </Typography>
                                <Stack
                                  direction="row"
                                  spacing={0.6}
                                  sx={{ mt: 0.4 }}
                                  flexWrap="wrap"
                                  useFlexGap
                                >
                                  <Chip
                                    label={assignmentTypeLabel(
                                      assignment.assignmentType,
                                    )}
                                    size="small"
                                    sx={{
                                      height: 20,
                                      color: "#edf0f7",
                                      bgcolor: "rgba(248,179,33,0.2)",
                                      fontSize: 11,
                                    }}
                                  />
                                  <Chip
                                    label={`${transformationStageLabel(assignment.transformationStage)} • ${assignmentLevelLabel(assignment.level)}`}
                                    size="small"
                                    sx={{
                                      height: 20,
                                      color: "#edf0f7",
                                      bgcolor: "rgba(142,166,214,0.2)",
                                      fontSize: 11,
                                    }}
                                  />
                                  <Chip
                                    label={
                                      assignment.scope === "skill"
                                        ? assignment.skillTitle
                                        : tt("Kursnivå", "Course level")
                                    }
                                    size="small"
                                    sx={{
                                      height: 20,
                                      color: "#edf0f7",
                                      bgcolor: "rgba(255,255,255,0.1)",
                                      fontSize: 11,
                                    }}
                                  />
                                  {assignment.tags.map((tag) => (
                                    <Chip
                                      key={`${assignment.id}-${tag}`}
                                      label={tag}
                                      size="small"
                                      sx={{
                                        height: 20,
                                        color: "#edf0f7",
                                        bgcolor: "rgba(255,255,255,0.1)",
                                        fontSize: 11,
                                      }}
                                    />
                                  ))}
                                </Stack>
                              </Box>
                            </Stack>

                            <Box>
                              <Typography
                                sx={{
                                  fontSize: 13,
                                  color: "rgba(237,240,247,0.74)",
                                }}
                              >
                                {formatDateRange(
                                  assignment.startDate,
                                  assignment.dueDate,
                                  dateLocale,
                                )}
                              </Typography>
                              <Stack
                                direction="row"
                                alignItems="center"
                                spacing={1}
                                sx={{ mt: 0.4 }}
                              >
                                <Typography
                                  sx={{ minWidth: 44, fontWeight: 700 }}
                                >
                                  {progress}%
                                </Typography>
                                <LinearProgress
                                  variant="determinate"
                                  value={progress}
                                  sx={{
                                    flex: 1,
                                    height: 5,
                                    borderRadius: 999,
                                    bgcolor: "rgba(255,255,255,0.14)",
                                    "& .MuiLinearProgress-bar": {
                                      borderRadius: 999,
                                      background:
                                        "linear-gradient(90deg, #7fb4ff 0%, #f8b321 100%)",
                                    },
                                  }}
                                />
                              </Stack>
                              <Typography
                                sx={{
                                  fontSize: 12,
                                  color: "rgba(237,240,247,0.62)",
                                  mt: 0.35,
                                }}
                              >
                                {assignment.submissions}/
                                {assignment.targetSubmissions}{" "}
                                {tt("innleveringer", "submissions")}
                              </Typography>
                            </Box>

                            <Box>
                              <Typography
                                sx={{ color: "#f8d56f", fontWeight: 700 }}
                              >
                                {assignment.avgScore}%
                              </Typography>
                              <Typography
                                sx={{
                                  fontSize: 12,
                                  color: "rgba(237,240,247,0.62)",
                                }}
                              >
                                {statusLabel(assignment.status)}
                              </Typography>
                            </Box>

                            <Stack
                              direction="row"
                              spacing={0.5}
                              justifyContent="flex-end"
                            >
                              <IconButton
                                size="small"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setLocation(
                                    `/academy/settings?tab=messages&assignmentId=${encodeURIComponent(assignment.id)}`,
                                  );
                                }}
                                sx={{ color: "rgba(237,240,247,0.68)" }}
                              >
                                <MailOutline fontSize="small" />
                              </IconButton>
                              <IconButton
                                size="small"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setSelectedAssignmentId(assignment.id);
                                }}
                                sx={{ color: "rgba(237,240,247,0.68)" }}
                              >
                                <Edit fontSize="small" />
                              </IconButton>
                              <IconButton
                                size="small"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  duplicateAssignment(assignment.id);
                                }}
                                sx={{ color: "rgba(237,240,247,0.68)" }}
                              >
                                <MoreHoriz fontSize="small" />
                              </IconButton>
                              <IconButton
                                size="small"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  removeAssignment(assignment.id);
                                }}
                                sx={{ color: "rgba(237,240,247,0.68)" }}
                              >
                                <DeleteOutline fontSize="small" />
                              </IconButton>
                            </Stack>
                          </Box>
                        );
                      })}
                    </Stack>
                  </Box>

                  {selectedAssignment && (
                    <Box
                      sx={{
                        ...panelSx,
                        p: 1,
                        mt: 1,
                        borderColor: "rgba(248,179,33,0.28)",
                        bgcolor: "rgba(8,12,20,0.9)",
                      }}
                    >
                      <Stack
                        direction="row"
                        spacing={0.8}
                        justifyContent="space-between"
                        alignItems="center"
                      >
                        <Typography sx={{ fontSize: 16, fontWeight: 700 }}>
                          {tt("Visuell forhåndsvisning", "Visual preview")}
                        </Typography>
                        <Chip
                          size="small"
                          label={
                            selectedAssignmentPreviewVisible
                              ? tt("Synlig nå", "Visible now")
                              : tt("Skjult nå", "Hidden now")
                          }
                          color={
                            selectedAssignmentPreviewVisible
                              ? "warning"
                              : "default"
                          }
                          sx={{ color: "#edf0f7" }}
                        />
                      </Stack>
                      <Typography
                        sx={{
                          fontSize: 12,
                          color: "rgba(237,240,247,0.64)",
                          mt: 0.3,
                        }}
                      >
                        {tt(
                          "Samme visuelle prinsipp som CTA: dra tid og se plassering live.",
                          "Same visual behavior as CTA: scrub time and see placement live.",
                        )}
                      </Typography>

                      <Box
                        sx={{
                          position: "relative",
                          borderRadius: 1.2,
                          border:
                            "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.14)",
                          overflow: "hidden",
                          mt: 0.8,
                          aspectRatio: "16 / 9",
                          background:
                            "linear-gradient(160deg, rgba(15,23,39,0.96), rgba(8,12,20,0.98)), radial-gradient(circle at 76% 22%, rgba(248,179,33,0.2), rgba(0,0,0,0))",
                        }}
                      >
                        <Box
                          sx={{
                            position: "absolute",
                            inset: 0,
                            background:
                              "linear-gradient(180deg, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.45) 100%)",
                          }}
                        />
                        <Box
                          sx={{
                            position: "absolute",
                            top: 8,
                            left: 10,
                            px: 0.6,
                            py: 0.25,
                            borderRadius: 0.8,
                            bgcolor: "rgba(0,0,0,0.52)",
                            border:
                              "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.12)",
                          }}
                        >
                          <Typography
                            sx={{
                              fontSize: 11,
                              color: "rgba(237,240,247,0.9)",
                              fontWeight: 600,
                            }}
                          >
                            {tt("Tid", "Time")}:{" "}
                            {formatMinuteSecond(previewTime)}
                          </Typography>
                        </Box>
                        <Box
                          sx={{
                            position: "absolute",
                            top: 8,
                            right: 10,
                            px: 0.6,
                            py: 0.25,
                            borderRadius: 0.8,
                            bgcolor: "rgba(0,0,0,0.52)",
                            border:
                              "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.12)",
                          }}
                        >
                          <Typography
                            sx={{
                              fontSize: 11,
                              color: "rgba(237,240,247,0.88)",
                            }}
                          >
                            {tt("Trigger-vindu", "Trigger window")}:{" "}
                            {formatMinuteSecond(selectedAssignment.triggerAt)}-
                            {formatMinuteSecond(selectedAssignment.endAt)}
                          </Typography>
                        </Box>

                        {selectedAssignmentPreviewVisible ? (
                          <Box
                            sx={{
                              position: "absolute",
                              width: { xs: "calc(100% - 24px)", sm: 300 },
                              maxWidth: "calc(100% - 24px)",
                              borderRadius: `${selectedAssignment.overlayRadius}px`,
                              border:
                                "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.18)",
                              bgcolor: selectedAssignment.overlayBackground,
                              backdropFilter: "blur(6px)",
                              boxShadow: "0 14px 30px rgba(0,0,0,0.45)",
                              p: 0.8,
                              zIndex: 3,
                              opacity: selectedAssignment.overlayOpacity,
                              fontFamily: selectedAssignment.overlayFontFamily,
                              ...previewPlacementSx,
                              ...previewAnimationSx,
                            }}
                          >
                            <Typography
                              sx={{
                                fontSize: `${selectedAssignment.overlayTitleSize}px`,
                                color: selectedAssignment.overlayTextColor,
                                fontWeight: 700,
                                lineHeight: 1.1,
                              }}
                            >
                              {selectedAssignment.title ||
                                tt("Ny oppgave", "New assignment")}
                            </Typography>
                            <Typography
                              sx={{
                                fontSize: 13,
                                color: selectedAssignment.overlayTextColor,
                                opacity: 0.86,
                                mt: 0.25,
                              }}
                            >
                              {selectedAssignment.subtitle ||
                                assignmentTypeDescription(
                                  selectedAssignment.assignmentType,
                                )}
                            </Typography>
                            <Stack
                              direction="row"
                              spacing={0.6}
                              sx={{ mt: 0.7 }}
                            >
                              <Button
                                size="small"
                                sx={{
                                  textTransform: "none",
                                  color:
                                    selectedAssignment.overlayPrimaryButtonTextColor,
                                  background:
                                    selectedAssignment.overlayPrimaryButtonColor,
                                  fontWeight: 700,
                                  minWidth: 112,
                                  "&:hover": { filter: "brightness(1.08)" },
                                }}
                              >
                                {tt("Åpne oppgave", "Open assignment")}
                              </Button>
                              <Button
                                size="small"
                                sx={{
                                  textTransform: "none",
                                  color: selectedAssignment.overlayTextColor,
                                  border:
                                    "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.26)",
                                }}
                              >
                                {tt("Senere", "Later")}
                              </Button>
                            </Stack>
                          </Box>
                        ) : (
                          <Box
                            sx={{
                              position: "absolute",
                              left: "50%",
                              top: "50%",
                              transform: "translate(-50%, -50%)",
                              px: 1.2,
                              py: 0.5,
                              borderRadius: 999,
                              border:
                                "var(--academy-hairline-width, 1px) dashed rgba(255,255,255,0.2)",
                              bgcolor: "rgba(0,0,0,0.32)",
                            }}
                          >
                            <Typography
                              sx={{
                                fontSize: 12,
                                color: "rgba(237,240,247,0.78)",
                                textAlign: "center",
                              }}
                            >
                              {tt(
                                "Overlay skjult ved valgt tid",
                                "Overlay hidden at selected time",
                              )}
                            </Typography>
                          </Box>
                        )}
                      </Box>

                      <Stack
                        direction={{ xs: "column", sm: "row" }}
                        spacing={0.8}
                        alignItems={{ xs: "stretch", sm: "center" }}
                        sx={{ mt: 0.8 }}
                      >
                        <TextField
                          size="small"
                          label={tt(
                            "Preview-tid (min:sek)",
                            "Preview time (min:sec)",
                          )}
                          value={previewTimeInput}
                          onChange={(event) =>
                            setPreviewTimeInput(event.target.value)
                          }
                          onBlur={() => {
                            const parsed = parseMinuteSecond(
                              previewTimeInput,
                              previewTime,
                            );
                            const clamped = Math.max(
                              0,
                              Math.min(parsed, selectedAssignmentPreviewMax),
                            );
                            setPreviewTime(clamped);
                            setPreviewTimeInput(formatMinuteSecond(clamped));
                          }}
                          sx={{
                            width: { xs: "100%", sm: 190 },
                            "& .MuiInputBase-root": {
                              color: "#edf0f7",
                              bgcolor: "rgba(255,255,255,0.03)",
                            },
                          }}
                        />
                        <Typography
                          sx={{ fontSize: 12, color: "rgba(237,240,247,0.62)" }}
                        >
                          {tt("Maks", "Max")}:{" "}
                          {formatMinuteSecond(selectedAssignmentPreviewMax)}
                        </Typography>
                      </Stack>
                      <Slider
                        value={previewTime}
                        min={0}
                        max={selectedAssignmentPreviewMax}
                        step={1}
                        onChange={(_event, nextValue) => {
                          const value = Array.isArray(nextValue)
                            ? nextValue[0]
                            : nextValue;
                          setPreviewTime(Number(value) || 0);
                        }}
                        valueLabelDisplay="auto"
                        valueLabelFormat={(value) =>
                          formatMinuteSecond(Number(value) || 0)
                        }
                        sx={{
                          mt: 0.3,
                          color: "#f8b321",
                          "& .MuiSlider-rail": { opacity: 0.3 },
                          "& .MuiSlider-thumb": {
                            width: 14,
                            height: 14,
                            boxShadow: "0 0 0 3px rgba(248,179,33,0.25)",
                          },
                        }}
                      />
                      <Stack
                        direction={{ xs: "column", lg: "row" }}
                        spacing={0.8}
                        sx={{ mt: 0.8 }}
                      >
                        <Box
                          sx={{
                            ...panelSx,
                            p: 0.8,
                            borderColor: "rgba(248,179,33,0.22)",
                            flex: 1,
                          }}
                        >
                          <Typography
                            sx={{ fontSize: 14, fontWeight: 700, mb: 0.8 }}
                          >
                            {tt("Visuell stil", "Visual style")}
                          </Typography>
                          <Stack spacing={0.8}>
                            <TextField
                              size="small"
                              label={tt(
                                "Overlay-bakgrunn (RGBA/HEX)",
                                "Overlay background (RGBA/HEX)",
                              )}
                              value={selectedAssignment.overlayBackground}
                              onChange={(event) =>
                                upsertAssignment(selectedAssignment.id, {
                                  overlayBackground: event.target.value,
                                })
                              }
                              sx={{
                                "& .MuiInputBase-root": {
                                  color: "#edf0f7",
                                  bgcolor: "rgba(255,255,255,0.03)",
                                },
                              }}
                            />
                            <Stack
                              direction={{ xs: "column", sm: "row" }}
                              spacing={0.8}
                            >
                              <TextField
                                size="small"
                                label={tt(
                                  "Tekstfarge (RGBA/HEX)",
                                  "Text color (RGBA/HEX)",
                                )}
                                value={selectedAssignment.overlayTextColor}
                                onChange={(event) =>
                                  upsertAssignment(selectedAssignment.id, {
                                    overlayTextColor: event.target.value,
                                  })
                                }
                                sx={{
                                  flex: 1,
                                  "& .MuiInputBase-root": {
                                    color: "#edf0f7",
                                    bgcolor: "rgba(255,255,255,0.03)",
                                  },
                                }}
                              />
                              <TextField
                                size="small"
                                label={tt(
                                  "Primærknapp-farge (RGBA/HEX)",
                                  "Primary button color (RGBA/HEX)",
                                )}
                                value={
                                  selectedAssignment.overlayPrimaryButtonColor
                                }
                                onChange={(event) =>
                                  upsertAssignment(selectedAssignment.id, {
                                    overlayPrimaryButtonColor:
                                      event.target.value,
                                  })
                                }
                                sx={{
                                  flex: 1,
                                  "& .MuiInputBase-root": {
                                    color: "#edf0f7",
                                    bgcolor: "rgba(255,255,255,0.03)",
                                  },
                                }}
                              />
                            </Stack>
                            <Stack
                              direction={{ xs: "column", sm: "row" }}
                              spacing={0.8}
                            >
                              <TextField
                                size="small"
                                label={tt(
                                  "Primærknapp tekstfarge",
                                  "Primary button text color",
                                )}
                                value={
                                  selectedAssignment.overlayPrimaryButtonTextColor
                                }
                                onChange={(event) =>
                                  upsertAssignment(selectedAssignment.id, {
                                    overlayPrimaryButtonTextColor:
                                      event.target.value,
                                  })
                                }
                                sx={{
                                  flex: 1,
                                  "& .MuiInputBase-root": {
                                    color: "#edf0f7",
                                    bgcolor: "rgba(255,255,255,0.03)",
                                  },
                                }}
                              />
                              <TextField
                                size="small"
                                label={tt("Skrifttype", "Font family")}
                                value={selectedAssignment.overlayFontFamily}
                                onChange={(event) =>
                                  upsertAssignment(selectedAssignment.id, {
                                    overlayFontFamily: event.target.value,
                                  })
                                }
                                sx={{
                                  flex: 1,
                                  "& .MuiInputBase-root": {
                                    color: "#edf0f7",
                                    bgcolor: "rgba(255,255,255,0.03)",
                                  },
                                }}
                              />
                            </Stack>
                          </Stack>
                        </Box>
                        <Box
                          sx={{
                            ...panelSx,
                            p: 0.8,
                            borderColor: "rgba(248,179,33,0.22)",
                            flex: 1,
                          }}
                        >
                          <Typography
                            sx={{ fontSize: 14, fontWeight: 700, mb: 0.8 }}
                          >
                            {tt("Animasjon og layout", "Animation and layout")}
                          </Typography>
                          <Stack spacing={0.8}>
                            <Stack
                              direction="row"
                              spacing={0.8}
                              flexWrap="wrap"
                              useFlexGap
                            >
                              <Chip
                                label={tt(
                                  "Aktiver animasjon",
                                  "Enable animation",
                                )}
                                color={
                                  selectedAssignment.overlayAnimationEnabled
                                    ? "warning"
                                    : "default"
                                }
                                onClick={() =>
                                  upsertAssignment(selectedAssignment.id, {
                                    overlayAnimationEnabled:
                                      !selectedAssignment.overlayAnimationEnabled,
                                  })
                                }
                                sx={{ color: "#edf0f7" }}
                              />
                              <Chip
                                size="small"
                                label={selectedAssignment.overlayAnimationType}
                                sx={{
                                  bgcolor: "rgba(255,255,255,0.1)",
                                  color: "#edf0f7",
                                }}
                              />
                            </Stack>
                            <Stack
                              direction={{ xs: "column", sm: "row" }}
                              spacing={0.8}
                            >
                              <TextField
                                size="small"
                                select
                                label={tt("Animasjonstype", "Animation type")}
                                value={selectedAssignment.overlayAnimationType}
                                onChange={(event) =>
                                  upsertAssignment(selectedAssignment.id, {
                                    overlayAnimationType: event.target
                                      .value as AssignmentOverlayAnimationType,
                                  })
                                }
                                sx={{
                                  flex: 1,
                                  "& .MuiInputBase-root": {
                                    color: "#edf0f7",
                                    bgcolor: "rgba(255,255,255,0.03)",
                                  },
                                }}
                              >
                                <MenuItem value="slide-up">slide-up</MenuItem>
                                <MenuItem value="fade">fade</MenuItem>
                                <MenuItem value="zoom">zoom</MenuItem>
                              </TextField>
                              <TextField
                                size="small"
                                select
                                label={tt("Tempo (easing)", "Easing")}
                                value={
                                  selectedAssignment.overlayAnimationEasing
                                }
                                onChange={(event) =>
                                  upsertAssignment(selectedAssignment.id, {
                                    overlayAnimationEasing: event.target
                                      .value as AssignmentOverlayAnimationEasing,
                                  })
                                }
                                sx={{
                                  flex: 1,
                                  "& .MuiInputBase-root": {
                                    color: "#edf0f7",
                                    bgcolor: "rgba(255,255,255,0.03)",
                                  },
                                }}
                              >
                                <MenuItem value="ease-out">ease-out</MenuItem>
                                <MenuItem value="ease-in-out">
                                  ease-in-out
                                </MenuItem>
                                <MenuItem value="ease-in">ease-in</MenuItem>
                                <MenuItem value="linear">linear</MenuItem>
                              </TextField>
                            </Stack>
                            <Stack
                              direction={{ xs: "column", sm: "row" }}
                              spacing={0.8}
                            >
                              <TextField
                                size="small"
                                type="number"
                                label={tt("Varighet (sek)", "Duration (sec)")}
                                value={
                                  selectedAssignment.overlayAnimationDuration
                                }
                                onChange={(event) =>
                                  upsertAssignment(selectedAssignment.id, {
                                    overlayAnimationDuration: Math.max(
                                      0,
                                      Math.min(
                                        8,
                                        Number(event.target.value) || 0,
                                      ),
                                    ),
                                  })
                                }
                                sx={{
                                  flex: 1,
                                  "& .MuiInputBase-root": {
                                    color: "#edf0f7",
                                    bgcolor: "rgba(255,255,255,0.03)",
                                  },
                                }}
                              />
                              <TextField
                                size="small"
                                type="number"
                                label={tt("Forsinkelse (sek)", "Delay (sec)")}
                                value={selectedAssignment.overlayAnimationDelay}
                                onChange={(event) =>
                                  upsertAssignment(selectedAssignment.id, {
                                    overlayAnimationDelay: Math.max(
                                      0,
                                      Math.min(
                                        8,
                                        Number(event.target.value) || 0,
                                      ),
                                    ),
                                  })
                                }
                                sx={{
                                  flex: 1,
                                  "& .MuiInputBase-root": {
                                    color: "#edf0f7",
                                    bgcolor: "rgba(255,255,255,0.03)",
                                  },
                                }}
                              />
                            </Stack>
                            <Stack
                              direction={{ xs: "column", sm: "row" }}
                              spacing={0.8}
                            >
                              <TextField
                                size="small"
                                type="number"
                                label={tt(
                                  "Hjørneradius (px)",
                                  "Corner radius (px)",
                                )}
                                value={selectedAssignment.overlayRadius}
                                onChange={(event) =>
                                  upsertAssignment(selectedAssignment.id, {
                                    overlayRadius: Math.max(
                                      0,
                                      Math.min(
                                        48,
                                        Number(event.target.value) || 0,
                                      ),
                                    ),
                                  })
                                }
                                sx={{
                                  flex: 1,
                                  "& .MuiInputBase-root": {
                                    color: "#edf0f7",
                                    bgcolor: "rgba(255,255,255,0.03)",
                                  },
                                }}
                              />
                              <TextField
                                size="small"
                                type="number"
                                label={tt("Opasitet", "Opacity")}
                                value={selectedAssignment.overlayOpacity}
                                onChange={(event) =>
                                  upsertAssignment(selectedAssignment.id, {
                                    overlayOpacity: Math.max(
                                      0.2,
                                      Math.min(
                                        1,
                                        Number(event.target.value) || 1,
                                      ),
                                    ),
                                  })
                                }
                                sx={{
                                  flex: 1,
                                  "& .MuiInputBase-root": {
                                    color: "#edf0f7",
                                    bgcolor: "rgba(255,255,255,0.03)",
                                  },
                                }}
                              />
                              <TextField
                                size="small"
                                type="number"
                                label={tt(
                                  "Tittelstørrelse (px)",
                                  "Title size (px)",
                                )}
                                value={selectedAssignment.overlayTitleSize}
                                onChange={(event) =>
                                  upsertAssignment(selectedAssignment.id, {
                                    overlayTitleSize: Math.max(
                                      14,
                                      Math.min(
                                        72,
                                        Number(event.target.value) || 16,
                                      ),
                                    ),
                                  })
                                }
                                sx={{
                                  flex: 1,
                                  "& .MuiInputBase-root": {
                                    color: "#edf0f7",
                                    bgcolor: "rgba(255,255,255,0.03)",
                                  },
                                }}
                              />
                            </Stack>
                          </Stack>
                        </Box>
                      </Stack>
                    </Box>
                  )}
                </Box>
              ) : null}

              <Box
                ref={upcomingSectionRef}
                sx={{
                  mt: 1.3,
                  p: isFollowUpView ? 0.8 : 0,
                  borderRadius: isFollowUpView ? 1 : 0,
                  border: isFollowUpView
                    ? "var(--academy-hairline-width, 1px) solid rgba(248,179,33,0.28)"
                    : "none",
                  background: isFollowUpView
                    ? "rgba(248,179,33,0.04)"
                    : "transparent",
                }}
              >
                <Typography
                  sx={{
                    fontSize: { xs: 24, md: 26, xl: 28 },
                    fontWeight: 600,
                    lineHeight: 1.12,
                  }}
                >
                  {tt("Kommende oppgaver", "Upcoming Assignments")}
                </Typography>
                {isFollowUpView ? (
                  <Typography
                    sx={{
                      mt: 0.35,
                      fontSize: 13,
                      color: "rgba(237,240,247,0.72)",
                    }}
                  >
                    {tt(
                      "Fokusvisning for oppgaver som krever aktiv oppfølging og respons.",
                      "Focused view for assignments that need active follow-up and response.",
                    )}
                  </Typography>
                ) : null}
              </Box>

              <Box
                sx={{
                  mt: 1,
                  display: "grid",
                  gridTemplateColumns: {
                    xs: "1fr",
                    md: "repeat(2, minmax(0, 1fr))",
                  },
                  gap: 1,
                  "@media (min-width: 2560px)": {
                    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                  },
                }}
              >
                {upcomingAssignments.map((assignment, index) => (
                  <Box
                    key={`upcoming-${assignment.id}`}
                    sx={{
                      ...panelSx,
                      p: 1,
                      borderColor: "rgba(255,255,255,0.1)",
                    }}
                  >
                    <Stack direction="row" spacing={1}>
                      <Box
                        sx={{
                          width: 120,
                          height: 72,
                          borderRadius: 1,
                          border:
                            "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.1)",
                          background:
                            placeholderBackgrounds[
                              (assignment.imageTheme + index) %
                                placeholderBackgrounds.length
                            ],
                          flexShrink: 0,
                        }}
                      />
                      <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Typography sx={{ fontWeight: 600 }} noWrap>
                          {assignment.title}
                        </Typography>
                        <Typography
                          sx={{ fontSize: 12, color: "rgba(237,240,247,0.64)" }}
                          noWrap
                        >
                          {assignment.subtitle}
                        </Typography>
                        <Typography
                          sx={{ fontSize: 12, color: "rgba(248,213,111,0.9)" }}
                          noWrap
                        >
                          {assignment.competency} ·{" "}
                          {assignment.scope === "skill"
                            ? assignment.skillTitle
                            : tt("Kursnivå", "Course level")}
                        </Typography>
                        <Typography
                          sx={{
                            fontSize: 12,
                            color: "rgba(237,240,247,0.64)",
                            mt: 0.4,
                          }}
                        >
                          {formatDateRange(
                            assignment.startDate,
                            assignment.dueDate,
                            dateLocale,
                          )}
                        </Typography>
                        <Stack direction="row" spacing={0.8} sx={{ mt: 0.8 }}>
                          <Button
                            size="small"
                            onClick={() =>
                              setSelectedAssignmentId(assignment.id)
                            }
                            sx={{
                              textTransform: "none",
                              color: "#edf0f7",
                              border:
                                "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.16)",
                            }}
                          >
                            {tt("Administrer", "Manage")}
                          </Button>
                          <Button
                            size="small"
                            onClick={() => {
                              setSelectedCourseId("all");
                              setSelectedCompetencyFilter(
                                String(assignment.competency || "").trim() ||
                                  "all",
                              );
                              setStatusFilter("active");
                            }}
                            sx={{
                              textTransform: "none",
                              color: "#edf0f7",
                              border:
                                "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.16)",
                            }}
                          >
                            {tt("Følg opp", "Track")}
                          </Button>
                        </Stack>
                      </Box>
                    </Stack>
                  </Box>
                ))}
              </Box>

              <Box sx={{ ...panelSx, p: 1, mt: 1 }}>
                <Stack
                  direction="row"
                  justifyContent="space-between"
                  alignItems="center"
                >
                  <Typography sx={{ fontSize: 20, fontWeight: 600 }}>
                    {tt("Oppgavetilbakemeldinger", "Assignment Feedback")}
                  </Typography>
                  <Button
                    size="small"
                    onClick={addFeedback}
                    sx={{
                      textTransform: "none",
                      color: "#edf0f7",
                      border:
                        "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.16)",
                    }}
                  >
                    {tt("Legg til", "Add")}
                  </Button>
                </Stack>

                <Stack
                  direction={{ xs: "column", md: "row" }}
                  spacing={0.8}
                  sx={{ mt: 0.8 }}
                >
                  <TextField
                    value={feedbackAuthor}
                    onChange={(event) => setFeedbackAuthor(event.target.value)}
                    size="small"
                    label={tt("Forfatter", "Author")}
                    sx={{
                      width: { xs: "100%", md: 160 },
                      "& .MuiInputBase-root": {
                        color: "#edf0f7",
                        bgcolor: "rgba(255,255,255,0.03)",
                      },
                    }}
                  />
                  <Select
                    size="small"
                    value={feedbackRecipient}
                    onChange={(event) =>
                      setFeedbackRecipient(String(event.target.value))
                    }
                    sx={{
                      width: { xs: "100%", md: 200 },
                      color: "#edf0f7",
                      bgcolor: "rgba(255,255,255,0.03)",
                      "& .MuiOutlinedInput-notchedOutline": {
                        borderColor: "rgba(255,255,255,0.16)",
                      },
                    }}
                  >
                    <MenuItem value="all">
                      {tt("Svar til alle", "Reply to all")}
                    </MenuItem>
                    {feedbackRecipients.map((recipient) => (
                      <MenuItem key={recipient} value={recipient}>
                        {recipient}
                      </MenuItem>
                    ))}
                  </Select>
                  <TextField
                    value={feedbackDraft}
                    onChange={(event) => setFeedbackDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        addFeedback();
                      }
                    }}
                    size="small"
                    label={tt("Tilbakemelding", "Feedback")}
                    placeholder={tt(
                      "Legg til oppgavetilbakemelding",
                      "Add assignment feedback",
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
                    size="small"
                    onClick={addFeedback}
                    sx={{
                      textTransform: "none",
                      color: "#edf0f7",
                      border:
                        "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.2)",
                      minWidth: { xs: 100, md: 90 },
                    }}
                  >
                    {tt("Svar", "Reply")}
                  </Button>
                </Stack>

                <Stack spacing={0.8} sx={{ mt: 0.8 }}>
                  {feedbackItems.map((item, index) => (
                    <Stack
                      key={item.id}
                      direction="row"
                      spacing={0.8}
                      alignItems="flex-start"
                      sx={{
                        px: 0.8,
                        py: 0.8,
                        borderRadius: 1,
                        border:
                          "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.1)",
                        bgcolor:
                          index === 0
                            ? "rgba(248,179,33,0.08)"
                            : "rgba(10,14,22,0.7)",
                      }}
                    >
                      <Avatar
                        sx={{
                          width: 30,
                          height: 30,
                          bgcolor: "rgba(248,179,33,0.78)",
                          color: "#111",
                        }}
                      >
                        {item.author.charAt(0).toUpperCase()}
                      </Avatar>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography sx={{ fontWeight: 700 }}>
                          {item.author}
                        </Typography>
                        {item.recipient ? (
                          <Typography
                            sx={{
                              fontSize: 12,
                              color: "rgba(248,213,111,0.9)",
                            }}
                          >
                            {tt("Svar til", "Reply to")}: {item.recipient}
                          </Typography>
                        ) : null}
                        <Typography sx={{ color: "rgba(237,240,247,0.72)" }}>
                          {item.message}
                        </Typography>
                        <Typography
                          sx={{ fontSize: 12, color: "rgba(237,240,247,0.58)" }}
                        >
                          {item.timestamp}
                        </Typography>
                      </Box>
                    </Stack>
                  ))}
                </Stack>
              </Box>
            </Box>

            <Box
              sx={{
                ...panelSx,
                minHeight: 0,
                display: "flex",
                flexDirection: "column",
                position: { xs: "static", lg: "sticky" },
                top: { lg: 10, xl: 12 },
                alignSelf: "start",
                maxHeight: { lg: "calc(100vh - 116px)" },
                overflow: "hidden",
              }}
            >
              <Box
                sx={{
                  p: { xs: 1, md: 1.2, xl: 1.4 },
                  borderBottom:
                    "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.08)",
                }}
              >
                <Typography
                  sx={{ fontSize: { xs: 20, md: 22, xl: 24 }, fontWeight: 600 }}
                >
                  {isFollowUpView
                    ? tt("Oppfølging", "Follow-up")
                    : tt("Oppgavedetaljer", "Assignment details")}
                </Typography>
                {!isFollowUpView ? (
                  <>
                    <Tabs
                      value={rightPanelTab}
                      onChange={(_event, nextValue) =>
                        setRightPanelTab(
                          nextValue as
                            | "assignment"
                            | "analytics"
                            | "leaderboard",
                        )
                      }
                      sx={{
                        mt: 0.7,
                        minHeight: 36,
                        "& .MuiTab-root": {
                          minHeight: 34,
                          textTransform: "none",
                          color: "rgba(237,240,247,0.72)",
                          fontWeight: 600,
                        },
                        "& .Mui-selected": { color: "#f8d56f" },
                        "& .MuiTabs-indicator": {
                          backgroundColor: "#f8b321",
                          height: 2.5,
                        },
                      }}
                    >
                      <Tab
                        value="assignment"
                        label={tt("Oppgave", "Assignment")}
                      />
                      <Tab
                        value="analytics"
                        label={tt("Analyse", "Analytics")}
                      />
                      <Tab
                        value="leaderboard"
                        label={tt("Rangering", "Ranking")}
                      />
                    </Tabs>

                    {rightPanelTab === "analytics" && (
                      <Stack
                        direction="row"
                        spacing={0.8}
                        sx={{ mt: 1 }}
                        flexWrap="wrap"
                        useFlexGap
                      >
                        <Chip
                          label={tt("Tidlig tilgang", "Early Access")}
                          onClick={() => toggleAnalyticsFlag("earlyAccess")}
                          color={
                            analyticsFlags.earlyAccess ? "warning" : "default"
                          }
                          sx={{ color: "#edf0f7" }}
                        />
                        <Chip
                          label={tt("Kun invitasjon", "Invitation Only")}
                          onClick={() => toggleAnalyticsFlag("invitationOnly")}
                          color={
                            analyticsFlags.invitationOnly
                              ? "warning"
                              : "default"
                          }
                          sx={{ color: "#edf0f7" }}
                        />
                        <Chip
                          label={tt("Lukket", "Closed")}
                          onClick={() => toggleAnalyticsFlag("closed")}
                          color={analyticsFlags.closed ? "warning" : "default"}
                          sx={{ color: "#edf0f7" }}
                        />
                        <Chip
                          label={tt("Dryppslipp", "Drip Release")}
                          onClick={() => toggleAnalyticsFlag("dripRelease")}
                          color={
                            analyticsFlags.dripRelease ? "warning" : "default"
                          }
                          sx={{ color: "#edf0f7" }}
                        />
                      </Stack>
                    )}
                  </>
                ) : (
                  <Typography
                    sx={{
                      mt: 0.7,
                      fontSize: 12,
                      color: "rgba(237,240,247,0.66)",
                    }}
                  >
                    {tt(
                      "Viser kun elementer som støtter oppfølging, respons og oppgaveflyt.",
                      "Shows only items that support follow-up, responses, and assignment flow.",
                    )}
                  </Typography>
                )}
              </Box>

              <Box
                sx={{
                  p: { xs: 1, md: 1.2, xl: 1.4 },
                  display: "flex",
                  flexDirection: "column",
                  gap: 1,
                  minHeight: 0,
                  overflowY: { lg: "auto" },
                }}
              >
                {isFollowUpView ? (
                  <Stack spacing={1}>
                    <Box sx={{ ...panelSx, p: 1 }}>
                      <Typography
                        sx={{ fontSize: 16, fontWeight: 700, mb: 0.6 }}
                      >
                        {tt("Oppfølging nå", "Follow-up now")}
                      </Typography>
                      <Stack
                        direction="row"
                        spacing={0.8}
                        sx={{
                          display: "grid",
                          gridTemplateColumns: {
                            xs: "1fr",
                            sm: "repeat(3, minmax(0, 1fr))",
                          },
                        }}
                      >
                        <Box
                          sx={{
                            ...panelSx,
                            p: 0.75,
                            borderColor: "rgba(255,255,255,0.12)",
                          }}
                        >
                          <Typography sx={{ fontSize: 22, fontWeight: 700 }}>
                            {upcomingAssignments.length}
                          </Typography>
                          <Typography
                            sx={{
                              fontSize: 12,
                              color: "rgba(237,240,247,0.7)",
                            }}
                          >
                            {tt("Krever oppfølging", "Needs follow-up")}
                          </Typography>
                        </Box>
                        <Box
                          sx={{
                            ...panelSx,
                            p: 0.75,
                            borderColor: "rgba(255,255,255,0.12)",
                          }}
                        >
                          <Typography sx={{ fontSize: 22, fontWeight: 700 }}>
                            {feedbackItems.length}
                          </Typography>
                          <Typography
                            sx={{
                              fontSize: 12,
                              color: "rgba(237,240,247,0.7)",
                            }}
                          >
                            {tt("Svartråder", "Reply threads")}
                          </Typography>
                        </Box>
                        <Box
                          sx={{
                            ...panelSx,
                            p: 0.75,
                            borderColor: "rgba(255,255,255,0.12)",
                          }}
                        >
                          <Typography sx={{ fontSize: 22, fontWeight: 700 }}>
                            {totals.completed}
                          </Typography>
                          <Typography
                            sx={{
                              fontSize: 12,
                              color: "rgba(237,240,247,0.7)",
                            }}
                          >
                            {tt("Fullført", "Completed")}
                          </Typography>
                        </Box>
                      </Stack>
                    </Box>

                    <Box sx={{ ...panelSx, p: 1 }}>
                      <Typography
                        sx={{ fontSize: 16, fontWeight: 700, mb: 0.6 }}
                      >
                        {tt("Oppfølgingskø", "Follow-up queue")}
                      </Typography>
                      <Stack spacing={0.7}>
                        {upcomingAssignments.slice(0, 6).map((assignment) => (
                          <Box
                            key={`followup-${assignment.id}`}
                            sx={{
                              ...panelSx,
                              p: 0.75,
                              borderColor: "rgba(255,255,255,0.1)",
                              bgcolor: "rgba(10,14,22,0.72)",
                            }}
                          >
                            <Typography sx={{ fontWeight: 700 }} noWrap>
                              {assignment.title}
                            </Typography>
                            <Typography
                              sx={{
                                fontSize: 12,
                                color: "rgba(237,240,247,0.66)",
                              }}
                              noWrap
                            >
                              {formatDateRange(
                                assignment.startDate,
                                assignment.dueDate,
                                dateLocale,
                              )}
                            </Typography>
                            <Stack
                              direction="row"
                              spacing={0.6}
                              sx={{ mt: 0.5 }}
                            >
                              <Button
                                size="small"
                                onClick={() =>
                                  setSelectedAssignmentId(assignment.id)
                                }
                                sx={{
                                  textTransform: "none",
                                  color: "#edf0f7",
                                  border:
                                    "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.16)",
                                }}
                              >
                                {tt("Åpne", "Open")}
                              </Button>
                              <Button
                                size="small"
                                onClick={() =>
                                  setLocation(
                                    `/academy/settings?tab=messages&assignmentId=${encodeURIComponent(assignment.id)}`,
                                  )
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
                        {upcomingAssignments.length === 0 && (
                          <Typography
                            sx={{
                              fontSize: 13,
                              color: "rgba(237,240,247,0.66)",
                            }}
                          >
                            {tt(
                              "Ingen oppgaver i oppfølgingskøen.",
                              "No assignments in follow-up queue.",
                            )}
                          </Typography>
                        )}
                      </Stack>
                    </Box>
                  </Stack>
                ) : (
                  <>
                    {rightPanelTab === "analytics" && (
                      <Box sx={{ ...panelSx, p: 1 }}>
                        <Typography
                          sx={{ fontSize: 22, fontWeight: 600, mb: 0.8 }}
                        >
                          {tt(
                            "Fordeling av gjennomsnittsscore",
                            "Average Score Distribution",
                          )}
                        </Typography>

                        <Stack
                          direction="row"
                          spacing={1.2}
                          alignItems="center"
                        >
                          <Box
                            sx={{
                              width: 122,
                              height: 122,
                              borderRadius: "50%",
                              background: donutStyle,
                              display: "grid",
                              placeItems: "center",
                              flexShrink: 0,
                            }}
                          >
                            <Box
                              sx={{
                                width: 84,
                                height: 84,
                                borderRadius: "50%",
                                bgcolor: "#0f1420",
                                display: "grid",
                                placeItems: "center",
                                textAlign: "center",
                              }}
                            >
                              <Typography
                                sx={{ fontSize: 20, fontWeight: 700 }}
                              >
                                {totals.submissions}
                              </Typography>
                              <Typography
                                sx={{
                                  fontSize: 11,
                                  color: "rgba(237,240,247,0.62)",
                                }}
                              >
                                {tt("Innleveringer", "Submissions")}
                              </Typography>
                            </Box>
                          </Box>

                          <Stack spacing={0.5} sx={{ flex: 1 }}>
                            <Stack
                              direction="row"
                              justifyContent="space-between"
                            >
                              <Typography
                                sx={{ color: "rgba(237,240,247,0.72)" }}
                              >
                                {tt("Innsendt", "Submitted")}
                              </Typography>
                              <Typography>
                                {distribution.submittedPct}%
                              </Typography>
                            </Stack>
                            <LinearProgress
                              variant="determinate"
                              value={distribution.submittedPct}
                              sx={{
                                height: 6,
                                borderRadius: 999,
                                bgcolor: "rgba(255,255,255,0.1)",
                                "& .MuiLinearProgress-bar": {
                                  background: "#8ea6d6",
                                },
                              }}
                            />

                            <Stack
                              direction="row"
                              justifyContent="space-between"
                            >
                              <Typography
                                sx={{ color: "rgba(237,240,247,0.72)" }}
                              >
                                {tt("Under vurdering", "In Review")}
                              </Typography>
                              <Typography>
                                {distribution.inReviewPct}%
                              </Typography>
                            </Stack>
                            <LinearProgress
                              variant="determinate"
                              value={distribution.inReviewPct}
                              sx={{
                                height: 6,
                                borderRadius: 999,
                                bgcolor: "rgba(255,255,255,0.1)",
                                "& .MuiLinearProgress-bar": {
                                  background: "#f8b321",
                                },
                              }}
                            />

                            <Stack
                              direction="row"
                              justifyContent="space-between"
                            >
                              <Typography
                                sx={{ color: "rgba(237,240,247,0.72)" }}
                              >
                                {tt("Fullført", "Completed")}
                              </Typography>
                              <Typography>
                                {distribution.completedPct}%
                              </Typography>
                            </Stack>
                            <LinearProgress
                              variant="determinate"
                              value={distribution.completedPct}
                              sx={{
                                height: 6,
                                borderRadius: 999,
                                bgcolor: "rgba(255,255,255,0.1)",
                                "& .MuiLinearProgress-bar": {
                                  background: "#f5d47a",
                                },
                              }}
                            />

                            <Stack
                              direction="row"
                              justifyContent="space-between"
                            >
                              <Typography
                                sx={{ color: "rgba(237,240,247,0.72)" }}
                              >
                                {tt("Forfalt", "Overdue")}
                              </Typography>
                              <Typography>
                                {distribution.overduePct}%
                              </Typography>
                            </Stack>
                            <LinearProgress
                              variant="determinate"
                              value={distribution.overduePct}
                              sx={{
                                height: 6,
                                borderRadius: 999,
                                bgcolor: "rgba(255,255,255,0.1)",
                                "& .MuiLinearProgress-bar": {
                                  background: "#d2754a",
                                },
                              }}
                            />
                          </Stack>
                        </Stack>
                      </Box>
                    )}

                    {rightPanelTab === "leaderboard" && (
                      <Box sx={{ ...panelSx, p: 1 }}>
                        <Typography
                          sx={{ fontSize: 20, fontWeight: 600, mb: 0.8 }}
                        >
                          {tt("Oppgaverangering", "Assignment Leaderboard")}
                        </Typography>

                        <Stack spacing={0.8}>
                          {leaderboard.map((assignment) => (
                            <Stack
                              key={`leader-${assignment.id}`}
                              direction="row"
                              spacing={0.8}
                              alignItems="center"
                              sx={{
                                px: 0.8,
                                py: 0.8,
                                borderRadius: 1,
                                border:
                                  "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.1)",
                                bgcolor: "rgba(10,14,22,0.7)",
                              }}
                            >
                              <Box
                                sx={{
                                  width: 44,
                                  height: 44,
                                  borderRadius: 1,
                                  border:
                                    "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.1)",
                                  background:
                                    placeholderBackgrounds[
                                      assignment.imageTheme %
                                        placeholderBackgrounds.length
                                    ],
                                  flexShrink: 0,
                                }}
                              />
                              <Box sx={{ flex: 1, minWidth: 0 }}>
                                <Typography noWrap sx={{ fontWeight: 600 }}>
                                  {assignment.title}
                                </Typography>
                                <Typography
                                  sx={{
                                    fontSize: 12,
                                    color: "rgba(237,240,247,0.64)",
                                  }}
                                  noWrap
                                >
                                  {assignment.subtitle}
                                </Typography>
                              </Box>
                              <Typography
                                sx={{ color: "#f8d56f", fontWeight: 700 }}
                              >
                                {assignment.avgScore}%
                              </Typography>
                            </Stack>
                          ))}
                        </Stack>
                      </Box>
                    )}

                    {rightPanelTab === "assignment" && selectedAssignment && (
                      <Box sx={{ ...panelSx, p: 1 }}>
                        <Typography
                          sx={{ fontSize: 18, fontWeight: 700, mb: 0.8 }}
                        >
                          {tt("Valgt oppgave", "Selected Assignment")}
                        </Typography>
                        <Stack spacing={0.8}>
                          <Tabs
                            value={assignmentEditorTab}
                            onChange={(_event, nextValue) =>
                              setAssignmentEditorTab(
                                nextValue as
                                  | "type"
                                  | "settings"
                                  | "linking"
                                  | "player",
                              )
                            }
                            sx={{
                              minHeight: 34,
                              "& .MuiTab-root": {
                                minHeight: 34,
                                textTransform: "none",
                                color: "rgba(237,240,247,0.72)",
                                fontWeight: 600,
                                px: 1,
                              },
                              "& .Mui-selected": { color: "#f8d56f" },
                              "& .MuiTabs-indicator": {
                                backgroundColor: "#f8b321",
                                height: 2.5,
                              },
                            }}
                          >
                            <Tab
                              value="type"
                              label={tt("Type oppgave", "Assignment type")}
                            />
                            <Tab
                              value="settings"
                              label={tt(
                                "Oppgaveinnstillinger",
                                "Assignment settings",
                              )}
                            />
                            <Tab
                              value="linking"
                              label={tt("Tilknytning", "Linking")}
                            />
                            <Tab
                              value="player"
                              label={tt("Avspiller", "Player")}
                            />
                          </Tabs>

                          {assignmentEditorTab === "type" && (
                            <>
                              <TextField
                                size="small"
                                label={tt("Tittel", "Title")}
                                value={selectedAssignment.title}
                                onChange={(event) =>
                                  upsertAssignment(selectedAssignment.id, {
                                    title: event.target.value,
                                  })
                                }
                                sx={{
                                  "& .MuiInputBase-root": {
                                    color: "#edf0f7",
                                    bgcolor: "rgba(255,255,255,0.03)",
                                  },
                                }}
                              />
                              <TextField
                                size="small"
                                label={tt("Undertittel", "Subtitle")}
                                value={selectedAssignment.subtitle}
                                onChange={(event) =>
                                  upsertAssignment(selectedAssignment.id, {
                                    subtitle: event.target.value,
                                  })
                                }
                                sx={{
                                  "& .MuiInputBase-root": {
                                    color: "#edf0f7",
                                    bgcolor: "rgba(255,255,255,0.03)",
                                  },
                                }}
                              />
                              <Stack direction="row" spacing={0.8}>
                                <TextField
                                  size="small"
                                  select
                                  label={tt("Oppgavetype", "Assignment type")}
                                  value={selectedAssignment.assignmentType}
                                  onChange={(event) =>
                                    upsertAssignment(selectedAssignment.id, {
                                      assignmentType: event.target
                                        .value as AssignmentType,
                                    })
                                  }
                                  sx={{
                                    flex: 1,
                                    "& .MuiInputBase-root": {
                                      color: "#edf0f7",
                                      bgcolor: "rgba(255,255,255,0.03)",
                                    },
                                  }}
                                >
                                  <MenuItem value="replication">
                                    {assignmentTypeLabel("replication")}
                                  </MenuItem>
                                  <MenuItem value="analysis">
                                    {assignmentTypeLabel("analysis")}
                                  </MenuItem>
                                  <MenuItem value="decision">
                                    {assignmentTypeLabel("decision")}
                                  </MenuItem>
                                  <MenuItem value="scenario">
                                    {assignmentTypeLabel("scenario")}
                                  </MenuItem>
                                  <MenuItem value="production">
                                    {assignmentTypeLabel("production")}
                                  </MenuItem>
                                </TextField>
                                <TextField
                                  size="small"
                                  select
                                  label={tt("Oppgavenivå", "Assignment level")}
                                  value={selectedAssignment.level}
                                  onChange={(event) =>
                                    upsertAssignment(selectedAssignment.id, {
                                      level: Math.min(
                                        5,
                                        Math.max(
                                          1,
                                          Number(event.target.value) || 1,
                                        ),
                                      ) as AssignmentLevel,
                                    })
                                  }
                                  sx={{
                                    flex: 1,
                                    "& .MuiInputBase-root": {
                                      color: "#edf0f7",
                                      bgcolor: "rgba(255,255,255,0.03)",
                                    },
                                  }}
                                >
                                  <MenuItem value={1}>
                                    {assignmentLevelLabel(1)}
                                  </MenuItem>
                                  <MenuItem value={2}>
                                    {assignmentLevelLabel(2)}
                                  </MenuItem>
                                  <MenuItem value={3}>
                                    {assignmentLevelLabel(3)}
                                  </MenuItem>
                                  <MenuItem value={4}>
                                    {assignmentLevelLabel(4)}
                                  </MenuItem>
                                  <MenuItem value={5}>
                                    {assignmentLevelLabel(5)}
                                  </MenuItem>
                                </TextField>
                              </Stack>
                              <TextField
                                size="small"
                                select
                                label={tt(
                                  "Transformasjonsfase",
                                  "Transformation stage",
                                )}
                                value={selectedAssignment.transformationStage}
                                onChange={(event) =>
                                  upsertAssignment(selectedAssignment.id, {
                                    transformationStage: event.target
                                      .value as TransformationStage,
                                  })
                                }
                                sx={{
                                  "& .MuiInputBase-root": {
                                    color: "#edf0f7",
                                    bgcolor: "rgba(255,255,255,0.03)",
                                  },
                                }}
                              >
                                <MenuItem value="discover">
                                  {transformationStageLabel("discover")}
                                </MenuItem>
                                <MenuItem value="practice">
                                  {transformationStageLabel("practice")}
                                </MenuItem>
                                <MenuItem value="perform">
                                  {transformationStageLabel("perform")}
                                </MenuItem>
                                <MenuItem value="prove">
                                  {transformationStageLabel("prove")}
                                </MenuItem>
                              </TextField>
                              <Typography
                                sx={{
                                  color: "rgba(237,240,247,0.72)",
                                  fontSize: 12,
                                }}
                              >
                                {assignmentTypeDescription(
                                  selectedAssignment.assignmentType,
                                )}
                              </Typography>
                            </>
                          )}

                          {assignmentEditorTab === "settings" && (
                            <>
                              <Stack
                                direction="row"
                                spacing={0.8}
                                flexWrap="wrap"
                                useFlexGap
                              >
                                <Chip
                                  label={tt(
                                    "Krever tenking",
                                    "Requires thinking",
                                  )}
                                  color={
                                    selectedAssignment.requiresThinking
                                      ? "warning"
                                      : "default"
                                  }
                                  onClick={() =>
                                    upsertAssignment(selectedAssignment.id, {
                                      requiresThinking:
                                        !selectedAssignment.requiresThinking,
                                    })
                                  }
                                  sx={{ color: "#edf0f7" }}
                                />
                                <Chip
                                  label={tt(
                                    "Krever feedback",
                                    "Requires feedback",
                                  )}
                                  color={
                                    selectedAssignment.feedbackRequired
                                      ? "warning"
                                      : "default"
                                  }
                                  onClick={() =>
                                    upsertAssignment(selectedAssignment.id, {
                                      feedbackRequired:
                                        !selectedAssignment.feedbackRequired,
                                    })
                                  }
                                  sx={{ color: "#edf0f7" }}
                                />
                                <Chip
                                  label={tt(
                                    "Tillat nye forsøk",
                                    "Allow retries",
                                  )}
                                  color={
                                    selectedAssignment.retryEnabled
                                      ? "warning"
                                      : "default"
                                  }
                                  onClick={() =>
                                    upsertAssignment(selectedAssignment.id, {
                                      retryEnabled:
                                        !selectedAssignment.retryEnabled,
                                    })
                                  }
                                  sx={{ color: "#edf0f7" }}
                                />
                              </Stack>
                              <TextField
                                size="small"
                                select
                                label={tt("Mestringsbevis", "Proof of mastery")}
                                value={selectedAssignment.masteryEvidence}
                                onChange={(event) =>
                                  upsertAssignment(selectedAssignment.id, {
                                    masteryEvidence: event.target
                                      .value as MasteryEvidenceType,
                                  })
                                }
                                sx={{
                                  "& .MuiInputBase-root": {
                                    color: "#edf0f7",
                                    bgcolor: "rgba(255,255,255,0.03)",
                                  },
                                }}
                              >
                                <MenuItem value="artifact">
                                  {masteryEvidenceLabel("artifact")}
                                </MenuItem>
                                <MenuItem value="before_after">
                                  {masteryEvidenceLabel("before_after")}
                                </MenuItem>
                                <MenuItem value="mentor_review">
                                  {masteryEvidenceLabel("mentor_review")}
                                </MenuItem>
                                <MenuItem value="peer_feedback">
                                  {masteryEvidenceLabel("peer_feedback")}
                                </MenuItem>
                                <MenuItem value="demo_video">
                                  {masteryEvidenceLabel("demo_video")}
                                </MenuItem>
                                <MenuItem value="quiz_pass">
                                  {masteryEvidenceLabel("quiz_pass")}
                                </MenuItem>
                              </TextField>
                              <TextField
                                size="small"
                                multiline
                                minRows={2}
                                label={tt(
                                  "Transformasjonsmål",
                                  "Transformation objective",
                                )}
                                value={
                                  selectedAssignment.transformationObjective
                                }
                                onChange={(event) =>
                                  upsertAssignment(selectedAssignment.id, {
                                    transformationObjective: event.target.value,
                                  })
                                }
                                sx={{
                                  "& .MuiInputBase-root": {
                                    color: "#edf0f7",
                                    bgcolor: "rgba(255,255,255,0.03)",
                                  },
                                }}
                              />
                              <TextField
                                size="small"
                                multiline
                                minRows={2}
                                label={tt(
                                  "Refleksjonsspørsmål",
                                  "Reflection prompt",
                                )}
                                value={selectedAssignment.reflectionPrompt}
                                onChange={(event) =>
                                  upsertAssignment(selectedAssignment.id, {
                                    reflectionPrompt: event.target.value,
                                  })
                                }
                                sx={{
                                  "& .MuiInputBase-root": {
                                    color: "#edf0f7",
                                    bgcolor: "rgba(255,255,255,0.03)",
                                  },
                                }}
                              />
                              <Stack direction="row" spacing={0.8}>
                                <TextField
                                  size="small"
                                  type="date"
                                  label={tt("Startdato", "Start date")}
                                  value={selectedAssignment.startDate}
                                  onChange={(event) =>
                                    upsertAssignment(selectedAssignment.id, {
                                      startDate: event.target.value,
                                    })
                                  }
                                  InputLabelProps={{ shrink: true }}
                                  sx={{
                                    flex: 1,
                                    "& .MuiInputBase-root": {
                                      color: "#edf0f7",
                                      bgcolor: "rgba(255,255,255,0.03)",
                                    },
                                  }}
                                />
                                <TextField
                                  size="small"
                                  type="date"
                                  label={tt("Sluttdato", "Due date")}
                                  value={selectedAssignment.dueDate}
                                  onChange={(event) =>
                                    upsertAssignment(selectedAssignment.id, {
                                      dueDate: event.target.value,
                                    })
                                  }
                                  InputLabelProps={{ shrink: true }}
                                  sx={{
                                    flex: 1,
                                    "& .MuiInputBase-root": {
                                      color: "#edf0f7",
                                      bgcolor: "rgba(255,255,255,0.03)",
                                    },
                                  }}
                                />
                              </Stack>
                              <Stack direction="row" spacing={0.8}>
                                <TextField
                                  size="small"
                                  type="number"
                                  label={tt(
                                    "Målinnleveringer",
                                    "Target submissions",
                                  )}
                                  value={selectedAssignment.targetSubmissions}
                                  onChange={(event) =>
                                    upsertAssignment(selectedAssignment.id, {
                                      targetSubmissions: Math.max(
                                        0,
                                        Number(event.target.value) || 0,
                                      ),
                                    })
                                  }
                                  sx={{
                                    flex: 1,
                                    "& .MuiInputBase-root": {
                                      color: "#edf0f7",
                                      bgcolor: "rgba(255,255,255,0.03)",
                                    },
                                  }}
                                />
                                <TextField
                                  size="small"
                                  select
                                  label={tt("Status", "Status")}
                                  value={selectedAssignment.status}
                                  onChange={(event) =>
                                    upsertAssignment(selectedAssignment.id, {
                                      status: event.target
                                        .value as AssignmentStatus,
                                    })
                                  }
                                  sx={{
                                    flex: 1,
                                    "& .MuiInputBase-root": {
                                      color: "#edf0f7",
                                      bgcolor: "rgba(255,255,255,0.03)",
                                    },
                                  }}
                                >
                                  <MenuItem value="active">
                                    {tt("Aktiv", "Active")}
                                  </MenuItem>
                                  <MenuItem value="in_review">
                                    {tt("Under vurdering", "In Review")}
                                  </MenuItem>
                                  <MenuItem value="completed">
                                    {tt("Fullført", "Completed")}
                                  </MenuItem>
                                  <MenuItem value="overdue">
                                    {tt("Forfalt", "Overdue")}
                                  </MenuItem>
                                  <MenuItem value="draft">
                                    {tt("Utkast", "Draft")}
                                  </MenuItem>
                                </TextField>
                              </Stack>
                              <Typography
                                sx={{
                                  color: "rgba(237,240,247,0.72)",
                                  fontSize: 13,
                                }}
                              >
                                {tt("Bevisformat", "Proof format")}:{" "}
                                {masteryEvidenceLabel(
                                  selectedAssignment.masteryEvidence,
                                )}
                              </Typography>
                              <Typography
                                sx={{
                                  color: "rgba(237,240,247,0.72)",
                                  fontSize: 13,
                                }}
                              >
                                {tt(
                                  "Deliberate Practice",
                                  "Deliberate Practice",
                                )}
                                :{" "}
                                {selectedAssignment.requiresThinking &&
                                selectedAssignment.feedbackRequired &&
                                selectedAssignment.retryEnabled
                                  ? tt("Aktivert", "Enabled")
                                  : tt("Delvis", "Partial")}
                              </Typography>
                              <Typography
                                sx={{
                                  color: "rgba(237,240,247,0.72)",
                                  fontSize: 13,
                                }}
                              >
                                {formatDateRange(
                                  selectedAssignment.startDate,
                                  selectedAssignment.dueDate,
                                  dateLocale,
                                )}
                              </Typography>
                              <Typography
                                sx={{
                                  color: "#f8d56f",
                                  mt: 0.1,
                                  fontWeight: 700,
                                }}
                              >
                                {tt("Inntektseffekt", "Revenue impact")}:{" "}
                                {toNok(selectedAssignment.revenueImpact)}
                              </Typography>
                            </>
                          )}

                          {assignmentEditorTab === "linking" ? (
                            <Stack spacing={0.8}>
                              <Stack direction="row" spacing={0.8}>
                                <TextField
                                  size="small"
                                  select
                                  label={tt("Kobling", "Target")}
                                  value={selectedAssignment.scope}
                                  onChange={(event) => {
                                    const nextScope = event.target
                                      .value as AssignmentScope;
                                    if (nextScope === "course") {
                                      upsertAssignment(selectedAssignment.id, {
                                        scope: nextScope,
                                        skillId: "",
                                        skillTitle: tt(
                                          "Hele kurset",
                                          "Entire course",
                                        ),
                                      });
                                      return;
                                    }
                                    const fallbackSkill = skillOptions[0];
                                    upsertAssignment(selectedAssignment.id, {
                                      scope: nextScope,
                                      skillId:
                                        fallbackSkill?.id ||
                                        selectedAssignment.skillId ||
                                        "",
                                      skillTitle:
                                        fallbackSkill?.title ||
                                        selectedAssignment.skillTitle ||
                                        tt("Uten navn", "Untitled"),
                                    });
                                  }}
                                  sx={{
                                    flex: 1,
                                    "& .MuiInputBase-root": {
                                      color: "#edf0f7",
                                      bgcolor: "rgba(255,255,255,0.03)",
                                    },
                                  }}
                                >
                                  <MenuItem value="course">
                                    {tt("Hele kurset", "Entire course")}
                                  </MenuItem>
                                  <MenuItem value="skill">
                                    {tt(
                                      "Spesifikk ferdighet",
                                      "Specific skill",
                                    )}
                                  </MenuItem>
                                </TextField>
                                <TextField
                                  size="small"
                                  select
                                  label={tt("Kompetanse", "Competency")}
                                  value={selectedAssignment.competency}
                                  onChange={(event) =>
                                    upsertAssignment(selectedAssignment.id, {
                                      competency: String(event.target.value),
                                    })
                                  }
                                  sx={{
                                    flex: 1,
                                    "& .MuiInputBase-root": {
                                      color: "#edf0f7",
                                      bgcolor: "rgba(255,255,255,0.03)",
                                    },
                                  }}
                                >
                                  {competencyOptions.map((competency) => (
                                    <MenuItem
                                      key={competency}
                                      value={competency}
                                    >
                                      {competency}
                                    </MenuItem>
                                  ))}
                                </TextField>
                              </Stack>
                              {selectedAssignment.scope === "skill" && (
                                <TextField
                                  size="small"
                                  select
                                  label={tt("Ferdighet", "Skill")}
                                  value={
                                    selectedAssignment.skillId ||
                                    skillOptions[0]?.id ||
                                    ""
                                  }
                                  onChange={(event) => {
                                    const nextSkillId = String(
                                      event.target.value,
                                    );
                                    const nextSkill = skillOptions.find(
                                      (skill) =>
                                        String(skill.id) === nextSkillId,
                                    );
                                    upsertAssignment(selectedAssignment.id, {
                                      skillId: nextSkillId,
                                      skillTitle:
                                        nextSkill?.title ||
                                        selectedAssignment.skillTitle ||
                                        tt("Uten navn", "Untitled"),
                                    });
                                  }}
                                  sx={{
                                    "& .MuiInputBase-root": {
                                      color: "#edf0f7",
                                      bgcolor: "rgba(255,255,255,0.03)",
                                    },
                                  }}
                                >
                                  {skillOptions.length === 0 ? (
                                    <MenuItem value="">
                                      {tt(
                                        "Ingen ferdigheter tilgjengelig",
                                        "No skills available",
                                      )}
                                    </MenuItem>
                                  ) : (
                                    skillOptions.map((skill) => (
                                      <MenuItem key={skill.id} value={skill.id}>
                                        {skill.title}
                                      </MenuItem>
                                    ))
                                  )}
                                </TextField>
                              )}
                              <Typography
                                sx={{
                                  color: "rgba(237,240,247,0.72)",
                                  fontSize: 13,
                                }}
                              >
                                {tt("Koblet til", "Linked to")}:{" "}
                                {selectedAssignment.competency} ·{" "}
                                {selectedAssignment.scope === "skill"
                                  ? selectedAssignment.skillTitle
                                  : tt("Hele kurset", "Entire course")}
                              </Typography>
                            </Stack>
                          ) : null}

                          {assignmentEditorTab === "player" ? (
                            <Stack spacing={0.8}>
                              <Stack
                                direction="row"
                                spacing={0.8}
                                flexWrap="wrap"
                                useFlexGap
                              >
                                <Chip
                                  label={tt(
                                    "Vis i avspiller",
                                    "Show in player",
                                  )}
                                  color={
                                    selectedAssignment.overlayEnabled
                                      ? "warning"
                                      : "default"
                                  }
                                  onClick={() =>
                                    upsertAssignment(selectedAssignment.id, {
                                      overlayEnabled:
                                        !selectedAssignment.overlayEnabled,
                                    })
                                  }
                                  sx={{ color: "#edf0f7" }}
                                />
                                <Typography
                                  sx={{
                                    color: "rgba(237,240,247,0.62)",
                                    fontSize: 12,
                                    alignSelf: "center",
                                  }}
                                >
                                  {tt(
                                    "Studenten får oppgaven in-video ved trigger-tidspunkt.",
                                    "Learner receives this assignment in-video at trigger time.",
                                  )}
                                </Typography>
                              </Stack>
                              <Stack direction="row" spacing={0.8}>
                                <TextField
                                  size="small"
                                  label={tt(
                                    "Trigger (min:sek)",
                                    "Trigger (min:sec)",
                                  )}
                                  value={triggerAtInput}
                                  onChange={(event) =>
                                    setTriggerAtInput(event.target.value)
                                  }
                                  onBlur={() => {
                                    const parsed = parseMinuteSecond(
                                      triggerAtInput,
                                      selectedAssignment.triggerAt,
                                    );
                                    const clamped = Math.max(
                                      0,
                                      Math.min(
                                        parsed,
                                        selectedAssignment.endAt,
                                      ),
                                    );
                                    upsertAssignment(selectedAssignment.id, {
                                      triggerAt: clamped,
                                    });
                                    setTriggerAtInput(
                                      formatMinuteSecond(clamped),
                                    );
                                  }}
                                  sx={{
                                    flex: 1,
                                    "& .MuiInputBase-root": {
                                      color: "#edf0f7",
                                      bgcolor: "rgba(255,255,255,0.03)",
                                    },
                                  }}
                                />
                                <TextField
                                  size="small"
                                  label={tt("Slutt (min:sek)", "End (min:sec)")}
                                  value={endAtInput}
                                  onChange={(event) =>
                                    setEndAtInput(event.target.value)
                                  }
                                  onBlur={() => {
                                    const parsed = parseMinuteSecond(
                                      endAtInput,
                                      selectedAssignment.endAt,
                                    );
                                    const clamped = Math.max(
                                      selectedAssignment.triggerAt,
                                      parsed,
                                    );
                                    upsertAssignment(selectedAssignment.id, {
                                      endAt: clamped,
                                    });
                                    setEndAtInput(formatMinuteSecond(clamped));
                                  }}
                                  sx={{
                                    flex: 1,
                                    "& .MuiInputBase-root": {
                                      color: "#edf0f7",
                                      bgcolor: "rgba(255,255,255,0.03)",
                                    },
                                  }}
                                />
                              </Stack>
                              <TextField
                                size="small"
                                select
                                label={tt(
                                  "Plassering i video",
                                  "Placement in video",
                                )}
                                value={selectedAssignment.placement}
                                onChange={(event) =>
                                  upsertAssignment(selectedAssignment.id, {
                                    placement: event.target
                                      .value as AssignmentPlacement,
                                  })
                                }
                                sx={{
                                  "& .MuiInputBase-root": {
                                    color: "#edf0f7",
                                    bgcolor: "rgba(255,255,255,0.03)",
                                  },
                                }}
                              >
                                <MenuItem value="bottom-center">
                                  {tt("Nederst midt", "Bottom center")}
                                </MenuItem>
                                <MenuItem value="bottom-right">
                                  {tt("Nederst høyre", "Bottom right")}
                                </MenuItem>
                                <MenuItem value="center">
                                  {tt("Midt", "Center")}
                                </MenuItem>
                                <MenuItem value="top-right">
                                  {tt("Øverst høyre", "Top right")}
                                </MenuItem>
                              </TextField>
                              <Typography
                                sx={{
                                  color: "rgba(237,240,247,0.72)",
                                  fontSize: 13,
                                }}
                              >
                                {tt("In-video visning", "In-video display")}:{" "}
                                {selectedAssignment.overlayEnabled
                                  ? `${formatMinuteSecond(selectedAssignment.triggerAt)}–${formatMinuteSecond(selectedAssignment.endAt)} · ${tt("aktiv", "active")}`
                                  : tt("deaktivert", "disabled")}
                              </Typography>
                            </Stack>
                          ) : null}
                        </Stack>
                      </Box>
                    )}
                  </>
                )}
              </Box>

              <Divider sx={{ borderColor: "rgba(255,255,255,0.08)" }} />

              <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={1}
                sx={{ p: { xs: 1, md: 1.1 }, pt: 0 }}
              >
                <Button
                  startIcon={<Save />}
                  onClick={() => void saveAssignments(false)}
                  sx={{
                    flex: 1,
                    textTransform: "none",
                    color: "#edf0f7",
                    border:
                      "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.16)",
                  }}
                >
                  {tt("Lagre", "Save")}
                </Button>
                <Button
                  startIcon={<Publish />}
                  onClick={() => void saveAssignments(true)}
                  sx={{
                    minWidth: { xs: "100%", sm: 118 },
                    textTransform: "none",
                    color: "#0f0f0f",
                    background: "linear-gradient(180deg, #ffd44e, #f2a616)",
                    fontWeight: 700,
                  }}
                >
                  {tt("Publiser", "Publish")}
                </Button>
                <Button
                  onClick={() => {
                    if (onCancel) {
                      onCancel();
                    } else {
                      setLocation("/academy-dashboard");
                    }
                  }}
                  sx={{
                    textTransform: "none",
                    color: "rgba(237,240,247,0.78)",
                    border:
                      "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.16)",
                    width: { xs: "100%", sm: "auto" },
                  }}
                >
                  {tt("Lukk", "Close")}
                </Button>
              </Stack>
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

export default withUniversalIntegration(AcademyAssignmentsStudio, {
  componentId: "academy-assignments-studio",
  componentName: "Academy Assignments Studio",
  componentType: "manager",
  componentCategory: "academy",
  featureIds: [
    "assignments",
    "assignment-analytics",
    "assignment-workflows",
    "academy-assessment",
  ],
});
