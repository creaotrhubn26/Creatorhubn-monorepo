import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Avatar,
  Box,
  Button,
  Chip,
  Divider,
  Collapse,
  IconButton,
  LinearProgress,
  MenuItem,
  Select,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import {
  Add,
  ArrowDownward,
  ArrowUpward,
  AutoAwesome,
  CheckCircleOutline,
  ContentCopy,
  DeleteOutline,
  HourglassTop,
  LockOpen,
  LockOutlined,
  MailOutline,
  NotificationsNone,
  OpenInNew,
  Publish,
  Refresh,
  Save,
  Videocam,
  VisibilityOff,
} from "@mui/icons-material";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import {
  useAcademy,
  type AcademyGoogleProductionSceneDraft,
  type AcademyGoogleProductionWorkflow,
  type Course,
  type PedagogicalAnnotationSuggestion,
  type PedagogicalArchitecture,
  type PedagogicalCompetencyLevel,
  type PedagogicalCompetencyMapItem,
  type PedagogicalQuizSuggestion,
  type PedagogicalQuizSuggestionOption,
  type PedagogicalSkillMapItem,
  type PedagogicalSkillSuggestion,
  type PedagogicalStudioSuggestions,
} from "@/contexts/AcademyContext";
import { useEnhancedMasterIntegration } from "@/integration/EnhancedMasterIntegrationProvider";
import { withUniversalIntegration } from "@/integration/UniversalIntegrationHOC";
import { useAcademyLocale } from "./academyLocale";
import AcademyLocaleSwitcher from "./AcademyLocaleSwitcher";
import AcademyLeftSidebar from "./AcademyLeftSidebar";
import {
  type AcademyVidsPresenterScene,
  academyVidsRecordingModeLabel,
  buildAcademyVidsPresenterPlan,
  buildAcademyVidsPresenterPlanFromScenes,
} from "./academyVidsPresenterPlan";
import { academyGoogleVidsService } from "@/services/academyGoogleVidsService";
import {
  NOTEBOOK_LM_HOME_URL,
  academyNotebookLmService,
} from "@/services/academyNotebookLmService";
import {
  academyGoogleWorkspaceService,
  type AcademyGoogleDriveFileItem,
} from "@/services/academyGoogleWorkspaceService";
import {
  buildGoogleDriveMediaAssetId,
  probeVideoDurationSeconds,
} from "./academyVideoSourceUtils";
import {
  buildUrlMediaFingerprint,
  normalizeMediaVersion,
} from "@/utils/academyMediaLinkUtils";

interface AcademyCurriculumStudioProps {
  courseId?: string;
  onSave?: (payload: Record<string, unknown>) => void;
  onCancel?: () => void;
}

type CurriculumFoundationInterviewQuestionId =
  | "competencyTopic"
  | "competencySubtype"
  | "targetAudience"
  | "desiredTransformation"
  | "contextConstraint";

interface CurriculumFoundationInterviewQuestion {
  id: CurriculumFoundationInterviewQuestionId;
  question: string;
  placeholder: string;
  helpText: string;
  suggestions: string[];
}

interface CurriculumFoundationInterviewAnswer {
  id: CurriculumFoundationInterviewQuestionId;
  question: string;
  answer: string;
}

interface CurriculumFoundationInterviewRecommendation {
  competencyName: string;
  recommendedProjectTemplateId?: string;
  rationale: string[];
  architecture: PedagogicalArchitecture;
}

type CurriculumFoundationIndustryProfile =
  | "sales"
  | "production"
  | "offshore"
  | "leadership"
  | "customer-service"
  | "hr"
  | "healthcare"
  | "it"
  | "compliance"
  | "education"
  | "marketing"
  | "project-management"
  | "finance"
  | "legal"
  | "retail"
  | "logistics"
  | "construction"
  | "hospitality"
  | "procurement"
  | "real-estate"
  | "creative"
  | "generic";

type CurriculumFoundationDomainResolutionSource =
  | "manual"
  | "template-memory"
  | "embedding"
  | "lexical"
  | "heuristic";

interface CurriculumFoundationTemplateMemoryItem {
  id: string;
  name: string;
  sourceProjectTemplateId?: string;
  profileHint?: CurriculumFoundationIndustryProfile;
  architecture: PedagogicalArchitecture;
}

interface CurriculumFoundationTemplateMatch {
  id: string;
  name: string;
  confidence: number;
  profileHint: CurriculumFoundationIndustryProfile;
  sourceProjectTemplateId?: string;
}

interface CurriculumFoundationDomainCandidate {
  profile: CurriculumFoundationIndustryProfile;
  label: string;
  confidence: number;
  source: CurriculumFoundationDomainResolutionSource;
}

interface CurriculumFoundationDomainResolution {
  profile: CurriculumFoundationIndustryProfile;
  label: string;
  confidence: number;
  source: CurriculumFoundationDomainResolutionSource;
  needsConfirmation: boolean;
  reasoning: string[];
  alternatives: CurriculumFoundationDomainCandidate[];
}

interface CurriculumFoundationInterviewProgress {
  phase: string;
  statusMessage: string;
  percent: number;
  focusAreas: string[];
  appliedSections: string[];
}

interface CurriculumFoundationGenerationStage {
  id: string;
  label: string;
  sectionsToRefresh: string[];
  completedSections: string[];
  nextSections: string[];
}

interface CurriculumFoundationInterviewSectionRationale {
  section: string;
  reason: string;
  evidence: string;
}

interface CurriculumFoundationInterviewApiResponse {
  success?: boolean;
  data?: {
    completed?: boolean;
    totalQuestions?: number;
    answeredCount?: number;
    answers?: CurriculumFoundationInterviewAnswer[];
    nextQuestion?: CurriculumFoundationInterviewQuestion | null;
    recommendation?: CurriculumFoundationInterviewRecommendation | null;
    progress?: CurriculumFoundationInterviewProgress | null;
    sectionRationales?: CurriculumFoundationInterviewSectionRationale[];
    meta?: {
      provider?: string;
      model?: string;
      industryProfile?: CurriculumFoundationIndustryProfile;
      domainResolution?: CurriculumFoundationDomainResolution | null;
      generationStage?: CurriculumFoundationGenerationStage | null;
      templateMatch?: CurriculumFoundationTemplateMatch | null;
      generatedAt?: string;
    };
  };
}

type FoundationEditorMode = "simple" | "edit";
type FoundationFlowSection = "clarify" | "structure" | "suggestions" | "templates";
type CurriculumAutosaveState = "saved" | "saving" | "unsaved";

const panelSx = {
  borderRadius: 1.4,
  border: "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.08)",
  background:
    "linear-gradient(145deg, rgba(20,24,36,0.88), rgba(11,14,22,0.96))",
};

const sectionLabelSx = {
  fontSize: 11,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  color: "rgba(237,240,247,0.64)",
  fontWeight: 700,
} as const;

const compactActionButtonSx = {
  width: 30,
  height: 30,
  borderRadius: 0.95,
  border: "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.12)",
  color: "rgba(237,240,247,0.8)",
  bgcolor: "rgba(255,255,255,0.04)",
  "&:hover": {
    bgcolor: "rgba(255,255,255,0.08)",
    borderColor: "rgba(248,179,33,0.28)",
  },
} as const;

const curriculumFieldContainerSx = {
  "& .MuiTextField-root .MuiInputLabel-root": {
    color: "rgba(237,240,247,0.62)",
  },
  "& .MuiTextField-root .MuiInputLabel-root.Mui-focused": {
    color: "#f8d56f",
  },
  "& .MuiTextField-root .MuiInputBase-input": {
    color: "#edf0f7",
  },
  "& .MuiTextField-root .MuiInputBase-input::placeholder": {
    color: "rgba(237,240,247,0.56)",
    opacity: 1,
  },
  "& .MuiTextField-root .MuiOutlinedInput-root": {
    backgroundColor: "rgba(255,255,255,0.03)",
    borderRadius: 1,
  },
  "& .MuiTextField-root .MuiOutlinedInput-notchedOutline": {
    borderColor: "rgba(255,255,255,0.18)",
  },
  "& .MuiTextField-root .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline":
    {
      borderColor: "rgba(248,179,33,0.35)",
    },
  "& .MuiTextField-root .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline":
    {
      borderColor: "rgba(248,179,33,0.55)",
    },
} as const;

const emptyArchitecture: PedagogicalArchitecture = {
  purpose: "",
  audience: "",
  transformation: "",
  skillMap: [],
  competencyMap: [],
  problemsSolved: [],
  learningJourney: "",
  practiceDesign: "",
  proofOfLearning: "",
  competencies: [],
  skills: [],
  transformations: [],
  studioSuggestions: {
    skills: [],
    quiz: [],
    annotations: [],
  },
};

const ALL_COMPETENCIES_OPTION = "__all_competencies__";
const FOUNDATION_INTERVIEW_TOTAL_QUESTIONS = 5;
const FOUNDATION_TEMPLATE_STORAGE_KEY =
  "creatorhub:academy:curriculum-foundation-templates:v1";
const FOUNDATION_DRAFT_STORAGE_KEY =
  "creatorhub:academy:curriculum-foundation-drafts:v1";
const FOUNDATION_VERSION_STORAGE_KEY =
  "creatorhub:academy:curriculum-foundation-versions:v1";
const FOUNDATION_VERSION_LIMIT = 20;

const normalizeList = (values: unknown): string[] => {
  if (!Array.isArray(values)) return [];
  return values
    .map((value) => String(value).trim())
    .filter((value) => value.length > 0);
};

const isPresent = <T,>(value: T | null): value is T => value !== null;

const createSkillMapItem = (
  title = "",
  focus = "",
): PedagogicalSkillMapItem => ({
  id: `skill-map-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  title,
  focus,
});

const createCompetencyMapItem = (): PedagogicalCompetencyMapItem => ({
  id: `competency-map-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  title: "",
  description: "",
  basic: [],
  operational: [],
  advanced: [],
  locked: false,
});

const createSkillSuggestionItem = (): PedagogicalSkillSuggestion => ({
  id: `skill-suggestion-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  title: "",
  competency: "",
  level: "operational",
  objective: "",
  recommendedDurationMinutes: 8,
  locked: false,
});

const createQuizSuggestionItem = (): PedagogicalQuizSuggestion => ({
  id: `quiz-suggestion-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  prompt: "",
  hint: "",
  competency: "",
  skillTitle: "",
  level: "operational",
  type: "single-choice",
  options: [
    { label: "A", text: "", isCorrect: true },
    { label: "B", text: "", isCorrect: false },
    { label: "C", text: "", isCorrect: false },
  ],
  acceptedAnswers: [],
  explanation: "",
  timestampRatio: 0.18,
  duration: 12,
  tags: [],
  locked: false,
});

const createAnnotationSuggestionItem = (): PedagogicalAnnotationSuggestion => ({
  id: `annotation-suggestion-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  type: "callout",
  title: "",
  content: "",
  competency: "",
  skillTitle: "",
  level: "operational",
  startRatio: 0.1,
  endRatio: 0.2,
  actionType: "showContent",
  actionTarget: "",
  locked: false,
});

const reorderItems = <T,>(items: T[], index: number, direction: -1 | 1): T[] => {
  const targetIndex = index + direction;
  if (targetIndex < 0 || targetIndex >= items.length) return items;
  const nextItems = [...items];
  const [current] = nextItems.splice(index, 1);
  nextItems.splice(targetIndex, 0, current);
  return nextItems;
};

const normalizeMergeKey = (value: string | undefined | null): string =>
  String(value || "").trim().toLowerCase();

const mergeLockedEntries = <T extends { locked?: boolean }>(params: {
  current: T[];
  incoming: T[];
  matches: (currentItem: T, incomingItem: T) => boolean;
}): T[] => {
  const remainingIncoming = [...params.incoming];
  const merged: T[] = [];

  params.current.forEach((currentItem) => {
    if (!currentItem.locked) {
      if (remainingIncoming.length > 0) {
        const nextIncoming = remainingIncoming.shift();
        if (nextIncoming) merged.push(nextIncoming);
      }
      return;
    }

    const matchedIndex = remainingIncoming.findIndex((incomingItem) =>
      params.matches(currentItem, incomingItem),
    );
    if (matchedIndex >= 0) {
      remainingIncoming.splice(matchedIndex, 1);
    }
    merged.push(currentItem);
  });

  return [...merged, ...remainingIncoming];
};

const normalizeSkillMapItems = (values: unknown): PedagogicalSkillMapItem[] => {
  if (Array.isArray(values)) {
    return values
      .map((value) => {
        if (!value || typeof value !== "object") return null;
        const row = value as Record<string, unknown>;
        const title = String(
          row.title ?? row.label ?? row.area ?? row.category ?? "",
        ).trim();
        const focus = String(
          row.focus ?? row.description ?? row.value ?? row.outcome ?? "",
        ).trim();
        if (!title && !focus) return null;
        const id = String(row.id ?? "").trim();
        return {
          id: id || createSkillMapItem().id,
          title,
          focus,
        } satisfies PedagogicalSkillMapItem;
      })
      .filter((value): value is PedagogicalSkillMapItem => Boolean(value));
  }

  if (values && typeof values === "object") {
    const legacy = values as Record<string, unknown>;
    const legacyLabels: Array<[key: string, label: string]> = [
      ["camera", "Kamera"],
      ["lighting", "Lyssetting"],
      ["storytelling", "Storytelling"],
      ["editing", "Redigering"],
      ["musicProduction", "Musikkproduksjon"],
    ];

    const migrated = legacyLabels
      .map(([key, label]) => {
        const focus = String(legacy[key] ?? "").trim();
        if (!focus) return null;
        return createSkillMapItem(label, focus);
      })
      .filter((value): value is PedagogicalSkillMapItem => Boolean(value));

    if (migrated.length > 0) return migrated;
  }

  return [];
};

const normalizeCompetencyMapItems = (
  values: unknown,
  preserveIncomplete = false,
): PedagogicalCompetencyMapItem[] => {
  if (!Array.isArray(values)) return [];
  return values
    .map<PedagogicalCompetencyMapItem | null>((value, index) => {
      if (!value || typeof value !== "object") return null;
      const row = value as Record<string, unknown>;
      const normalizeLevelList = (entry: unknown): string[] =>
        Array.isArray(entry)
          ? entry
              .map((item) => String(item || "").trim())
              .filter((item) => item.length > 0)
              .slice(0, 6)
          : [];
      const title = String(row.title || "").trim();
      const description = String(row.description || "").trim();
      const basic = normalizeLevelList(row.basic);
      const operational = normalizeLevelList(row.operational);
      const advanced = normalizeLevelList(row.advanced);
      if (
        !title &&
        !description &&
        basic.length === 0 &&
        operational.length === 0 &&
        advanced.length === 0 &&
        !preserveIncomplete
      ) {
        return null;
      }
      const item: PedagogicalCompetencyMapItem = {
        id:
          String(row.id || "").trim() ||
          `competency-map-${`${title}-${description}`.toLowerCase().replace(/[^a-z0-9]+/g, "-") || index + 1}`,
        title,
        description,
        basic,
        operational,
        advanced,
        locked: Boolean(row.locked),
      };
      return item;
    })
    .filter(isPresent)
    .slice(0, 8);
};

const normalizeSkillSuggestions = (
  values: unknown,
  preserveIncomplete = false,
): PedagogicalSkillSuggestion[] => {
  if (!Array.isArray(values)) return [];
  return values
    .map<PedagogicalSkillSuggestion | null>((value, index) => {
      if (!value || typeof value !== "object") return null;
      const row = value as Record<string, unknown>;
      const title = String(row.title || "").trim();
      const competency = String(row.competency || "").trim();
      const objective = String(row.objective || "").trim();
      const levelRaw = String(row.level || "").trim().toLowerCase();
      const level: PedagogicalCompetencyLevel =
        levelRaw === "basic"
          ? "basic"
          : levelRaw === "advanced"
            ? "advanced"
            : "operational";
      if ((!title || !competency || !objective) && !preserveIncomplete) return null;
      const item: PedagogicalSkillSuggestion = {
        id:
          String(row.id || "").trim() ||
          `skill-suggestion-${`${competency}-${title}-${level}`.toLowerCase().replace(/[^a-z0-9]+/g, "-") || index + 1}`,
        title,
        competency,
        level,
        objective,
        recommendedDurationMinutes: Math.max(
          2,
          Math.min(45, Number(row.recommendedDurationMinutes || 8) || 8),
        ),
        locked: Boolean(row.locked),
      };
      return item;
    })
    .filter(isPresent)
    .slice(0, 18);
};

const normalizeQuizSuggestionOptions = (
  values: unknown,
  preserveIncomplete = false,
): PedagogicalQuizSuggestionOption[] => {
  if (!Array.isArray(values)) return [];
  return values
    .map<PedagogicalQuizSuggestionOption | null>((value, index) => {
      if (!value || typeof value !== "object") return null;
      const row = value as Record<string, unknown>;
      const text = String(row.text || "").trim();
      if (!text && !preserveIncomplete) return null;
      const option: PedagogicalQuizSuggestionOption = {
        label:
          String(row.label || String.fromCharCode(65 + index))
            .trim()
            .slice(0, 1)
            .toUpperCase() || String.fromCharCode(65 + index),
        text,
        isCorrect: Boolean(row.isCorrect),
        explanation: String(row.explanation || "").trim() || undefined,
      };
      return option;
    })
    .filter(isPresent)
    .slice(0, 6);
};

const normalizeQuizSuggestions = (
  values: unknown,
  preserveIncomplete = false,
): PedagogicalQuizSuggestion[] => {
  if (!Array.isArray(values)) return [];
  return values
    .map<PedagogicalQuizSuggestion | null>((value, index) => {
      if (!value || typeof value !== "object") return null;
      const row = value as Record<string, unknown>;
      const prompt = String(row.prompt || "").trim();
      const competency = String(row.competency || "").trim();
      if ((!prompt || !competency) && !preserveIncomplete) return null;
      const levelRaw = String(row.level || "").trim().toLowerCase();
      const level: PedagogicalCompetencyLevel =
        levelRaw === "basic"
          ? "basic"
          : levelRaw === "advanced"
            ? "advanced"
            : "operational";
      const typeRaw = String(row.type || "").trim().toLowerCase();
      const type: PedagogicalQuizSuggestion["type"] =
        typeRaw === "multi-select"
          ? "multi-select"
          : typeRaw === "true-false"
            ? "true-false"
            : typeRaw === "short-answer"
              ? "short-answer"
              : "single-choice";
      const suggestion: PedagogicalQuizSuggestion = {
        id:
          String(row.id || "").trim() ||
          `quiz-suggestion-${`${competency}-${prompt}`.toLowerCase().replace(/[^a-z0-9]+/g, "-") || index + 1}`,
        prompt,
        hint: String(row.hint || "").trim(),
        competency,
        skillTitle: String(row.skillTitle || "").trim() || undefined,
        level,
        type,
        options: normalizeQuizSuggestionOptions(row.options, preserveIncomplete),
        acceptedAnswers: Array.isArray(row.acceptedAnswers)
          ? row.acceptedAnswers
              .map((entry) => String(entry || "").trim())
              .filter((entry) => entry.length > 0)
              .slice(0, 8)
          : [],
        explanation: String(row.explanation || "").trim() || undefined,
        timestampRatio: Math.max(
          0,
          Math.min(0.98, Number(row.timestampRatio || 0) || 0),
        ),
        duration: Math.max(4, Math.min(45, Number(row.duration || 12) || 12)),
        tags: Array.isArray(row.tags)
          ? row.tags
              .map((entry) => String(entry || "").trim())
              .filter((entry) => entry.length > 0)
              .slice(0, 8)
          : [],
        locked: Boolean(row.locked),
      };
      return suggestion;
    })
    .filter(isPresent)
    .slice(0, 12);
};

const normalizeAnnotationSuggestions = (
  values: unknown,
  preserveIncomplete = false,
): PedagogicalAnnotationSuggestion[] => {
  if (!Array.isArray(values)) return [];
  return values
    .map<PedagogicalAnnotationSuggestion | null>((value, index) => {
      if (!value || typeof value !== "object") return null;
      const row = value as Record<string, unknown>;
      const title = String(row.title || "").trim();
      const content = String(row.content || "").trim();
      const competency = String(row.competency || "").trim();
      if ((!title || !content || !competency) && !preserveIncomplete) return null;
      const levelRaw = String(row.level || "").trim().toLowerCase();
      const level: PedagogicalCompetencyLevel =
        levelRaw === "basic"
          ? "basic"
          : levelRaw === "advanced"
            ? "advanced"
            : "operational";
      const typeRaw = String(row.type || "").trim().toLowerCase();
      const type: PedagogicalAnnotationSuggestion["type"] =
        typeRaw === "hotspot" ||
        typeRaw === "note" ||
        typeRaw === "quiz" ||
        typeRaw === "link" ||
        typeRaw === "image" ||
        typeRaw === "video"
          ? typeRaw
          : "callout";
      const actionTypeRaw = String(row.actionType || "").trim();
      const actionType: PedagogicalAnnotationSuggestion["actionType"] =
        actionTypeRaw === "navigate" ||
        actionTypeRaw === "showContent" ||
        actionTypeRaw === "openLink" ||
        actionTypeRaw === "playVideo" ||
        actionTypeRaw === "showQuiz"
          ? actionTypeRaw
          : undefined;
      const suggestion: PedagogicalAnnotationSuggestion = {
        id:
          String(row.id || "").trim() ||
          `annotation-suggestion-${`${competency}-${title}-${type}`.toLowerCase().replace(/[^a-z0-9]+/g, "-") || index + 1}`,
        type,
        title,
        content,
        competency,
        skillTitle: String(row.skillTitle || "").trim() || undefined,
        level,
        startRatio: Math.max(
          0,
          Math.min(0.97, Number(row.startRatio || 0) || 0),
        ),
        endRatio: Math.max(
          0.02,
          Math.min(1, Number(row.endRatio || 0.1) || 0.1),
        ),
        actionType,
        actionTarget: String(row.actionTarget || "").trim() || undefined,
        locked: Boolean(row.locked),
      };
      return suggestion;
    })
    .filter(isPresent)
    .slice(0, 12);
};

const normalizeStudioSuggestions = (
  value: unknown,
  preserveIncomplete = false,
): PedagogicalStudioSuggestions => {
  const record =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};
  return {
    skills: normalizeSkillSuggestions(record.skills, preserveIncomplete),
    quiz: normalizeQuizSuggestions(record.quiz, preserveIncomplete),
    annotations: normalizeAnnotationSuggestions(record.annotations, preserveIncomplete),
  };
};

const competencyLevelLabel = (
  level: PedagogicalCompetencyLevel,
  tt: (no: string, en: string) => string,
): string => {
  if (level === "basic") return tt("Grunnleggende", "Basic");
  if (level === "advanced") return tt("Avansert", "Advanced");
  return tt("Operativ", "Operational");
};

const suggestedSkillMapByDomain: Record<
  string,
  Array<{ title: string; focus: string }>
> = {
  videography: [
    {
      title: "Kamera",
      focus: "Kameraføring, komposisjon og eksponering for film",
    },
    { title: "Lyssetting", focus: "Motivasjonslys, key/fill og scenebalanse" },
    { title: "Storytelling", focus: "Fortellerbue, sceneintensjon og rytme" },
    { title: "Redigering", focus: "Klipperytme, kontinuitet og narrativ flyt" },
  ],
  photography: [
    { title: "Kamera", focus: "Eksponering, objektivvalg og komposisjon" },
    {
      title: "Lyssetting",
      focus: "Naturlig og kunstig lys for konsistent uttrykk",
    },
    {
      title: "Storytelling",
      focus: "Visuell historiefortelling gjennom bilder",
    },
    { title: "Redigering", focus: "Farge, kontrast og leveringsklare filer" },
  ],
  music_production: [
    { title: "Komposisjon", focus: "Harmonikk, rytme og melodisk struktur" },
    { title: "Arrangement", focus: "Lagdeling, dynamikk og energiutvikling" },
    { title: "Mix", focus: "Balansere elementer, rom og frekvensområde" },
    { title: "Master", focus: "Loudness, oversettbarhet og sluttnivå" },
  ],
  lighting: [
    {
      title: "Lyskilder",
      focus: "Valg av lyskilder basert på uttrykk og behov",
    },
    { title: "Modifisering", focus: "Diffusjon, shaping og lysretning" },
    { title: "Scenebalanse", focus: "Kontroll av kontrast og dybde i motivet" },
    {
      title: "Praktisk drift",
      focus: "Effektiv rigg, sikkerhet og repetisjon",
    },
  ],
  wedding: [
    {
      title: "Kundeopplevelse",
      focus: "Forventningsstyring og tydelig leveranse",
    },
    {
      title: "Storytelling",
      focus: "Emosjonell narrativ struktur for bryllup",
    },
    {
      title: "Lyssetting",
      focus: "Rask tilpasning mellom location og tidspunkt",
    },
    { title: "Leveranseflyt", focus: "Seleksjon, redigering og publisering" },
  ],
  business: [
    { title: "Posisjonering", focus: "Tydelig verdiforslag og målgruppe" },
    { title: "Tilbud", focus: "Pakkestruktur og prislogikk" },
    { title: "Salg", focus: "Konverteringspunkter og oppfølging" },
    { title: "Drift", focus: "Systemer for stabil leveranse og vekst" },
  ],
  default: [
    {
      title: "Kjerneferdighet",
      focus: "Den viktigste praktiske ferdigheten kurset bygger",
    },
    {
      title: "Kvalitet",
      focus: "Hvordan studenten leverer på profesjonelt nivå",
    },
    {
      title: "Prosess",
      focus: "Steg-for-steg arbeidsflyt fra start til slutt",
    },
    {
      title: "Transformasjon",
      focus: "Målbar endring i kompetanse hos studenten",
    },
  ],
};

type CurriculumProjectTemplate = {
  id: string;
  nameNo: string;
  nameEn: string;
  architecture: PedagogicalArchitecture;
};

type SavedCurriculumFoundationTemplate = {
  id: string;
  name: string;
  architecture: PedagogicalArchitecture;
  sourceProjectTemplateId?: string;
  createdAt: string;
  updatedAt: string;
};

type CurriculumFoundationSnapshot = {
  architecture: PedagogicalArchitecture;
  selectedProjectTemplateId?: string;
  selectedLeadInstructorId?: string;
  selectedCompetencyName?: string;
};

type CurriculumFoundationDraftEntry = CurriculumFoundationSnapshot & {
  scopeId: string;
  courseId?: string;
  courseTitle?: string;
  savedAt: string;
  signature: string;
  publishedAt?: string;
};

type CurriculumFoundationVersionEntry = CurriculumFoundationDraftEntry & {
  id: string;
  label: string;
};

type AssignmentTemplateStatus =
  | "active"
  | "in_review"
  | "completed"
  | "overdue"
  | "draft";
type AssignmentTemplateScope = "course" | "skill";
type AssignmentTemplateType =
  | "replication"
  | "analysis"
  | "decision"
  | "scenario"
  | "production";
type AssignmentTemplateMasteryEvidence =
  | "artifact"
  | "before_after"
  | "mentor_review"
  | "peer_feedback"
  | "demo_video"
  | "quiz_pass";
type AssignmentTemplateTransformationStage =
  | "discover"
  | "practice"
  | "perform"
  | "prove";
type AssignmentTemplateLevel = 1 | 2 | 3 | 4 | 5;
type AssignmentTemplatePlacement =
  | "bottom-center"
  | "bottom-right"
  | "center"
  | "top-right";
type AssignmentTemplateAnimationType = "slide-up" | "fade" | "zoom";
type AssignmentTemplateAnimationEasing =
  | "ease-out"
  | "ease-in-out"
  | "ease-in"
  | "linear";

interface AssignmentTemplateItem {
  id: string;
  courseId: string;
  title: string;
  subtitle: string;
  scope: AssignmentTemplateScope;
  competency: string;
  skillId?: string;
  skillTitle: string;
  assignmentType: AssignmentTemplateType;
  masteryEvidence: AssignmentTemplateMasteryEvidence;
  transformationStage: AssignmentTemplateTransformationStage;
  level: AssignmentTemplateLevel;
  overlayEnabled: boolean;
  triggerAt: number;
  endAt: number;
  placement: AssignmentTemplatePlacement;
  overlayBackground: string;
  overlayTextColor: string;
  overlayPrimaryButtonColor: string;
  overlayPrimaryButtonTextColor: string;
  overlayFontFamily: string;
  overlayAnimationEnabled: boolean;
  overlayAnimationType: AssignmentTemplateAnimationType;
  overlayAnimationEasing: AssignmentTemplateAnimationEasing;
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
  status: AssignmentTemplateStatus;
  tags: string[];
  revenueImpact: number;
  imageTheme: number;
}

interface AssignmentTemplateFeedbackItem {
  id: string;
  author: string;
  recipient?: string;
  message: string;
  timestamp: string;
}

interface AssignmentTemplateAnalyticsFlags {
  earlyAccess: boolean;
  invitationOnly: boolean;
  closed: boolean;
  dripRelease: boolean;
}

interface AssignmentTemplateStudioState {
  assignments: AssignmentTemplateItem[];
  feedback: AssignmentTemplateFeedbackItem[];
  selectedCourseId: string;
  statusFilter: "all" | AssignmentTemplateStatus;
  rangeFilter: "7d" | "30d" | "90d";
  analyticsFlags: AssignmentTemplateAnalyticsFlags;
  updatedAt: string;
}

type CourseWithAssignmentStudio = Course & {
  assignmentStudio?: AssignmentTemplateStudioState;
};

type AcademyCurriculumProductionScene = AcademyGoogleProductionSceneDraft;

interface AcademyCurriculumDriveExportCandidate
  extends AcademyGoogleDriveFileItem {
  playbackUrl: string;
  externalUrl: string;
}

const GOOGLE_DRIVE_VIDEO_EXTENSIONS = new Set([
  "mp4",
  "mov",
  "m4v",
  "webm",
  "ogg",
  "m3u8",
]);

const normalizeProductionSceneStatus = (
  value: unknown,
): AcademyGoogleProductionSceneDraft["status"] => {
  const normalized = String(value || "").trim();
  return normalized === "recording" ||
    normalized === "ready" ||
    normalized === "done" ||
    normalized === "planned"
    ? normalized
    : "planned";
};

const normalizeProductionRecordingMode = (
  value: unknown,
  fallback: AcademyVidsPresenterScene["recordingMode"] = "camera",
): AcademyVidsPresenterScene["recordingMode"] => {
  const normalized = String(value || "").trim();
  return normalized === "camera" ||
    normalized === "camera-and-screen" ||
    normalized === "screen" ||
    normalized === "voiceover"
    ? normalized
    : fallback;
};

const normalizeProductionSceneDraft = (
  value: Partial<AcademyCurriculumProductionScene> | null | undefined,
  fallback: AcademyVidsPresenterScene,
): AcademyCurriculumProductionScene => ({
  id: String(value?.id || fallback.id || "").trim() || fallback.id,
  title: String(value?.title || fallback.title || "").trim() || fallback.title,
  objective:
    String(value?.objective || fallback.objective || "").trim() ||
    fallback.objective,
  recordingMode: normalizeProductionRecordingMode(
    value?.recordingMode,
    fallback.recordingMode,
  ),
  durationMinutes: Math.max(
    0.5,
    Number.isFinite(Number(value?.durationMinutes))
      ? Number(value?.durationMinutes)
      : Number(fallback.durationMinutes || 0.75) || 0.75,
  ),
  visualCue:
    String(value?.visualCue || fallback.visualCue || "").trim() ||
    fallback.visualCue,
  whyThisMode:
    String(value?.whyThisMode || fallback.whyThisMode || "").trim() ||
    fallback.whyThisMode,
  teleprompterScript:
    String(value?.teleprompterScript || fallback.teleprompterScript || "")
      .trim() || fallback.teleprompterScript,
  notes: String(value?.notes || "").trim() || undefined,
  status: normalizeProductionSceneStatus(value?.status),
});

const mergeGoogleProductionWorkflowDraft = (
  workflow: AcademyGoogleProductionWorkflow | null | undefined,
  fallbackScenes: AcademyVidsPresenterScene[],
): AcademyGoogleProductionWorkflow => {
  const workflowScenes = Array.isArray(workflow?.sceneDrafts)
    ? workflow.sceneDrafts
    : [];
  const nextSceneDrafts = fallbackScenes.map((scene) =>
    normalizeProductionSceneDraft(
      workflowScenes.find(
        (candidate) => String(candidate?.id || "").trim() === scene.id,
      ),
      scene,
    ),
  );

  return {
    ...(workflow || {}),
    googleRequired: true,
    googleConnectedEmail:
      String(workflow?.googleConnectedEmail || "").trim() || undefined,
    sceneDrafts: nextSceneDrafts,
    recordingStartedAt:
      String(workflow?.recordingStartedAt || "").trim() || undefined,
    recordingCompletedAt:
      String(workflow?.recordingCompletedAt || "").trim() || undefined,
    ctaApprovedAt: String(workflow?.ctaApprovedAt || "").trim() || undefined,
    proofApprovedAt:
      String(workflow?.proofApprovedAt || "").trim() || undefined,
    runtimeApprovedAt:
      String(workflow?.runtimeApprovedAt || "").trim() || undefined,
    lastVidsSyncAt:
      String(workflow?.lastVidsSyncAt || "").trim() || undefined,
    lastNotebookLmSyncAt:
      String(workflow?.lastNotebookLmSyncAt || "").trim() || undefined,
    driveExportFileId:
      String(workflow?.driveExportFileId || "").trim() || undefined,
    driveExportName:
      String(workflow?.driveExportName || "").trim() || undefined,
    driveExportMimeType:
      String(workflow?.driveExportMimeType || "").trim() || undefined,
    driveExportUrl: String(workflow?.driveExportUrl || "").trim() || undefined,
    driveExportPlaybackUrl:
      String(workflow?.driveExportPlaybackUrl || "").trim() || undefined,
    driveExportVersion: Number.isFinite(Number(workflow?.driveExportVersion))
      ? Number(workflow?.driveExportVersion)
      : undefined,
    driveExportModifiedAt:
      String(workflow?.driveExportModifiedAt || "").trim() || undefined,
    videoBoundAt: String(workflow?.videoBoundAt || "").trim() || undefined,
    updatedAt: String(workflow?.updatedAt || "").trim() || undefined,
  };
};

const buildDrivePlaybackUrl = (
  file: Pick<AcademyGoogleDriveFileItem, "id" | "webContentLink">,
): string => {
  const contentLink = String(file.webContentLink || "").trim();
  if (contentLink) {
    return contentLink;
  }

  const fileId = String(file.id || "").trim();
  return fileId
    ? `https://drive.google.com/uc?export=download&id=${encodeURIComponent(fileId)}`
    : "";
};

const isDriveExportVideo = (
  file: Pick<AcademyGoogleDriveFileItem, "mimeType" | "fileExtension">,
): boolean => {
  const mimeType = String(file.mimeType || "").trim().toLowerCase();
  if (mimeType.startsWith("video/")) {
    return true;
  }

  const extension = String(file.fileExtension || "")
    .trim()
    .toLowerCase()
    .replace(/^\./, "");
  return GOOGLE_DRIVE_VIDEO_EXTENSIONS.has(extension);
};

const mapDriveExportCandidate = (
  file: AcademyGoogleDriveFileItem,
): AcademyCurriculumDriveExportCandidate => ({
  ...file,
  playbackUrl: buildDrivePlaybackUrl(file),
  externalUrl:
    String(file.webViewLink || "").trim() ||
    String(file.webContentLink || "").trim(),
});

const buildCustomProductionScene = (
  useNorwegian: boolean,
  index: number,
): AcademyCurriculumProductionScene => ({
  id: `custom-scene-${Date.now()}-${index + 1}`,
  title: useNorwegian ? `Ekstra scene ${index + 1}` : `Extra scene ${index + 1}`,
  objective: useNorwegian
    ? "Beskriv hva denne scenen skal lære bort."
    : "Describe what this scene should teach.",
  recordingMode: "camera",
  durationMinutes: 1,
  visualCue: useNorwegian
    ? "Forklar hva seeren skal se samtidig med opptaket."
    : "Explain what the viewer should see during the recording.",
  whyThisMode: useNorwegian
    ? "Bruk kamera hvis du vil bygge tillit og holde instruktoeren i fokus."
    : "Use camera when you want to keep the instructor front and center.",
  teleprompterScript: useNorwegian
    ? "Skriv et kort manus som hoeres naturlig ut naar det leses hoeyt."
    : "Write a short script that sounds natural when spoken aloud.",
  status: "planned",
});

const hasWorkflowTimestamp = (value: unknown): boolean =>
  typeof value === "string" && value.trim().length > 0;

const curriculumProjectTemplates: CurriculumProjectTemplate[] = [
  {
    id: "sales-enablement-a-a",
    nameNo: "Salgsteam opplæring A-Å",
    nameEn: "Sales Enablement A-Z",
    architecture: normalizeArchitecture({
      purpose:
        "Bygge en komplett opplæringsreise som løfter salgsteamet fra tilfeldig innsats til forutsigbar konvertering.",
      audience:
        "Salgsteam, account managers og teamledere som trenger felles metode i hele salgsprosessen.",
      transformation:
        "Studenten går fra ad-hoc salgssamtaler til strukturert, datadrevet og repeterbar salgsgjennomføring.",
      competencies: [
        "Discovery og behovsavklaring",
        "Verdibaserte salgsdialoger",
        "Pipeline-styring og oppfølging",
      ],
      skills: [
        "Gjennomføre strukturert discovery-møte",
        "Knytte kundebehov til tydelig verdiargumentasjon",
        "Håndtere innvendinger med beslutningsrammeverk",
        "Følge opp tilbud med tydelige neste steg",
        "Oppdatere CRM med kvalitetssikrede data",
      ],
      transformations: [
        "Bedre treff på riktig kundeprofil",
        "Kortere salgssyklus og færre tapte saker",
        "Høyere kvalitet i pipeline-rapportering",
      ],
      skillMap: [
        createSkillMapItem(
          "Discovery",
          "Spørreteknikk, behovsavklaring og prioritering av signaler",
        ),
        createSkillMapItem(
          "Value Selling",
          "Koble løsning til forretningsverdi med klare bevis",
        ),
        createSkillMapItem(
          "Objection Handling",
          "Strukturert håndtering av risiko, pris og timing-innvendinger",
        ),
        createSkillMapItem(
          "Pipeline Execution",
          "Neste steg, forecast kvalitet og lukkeplan",
        ),
      ],
      problemsSolved: [
        "Hvorfor leads stopper etter første møte",
        "Hvorfor tilbud ikke blir tydelig differensiert",
        "Hvorfor forecast treffer dårlig",
        "Hvorfor oppfølging blir inkonsistent på tvers av teamet",
      ],
      learningJourney:
        "1) Kartlegg kundescenario. 2) Tren discovery i realistiske case. 3) Bygg verdiargumentasjon og innvendingshåndtering. 4) Gjennomfør oppfølging med KPI-sporing. 5) Lukk saker med dokumentert læring.",
      practiceDesign:
        "Nivå 1: repliker salgsstruktur. Nivå 2: samtaler med begrensninger. Nivå 3: scenario-baserte beslutninger. Nivå 4: full case med pipeline-oppfølging. Nivå 5: master challenge med dokumentert resultateffekt.",
      proofOfLearning:
        "Studenten dokumenterer mestring med møteopptak, case-refleksjon, CRM-kvalitet, konverteringsforbedring og tilbakemelding fra mentor.",
    }),
  },
  {
    id: "production-operations-a-a",
    nameNo: "Produksjonsdrift A-Å",
    nameEn: "Production Operations A-Z",
    architecture: normalizeArchitecture({
      purpose:
        "Standardisere intern opplæring for produksjonsteam slik at kvalitet, sikkerhet og flyt blir konsekvent i hele skiftet.",
      audience:
        "Operatører, skiftledere og vedlikeholdspersonell i produksjonsmiljø.",
      transformation:
        "Studenten går fra reaktiv drift til proaktiv, standardisert og avviksreduserende operasjon.",
      competencies: [
        "Operasjonell standard",
        "Kvalitetskontroll",
        "Avvik og forbedringsarbeid",
      ],
      skills: [
        "Utføre SOP-trinn uten avvik",
        "Kontrollere kritiske kvalitetsparametre",
        "Dokumentere hendelser og avvik korrekt",
        "Gjennomføre årsaksanalyse og korrigerende tiltak",
      ],
      transformations: [
        "Færre produksjonsstopp og omarbeid",
        "Bedre sporbarhet i hendelser og tiltak",
        "Stabilere output-kvalitet mellom skift",
      ],
      skillMap: [
        createSkillMapItem(
          "Standard Prosedyre",
          "Kjøreprosedyrer, checkpoints og beslutningsgrenser",
        ),
        createSkillMapItem(
          "Kvalitet",
          "Målinger, toleranser og verifikasjon",
        ),
        createSkillMapItem(
          "Avvik",
          "Registrering, eskalering og rotårsaksanalyse",
        ),
        createSkillMapItem(
          "Kontinuerlig forbedring",
          "Tiltak, evaluering og læringsloop",
        ),
      ],
      problemsSolved: [
        "Hvorfor feil oppdages for sent i prosessen",
        "Hvorfor avvik rapporteres ulikt mellom team",
        "Hvorfor forbedringstiltak ikke blir lukket",
      ],
      learningJourney:
        "Fra basisprosedyrer til avansert avviksstyring med praktiske simuleringer, teamøvelser og dokumentert forbedring.",
      practiceDesign:
        "Replikeringsoppgaver på SOP, analyseoppgaver på avvik, scenariooppgaver ved driftsforstyrrelser, og produksjonsoppgave med full skiftrapport.",
      proofOfLearning:
        "Studenten består ved å dokumentere korrekt drift, avviksbehandling og forbedringseffekt i definerte KPI-er.",
    }),
  },
  {
    id: "offshore-safety-a-a",
    nameNo: "Offshore/plattform internopplæring A-Å",
    nameEn: "Offshore Platform Internal Training A-Z",
    architecture: normalizeArchitecture({
      purpose:
        "Sikre at ansatte på oljeplattform følger kritiske HMS- og beredskapsprosedyrer med høy etterlevelse.",
      audience:
        "Nyansatte og eksisterende personell på offshore installasjoner.",
      transformation:
        "Studenten går fra teoretisk kjennskap til trygg og korrekt handling i kritiske situasjoner.",
      competencies: [
        "HMS-forståelse og risikovurdering",
        "Beredskap og hendelseshåndtering",
        "Kommunikasjon under operativt press",
      ],
      skills: [
        "Utføre SJA (sikker jobb-analyse) korrekt",
        "Velge riktig tiltak ved alarm og hendelse",
        "Følge evakuerings- og samlingsprosedyrer",
        "Kommunisere status tydelig i kommandokjede",
      ],
      transformations: [
        "Raskere og riktigere respons ved hendelser",
        "Færre prosedyrebrudd i kritiske operasjoner",
        "Høyere trygghetsnivå i teamet",
      ],
      skillMap: [
        createSkillMapItem(
          "Forebygging",
          "Risikoidentifikasjon, barrierer og kontrollpunkter",
        ),
        createSkillMapItem(
          "Respons",
          "Alarmprosedyrer, rolleforståelse og tiltakskjede",
        ),
        createSkillMapItem(
          "Beredskap",
          "Evakuering, muster og samhandling på tvers av team",
        ),
        createSkillMapItem(
          "Etterarbeid",
          "Debrief, læringspunkter og prosedyreoppdatering",
        ),
      ],
      problemsSolved: [
        "Hvorfor kritiske alarmer håndteres ulikt",
        "Hvorfor prosedyrer feiltolkes under press",
        "Hvorfor læring etter hendelser ikke implementeres",
      ],
      learningJourney:
        "Fra HMS-grunnlag til scenario-trening i realistiske offshore-case med tydelige beslutningspunkter og oppfølging.",
      practiceDesign:
        "Nivåbaserte oppgaver: repliker prosedyre, analyser hendelse, beslutning under tidspress, full scenariosimulering og master challenge.",
      proofOfLearning:
        "Studenten må bestå scenarioer med riktig tiltak, korrekt kommunikasjon og dokumentert etterlevelse av HMS-krav.",
    }),
  },
];

const resolveSkillMapDomain = (course: Course | null | undefined): string => {
  const category = String(course?.category || "").toLowerCase();
  if (category && suggestedSkillMapByDomain[category]) return category;
  const profession = String(course?.instructor?.profession || "").toLowerCase();
  if (profession.includes("music")) return "music_production";
  if (profession.includes("photo")) return "photography";
  if (profession.includes("video")) return "videography";
  return "default";
};

const suggestedSkillMapTemplateForCourse = (
  course: Course | null | undefined,
): Array<{ title: string; focus: string }> => {
  const domain = resolveSkillMapDomain(course);
  return suggestedSkillMapByDomain[domain] || suggestedSkillMapByDomain.default;
};

function normalizeArchitecture(
  architecture: PedagogicalArchitecture,
): PedagogicalArchitecture {
  return {
    purpose: architecture.purpose.trim(),
    audience: architecture.audience.trim(),
    transformation: architecture.transformation.trim(),
    skillMap: normalizeSkillMapItems(architecture.skillMap),
    competencyMap: normalizeCompetencyMapItems(architecture.competencyMap),
    problemsSolved: normalizeList(architecture.problemsSolved),
    learningJourney: architecture.learningJourney.trim(),
    practiceDesign: architecture.practiceDesign.trim(),
    proofOfLearning: architecture.proofOfLearning.trim(),
    competencies: normalizeList(architecture.competencies),
    skills: normalizeList(architecture.skills),
    transformations: normalizeList(architecture.transformations),
    studioSuggestions: normalizeStudioSuggestions(architecture.studioSuggestions),
  };
}

const normalizeSavedFoundationTemplates = (
  value: unknown,
): SavedCurriculumFoundationTemplate[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map<SavedCurriculumFoundationTemplate | null>((entry, index) => {
      if (!entry || typeof entry !== "object") return null;
      const row = entry as Record<string, unknown>;
      const name = String(row.name || "").trim();
      const architecture = normalizeArchitecture(
        (row.architecture || emptyArchitecture) as PedagogicalArchitecture,
      );
      if (!name) return null;
      const template: SavedCurriculumFoundationTemplate = {
        id:
          String(row.id || "").trim() ||
          `foundation-template-${`${name}-${index + 1}`.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
        name,
        architecture,
        sourceProjectTemplateId:
          String(row.sourceProjectTemplateId || "").trim() || undefined,
        createdAt: String(row.createdAt || row.updatedAt || new Date().toISOString()).trim(),
        updatedAt: String(row.updatedAt || row.createdAt || new Date().toISOString()).trim(),
      };
      return template;
    })
    .filter(isPresent)
    .slice(0, 100);
};

const readSavedFoundationTemplates = (): SavedCurriculumFoundationTemplate[] => {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(FOUNDATION_TEMPLATE_STORAGE_KEY);
    if (!raw) return [];
    return normalizeSavedFoundationTemplates(JSON.parse(raw));
  } catch {
    return [];
  }
};

const writeSavedFoundationTemplates = (
  templates: SavedCurriculumFoundationTemplate[],
) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    FOUNDATION_TEMPLATE_STORAGE_KEY,
    JSON.stringify(templates),
  );
};

const buildCurriculumFoundationScopeId = (courseId?: string | null): string => {
  const normalizedCourseId = String(courseId || "").trim();
  return normalizedCourseId
    ? `course:${normalizedCourseId}`
    : "course:unsaved-foundation";
};

const normalizeCurriculumFoundationSnapshot = (
  value: unknown,
): CurriculumFoundationSnapshot => {
  const row =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};
  return {
    architecture: normalizeArchitecture(
      (row.architecture || emptyArchitecture) as PedagogicalArchitecture,
    ),
    selectedProjectTemplateId:
      String(row.selectedProjectTemplateId || "").trim() || undefined,
    selectedLeadInstructorId:
      String(row.selectedLeadInstructorId || "").trim() || undefined,
    selectedCompetencyName:
      String(row.selectedCompetencyName || "").trim() || undefined,
  };
};

const createCurriculumFoundationSignature = (
  snapshot: CurriculumFoundationSnapshot,
): string =>
  JSON.stringify({
    architecture: normalizeArchitecture(snapshot.architecture),
    selectedProjectTemplateId:
      String(snapshot.selectedProjectTemplateId || "").trim() || undefined,
    selectedLeadInstructorId:
      String(snapshot.selectedLeadInstructorId || "").trim() || undefined,
    selectedCompetencyName:
      String(snapshot.selectedCompetencyName || "").trim() || undefined,
  });

const normalizeCurriculumFoundationDraftEntry = (
  value: unknown,
): CurriculumFoundationDraftEntry | null => {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const scopeId = String(row.scopeId || "").trim();
  const savedAt = String(row.savedAt || "").trim();
  if (!scopeId || !savedAt) return null;
  const snapshot = normalizeCurriculumFoundationSnapshot(row);
  return {
    ...snapshot,
    scopeId,
    courseId: String(row.courseId || "").trim() || undefined,
    courseTitle: String(row.courseTitle || "").trim() || undefined,
    savedAt,
    signature:
      String(row.signature || "").trim() ||
      createCurriculumFoundationSignature(snapshot),
    publishedAt: String(row.publishedAt || "").trim() || undefined,
  };
};

const normalizeCurriculumFoundationVersionEntry = (
  value: unknown,
): CurriculumFoundationVersionEntry | null => {
  const draftEntry = normalizeCurriculumFoundationDraftEntry(value);
  if (!draftEntry || !value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const label = String(row.label || "").trim();
  const id = String(row.id || "").trim();
  if (!label || !id) return null;
  return {
    ...draftEntry,
    id,
    label,
  };
};

const readCurriculumFoundationDraftStore = (): Record<
  string,
  CurriculumFoundationDraftEntry
> => {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(FOUNDATION_DRAFT_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    return Object.entries(parsed as Record<string, unknown>).reduce<
      Record<string, CurriculumFoundationDraftEntry>
    >((accumulator, [key, value]) => {
      const normalized = normalizeCurriculumFoundationDraftEntry(value);
      if (!normalized) return accumulator;
      accumulator[key] = normalized;
      return accumulator;
    }, {});
  } catch {
    return {};
  }
};

const writeCurriculumFoundationDraftStore = (
  store: Record<string, CurriculumFoundationDraftEntry>,
) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    FOUNDATION_DRAFT_STORAGE_KEY,
    JSON.stringify(store),
  );
};

const readCurriculumFoundationDraftEntry = (
  scopeId: string,
): CurriculumFoundationDraftEntry | null =>
  readCurriculumFoundationDraftStore()[scopeId] || null;

const writeCurriculumFoundationDraftEntry = (
  entry: CurriculumFoundationDraftEntry,
) => {
  const store = readCurriculumFoundationDraftStore();
  store[entry.scopeId] = entry;
  writeCurriculumFoundationDraftStore(store);
};

const readCurriculumFoundationVersionStore = (): Record<
  string,
  CurriculumFoundationVersionEntry[]
> => {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(FOUNDATION_VERSION_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    return Object.entries(parsed as Record<string, unknown>).reduce<
      Record<string, CurriculumFoundationVersionEntry[]>
    >((accumulator, [key, value]) => {
      if (!Array.isArray(value)) return accumulator;
      accumulator[key] = value
        .map((entry) => normalizeCurriculumFoundationVersionEntry(entry))
        .filter(
          (entry): entry is CurriculumFoundationVersionEntry => Boolean(entry),
        )
        .sort(
          (left, right) =>
            new Date(right.savedAt).getTime() - new Date(left.savedAt).getTime(),
        )
        .slice(0, FOUNDATION_VERSION_LIMIT);
      return accumulator;
    }, {});
  } catch {
    return {};
  }
};

const writeCurriculumFoundationVersionStore = (
  store: Record<string, CurriculumFoundationVersionEntry[]>,
) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    FOUNDATION_VERSION_STORAGE_KEY,
    JSON.stringify(store),
  );
};

const readCurriculumFoundationVersionEntries = (
  scopeId: string,
): CurriculumFoundationVersionEntry[] =>
  readCurriculumFoundationVersionStore()[scopeId] || [];

const writeCurriculumFoundationVersionEntries = (
  scopeId: string,
  entries: CurriculumFoundationVersionEntry[],
): CurriculumFoundationVersionEntry[] => {
  const store = readCurriculumFoundationVersionStore();
  store[scopeId] = entries.slice(0, FOUNDATION_VERSION_LIMIT);
  writeCurriculumFoundationVersionStore(store);
  return store[scopeId];
};

const buildAssignmentStudioFromArchitecture = (
  courseId: string,
  architecture: PedagogicalArchitecture,
  tt: (no: string, en: string) => string,
): AssignmentTemplateStudioState => {
  const safeCourseId = String(courseId || "").trim();
  const competencies = normalizeList(architecture.competencies);
  const skills = normalizeList(architecture.skills);
  const problems = normalizeList(architecture.problemsSolved);
  const transformations = normalizeList(architecture.transformations);

  const assignmentRows: AssignmentTemplateItem[] = [];
  const now = new Date();
  const getDateOffset = (days: number): string => {
    const date = new Date(now);
    date.setDate(date.getDate() + days);
    return date.toISOString().slice(0, 10);
  };

  skills.forEach((skill, index) => {
    const competency = competencies[index % Math.max(competencies.length, 1)] ||
      tt("Generell kompetanse", "General competency");
    const transformation =
      transformations[index % Math.max(transformations.length, 1)] ||
      tt(
        "Studenten demonstrerer målbar forbedring i ferdigheten.",
        "Learner demonstrates measurable skill improvement.",
      );
    const reflectionPrompt =
      problems[index % Math.max(problems.length, 1)] ||
      tt(
        "Hva gjorde du annerledes, og hvorfor ga det bedre resultat?",
        "What did you do differently, and why did it improve the result?",
      );

    const buildBase = (
      rowIdSuffix: string,
      level: AssignmentTemplateLevel,
      type: AssignmentTemplateType,
      stage: AssignmentTemplateTransformationStage,
      titleSuffix: string,
      dayOffset: number,
    ): AssignmentTemplateItem => ({
      id: `assignment-template-${Date.now()}-${index + 1}-${rowIdSuffix}`,
      courseId: safeCourseId,
      title: `${skill} ${titleSuffix}`.trim(),
      subtitle: tt(
        "Målbar ferdighetstrening med deliberate practice",
        "Measurable skill training using deliberate practice",
      ),
      scope: "skill",
      competency,
      skillId: `template-skill-${index + 1}`,
      skillTitle: skill,
      assignmentType: type,
      masteryEvidence: level >= 4 ? "demo_video" : "artifact",
      transformationStage: stage,
      level,
      overlayEnabled: true,
      triggerAt: Math.max(20, 50 + index * 18),
      endAt: Math.max(50, 90 + index * 18),
      placement: "bottom-right",
      overlayBackground: "rgba(10,15,25,0.84)",
      overlayTextColor: "#f5f1e7",
      overlayPrimaryButtonColor: "#d99622",
      overlayPrimaryButtonTextColor: "#1a1306",
      overlayFontFamily: 'Barlow Condensed, "Manrope", sans-serif',
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
      transformationObjective: transformation,
      reflectionPrompt,
      startDate: getDateOffset(dayOffset),
      dueDate: getDateOffset(dayOffset + 10),
      submissions: 0,
      targetSubmissions: 120,
      completionRate: 0,
      avgScore: 0,
      status: "draft",
      tags: [
        tt("Mal", "Template"),
        `${tt("Nivå", "Level")} ${level}`,
      ],
      revenueImpact: 0,
      imageTheme: index % 4,
    });

    assignmentRows.push(
      buildBase(
        "replication",
        1,
        "replication",
        "practice",
        `· ${tt("Replikeringsoppgave", "Replication assignment")}`,
        index * 2 + 1,
      ),
      buildBase(
        "scenario",
        3,
        "scenario",
        "perform",
        `· ${tt("Scenariooppgave", "Scenario assignment")}`,
        index * 2 + 3,
      ),
    );
  });

  const firstCompetency =
    competencies[0] || tt("Generell kompetanse", "General competency");

  assignmentRows.push({
    id: `assignment-template-${Date.now()}-master-challenge`,
    courseId: safeCourseId,
    title: tt("Master Challenge", "Master Challenge"),
    subtitle: tt(
      "Helhetlig sluttoppgave på tvers av ferdigheter",
      "Integrated final assignment across skills",
    ),
    scope: "course",
    competency: firstCompetency,
    skillId: "",
    skillTitle: tt("Hele kompetansen", "Entire competency"),
    assignmentType: "production",
    masteryEvidence: "demo_video",
    transformationStage: "prove",
    level: 5,
    overlayEnabled: true,
    triggerAt: 160,
    endAt: 220,
    placement: "bottom-right",
    overlayBackground: "rgba(10,15,25,0.84)",
    overlayTextColor: "#f5f1e7",
    overlayPrimaryButtonColor: "#d99622",
    overlayPrimaryButtonTextColor: "#1a1306",
    overlayFontFamily: 'Barlow Condensed, "Manrope", sans-serif',
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
    transformationObjective:
      transformations[0] ||
      tt(
        "Studenten viser dokumentert transformasjon i praksis.",
        "Learner demonstrates documented transformation in practice.",
      ),
    reflectionPrompt:
      problems[0] ||
      tt(
        "Hva er den viktigste endringen i hvordan du jobber nå?",
        "What is the most important change in how you work now?",
      ),
    startDate: getDateOffset(14),
    dueDate: getDateOffset(28),
    submissions: 0,
    targetSubmissions: 120,
    completionRate: 0,
    avgScore: 0,
    status: "draft",
    tags: [tt("Mal", "Template"), tt("Master", "Master")],
    revenueImpact: 0,
    imageTheme: 0,
  });

  return {
    assignments: assignmentRows,
    feedback: [],
    selectedCourseId: "all",
    statusFilter: "all",
    rangeFilter: "30d",
    analyticsFlags: {
      earlyAccess: true,
      invitationOnly: true,
      closed: false,
      dripRelease: false,
    },
    updatedAt: new Date().toISOString(),
  };
};

const createInitialFoundationQuestion = (
  tt: (no: string, en: string) => string,
): CurriculumFoundationInterviewQuestion => ({
  id: "competencyTopic",
  question: tt(
    "Hvilken kompetanse ønsker du utvikle?",
    "Which competency do you want to develop?",
  ),
  placeholder: tt(
    "F.eks. lyssetting, prosjektledelse, HR, eiendomsmegling eller offshore-sikkerhet",
    "e.g. lighting, project management, HR, real estate, or offshore safety",
  ),
  helpText: tt(
    "Start med hovedområdet. AI-guiden stiller deretter det neste beste spørsmålet og fyller ut grunnlaget fortløpende.",
    "Start with the core domain. The AI guide will ask the next best question and fill the foundation as it goes.",
  ),
  suggestions: [
    tt("Salg", "Sales"),
    tt("Ledelse", "Leadership"),
    "HR",
    tt("Kundeservice", "Customer service"),
    tt("Prosjektledelse", "Project management"),
    tt("Markedsføring", "Marketing"),
    tt("Eiendom", "Real estate"),
    tt("IT-drift", "IT operations"),
    tt("Produksjonsdrift", "Production operations"),
    tt("Offshore-sikkerhet", "Offshore safety"),
  ],
});

const foundationIndustryProfileLabel = (
  profile: CurriculumFoundationIndustryProfile | "",
  tt: (no: string, en: string) => string,
  customTopic?: string,
): string => {
  const customTopicLabel = String(customTopic || "").trim();
  switch (profile) {
    case "sales":
      return tt("Salg", "Sales");
    case "production":
      return tt("Produksjonsdrift", "Production operations");
    case "offshore":
      return tt("Offshore-sikkerhet", "Offshore safety");
    case "leadership":
      return tt("Ledelse", "Leadership");
    case "customer-service":
      return tt("Kundeservice", "Customer service");
    case "hr":
      return "HR";
    case "healthcare":
      return tt("Helsetjeneste", "Healthcare");
    case "it":
      return tt("IT-drift", "IT operations");
    case "compliance":
      return tt("Etterlevelse", "Compliance");
    case "education":
      return tt("Undervisning", "Education");
    case "marketing":
      return tt("Markedsføring", "Marketing");
    case "project-management":
      return tt("Prosjektledelse", "Project management");
    case "finance":
      return tt("Økonomi og finans", "Finance");
    case "legal":
      return tt("Juridisk", "Legal");
    case "retail":
      return tt("Retail og butikkdrift", "Retail operations");
    case "logistics":
      return tt("Logistikk og lager", "Logistics and warehousing");
    case "construction":
      return tt("Bygg og anlegg", "Construction");
    case "hospitality":
      return tt("Vertskap og hospitality", "Hospitality");
    case "procurement":
      return tt("Innkjøp og sourcing", "Procurement and sourcing");
    case "real-estate":
      return tt("Eiendom og megling", "Real estate");
    case "creative":
      return tt("Kreativ produksjon", "Creative production");
    default:
      return customTopicLabel || tt("Tilpasset domene", "Custom domain");
  }
};

const foundationIndustryProfileOptions = (
  tt: (no: string, en: string) => string,
): Array<{
  id: CurriculumFoundationIndustryProfile;
  label: string;
}> => [
  { id: "sales", label: foundationIndustryProfileLabel("sales", tt) },
  { id: "leadership", label: foundationIndustryProfileLabel("leadership", tt) },
  { id: "customer-service", label: foundationIndustryProfileLabel("customer-service", tt) },
  { id: "hr", label: foundationIndustryProfileLabel("hr", tt) },
  { id: "healthcare", label: foundationIndustryProfileLabel("healthcare", tt) },
  { id: "it", label: foundationIndustryProfileLabel("it", tt) },
  { id: "education", label: foundationIndustryProfileLabel("education", tt) },
  { id: "marketing", label: foundationIndustryProfileLabel("marketing", tt) },
  { id: "project-management", label: foundationIndustryProfileLabel("project-management", tt) },
  { id: "finance", label: foundationIndustryProfileLabel("finance", tt) },
  { id: "legal", label: foundationIndustryProfileLabel("legal", tt) },
  { id: "retail", label: foundationIndustryProfileLabel("retail", tt) },
  { id: "logistics", label: foundationIndustryProfileLabel("logistics", tt) },
  { id: "construction", label: foundationIndustryProfileLabel("construction", tt) },
  { id: "hospitality", label: foundationIndustryProfileLabel("hospitality", tt) },
  { id: "procurement", label: foundationIndustryProfileLabel("procurement", tt) },
  { id: "real-estate", label: foundationIndustryProfileLabel("real-estate", tt) },
  { id: "creative", label: foundationIndustryProfileLabel("creative", tt) },
  { id: "production", label: foundationIndustryProfileLabel("production", tt) },
  { id: "offshore", label: foundationIndustryProfileLabel("offshore", tt) },
  { id: "compliance", label: foundationIndustryProfileLabel("compliance", tt) },
  { id: "generic", label: foundationIndustryProfileLabel("generic", tt) },
];

const inferFoundationIndustryProfile = (
  value: string,
): CurriculumFoundationIndustryProfile => {
  const normalized = value.toLowerCase();
  if (/(salg|sales|b2b|crm|pipeline|lead|discovery)/i.test(normalized))
    return "sales";
  if (/(film|video|videoproduksjon|content production|content creator|foto|photography|musikkproduksjon|music production|podcast|post-production|postproduksjon|editing|redigering|color grading|lyssetting|lighting|creative|kreativ|design|storytelling|motion graphics|grafisk)/i.test(normalized))
    return "creative";
  if (/(produksjonsdrift|production operations|operat|drift|sop|kvalitet|manufactur|prosessindustri|produksjonslinje|skiftleder)/i.test(normalized))
    return "production";
  if (/(offshore|plattform|rigg|hms|safety|beredskap|alarm)/i.test(normalized))
    return "offshore";
  if (/(prosjektledelse|prosjektstyring|project management|project delivery|programledelse|agile|scrum|pmo)/i.test(normalized))
    return "project-management";
  if (/(ledelse|leder|leadership|management|teamledelse|coaching)/i.test(normalized))
    return "leadership";
  if (/(kundeservice|customer service|support|customer success|klage)/i.test(normalized))
    return "customer-service";
  if (/(^|\b)(hr|human resources|people ops|rekrutter|onboarding|employee)(\b|$)/i.test(normalized))
    return "hr";
  if (/(helse|healthcare|klinisk|pasient|sykepleie|omsorg)/i.test(normalized))
    return "healthcare";
  if (/(^|\b)(it|devops|platform|incident|cyber|systemdrift|service desk)(\b|$)/i.test(normalized))
    return "it";
  if (/(compliance|etterlevelse|aml|gdpr|risiko|risk|internkontroll)/i.test(normalized))
    return "compliance";
  if (/(undervisning|teaching|education|skole|pedagogikk|fagopplæring)/i.test(normalized))
    return "education";
  if (/(marketing|markedsf|performance marketing|seo|sem|annonsering|content marketing|branding|kommunikasjon|social media|sosiale medier)/i.test(normalized))
    return "marketing";
  if (/(økonomi|finance|financial|regnskap|controller|controlling|fp&a|forecast|budsjett|budget|faktur)/i.test(normalized))
    return "finance";
  if (/(juridisk|legal|contract|kontrakt|arbeidsrett|advokat|legal ops|personvernrett)/i.test(normalized))
    return "legal";
  if (/(retail|butikk|butikkdrift|butikkledelse|merchandising|pos|point of sale)/i.test(normalized))
    return "retail";
  if (/(logistikk|lager|warehouse|transport|supply chain|frakt|distribution|distribusjon|plukk og pakk)/i.test(normalized))
    return "logistics";
  if (/(bygg|anlegg|construction|byggeplass|site management|tømrer|vvs|anleggsdrift)/i.test(normalized))
    return "construction";
  if (/(hospitality|vertskap|hotel|restaurant|resepsjon|servering|gjesteopplevelse|guest experience|barista)/i.test(normalized))
    return "hospitality";
  if (/(innkjøp|procurement|sourcing|leverandør|supplier|category management|anbud|tender|anskaffelse)/i.test(normalized))
    return "procurement";
  if (/(eiendom|real estate|megling|eiendomsmegling|property management|utleie|leasing|visning|boligsalg)/i.test(normalized))
    return "real-estate";
  return "generic";
};

const buildFoundationPendingStatus = (params: {
  answerCount: number;
  tt: (no: string, en: string) => string;
  profileLabel: string;
}): CurriculumFoundationInterviewProgress => {
  const { answerCount, tt, profileLabel } = params;
  if (answerCount <= 0) {
    return {
      phase: tt("Kartlegger retning", "Mapping direction"),
      statusMessage: tt(
        "AI starter med å forstå hvilket kompetanseområde du vil bygge.",
        "AI is starting by understanding which competency area you want to build.",
      ),
      percent: 12,
      focusAreas: [
        tt("Kompetanseområde", "Competency area"),
        tt("Bransje", "Industry"),
        tt("Brukskontekst", "Usage context"),
      ],
      appliedSections: [tt("Kompetanseramme", "Competency frame")],
    };
  }

  if (answerCount === 1) {
    return {
      phase: tt("Avklarer kontekst", "Clarifying context"),
      statusMessage: tt(
        `AI foreslår nå kompetansegrunnlaget for ${profileLabel.toLowerCase()} og avklarer hvilken kontekst det må passe inn i.`,
        `AI is now proposing the competency foundation for ${profileLabel.toLowerCase()} and clarifying which context it must fit into.`,
      ),
      percent: 28,
      focusAreas: [tt("Kontekst", "Context"), tt("Scenarioer", "Scenarios"), tt("Arbeidsflyt", "Workflow")],
      appliedSections: [tt("Formål", "Purpose"), tt("Kompetanser", "Competencies"), tt("Ferdigheter", "Skills")],
    };
  }

  if (answerCount === 2) {
    return {
      phase: tt("Tilpasser målgruppe", "Adapting audience"),
      statusMessage: tt(
        "AI justerer nå nivå, ansvar og eksempler til riktig målgruppe.",
        "AI is now adjusting level, responsibility, and examples to the right audience.",
      ),
      percent: 48,
      focusAreas: [tt("Målgruppe", "Audience"), tt("Erfaringsnivå", "Experience level"), tt("Ansvar", "Responsibility")],
      appliedSections: [tt("Målgruppe", "Audience"), tt("Kompetanser", "Competencies"), tt("Ferdigheter", "Skills")],
    };
  }

  if (answerCount === 3) {
    return {
      phase: tt("Former resultatmål", "Shaping outcomes"),
      statusMessage: tt(
        "AI konkretiserer nå ønsket transformasjon og hvordan mestring skal observeres.",
        "AI is now clarifying the desired transformation and how mastery should be observed.",
      ),
      percent: 68,
      focusAreas: [tt("Transformasjon", "Transformation"), tt("Adferd", "Behavior"), tt("Proof of learning", "Proof of learning")],
      appliedSections: [tt("Transformasjon", "Transformation"), tt("Proof of learning", "Proof of learning")],
    };
  }

  return {
    phase: tt("Knytter til praksis", "Connecting to practice"),
    statusMessage: tt(
      "AI kobler nå kompetansegrunnlaget til verktøy, prosesser og arbeidssituasjoner.",
      "AI is now connecting the competency foundation to tools, processes, and real working situations.",
    ),
    percent: 88,
    focusAreas: [tt("Verktøy", "Tools"), tt("Prosesser", "Processes"), tt("Læringsreise", "Learning journey")],
    appliedSections: [tt("Læringsreise", "Learning journey"), tt("Practice design", "Practice design"), tt("Problemområder", "Problems solved")],
  };
};

const toArchitectureDraft = (
  course: Course | null | undefined,
): PedagogicalArchitecture => {
  const raw = (course?.pedagogicalArchitecture || {}) as Partial<
    PedagogicalArchitecture & {
      coursePromise?: string;
      targetAudience?: string;
      pedagogyModel?: string;
      assessmentModel?: string;
      engagementPlan?: string;
      completionCriteria?: string;
    }
  >;
  const normalizedSkillMap = normalizeSkillMapItems(raw.skillMap);

  return normalizeArchitecture({
    purpose: raw.purpose || raw.coursePromise || "",
    audience: raw.audience || raw.targetAudience || "",
    transformation: raw.transformation || "",
    skillMap: normalizedSkillMap,
    competencyMap: normalizeCompetencyMapItems(raw.competencyMap),
    problemsSolved: normalizeList(raw.problemsSolved),
    learningJourney: raw.learningJourney || raw.engagementPlan || "",
    practiceDesign: raw.practiceDesign || raw.pedagogyModel || "",
    proofOfLearning:
      raw.proofOfLearning ||
      raw.assessmentModel ||
      raw.completionCriteria ||
      "",
    competencies: normalizeList(raw.competencies),
    skills: normalizeList(raw.skills),
    transformations: normalizeList(raw.transformations),
    studioSuggestions: normalizeStudioSuggestions(raw.studioSuggestions),
  });
};

const buildDerivedLearningOutcomes = (
  architecture: PedagogicalArchitecture,
  existingOutcomes: string[],
): string[] => {
  const fromSkillMap = normalizeSkillMapItems(architecture.skillMap)
    .map((entry) => {
      const title = entry.title.trim();
      const focus = entry.focus.trim();
      if (!title && !focus) return "";
      if (!title) return focus;
      if (!focus) return title;
      return `${title}: ${focus}`;
    })
    .filter((value) => value.length > 0);
  const fromCompetencyMap = normalizeCompetencyMapItems(architecture.competencyMap)
    .flatMap((entry) => [
      entry.description,
      ...entry.basic,
      ...entry.operational,
      ...entry.advanced,
    ])
    .filter((value) => value.trim().length > 0);

  const generated = normalizeList([
    architecture.transformation,
    architecture.proofOfLearning,
    ...architecture.transformations,
    ...architecture.skills,
    ...architecture.competencies,
    ...fromSkillMap,
    ...fromCompetencyMap,
  ]);

  if (generated.length > 0) return generated;
  return normalizeList(existingOutcomes);
};

function AcademyCurriculumStudio({
  courseId,
  onSave,
  onCancel,
}: AcademyCurriculumStudioProps) {
  const [location, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const {
    state,
    getCourse,
    updateCourse,
    setCurrentCourse,
    createCourse,
    loadCourses,
  } =
    useAcademy();
  const { analytics, debugging } = useEnhancedMasterIntegration();
  const { navLabel, tt, isNorwegian } = useAcademyLocale();

  const [leftNav, setLeftNav] = useState("curriculum");
  const [selectedCourseId, setSelectedCourseId] = useState(courseId || "all");
  const [selectedCompetencyName, setSelectedCompetencyName] = useState(
    ALL_COMPETENCIES_OPTION,
  );
  const [selectedLeadInstructorId, setSelectedLeadInstructorId] = useState("");
  const [saveMessage, setSaveMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [curriculumAutosaveState, setCurriculumAutosaveState] =
    useState<CurriculumAutosaveState>("saved");
  const [curriculumLastSavedAt, setCurriculumLastSavedAt] = useState("");
  const [curriculumVersionEntries, setCurriculumVersionEntries] = useState<
    CurriculumFoundationVersionEntry[]
  >([]);
  const [selectedCurriculumVersionId, setSelectedCurriculumVersionId] =
    useState("");
  const [googleProductionWorkflowDraft, setGoogleProductionWorkflowDraft] =
    useState<AcademyGoogleProductionWorkflow>({
      googleRequired: true,
      sceneDrafts: [],
    });
  const [googleProductionWorkflowSaving, setGoogleProductionWorkflowSaving] =
    useState(false);

  const [architectureDraft, setArchitectureDraft] =
    useState<PedagogicalArchitecture>(emptyArchitecture);
  const [problemItems, setProblemItems] = useState<string[]>([]);
  const [newProblem, setNewProblem] = useState("");
  const [competencyItems, setCompetencyItems] = useState<string[]>([]);
  const [newCompetency, setNewCompetency] = useState("");
  const [skillItems, setSkillItems] = useState<string[]>([]);
  const [newSkill, setNewSkill] = useState("");
  const [transformationItems, setTransformationItems] = useState<string[]>([]);
  const [newTransformation, setNewTransformation] = useState("");
  const [newSkillMapTitle, setNewSkillMapTitle] = useState("");
  const [newSkillMapFocus, setNewSkillMapFocus] = useState("");
  const [selectedProjectTemplateId, setSelectedProjectTemplateId] =
    useState("");
  const [savedFoundationTemplates, setSavedFoundationTemplates] = useState<
    SavedCurriculumFoundationTemplate[]
  >(() => readSavedFoundationTemplates());
  const [selectedFoundationTemplateId, setSelectedFoundationTemplateId] =
    useState("");
  const [foundationTemplateName, setFoundationTemplateName] = useState("");
  const [foundationEditorMode, setFoundationEditorMode] =
    useState<FoundationEditorMode>("simple");
  const [activeFoundationSection, setActiveFoundationSection] =
    useState<FoundationFlowSection>("clarify");
  const [showAdvancedFoundationFields, setShowAdvancedFoundationFields] =
    useState(false);
  const [expandedSkillSuggestionIds, setExpandedSkillSuggestionIds] = useState<
    string[]
  >([]);
  const [expandedQuizSuggestionIds, setExpandedQuizSuggestionIds] = useState<
    string[]
  >([]);
  const [expandedAnnotationSuggestionIds, setExpandedAnnotationSuggestionIds] =
    useState<string[]>([]);
  const [foundationInterviewAnswers, setFoundationInterviewAnswers] = useState<
    CurriculumFoundationInterviewAnswer[]
  >([]);
  const [foundationInterviewQuestion, setFoundationInterviewQuestion] =
    useState<CurriculumFoundationInterviewQuestion | null>(() =>
      createInitialFoundationQuestion(tt),
    );
  const [foundationInterviewInput, setFoundationInterviewInput] = useState("");
  const [foundationInterviewLoading, setFoundationInterviewLoading] =
    useState(false);
  const [foundationInterviewCompleted, setFoundationInterviewCompleted] =
    useState(false);
  const [foundationInterviewProvider, setFoundationInterviewProvider] =
    useState("");
  const [foundationInterviewModel, setFoundationInterviewModel] = useState("");
  const [foundationInterviewGeneratedAt, setFoundationInterviewGeneratedAt] =
    useState("");
  const [foundationInterviewRationale, setFoundationInterviewRationale] =
    useState<string[]>([]);
  const [foundationInterviewProgress, setFoundationInterviewProgress] =
    useState<CurriculumFoundationInterviewProgress | null>(null);
  const [foundationInterviewSectionRationales, setFoundationInterviewSectionRationales] =
    useState<CurriculumFoundationInterviewSectionRationale[]>([]);
  const [foundationInterviewIndustryProfile, setFoundationInterviewIndustryProfile] =
    useState<CurriculumFoundationIndustryProfile | "">("");
  const [foundationInterviewDomainResolution, setFoundationInterviewDomainResolution] =
    useState<CurriculumFoundationDomainResolution | null>(null);
  const [foundationInterviewGenerationStage, setFoundationInterviewGenerationStage] =
    useState<CurriculumFoundationGenerationStage | null>(null);
  const [foundationInterviewTemplateMatch, setFoundationInterviewTemplateMatch] =
    useState<CurriculumFoundationTemplateMatch | null>(null);
  const [foundationInterviewManualProfile, setFoundationInterviewManualProfile] =
    useState<CurriculumFoundationIndustryProfile | "">("");
  const [showCompetencyComposer, setShowCompetencyComposer] = useState(false);
  const competencyComposerRef = useRef<HTMLDivElement | null>(null);
  const competencyNameInputRef = useRef<HTMLInputElement | null>(null);
  const curriculumHydratedSignatureRef = useRef("");
  const curriculumSkipAutosaveRef = useRef(false);
  const googleProductionWorkflowCourseRef = useRef("");
  const routeSearch =
    typeof window !== "undefined" ? window.location.search : "";
  const routeQuery = useMemo(
    () => new URLSearchParams(routeSearch),
    [location, routeSearch],
  );
  const shouldOpenCompetencyComposer =
    routeQuery.get("createCompetency") === "1";

  const courseItems = useMemo(() => {
    if (Array.isArray(state?.courses) && state.courses.length > 0) {
      return state.courses;
    }
    return [];
  }, [state?.courses]);

  const instructorItems = useMemo(() => {
    if (!Array.isArray(state?.instructors)) return [];
    return [...state.instructors].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
    );
  }, [state?.instructors]);

  const activeCourse = useMemo(() => {
    const fromParam = courseId ? getCourse(courseId) : null;
    if (fromParam) return fromParam;

    if (selectedCourseId !== "all") {
      const fromSelected = courseItems.find(
        (course) => String(course.id) === String(selectedCourseId),
      );
      if (fromSelected) return fromSelected;
    }

    return state.currentCourse || courseItems[0] || null;
  }, [courseId, courseItems, getCourse, selectedCourseId, state.currentCourse]);

  const curriculumFoundationScopeId = useMemo(
    () =>
      buildCurriculumFoundationScopeId(
        activeCourse?.id || (selectedCourseId !== "all" ? selectedCourseId : ""),
      ),
    [activeCourse?.id, selectedCourseId],
  );

  const selectedFoundationTemplate = useMemo(
    () =>
      savedFoundationTemplates.find(
        (template) =>
          String(template.id).trim() === String(selectedFoundationTemplateId).trim(),
      ) || null,
    [savedFoundationTemplates, selectedFoundationTemplateId],
  );

  const suggestedProjectTemplate = useMemo(
    () =>
      curriculumProjectTemplates.find(
        (template) =>
          String(template.id).trim() === String(selectedProjectTemplateId).trim(),
      ) || null,
    [selectedProjectTemplateId],
  );

  const foundationProfileOptions = useMemo(
    () => foundationIndustryProfileOptions(tt),
    [tt],
  );

  const foundationTemplateMemory = useMemo<CurriculumFoundationTemplateMemoryItem[]>(
    () =>
      savedFoundationTemplates.slice(0, 12).map((template) => ({
        id: template.id,
        name: template.name,
        sourceProjectTemplateId: template.sourceProjectTemplateId,
        profileHint: inferFoundationIndustryProfile(
          [
            template.name,
            template.sourceProjectTemplateId || "",
            ...normalizeList(template.architecture.competencies),
            ...normalizeList(template.architecture.skills),
            ...normalizeList(template.architecture.problemsSolved),
            String(template.architecture.purpose || ""),
            String(template.architecture.audience || ""),
            String(template.architecture.transformation || ""),
          ].join(" "),
        ),
        architecture: normalizeArchitecture(template.architecture),
      })),
    [savedFoundationTemplates],
  );

  useEffect(() => {
    if (!selectedFoundationTemplate) return;
    setFoundationTemplateName((previous) =>
      previous === selectedFoundationTemplate.name
        ? previous
        : selectedFoundationTemplate.name,
    );
  }, [selectedFoundationTemplate]);

  const isSuggestionEditorExpanded = useCallback(
    (kind: "skill" | "quiz" | "annotation", id: string): boolean => {
      const source =
        kind === "skill"
          ? expandedSkillSuggestionIds
          : kind === "quiz"
            ? expandedQuizSuggestionIds
            : expandedAnnotationSuggestionIds;
      return source.includes(id);
    },
    [
      expandedAnnotationSuggestionIds,
      expandedQuizSuggestionIds,
      expandedSkillSuggestionIds,
    ],
  );

  const toggleSuggestionEditorExpanded = useCallback(
    (kind: "skill" | "quiz" | "annotation", id: string) => {
      const update = (current: string[]) =>
        current.includes(id)
          ? current.filter((entry) => entry !== id)
          : [...current, id];
      if (kind === "skill") {
        setExpandedSkillSuggestionIds((current) => update(current));
        return;
      }
      if (kind === "quiz") {
        setExpandedQuizSuggestionIds((current) => update(current));
        return;
      }
      setExpandedAnnotationSuggestionIds((current) => update(current));
    },
    [],
  );

  const foundationInterviewProfileLabel = useMemo(
    () => {
      const fallbackTopic =
        String(
          foundationInterviewAnswers.find(
            (entry) => entry.id === "competencyTopic",
          )?.answer || foundationInterviewInput || "",
        ).trim();
      const inferredProfile = fallbackTopic
        ? inferFoundationIndustryProfile(fallbackTopic)
        : "generic";
      if (foundationInterviewDomainResolution?.label) {
        return foundationInterviewDomainResolution.label;
      }
      return foundationIndustryProfileLabel(
        foundationInterviewManualProfile ||
          foundationInterviewIndustryProfile ||
          inferredProfile,
        tt,
        fallbackTopic,
      );
    },
    [
      foundationInterviewAnswers,
      foundationInterviewDomainResolution,
      foundationInterviewIndustryProfile,
      foundationInterviewInput,
      foundationInterviewManualProfile,
      tt,
    ],
  );

  const foundationInterviewDisplayProgress = useMemo(() => {
    if (foundationInterviewLoading) {
      return buildFoundationPendingStatus({
        answerCount: foundationInterviewAnswers.length,
        tt,
        profileLabel: foundationInterviewProfileLabel,
      });
    }
    return foundationInterviewProgress;
  }, [
    foundationInterviewAnswers.length,
    foundationInterviewLoading,
    foundationInterviewProfileLabel,
    foundationInterviewProgress,
    tt,
  ]);

  useEffect(() => {
    const routeCourseId = String(
      courseId || routeQuery.get("courseId") || routeQuery.get("course_id") || "",
    ).trim();
    if (!routeCourseId) return;
    setSelectedCourseId((previousCourseId) =>
      previousCourseId === routeCourseId ? previousCourseId : routeCourseId,
    );
  }, [courseId, routeQuery]);

  useEffect(() => {
    const activeCourseId = String(activeCourse?.id || "").trim();
    if (!activeCourseId) return;
    if (selectedCourseId === activeCourseId) return;
    if (selectedCourseId !== "all") return;
    setSelectedCourseId(activeCourseId);
  }, [activeCourse?.id, selectedCourseId]);

  useEffect(() => {
    const leadId = String(
      activeCourse?.competencyLeadInstructorId || activeCourse?.instructor?.id || "",
    ).trim();
    if (leadId) {
      if (selectedLeadInstructorId !== leadId) {
        setSelectedLeadInstructorId(leadId);
      }
      return;
    }
    const fallbackId = String(instructorItems[0]?.id || "").trim();
    if (!fallbackId) return;
    if (selectedLeadInstructorId === fallbackId) return;
    setSelectedLeadInstructorId(fallbackId);
  }, [
    activeCourse?.competencyLeadInstructorId,
    activeCourse?.instructor?.id,
    instructorItems,
    selectedLeadInstructorId,
  ]);

  const selectedLeadInstructor = useMemo(() => {
    if (!selectedLeadInstructorId) return null;
    return (
      instructorItems.find(
        (instructor) =>
          String(instructor.id) === String(selectedLeadInstructorId),
      ) || null
    );
  }, [instructorItems, selectedLeadInstructorId]);

  const buildCurriculumSnapshot = useCallback(
    (
      overrides?: Partial<CurriculumFoundationSnapshot> & {
        architecture?: PedagogicalArchitecture;
      },
    ): CurriculumFoundationSnapshot =>
      normalizeCurriculumFoundationSnapshot({
        architecture:
          overrides?.architecture ||
          normalizeArchitecture({
            ...architectureDraft,
            problemsSolved: problemItems,
            competencies: competencyItems,
            skills: skillItems,
            transformations: transformationItems,
          }),
        selectedProjectTemplateId:
          overrides?.selectedProjectTemplateId ?? selectedProjectTemplateId,
        selectedLeadInstructorId:
          overrides?.selectedLeadInstructorId ?? selectedLeadInstructorId,
        selectedCompetencyName:
          overrides?.selectedCompetencyName ?? selectedCompetencyName,
      }),
    [
      architectureDraft,
      competencyItems,
      problemItems,
      selectedCompetencyName,
      selectedLeadInstructorId,
      selectedProjectTemplateId,
      skillItems,
      transformationItems,
    ],
  );

  const applyCurriculumSnapshot = useCallback(
    (
      snapshot: CurriculumFoundationSnapshot,
      options?: {
        savedAt?: string;
        selectedVersionId?: string;
      },
    ): CurriculumFoundationSnapshot => {
      const normalized = normalizeCurriculumFoundationSnapshot(snapshot);
      curriculumHydratedSignatureRef.current =
        createCurriculumFoundationSignature(normalized);
      setArchitectureDraft(normalized.architecture);
      setProblemItems(normalized.architecture.problemsSolved);
      setCompetencyItems(normalized.architecture.competencies);
      setSkillItems(normalized.architecture.skills);
      setTransformationItems(normalized.architecture.transformations);
      setSelectedProjectTemplateId(normalized.selectedProjectTemplateId || "");
      setSelectedLeadInstructorId(normalized.selectedLeadInstructorId || "");
      setSelectedCompetencyName(
        normalized.selectedCompetencyName ||
          normalized.architecture.competencies[0] ||
          ALL_COMPETENCIES_OPTION,
      );
      if (options?.savedAt) {
        setCurriculumLastSavedAt(options.savedAt);
        setCurriculumAutosaveState("saved");
      }
      if (options?.selectedVersionId !== undefined) {
        setSelectedCurriculumVersionId(options.selectedVersionId);
      }
      return normalized;
    },
    [],
  );

  const persistCurriculumDraft = useCallback(
    (
      snapshot: CurriculumFoundationSnapshot,
      options?: {
        savedAt?: string;
        publishedAt?: string;
      },
    ): CurriculumFoundationDraftEntry => {
      const normalized = normalizeCurriculumFoundationSnapshot(snapshot);
      const savedAt = options?.savedAt || new Date().toISOString();
      const entry: CurriculumFoundationDraftEntry = {
        ...normalized,
        scopeId: curriculumFoundationScopeId,
        courseId: String(activeCourse?.id || "").trim() || undefined,
        courseTitle:
          String(
            activeCourse?.title ||
              newCompetency ||
              normalized.architecture.competencies[0] ||
              "",
          ).trim() || undefined,
        savedAt,
        signature: createCurriculumFoundationSignature(normalized),
        publishedAt: options?.publishedAt,
      };
      writeCurriculumFoundationDraftEntry(entry);
      setCurriculumLastSavedAt(savedAt);
      setCurriculumAutosaveState("saved");
      return entry;
    },
    [activeCourse?.id, activeCourse?.title, curriculumFoundationScopeId, newCompetency],
  );

  const recordCurriculumVersion = useCallback(
    (
      snapshot: CurriculumFoundationSnapshot,
      label: string,
      options?: {
        savedAt?: string;
        publishedAt?: string;
      },
    ): CurriculumFoundationVersionEntry => {
      const normalized = normalizeCurriculumFoundationSnapshot(snapshot);
      const savedAt = options?.savedAt || new Date().toISOString();
      const nextEntry: CurriculumFoundationVersionEntry = {
        ...normalized,
        id: `curriculum-version-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        label,
        scopeId: curriculumFoundationScopeId,
        courseId: String(activeCourse?.id || "").trim() || undefined,
        courseTitle:
          String(
            activeCourse?.title ||
              newCompetency ||
              normalized.architecture.competencies[0] ||
              "",
          ).trim() || undefined,
        savedAt,
        signature: createCurriculumFoundationSignature(normalized),
        publishedAt: options?.publishedAt,
      };
      const nextEntries = writeCurriculumFoundationVersionEntries(
        curriculumFoundationScopeId,
        [nextEntry, ...curriculumVersionEntries].slice(0, FOUNDATION_VERSION_LIMIT),
      );
      setCurriculumVersionEntries(nextEntries);
      setSelectedCurriculumVersionId(nextEntry.id);
      return nextEntry;
    },
    [
      activeCourse?.id,
      activeCourse?.title,
      curriculumFoundationScopeId,
      curriculumVersionEntries,
      newCompetency,
    ],
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

  const assignLeadInstructorToCourse = useCallback(
    async (instructorId: string) => {
      if (!activeCourse?.id) {
        setSaveMessage(
          tt(
            "Velg en kompetanse før du setter fagansvarlig.",
            "Select a competency before assigning a lead instructor.",
          ),
        );
        return;
      }

      const targetInstructor =
        instructorItems.find(
          (instructor) => String(instructor.id) === String(instructorId),
        ) || null;

      if (!targetInstructor) {
        setSaveMessage(
          tt("Instruktør ble ikke funnet.", "Instructor was not found."),
        );
        return;
      }

      setSaving(true);
      try {
        const nextCourse: Course = {
          ...activeCourse,
          competencyLeadInstructorId: targetInstructor.id,
          instructor: {
            id: targetInstructor.id,
            name: targetInstructor.name,
            avatar: targetInstructor.avatar,
            bio: targetInstructor.bio,
            profession: targetInstructor.profession,
          },
          updatedAt: new Date().toISOString(),
        };
        await updateCourse(nextCourse);
        setCurrentCourse(nextCourse);
        setSelectedLeadInstructorId(targetInstructor.id);
        setSaveMessage(
          tt(
            "Fagansvarlig oppdatert for kompetansen.",
            "Competency lead updated.",
          ),
        );
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : tt(
                "Kunne ikke oppdatere fagansvarlig.",
                "Failed to update competency lead.",
              );
        setSaveMessage(message);
      } finally {
        setSaving(false);
      }
    },
    [activeCourse, instructorItems, setCurrentCourse, tt, updateCourse],
  );

  const suggestedSkillMapTemplate = useMemo(
    () => suggestedSkillMapTemplateForCourse(activeCourse),
    [
      activeCourse?.id,
      activeCourse?.category,
      activeCourse?.instructor?.profession,
    ],
  );

  const skillMapRows = useMemo(
    () => normalizeSkillMapItems(architectureDraft.skillMap),
    [architectureDraft.skillMap],
  );

  const competencyMapRows = useMemo(
    () => normalizeCompetencyMapItems(architectureDraft.competencyMap, true),
    [architectureDraft.competencyMap],
  );

  const studioSuggestions = useMemo(
    () => normalizeStudioSuggestions(architectureDraft.studioSuggestions, true),
    [architectureDraft.studioSuggestions],
  );

  const applyFoundationRecommendation = useCallback(
    (recommendation: CurriculumFoundationInterviewRecommendation | null) => {
      if (!recommendation) return;

      const normalized = normalizeArchitecture(recommendation.architecture);
      const currentCompetencyMap = normalizeCompetencyMapItems(
        architectureDraft.competencyMap,
        true,
      );
      const nextCompetencyMap = normalizeCompetencyMapItems(
        normalized.competencyMap,
        true,
      );
      const mergedCompetencyMap = mergeLockedEntries({
        current: currentCompetencyMap,
        incoming: nextCompetencyMap,
        matches: (currentItem, incomingItem) =>
          normalizeMergeKey(currentItem.title) ===
            normalizeMergeKey(incomingItem.title) ||
          normalizeMergeKey(currentItem.id) === normalizeMergeKey(incomingItem.id),
      });

      const currentStudioSuggestions = normalizeStudioSuggestions(
        architectureDraft.studioSuggestions,
        true,
      );
      const nextStudioSuggestions = normalizeStudioSuggestions(
        normalized.studioSuggestions,
        true,
      );
      const mergedStudioSuggestions: PedagogicalStudioSuggestions = {
        skills: mergeLockedEntries({
          current: currentStudioSuggestions.skills,
          incoming: nextStudioSuggestions.skills,
          matches: (currentItem, incomingItem) =>
            normalizeMergeKey(currentItem.id) === normalizeMergeKey(incomingItem.id) ||
            (normalizeMergeKey(currentItem.title) ===
              normalizeMergeKey(incomingItem.title) &&
              normalizeMergeKey(currentItem.competency) ===
                normalizeMergeKey(incomingItem.competency)),
        }),
        quiz: mergeLockedEntries({
          current: currentStudioSuggestions.quiz,
          incoming: nextStudioSuggestions.quiz,
          matches: (currentItem, incomingItem) =>
            normalizeMergeKey(currentItem.id) === normalizeMergeKey(incomingItem.id) ||
            (normalizeMergeKey(currentItem.prompt) ===
              normalizeMergeKey(incomingItem.prompt) &&
              normalizeMergeKey(currentItem.skillTitle) ===
                normalizeMergeKey(incomingItem.skillTitle)),
        }),
        annotations: mergeLockedEntries({
          current: currentStudioSuggestions.annotations,
          incoming: nextStudioSuggestions.annotations,
          matches: (currentItem, incomingItem) =>
            normalizeMergeKey(currentItem.id) === normalizeMergeKey(incomingItem.id) ||
            (normalizeMergeKey(currentItem.title) ===
              normalizeMergeKey(incomingItem.title) &&
              normalizeMergeKey(currentItem.type) ===
                normalizeMergeKey(incomingItem.type) &&
              normalizeMergeKey(currentItem.skillTitle) ===
                normalizeMergeKey(incomingItem.skillTitle)),
        }),
      };

      const mergedArchitecture = normalizeArchitecture({
        ...normalized,
        competencyMap: mergedCompetencyMap,
        studioSuggestions: mergedStudioSuggestions,
      });

      const recommendedProjectTemplateId = String(
        recommendation.recommendedProjectTemplateId || "",
      ).trim();
      const nextSnapshot = applyCurriculumSnapshot({
        architecture: mergedArchitecture,
        selectedProjectTemplateId: recommendedProjectTemplateId,
        selectedLeadInstructorId,
        selectedCompetencyName:
          mergedArchitecture.competencies[0] || ALL_COMPETENCIES_OPTION,
      });
      const savedAt = new Date().toISOString();
      persistCurriculumDraft(nextSnapshot, { savedAt });
      recordCurriculumVersion(
        nextSnapshot,
        tt("AI oppdatering", "AI update"),
        { savedAt },
      );
      setSelectedProjectTemplateId(recommendedProjectTemplateId);

      const recommendedCompetencyName = String(
        recommendation.competencyName || "",
      ).trim();
      if (recommendedCompetencyName) {
        setNewCompetency(recommendedCompetencyName);
        if (!activeCourse?.id) {
          setShowCompetencyComposer(true);
        }
      }

      setFoundationInterviewRationale(
        Array.isArray(recommendation.rationale)
          ? recommendation.rationale
              .map((item) => String(item || "").trim())
              .filter((item) => item.length > 0)
              .slice(0, 4)
          : [],
      );
    },
    [
      activeCourse?.id,
      applyCurriculumSnapshot,
      architectureDraft.competencyMap,
      architectureDraft.studioSuggestions,
      persistCurriculumDraft,
      recordCurriculumVersion,
      selectedLeadInstructorId,
      tt,
    ],
  );

  const competencyDropdownItems = useMemo(
    () => normalizeList(competencyItems),
    [competencyItems],
  );

  useEffect(() => {
    curriculumSkipAutosaveRef.current = true;
    const persistedSnapshot = normalizeCurriculumFoundationSnapshot({
      architecture: toArchitectureDraft(activeCourse),
      selectedProjectTemplateId: String(
        activeCourse?.curriculumProjectTemplateId || "",
      ).trim(),
      selectedLeadInstructorId: String(
        activeCourse?.competencyLeadInstructorId ||
          activeCourse?.instructor?.id ||
          "",
      ).trim(),
      selectedCompetencyName: ALL_COMPETENCIES_OPTION,
    });
    const draftEntry = readCurriculumFoundationDraftEntry(
      curriculumFoundationScopeId,
    );
    const shouldRestoreDraft = Boolean(
      draftEntry &&
        (!activeCourse?.updatedAt ||
          new Date(draftEntry.savedAt).getTime() >=
            new Date(activeCourse.updatedAt).getTime()),
    );
    applyCurriculumSnapshot(
      shouldRestoreDraft && draftEntry ? draftEntry : persistedSnapshot,
      {
      savedAt: shouldRestoreDraft
        ? draftEntry?.savedAt
        : String(activeCourse?.updatedAt || "").trim() || undefined,
      selectedVersionId: "",
      },
    );
    const versionEntries = readCurriculumFoundationVersionEntries(
      curriculumFoundationScopeId,
    );
    setCurriculumVersionEntries(versionEntries);
    setSelectedCurriculumVersionId(versionEntries[0]?.id || "");
    if (!shouldRestoreDraft && !String(activeCourse?.updatedAt || "").trim()) {
      setCurriculumLastSavedAt("");
      setCurriculumAutosaveState("saved");
    }
    setNewProblem("");
    setNewCompetency("");
    setNewSkill("");
    setNewTransformation("");
    setNewSkillMapTitle("");
    setNewSkillMapFocus("");
    setSelectedFoundationTemplateId("");
    setFoundationTemplateName("");
    setFoundationEditorMode("simple");
    setActiveFoundationSection("clarify");
    setShowAdvancedFoundationFields(false);
    setExpandedSkillSuggestionIds([]);
    setExpandedQuizSuggestionIds([]);
    setExpandedAnnotationSuggestionIds([]);
    setFoundationInterviewAnswers([]);
    setFoundationInterviewQuestion(createInitialFoundationQuestion(tt));
    setFoundationInterviewInput("");
    setFoundationInterviewCompleted(false);
    setFoundationInterviewProvider("");
    setFoundationInterviewModel("");
    setFoundationInterviewGeneratedAt("");
    setFoundationInterviewRationale([]);
    setFoundationInterviewProgress(null);
    setFoundationInterviewSectionRationales([]);
    setFoundationInterviewIndustryProfile("");
    setFoundationInterviewDomainResolution(null);
    setFoundationInterviewGenerationStage(null);
    setFoundationInterviewTemplateMatch(null);
    setFoundationInterviewManualProfile("");
  }, [
    activeCourse,
    applyCurriculumSnapshot,
    curriculumFoundationScopeId,
    tt,
  ]);

  const requestFoundationInterview = useCallback(
    async (
      answers: CurriculumFoundationInterviewAnswer[],
      options?: {
        manualProfileOverride?: CurriculumFoundationIndustryProfile | "";
      },
    ) => {
      setFoundationInterviewLoading(true);
      const firstTopicAnswer = String(
        answers.find((entry) => entry.id === "competencyTopic")?.answer || "",
      ).trim();
      const firstTopicProfile = firstTopicAnswer
        ? inferFoundationIndustryProfile(firstTopicAnswer)
        : "generic";
      const activeCourseProfile = inferFoundationIndustryProfile(
        [
          activeCourse?.title || "",
          architectureDraft.purpose || "",
          architectureDraft.audience || "",
          ...(competencyItems || []),
          ...(skillItems || []),
        ].join(" "),
      );
      const isFirstTopicTurn =
        answers.length === 1 && answers[0]?.id === "competencyTopic";
      const shouldStartFresh =
        isFirstTopicTurn &&
        (firstTopicProfile !== "generic" ||
          !activeCourse?.id ||
          activeCourseProfile !== "generic");
      const requestCourseTitle =
        firstTopicAnswer ||
        String(activeCourse?.title || "").trim() ||
        String(newCompetency || "").trim();
      const manualProfileOverride =
        typeof options?.manualProfileOverride === "string"
          ? options.manualProfileOverride
          : foundationInterviewManualProfile;
      const requestArchitecture = shouldStartFresh
        ? emptyArchitecture
        : {
            ...architectureDraft,
            problemsSolved: problemItems,
            competencies: competencyItems,
            skills: skillItems,
            transformations: transformationItems,
          };

      try {
        const response = (await apiRequest(
          "/api/academy/curriculum/foundation-assistant",
          {
            method: "POST",
            body: {
              provider: "auto",
              useNorwegian: isNorwegian,
              courseId: activeCourse?.id || "",
              courseTitle: requestCourseTitle,
              answers,
              currentArchitecture: requestArchitecture,
              manualIndustryProfile: manualProfileOverride || undefined,
              templateMemory: foundationTemplateMemory,
            },
          },
        )) as CurriculumFoundationInterviewApiResponse;

        const payload =
          response && typeof response === "object" ? response.data : null;
        if (!payload) {
          throw new Error(
            tt(
              "AI-guiden returnerte ikke gyldige data.",
              "AI guide did not return valid data.",
            ),
          );
        }

        const normalizedAnswers = Array.isArray(payload.answers)
          ? payload.answers
              .map((entry) => {
                if (!entry || typeof entry !== "object") return null;
                const id = String(entry.id || "").trim();
                const question = String(entry.question || "").trim();
                const answer = String(entry.answer || "").trim();
                if (!id || !question || !answer) return null;
                return {
                  id: id as CurriculumFoundationInterviewQuestionId,
                  question,
                  answer,
                } satisfies CurriculumFoundationInterviewAnswer;
              })
              .filter(
                (entry): entry is CurriculumFoundationInterviewAnswer =>
                  Boolean(entry),
              )
          : answers;

        setFoundationInterviewAnswers(normalizedAnswers);
        setFoundationInterviewCompleted(Boolean(payload.completed));
        setFoundationInterviewQuestion(
          payload.nextQuestion && typeof payload.nextQuestion === "object"
            ? {
                id: String(payload.nextQuestion.id || "contextConstraint")
                  .trim() as CurriculumFoundationInterviewQuestionId,
                question: String(payload.nextQuestion.question || "").trim(),
                placeholder: String(
                  payload.nextQuestion.placeholder || "",
                ).trim(),
                helpText: String(payload.nextQuestion.helpText || "").trim(),
                suggestions: Array.isArray(payload.nextQuestion.suggestions)
                  ? payload.nextQuestion.suggestions
                      .map((entry) => String(entry || "").trim())
                      .filter((entry) => entry.length > 0)
                      .slice(0, 6)
                  : [],
              }
            : null,
        );
        setFoundationInterviewProvider(
          String(payload.meta?.provider || "").trim(),
        );
        setFoundationInterviewModel(String(payload.meta?.model || "").trim());
        setFoundationInterviewIndustryProfile(
          String(payload.meta?.industryProfile || "").trim() as CurriculumFoundationIndustryProfile,
        );
        setFoundationInterviewDomainResolution(
          payload.meta?.domainResolution &&
            typeof payload.meta.domainResolution === "object"
            ? {
                profile: String(
                  payload.meta.domainResolution.profile || "generic",
                ).trim() as CurriculumFoundationIndustryProfile,
                label: String(payload.meta.domainResolution.label || "").trim(),
                confidence: Number(payload.meta.domainResolution.confidence || 0),
                source: String(
                  payload.meta.domainResolution.source || "heuristic",
                ).trim() as CurriculumFoundationDomainResolutionSource,
                needsConfirmation:
                  Boolean(payload.meta.domainResolution.needsConfirmation),
                reasoning: Array.isArray(payload.meta.domainResolution.reasoning)
                  ? payload.meta.domainResolution.reasoning
                      .map((entry) => String(entry || "").trim())
                      .filter((entry) => entry.length > 0)
                      .slice(0, 4)
                  : [],
                alternatives: Array.isArray(payload.meta.domainResolution.alternatives)
                  ? payload.meta.domainResolution.alternatives
                      .map((entry) => {
                        if (!entry || typeof entry !== "object") return null;
                        const profile = String(entry.profile || "").trim();
                        const label = String(entry.label || "").trim();
                        if (!profile || !label) return null;
                        return {
                          profile: profile as CurriculumFoundationIndustryProfile,
                          label,
                          confidence: Number(entry.confidence || 0),
                          source: String(entry.source || "heuristic").trim() as CurriculumFoundationDomainResolutionSource,
                        } satisfies CurriculumFoundationDomainCandidate;
                      })
                      .filter(
                        (
                          entry,
                        ): entry is CurriculumFoundationDomainCandidate =>
                          Boolean(entry),
                      )
                      .slice(0, 3)
                  : [],
              }
            : null,
        );
        setFoundationInterviewGenerationStage(
          payload.meta?.generationStage &&
            typeof payload.meta.generationStage === "object"
            ? {
                id: String(payload.meta.generationStage.id || "").trim(),
                label: String(payload.meta.generationStage.label || "").trim(),
                sectionsToRefresh: Array.isArray(
                  payload.meta.generationStage.sectionsToRefresh,
                )
                  ? payload.meta.generationStage.sectionsToRefresh
                      .map((entry) => String(entry || "").trim())
                      .filter((entry) => entry.length > 0)
                      .slice(0, 12)
                  : [],
                completedSections: Array.isArray(
                  payload.meta.generationStage.completedSections,
                )
                  ? payload.meta.generationStage.completedSections
                      .map((entry) => String(entry || "").trim())
                      .filter((entry) => entry.length > 0)
                      .slice(0, 12)
                  : [],
                nextSections: Array.isArray(
                  payload.meta.generationStage.nextSections,
                )
                  ? payload.meta.generationStage.nextSections
                      .map((entry) => String(entry || "").trim())
                      .filter((entry) => entry.length > 0)
                      .slice(0, 12)
                  : [],
              }
            : null,
        );
        setFoundationInterviewTemplateMatch(
          payload.meta?.templateMatch &&
            typeof payload.meta.templateMatch === "object"
            ? {
                id: String(payload.meta.templateMatch.id || "").trim(),
                name: String(payload.meta.templateMatch.name || "").trim(),
                confidence: Number(payload.meta.templateMatch.confidence || 0),
                profileHint: String(
                  payload.meta.templateMatch.profileHint || "generic",
                ).trim() as CurriculumFoundationIndustryProfile,
                sourceProjectTemplateId:
                  String(
                    payload.meta.templateMatch.sourceProjectTemplateId || "",
                  ).trim() || undefined,
              }
            : null,
        );
        setFoundationInterviewGeneratedAt(
          String(payload.meta?.generatedAt || "").trim(),
        );
        setFoundationInterviewProgress(
          payload.progress && typeof payload.progress === "object"
            ? {
                phase: String(payload.progress.phase || "").trim(),
                statusMessage: String(payload.progress.statusMessage || "").trim(),
                percent: Number(payload.progress.percent || 0),
                focusAreas: Array.isArray(payload.progress.focusAreas)
                  ? payload.progress.focusAreas
                      .map((entry) => String(entry || "").trim())
                      .filter((entry) => entry.length > 0)
                      .slice(0, 6)
                  : [],
                appliedSections: Array.isArray(payload.progress.appliedSections)
                  ? payload.progress.appliedSections
                      .map((entry) => String(entry || "").trim())
                      .filter((entry) => entry.length > 0)
                      .slice(0, 8)
                  : [],
              }
            : null,
        );
        setFoundationInterviewSectionRationales(
          Array.isArray(payload.sectionRationales)
            ? payload.sectionRationales
                .map((entry) => {
                  if (!entry || typeof entry !== "object") return null;
                  const section = String(entry.section || "").trim();
                  const reason = String(entry.reason || "").trim();
                  const evidence = String(entry.evidence || "").trim();
                  if (!section || !reason || !evidence) return null;
                  return { section, reason, evidence } satisfies CurriculumFoundationInterviewSectionRationale;
                })
                .filter(
                  (entry): entry is CurriculumFoundationInterviewSectionRationale =>
                    Boolean(entry),
                )
                .slice(0, 6)
            : [],
        );
        applyFoundationRecommendation(payload.recommendation || null);
        setSaveMessage(
          payload.completed
            ? tt(
                "AI-guiden fullførte kompetansegrunnlaget og oppdaterte utkastet.",
                "AI guide completed the competency foundation and updated the draft.",
              )
            : tt(
                "AI-guiden oppdaterte utkastet og foreslo neste spørsmål.",
                "AI guide updated the draft and suggested the next question.",
              ),
        );
        setActiveFoundationSection(
          payload.completed ? "structure" : "clarify",
        );
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : tt(
                "Kunne ikke hente AI-forslag til kompetansegrunnlag.",
                "Failed to fetch AI competency foundation suggestions.",
              );
        setSaveMessage(message);
      } finally {
        setFoundationInterviewLoading(false);
      }
    },
    [
      activeCourse?.id,
      activeCourse?.title,
      applyFoundationRecommendation,
      architectureDraft,
      competencyItems,
      foundationInterviewManualProfile,
      foundationTemplateMemory,
      isNorwegian,
      newCompetency,
      problemItems,
      skillItems,
      transformationItems,
      tt,
    ],
  );

  const resetFoundationInterview = useCallback(() => {
    setFoundationInterviewAnswers([]);
    setFoundationInterviewQuestion(createInitialFoundationQuestion(tt));
    setFoundationInterviewInput("");
    setFoundationInterviewCompleted(false);
    setFoundationInterviewProvider("");
    setFoundationInterviewModel("");
    setFoundationInterviewGeneratedAt("");
    setFoundationInterviewRationale([]);
    setFoundationInterviewProgress(null);
    setFoundationInterviewSectionRationales([]);
    setFoundationInterviewIndustryProfile("");
    setFoundationInterviewDomainResolution(null);
    setFoundationInterviewGenerationStage(null);
    setFoundationInterviewTemplateMatch(null);
    setFoundationInterviewManualProfile("");
    if (!activeCourse?.id) {
      setSelectedProjectTemplateId("");
    }
  }, [activeCourse?.id, tt]);

  const handleFoundationManualProfileChange = useCallback(
    async (nextValue: string) => {
      const normalizedValue = String(nextValue || "").trim();
      const nextProfile = normalizedValue as CurriculumFoundationIndustryProfile | "";
      setFoundationInterviewManualProfile(nextProfile);
      if (foundationInterviewAnswers.length === 0) return;
      await requestFoundationInterview(foundationInterviewAnswers, {
        manualProfileOverride: nextProfile,
      });
    },
    [foundationInterviewAnswers, requestFoundationInterview],
  );

  const submitFoundationInterviewAnswer = useCallback(
    async (answerOverride?: string) => {
      if (!foundationInterviewQuestion) return;
      const rawAnswer =
        typeof answerOverride === "string"
          ? answerOverride
          : foundationInterviewInput;
      const trimmedAnswer = String(rawAnswer || "").trim();
      if (!trimmedAnswer) {
        setSaveMessage(
          tt(
            "Svar på spørsmålet før du går videre.",
            "Answer the question before continuing.",
          ),
        );
        return;
      }

      const nextAnswers = [
        ...foundationInterviewAnswers,
        {
          id: foundationInterviewQuestion.id,
          question: foundationInterviewQuestion.question,
          answer: trimmedAnswer,
        } satisfies CurriculumFoundationInterviewAnswer,
      ];
      setFoundationInterviewInput("");
      await requestFoundationInterview(nextAnswers);
    },
    [
      foundationInterviewAnswers,
      foundationInterviewInput,
      foundationInterviewQuestion,
      requestFoundationInterview,
      tt,
    ],
  );

  const skipFoundationInterviewQuestion = useCallback(async () => {
    await submitFoundationInterviewAnswer(
      tt("Ikke spesifisert ennå", "Not specified yet"),
    );
  }, [submitFoundationInterviewAnswer, tt]);

  useEffect(() => {
    if (selectedCompetencyName === ALL_COMPETENCIES_OPTION) return;
    const exists = competencyDropdownItems.some(
      (item) =>
        item.trim().toLowerCase() === selectedCompetencyName.toLowerCase(),
    );
    if (exists) return;
    setSelectedCompetencyName(ALL_COMPETENCIES_OPTION);
  }, [competencyDropdownItems, selectedCompetencyName]);

  useEffect(() => {
    if (!shouldOpenCompetencyComposer) return;
    setShowCompetencyComposer(true);

    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (!params.has("createCompetency")) return;
    params.delete("createCompetency");
    const nextQuery = params.toString();
    const nextUrl = nextQuery
      ? `${window.location.pathname}?${nextQuery}`
      : window.location.pathname;
    window.history.replaceState(window.history.state, "", nextUrl);
  }, [shouldOpenCompetencyComposer]);

  useEffect(() => {
    if (!showCompetencyComposer) return;
    competencyComposerRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, [showCompetencyComposer]);

  useEffect(() => {
    if (!showCompetencyComposer || typeof window === "undefined") return;
    const rafId = window.requestAnimationFrame(() => {
      competencyNameInputRef.current?.focus();
      competencyNameInputRef.current?.select();
    });
    return () => window.cancelAnimationFrame(rafId);
  }, [showCompetencyComposer]);

  useEffect(() => {
    analytics.trackEvent("academy_curriculum_studio_opened", {
      courseId: activeCourse?.id || null,
      section: "pedagogical_architecture",
      timestamp: Date.now(),
    });

    debugging.logIntegration("info", "AcademyCurriculumStudio opened", {
      courseId: activeCourse?.id || null,
      mode: "pedagogical-architecture",
    });
  }, [activeCourse?.id, analytics, debugging]);

  const loadSavedFoundationTemplate = useCallback(
    (templateIdArg?: string) => {
      const templateId = String(
        templateIdArg ?? selectedFoundationTemplateId,
      ).trim();
      if (!templateId) {
        setSaveMessage(
          tt("Velg en lagret mal først.", "Select a saved template first."),
        );
        return;
      }

      const template = savedFoundationTemplates.find(
        (entry) => String(entry.id).trim() === templateId,
      );
      if (!template) {
        setSaveMessage(
          tt("Fant ikke den lagrede malen.", "Saved template not found."),
        );
        return;
      }

      const normalized = normalizeArchitecture(template.architecture);
      const nextSnapshot = applyCurriculumSnapshot({
        architecture: normalized,
        selectedProjectTemplateId: template.sourceProjectTemplateId || "",
        selectedLeadInstructorId,
        selectedCompetencyName:
          normalized.competencies[0] || ALL_COMPETENCIES_OPTION,
      });
      const savedAt = new Date().toISOString();
      persistCurriculumDraft(nextSnapshot, { savedAt });
      recordCurriculumVersion(
        nextSnapshot,
        tt("Hentet mal", "Loaded template"),
        { savedAt },
      );
      setFoundationTemplateName(template.name);
      setSelectedFoundationTemplateId(template.id);
      setSelectedProjectTemplateId(template.sourceProjectTemplateId || "");
      setSaveMessage(
        tt(
          "Lagret kompetansegrunnlagsmal lastet inn i utkastet.",
          "Saved competency foundation template loaded into the draft.",
        ),
      );
    },
    [
      applyCurriculumSnapshot,
      persistCurriculumDraft,
      recordCurriculumVersion,
      savedFoundationTemplates,
      selectedFoundationTemplateId,
      selectedLeadInstructorId,
      tt,
    ],
  );

  const saveCurrentAsFoundationTemplate = useCallback(() => {
    const normalizedArchitecture = normalizeArchitecture({
      ...architectureDraft,
      problemsSolved: problemItems,
      competencies: competencyItems,
      skills: skillItems,
      transformations: transformationItems,
    });
    const suggestedName = String(
      foundationTemplateName ||
        normalizedArchitecture.competencies[0] ||
        newCompetency ||
        activeCourse?.title ||
        tt("Kompetansegrunnlag", "Competency foundation"),
    ).trim();

    if (!suggestedName) {
      setSaveMessage(
        tt("Gi malen et navn først.", "Enter a template name first."),
      );
      return;
    }

    const timestamp = new Date().toISOString();
    const existingTemplate = selectedFoundationTemplateId
      ? savedFoundationTemplates.find(
          (template) =>
            String(template.id).trim() ===
            String(selectedFoundationTemplateId).trim(),
        ) || null
      : null;

    const nextTemplate: SavedCurriculumFoundationTemplate = {
      id:
        existingTemplate?.id ||
        `foundation-template-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: suggestedName,
      architecture: normalizedArchitecture,
      sourceProjectTemplateId:
        String(selectedProjectTemplateId || "").trim() || undefined,
      createdAt: existingTemplate?.createdAt || timestamp,
      updatedAt: timestamp,
    };

    const nextTemplates = normalizeSavedFoundationTemplates(
      existingTemplate
        ? savedFoundationTemplates.map((template) =>
            template.id === existingTemplate.id ? nextTemplate : template,
          )
        : [nextTemplate, ...savedFoundationTemplates],
    );

    writeSavedFoundationTemplates(nextTemplates);
    setSavedFoundationTemplates(nextTemplates);
    setSelectedFoundationTemplateId(nextTemplate.id);
    setFoundationTemplateName(nextTemplate.name);
    setSaveMessage(
      existingTemplate
        ? tt(
            "Kompetansegrunnlagsmal oppdatert.",
            "Competency foundation template updated.",
          )
        : tt(
            "Kompetansegrunnlagsmal lagret.",
            "Competency foundation template saved.",
          ),
    );
  }, [
    activeCourse?.title,
    architectureDraft,
    competencyItems,
    foundationTemplateName,
    newCompetency,
    problemItems,
    savedFoundationTemplates,
    selectedFoundationTemplateId,
    selectedProjectTemplateId,
    skillItems,
    transformationItems,
    tt,
  ]);

  const deleteSavedFoundationTemplate = useCallback(() => {
    const templateId = String(selectedFoundationTemplateId || "").trim();
    if (!templateId) {
      setSaveMessage(
        tt("Velg en lagret mal først.", "Select a saved template first."),
      );
      return;
    }

    const nextTemplates = savedFoundationTemplates.filter(
      (template) => String(template.id).trim() !== templateId,
    );
    writeSavedFoundationTemplates(nextTemplates);
    setSavedFoundationTemplates(nextTemplates);
    setSelectedFoundationTemplateId("");
    setFoundationTemplateName("");
    setSaveMessage(
      tt(
        "Kompetansegrunnlagsmal slettet.",
        "Competency foundation template deleted.",
      ),
    );
  }, [savedFoundationTemplates, selectedFoundationTemplateId, tt]);

  const filledSectionCount = useMemo(() => {
    const normalized = normalizeArchitecture({
      ...architectureDraft,
      problemsSolved: problemItems,
      competencies: competencyItems,
      skills: skillItems,
      transformations: transformationItems,
    });
    const sections = [
      normalized.purpose,
      normalized.audience,
      normalized.transformation,
      normalized.competencies.join(" "),
      normalized.skills.join(" "),
      normalized.transformations.join(" "),
      normalizeSkillMapItems(normalized.skillMap)
        .map((item) => `${item.title} ${item.focus}`.trim())
        .join(" "),
      normalizeCompetencyMapItems(normalized.competencyMap)
        .map((item) =>
          [
            item.title,
            item.description,
            ...item.basic,
            ...item.operational,
            ...item.advanced,
          ]
            .join(" ")
            .trim(),
        )
        .join(" "),
      normalized.problemsSolved.join(" "),
      normalized.learningJourney,
      normalized.practiceDesign,
      normalized.proofOfLearning,
      normalizeStudioSuggestions(normalized.studioSuggestions).skills
        .map((item) => `${item.title} ${item.objective}`.trim())
        .join(" "),
      normalizeStudioSuggestions(normalized.studioSuggestions).quiz
        .map((item) => item.prompt.trim())
        .join(" "),
      normalizeStudioSuggestions(normalized.studioSuggestions).annotations
        .map((item) => `${item.title} ${item.content}`.trim())
        .join(" "),
    ];

    return sections.filter((value) => value.trim().length > 0).length;
  }, [
    architectureDraft,
    competencyItems,
    problemItems,
    skillItems,
    transformationItems,
  ]);

  const currentCurriculumSnapshot = useMemo(
    () => buildCurriculumSnapshot(),
    [buildCurriculumSnapshot],
  );

  const currentCurriculumSignature = useMemo(
    () => createCurriculumFoundationSignature(currentCurriculumSnapshot),
    [currentCurriculumSnapshot],
  );

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    if (curriculumSkipAutosaveRef.current) {
      curriculumSkipAutosaveRef.current = false;
      return undefined;
    }
    if (curriculumHydratedSignatureRef.current === currentCurriculumSignature) {
      curriculumHydratedSignatureRef.current = "";
      return undefined;
    }
    setCurriculumAutosaveState("unsaved");
    const timeoutId = window.setTimeout(() => {
      setCurriculumAutosaveState("saving");
      persistCurriculumDraft(currentCurriculumSnapshot, {
        savedAt: new Date().toISOString(),
      });
    }, 1200);
    return () => window.clearTimeout(timeoutId);
  }, [
    currentCurriculumSignature,
    currentCurriculumSnapshot,
    persistCurriculumDraft,
  ]);

  const autosaveStatusLabel = useMemo(() => {
    if (curriculumAutosaveState === "saving") {
      return tt("Lagrer utkast…", "Saving draft…");
    }
    if (curriculumAutosaveState === "unsaved") {
      return tt("Ulagrede endringer", "Unsaved changes");
    }
    if (curriculumLastSavedAt) {
      return `${tt("Lagret", "Saved")} ${new Date(
        curriculumLastSavedAt,
      ).toLocaleTimeString(isNorwegian ? "no-NO" : "en-US", {
        hour: "2-digit",
        minute: "2-digit",
      })}`;
    }
    return tt("Utkast klart", "Draft ready");
  }, [curriculumAutosaveState, curriculumLastSavedAt, isNorwegian, tt]);

  const restoreCurriculumVersion = useCallback(
    (versionId: string) => {
      const targetVersion = curriculumVersionEntries.find(
        (entry) => entry.id === versionId,
      );
      if (!targetVersion) return;
      const savedAt = new Date().toISOString();
      const restoredSnapshot = applyCurriculumSnapshot(targetVersion, {
        savedAt,
        selectedVersionId: versionId,
      });
      persistCurriculumDraft(restoredSnapshot, { savedAt });
      recordCurriculumVersion(
        restoredSnapshot,
        tt("Gjenopprettet versjon", "Restored version"),
        { savedAt },
      );
      setSaveMessage(
        tt(
          "Kompetansegrunnlag gjenopprettet fra versjonshistorikk.",
          "Competency foundation restored from version history.",
        ),
      );
    },
    [
      applyCurriculumSnapshot,
      curriculumVersionEntries,
      persistCurriculumDraft,
      recordCurriculumVersion,
      tt,
    ],
  );

  const foundationStepStatuses = useMemo(() => {
    const clarifyReady =
      foundationInterviewAnswers.length > 0 ||
      Boolean(
        String(architectureDraft.purpose || "").trim() ||
          String(architectureDraft.audience || "").trim() ||
          String(architectureDraft.transformation || "").trim(),
      );
    const structureReady =
      competencyItems.some((item) => String(item || "").trim().length > 0) &&
      skillItems.some((item) => String(item || "").trim().length > 0);
    const suggestionsReady =
      studioSuggestions.skills.length > 0 ||
      studioSuggestions.quiz.length > 0 ||
      studioSuggestions.annotations.length > 0;
    const templatesReady =
      savedFoundationTemplates.length > 0 ||
      Boolean(String(foundationTemplateName || "").trim());
    return {
      clarify: clarifyReady,
      structure: structureReady,
      suggestions: suggestionsReady,
      templates: templatesReady,
    };
  }, [
    architectureDraft.audience,
    architectureDraft.purpose,
    architectureDraft.transformation,
    foundationInterviewAnswers.length,
    foundationTemplateName,
    savedFoundationTemplates.length,
    skillItems,
    studioSuggestions.annotations.length,
    studioSuggestions.quiz.length,
    studioSuggestions.skills.length,
    competencyItems,
  ]);

  const foundationSummary = useMemo(() => {
    const leadCompetency =
      normalizeList(competencyItems)[0] ||
      normalizeCompetencyMapItems(architectureDraft.competencyMap, true)[0]?.title ||
      String(newCompetency || "").trim() ||
      tt("Ikke definert ennå", "Not defined yet");
    const leadAudience =
      String(architectureDraft.audience || "").trim() ||
      tt("Målgruppe er ikke definert ennå.", "Audience is not defined yet.");
    const leadTransformation =
      String(architectureDraft.transformation || "").trim() ||
      tt(
        "Transformasjonen er ikke definert ennå.",
        "The transformation is not defined yet.",
      );
    const leadSkills = normalizeList(skillItems).slice(0, 3);
    return {
      title: leadCompetency,
      audience: leadAudience,
      transformation: leadTransformation,
      skills:
        leadSkills.length > 0
          ? leadSkills
          : [tt("Ingen ferdigheter valgt ennå.", "No skills selected yet.")],
    };
  }, [
    architectureDraft.audience,
    architectureDraft.competencyMap,
    architectureDraft.transformation,
    competencyItems,
    newCompetency,
    skillItems,
    tt,
  ]);

  const vidsPresenterPlanInput = useMemo(
    () => ({
      courseTitle:
        String(activeCourse?.title || "").trim() || foundationSummary.title,
      purpose: architectureDraft.purpose,
      audience: architectureDraft.audience,
      transformation: architectureDraft.transformation,
      competencies: competencyItems,
      skills: skillItems,
      problemsSolved: problemItems,
      learningJourney: architectureDraft.learningJourney,
      practiceDesign: architectureDraft.practiceDesign,
      proofOfLearning: architectureDraft.proofOfLearning,
    }),
    [
      activeCourse?.title,
      architectureDraft.audience,
      architectureDraft.learningJourney,
      architectureDraft.practiceDesign,
      architectureDraft.proofOfLearning,
      architectureDraft.purpose,
      architectureDraft.transformation,
      competencyItems,
      foundationSummary.title,
      problemItems,
      skillItems,
    ],
  );

  const generatedVidsPresenterPlan = useMemo(
    () =>
      buildAcademyVidsPresenterPlan(vidsPresenterPlanInput, {
        useNorwegian: isNorwegian,
      }),
    [isNorwegian, vidsPresenterPlanInput],
  );

  const googleProductionWorkflowSeed = useMemo(
    () =>
      mergeGoogleProductionWorkflowDraft(
        activeCourse?.googleProductionWorkflow,
        generatedVidsPresenterPlan.scenes,
      ),
    [activeCourse?.googleProductionWorkflow, generatedVidsPresenterPlan.scenes],
  );

  useEffect(() => {
    const nextCourseId = String(activeCourse?.id || "");
    setGoogleProductionWorkflowDraft((previous) => {
      if (googleProductionWorkflowCourseRef.current !== nextCourseId) {
        googleProductionWorkflowCourseRef.current = nextCourseId;
        return googleProductionWorkflowSeed;
      }

      return mergeGoogleProductionWorkflowDraft(
        previous,
        generatedVidsPresenterPlan.scenes,
      );
    });
  }, [
    activeCourse?.id,
    generatedVidsPresenterPlan.scenes,
    googleProductionWorkflowSeed,
  ]);

  const productionSceneDrafts = useMemo(() => {
    const draftScenes = Array.isArray(googleProductionWorkflowDraft.sceneDrafts)
      ? googleProductionWorkflowDraft.sceneDrafts
      : [];
    return draftScenes.length > 0
      ? draftScenes
      : googleProductionWorkflowSeed.sceneDrafts || [];
  }, [googleProductionWorkflowDraft.sceneDrafts, googleProductionWorkflowSeed.sceneDrafts]);

  const vidsPresenterPlan = useMemo(
    () =>
      buildAcademyVidsPresenterPlanFromScenes(
        vidsPresenterPlanInput,
        productionSceneDrafts.map((scene) => ({
          id: scene.id,
          title: scene.title,
          objective: scene.objective,
          recordingMode: scene.recordingMode,
          durationMinutes: scene.durationMinutes,
          visualCue: scene.visualCue,
          whyThisMode: scene.whyThisMode,
          teleprompterScript: scene.teleprompterScript,
        })),
        { useNorwegian: isNorwegian },
      ),
    [isNorwegian, productionSceneDrafts, vidsPresenterPlanInput],
  );

  const googleWorkspaceStatusQuery = useQuery({
    queryKey: ["academy-google-workspace-status"],
    queryFn: () => academyGoogleWorkspaceService.getStatus(),
  });

  const googleWorkspaceStatus = googleWorkspaceStatusQuery.data;
  const googleWorkspaceConnected =
    academyGoogleWorkspaceService.hasActiveConnection(googleWorkspaceStatus);
  const googleWorkspaceDriveReady =
    academyGoogleWorkspaceService.hasDriveAccess(googleWorkspaceStatus);
  const googleWorkspaceDocsReady =
    academyGoogleWorkspaceService.hasDocsAccess(googleWorkspaceStatus);
  const googleWorkflowReady =
    googleWorkspaceConnected &&
    googleWorkspaceDriveReady &&
    googleWorkspaceDocsReady;
  const googleWorkspaceEmail =
    String(googleWorkspaceStatus?.connection?.googleEmail || "").trim() ||
    undefined;

  const googleWorkspaceConnectMutation = useMutation({
    mutationFn: async () => {
      const fallbackPath =
        activeCourse?.id &&
        typeof window === "undefined"
          ? `/academy/curriculum?courseId=${encodeURIComponent(String(activeCourse.id))}`
          : undefined;
      await academyGoogleWorkspaceService.startConnect(fallbackPath);
    },
    onError: (error) => {
      setSaveMessage(
        error instanceof Error
          ? error.message
          : tt(
              "Kunne ikke starte Google-innloggingen.",
              "Could not start the Google sign-in flow.",
            ),
      );
    },
  });

  const googleVidsWorkspaceSnapshot = useMemo(
    () =>
      activeCourse?.id
        ? {
            courseId: String(activeCourse.id),
            title:
              String(activeCourse.title || "").trim() || foundationSummary.title,
            subtitle: vidsPresenterPlan.subtitle,
            purpose: String(architectureDraft.purpose || "").trim() || null,
            audience: String(architectureDraft.audience || "").trim() || null,
            transformation:
              String(architectureDraft.transformation || "").trim() || null,
            competencies: normalizeList(competencyItems),
            skills: normalizeList(skillItems),
            problemsSolved: normalizeList(problemItems),
            learningJourney:
              String(architectureDraft.learningJourney || "").trim() || null,
            practiceDesign:
              String(architectureDraft.practiceDesign || "").trim() || null,
            proofOfLearning:
              String(architectureDraft.proofOfLearning || "").trim() || null,
            readiness: vidsPresenterPlan.readiness,
            primaryMode: vidsPresenterPlan.primaryMode,
            totalDurationMinutes: vidsPresenterPlan.totalDurationMinutes,
            missingFields: vidsPresenterPlan.missingFields,
            setupChecklist: vidsPresenterPlan.setupChecklist,
            productionNotes: vidsPresenterPlan.productionNotes,
            starterPrompt: vidsPresenterPlan.starterPrompt,
            brief: vidsPresenterPlan.brief,
            teleprompterScript: vidsPresenterPlan.teleprompterScript,
            scenes: vidsPresenterPlan.scenes,
            locale: isNorwegian ? "no" : "en",
          }
        : null,
    [
      activeCourse?.id,
      activeCourse?.title,
      architectureDraft.audience,
      architectureDraft.learningJourney,
      architectureDraft.practiceDesign,
      architectureDraft.proofOfLearning,
      architectureDraft.purpose,
      architectureDraft.transformation,
      competencyItems,
      foundationSummary.title,
      isNorwegian,
      problemItems,
      skillItems,
      vidsPresenterPlan,
    ],
  );

  const googleVidsStatusQueryKey = useMemo(
    () =>
      [
        "academy-google-vids-status",
        String(activeCourse?.id || ""),
        String(activeCourse?.title || ""),
      ] as const,
    [activeCourse?.id, activeCourse?.title],
  );

  const persistGoogleProductionWorkflow = useCallback(
    async (
      workflow: AcademyGoogleProductionWorkflow,
      successMessage?: string,
    ): Promise<AcademyGoogleProductionWorkflow> => {
      const normalizedWorkflow = mergeGoogleProductionWorkflowDraft(
        {
          ...workflow,
          googleRequired: true,
          googleConnectedEmail:
            googleWorkspaceEmail ||
            String(workflow.googleConnectedEmail || "").trim() ||
            undefined,
          updatedAt: new Date().toISOString(),
        },
        generatedVidsPresenterPlan.scenes,
      );
      setGoogleProductionWorkflowDraft(normalizedWorkflow);

      if (!activeCourse?.id) {
        if (successMessage) {
          setSaveMessage(successMessage);
        }
        return normalizedWorkflow;
      }

      const nowIso = new Date().toISOString();
      const nextCourse: Course = {
        ...activeCourse,
        googleProductionWorkflow: {
          ...normalizedWorkflow,
          updatedAt: nowIso,
        },
        updatedAt: nowIso,
      };

      await updateCourse(nextCourse);
      setCurrentCourse(nextCourse);
      if (successMessage) {
        setSaveMessage(successMessage);
      }
      return nextCourse.googleProductionWorkflow || normalizedWorkflow;
    },
    [
      activeCourse,
      generatedVidsPresenterPlan.scenes,
      googleWorkspaceEmail,
      setCurrentCourse,
      updateCourse,
    ],
  );

  const googleVidsStatusQuery = useQuery({
    queryKey: googleVidsStatusQueryKey,
    enabled: Boolean(activeCourse?.id),
    queryFn: () =>
      academyGoogleVidsService.getStatus({
        courseId: String(activeCourse?.id || ""),
        courseTitle: String(activeCourse?.title || "").trim() || undefined,
      }),
  });

  const googleVidsSyncMutation = useMutation({
    mutationFn: async () => {
      if (!googleWorkflowReady) {
        throw new Error(
          tt(
            "Logg inn med Google-kontoen din før du synker Vids-dokumentene.",
            "Sign in with your Google account before syncing the Vids documents.",
          ),
        );
      }
      if (!googleVidsWorkspaceSnapshot) {
        throw new Error(
          tt(
            "Fant ikke kursutkast for Google Vids-synk.",
            "Could not build a course draft for Google Vids sync.",
          ),
        );
      }

      return academyGoogleVidsService.sync({
        courseId: googleVidsWorkspaceSnapshot.courseId,
        courseTitle: googleVidsWorkspaceSnapshot.title,
        snapshot: googleVidsWorkspaceSnapshot,
      });
    },
    onSuccess: async (status) => {
      queryClient.setQueryData(googleVidsStatusQueryKey, status);
      void queryClient.invalidateQueries({
        queryKey: ["academy-google-vids-status"],
      });
      await persistGoogleProductionWorkflow({
        ...googleProductionWorkflowDraft,
        googleRequired: true,
        googleConnectedEmail:
          status.googleEmail || googleWorkspaceEmail || undefined,
        lastVidsSyncAt:
          status.workspace?.lastSyncedAt || new Date().toISOString(),
      });
      setSaveMessage(
        tt(
          "Google Vids-brief og teleprompter synket til Drive.",
          "Google Vids brief and teleprompter synced to Drive.",
        ),
      );
      analytics.trackEvent("academy_google_vids_workspace_synced", {
        courseId: activeCourse?.id || null,
        sceneCount: status.workspace?.sceneCount || vidsPresenterPlan.scenes.length,
        timestamp: Date.now(),
      });
    },
    onError: (error) => {
      const message =
        error instanceof Error
          ? error.message
          : tt(
              "Kunne ikke synke Google Vids-dokumentene akkurat naa.",
              "Could not sync the Google Vids documents right now.",
            );
      setSaveMessage(message);
      debugging.logIntegration(
        "error",
        "Academy Google Vids workspace sync failed",
        {
          message,
          courseId: activeCourse?.id || null,
        },
      );
    },
  });

  const googleVidsStatus = googleVidsStatusQuery.data;
  const googleVidsWorkspace = googleVidsStatus?.workspace || null;

  const copyTextToClipboard = useCallback(
    async (value: string, successMessage: string) => {
      const normalizedValue = String(value || "").trim();
      if (!normalizedValue) {
        setSaveMessage(
          tt(
            "Det er ikke noe klart innhold å kopiere ennå.",
            "There is no ready content to copy yet.",
          ),
        );
        return;
      }

      try {
        if (
          typeof navigator === "undefined" ||
          !navigator.clipboard ||
          typeof navigator.clipboard.writeText !== "function"
        ) {
          throw new Error("Clipboard unavailable");
        }

        await navigator.clipboard.writeText(normalizedValue);
        setSaveMessage(successMessage);
      } catch {
        setSaveMessage(
          tt(
            "Kunne ikke kopiere til utklippstavlen automatisk.",
            "Could not copy to the clipboard automatically.",
          ),
        );
      }
    },
    [tt],
  );

  const openGoogleVidsComposer = useCallback(() => {
    if (!googleWorkflowReady) {
      googleWorkspaceConnectMutation.mutate();
      return;
    }
    academyGoogleVidsService.openGoogleVids(googleVidsStatus?.vidsUrl);
  }, [
    googleVidsStatus?.vidsUrl,
    googleWorkflowReady,
    googleWorkspaceConnectMutation,
  ]);

  const openGoogleVidsWorkspaceUrl = useCallback((url?: string | null) => {
    academyGoogleVidsService.openExternalUrl(url);
  }, []);

  const saveGoogleProductionWorkflow = useCallback(async () => {
    if (!activeCourse?.id) {
      setSaveMessage(
        tt(
          "Opprett eller velg et kurs før du lagrer opptaksplanen.",
          "Create or select a course before saving the recording plan.",
        ),
      );
      return;
    }

    setGoogleProductionWorkflowSaving(true);
    try {
      await persistGoogleProductionWorkflow(
        googleProductionWorkflowDraft,
        tt("Opptaksplan lagret.", "Recording plan saved."),
      );
    } catch (error) {
      setSaveMessage(
        error instanceof Error
          ? error.message
          : tt(
              "Kunne ikke lagre opptaksplanen.",
              "Could not save the recording plan.",
            ),
      );
    } finally {
      setGoogleProductionWorkflowSaving(false);
    }
  }, [
    activeCourse?.id,
    googleProductionWorkflowDraft,
    persistGoogleProductionWorkflow,
    tt,
  ]);

  const updateProductionSceneDraft = useCallback(
    (
      sceneId: string,
      field:
        | "title"
        | "objective"
        | "recordingMode"
        | "durationMinutes"
        | "visualCue"
        | "whyThisMode"
        | "teleprompterScript"
        | "notes"
        | "status",
      value: string,
    ) => {
      setGoogleProductionWorkflowDraft((previous) => {
        const sceneDrafts = Array.isArray(previous.sceneDrafts)
          ? previous.sceneDrafts
          : [];
        return {
          ...previous,
          sceneDrafts: sceneDrafts.map((scene) =>
            scene.id !== sceneId
              ? scene
              : {
                  ...scene,
                  [field]:
                    field === "durationMinutes"
                      ? Math.max(0.5, Number(value || scene.durationMinutes) || 0.5)
                      : field === "recordingMode"
                        ? normalizeProductionRecordingMode(
                            value,
                            scene.recordingMode,
                          )
                        : field === "status"
                          ? normalizeProductionSceneStatus(value)
                          : value,
                },
          ),
        };
      });
      setCurriculumAutosaveState("unsaved");
    },
    [],
  );

  const moveProductionScene = useCallback((sceneId: string, direction: -1 | 1) => {
    setGoogleProductionWorkflowDraft((previous) => {
      const sceneDrafts = Array.isArray(previous.sceneDrafts)
        ? [...previous.sceneDrafts]
        : [];
      const currentIndex = sceneDrafts.findIndex((scene) => scene.id === sceneId);
      if (currentIndex < 0) {
        return previous;
      }
      const nextIndex = currentIndex + direction;
      if (nextIndex < 0 || nextIndex >= sceneDrafts.length) {
        return previous;
      }
      const [scene] = sceneDrafts.splice(currentIndex, 1);
      sceneDrafts.splice(nextIndex, 0, scene);
      return {
        ...previous,
        sceneDrafts,
      };
    });
    setCurriculumAutosaveState("unsaved");
  }, []);

  const addProductionScene = useCallback(() => {
    setGoogleProductionWorkflowDraft((previous) => ({
      ...previous,
      sceneDrafts: [
        ...(Array.isArray(previous.sceneDrafts) ? previous.sceneDrafts : []),
        buildCustomProductionScene(
          isNorwegian,
          Array.isArray(previous.sceneDrafts) ? previous.sceneDrafts.length : 0,
        ),
      ],
    }));
    setCurriculumAutosaveState("unsaved");
  }, [isNorwegian]);

  const removeProductionScene = useCallback((sceneId: string) => {
    setGoogleProductionWorkflowDraft((previous) => ({
      ...previous,
      sceneDrafts: (Array.isArray(previous.sceneDrafts)
        ? previous.sceneDrafts
        : []
      ).filter((scene) => scene.id !== sceneId),
    }));
    setCurriculumAutosaveState("unsaved");
  }, []);

  const toggleProductionMilestone = useCallback(
    (
      field:
        | "recordingStartedAt"
        | "recordingCompletedAt"
        | "ctaApprovedAt"
        | "proofApprovedAt"
        | "runtimeApprovedAt",
      checked: boolean,
    ) => {
      setGoogleProductionWorkflowDraft((previous) => ({
        ...previous,
        [field]: checked ? new Date().toISOString() : undefined,
      }));
      setCurriculumAutosaveState("unsaved");
    },
    [],
  );

  const currentNormalizedArchitecture = useMemo(
    () =>
      normalizeArchitecture({
        ...architectureDraft,
        problemsSolved: problemItems,
        competencies: competencyItems,
        skills: skillItems,
        transformations: transformationItems,
      }),
    [
      architectureDraft,
      competencyItems,
      problemItems,
      skillItems,
      transformationItems,
    ],
  );

  const derivedLearningOutcomes = useMemo(
    () =>
      buildDerivedLearningOutcomes(
        currentNormalizedArchitecture,
        activeCourse?.learningOutcomes || [],
      ),
    [activeCourse?.learningOutcomes, currentNormalizedArchitecture],
  );

  const buildNotebookLmCourseSnapshot = useCallback(() => {
    if (!activeCourse?.id) {
      return null;
    }

    const courseResources = Array.isArray(activeCourse.resources)
      ? activeCourse.resources
          .map((resource) => ({
            id: String(resource.id || "").trim(),
            title: String(resource.title || "").trim(),
            type: String(resource.type || "link").trim() || "link",
            url: String(resource.url || "").trim() || undefined,
            description: String(resource.description || "").trim() || undefined,
            videoSourceType: resource.videoSourceType || undefined,
            googleDriveWebViewLink:
              String(resource.googleDriveWebViewLink || "").trim() || undefined,
            googleDrivePlaybackUrl:
              String(resource.googleDrivePlaybackUrl || "").trim() || undefined,
          }))
          .filter((resource) => Boolean(resource.id && resource.title))
      : [];

    const workspaceResources = [
      googleVidsWorkspace?.briefDocumentUrl
        ? {
            id: "google-vids-brief",
            title: tt("Google Vids brief", "Google Vids brief"),
            type: "link",
            url: googleVidsWorkspace.briefDocumentUrl,
            description: tt(
              "Brief-dokumentet som brukes til a starte Google Vids-opptaket.",
              "The brief document used to start the Google Vids recording flow.",
            ),
          }
        : null,
      googleVidsWorkspace?.teleprompterDocumentUrl
        ? {
            id: "google-vids-teleprompter",
            title: tt("Teleprompter-manus", "Teleprompter script"),
            type: "link",
            url: googleVidsWorkspace.teleprompterDocumentUrl,
            description: tt(
              "Scene-for-scene manus for Record myself i Google Vids.",
              "Scene-by-scene script for Record myself in Google Vids.",
            ),
          }
        : null,
    ].filter((resource): resource is NonNullable<typeof resource> => Boolean(resource));

    const existingLessons = Array.isArray(activeCourse.lessons)
      ? activeCourse.lessons
          .map((lesson) => ({
            id: String(lesson.id || "").trim(),
            title: String(lesson.title || "").trim(),
            description: String(lesson.description || "").trim() || undefined,
            duration: Number(lesson.duration || 0) || undefined,
            order: Number(lesson.order || 0) || 0,
            isPreview: Boolean(lesson.isPreview),
            videoUrl: String(lesson.videoUrl || "").trim() || undefined,
            videoSourceType: lesson.videoSourceType || undefined,
            googleDriveWebViewLink:
              String(lesson.googleDriveWebViewLink || "").trim() || undefined,
            googleDrivePlaybackUrl:
              String(lesson.googleDrivePlaybackUrl || "").trim() || undefined,
            resources: Array.isArray(lesson.resources)
              ? lesson.resources
                  .map((resource) => ({
                    id: String(resource.id || "").trim(),
                    title: String(resource.title || "").trim(),
                    type: String(resource.type || "link").trim() || "link",
                    url: String(resource.url || "").trim() || undefined,
                    description:
                      String(resource.description || "").trim() || undefined,
                    videoSourceType: resource.videoSourceType || undefined,
                    googleDriveWebViewLink:
                      String(resource.googleDriveWebViewLink || "").trim() ||
                      undefined,
                    googleDrivePlaybackUrl:
                      String(resource.googleDrivePlaybackUrl || "").trim() ||
                      undefined,
                  }))
                  .filter((resource) => Boolean(resource.id && resource.title))
              : [],
          }))
          .filter((lesson) => Boolean(lesson.id && lesson.title))
      : [];

    const sceneLessons =
      existingLessons.length > 0
        ? existingLessons
        : productionSceneDrafts.map((scene, index) => ({
            id: `vids-scene-${scene.id}`,
            title: scene.title,
            description: [scene.objective, scene.visualCue, scene.teleprompterScript]
              .filter(Boolean)
              .join("\n\n"),
            duration: Math.round(Number(scene.durationMinutes || 0) * 60) || undefined,
            order: index,
            isPreview: index === 0,
            videoUrl: undefined,
            videoSourceType: undefined,
            googleDriveWebViewLink: undefined,
            googleDrivePlaybackUrl: undefined,
            resources: [],
          }));

    return {
      courseId: String(activeCourse.id),
      title:
        String(activeCourse.title || "").trim() || foundationSummary.title,
      description:
        String(activeCourse.description || currentNormalizedArchitecture.purpose || "")
          .trim() || undefined,
      duration: Number(activeCourse.duration || 0) || undefined,
      level: String(activeCourse.level || "").trim() || undefined,
      category: String(activeCourse.category || "").trim() || undefined,
      tags: normalizeList(activeCourse.tags),
      prerequisites: normalizeList(activeCourse.prerequisites),
      learningOutcomes: derivedLearningOutcomes,
      instructorName: String(activeCourse.instructor?.name || "").trim() || undefined,
      videoUrl: String(activeCourse.videoUrl || "").trim() || undefined,
      videoSourceType: activeCourse.videoSourceType || undefined,
      googleDriveWebViewLink:
        String(activeCourse.googleDriveWebViewLink || "").trim() || undefined,
      googleDrivePlaybackUrl:
        String(activeCourse.googleDrivePlaybackUrl || "").trim() || undefined,
      resources: [...courseResources, ...workspaceResources],
      lessons: sceneLessons,
      focusLessonId: sceneLessons[0]?.id || undefined,
    };
  }, [
    activeCourse,
    currentNormalizedArchitecture.purpose,
    derivedLearningOutcomes,
    foundationSummary.title,
    googleVidsWorkspace?.briefDocumentUrl,
    googleVidsWorkspace?.teleprompterDocumentUrl,
    productionSceneDrafts,
    tt,
  ]);

  const notebookLmStatusQueryKey = useMemo(
    () =>
      [
        "academy-notebooklm-status",
        String(activeCourse?.id || ""),
        String(activeCourse?.title || ""),
      ] as const,
    [activeCourse?.id, activeCourse?.title],
  );

  const notebookLmStatusQuery = useQuery({
    queryKey: notebookLmStatusQueryKey,
    enabled: Boolean(activeCourse?.id),
    queryFn: () =>
      academyNotebookLmService.getStatus({
        courseId: String(activeCourse?.id || ""),
        courseTitle: String(activeCourse?.title || "").trim() || undefined,
      }),
  });

  const notebookLmSyncMutation = useMutation({
    mutationFn: async () => {
      if (!googleWorkflowReady) {
        throw new Error(
          tt(
            "Logg inn med Google-kontoen din før du synker NotebookLM-kildene.",
            "Sign in with your Google account before syncing NotebookLM sources.",
          ),
        );
      }

      const snapshot = buildNotebookLmCourseSnapshot();
      if (!snapshot) {
        throw new Error(
          tt(
            "Fant ikke kursutkast for NotebookLM-synk.",
            "Could not build a course draft for NotebookLM sync.",
          ),
        );
      }

      return academyNotebookLmService.sync({
        courseId: snapshot.courseId,
        courseTitle: snapshot.title,
        snapshot,
      });
    },
    onSuccess: async (status) => {
      queryClient.setQueryData(notebookLmStatusQueryKey, status);
      void queryClient.invalidateQueries({
        queryKey: ["academy-notebooklm-status"],
      });
      await persistGoogleProductionWorkflow({
        ...googleProductionWorkflowDraft,
        googleRequired: true,
        googleConnectedEmail:
          status.googleEmail || googleWorkspaceEmail || undefined,
        lastNotebookLmSyncAt:
          status.workspace?.lastSyncedAt || new Date().toISOString(),
      });
      setSaveMessage(
        tt(
          "NotebookLM-kilder synket fra kursgrunnlaget.",
          "NotebookLM sources synced from the course foundation.",
        ),
      );
      analytics.trackEvent("academy_curriculum_notebooklm_workspace_synced", {
        courseId: activeCourse?.id || null,
        sourceDocumentCount: status.sourceDocumentCount,
        timestamp: Date.now(),
      });
    },
    onError: (error) => {
      const message =
        error instanceof Error
          ? error.message
          : tt(
              "Kunne ikke synke NotebookLM-kildene akkurat naa.",
              "Could not sync NotebookLM sources right now.",
            );
      setSaveMessage(message);
      debugging.logIntegration(
        "error",
        "Academy curriculum NotebookLM workspace sync failed",
        {
          message,
          courseId: activeCourse?.id || null,
        },
      );
    },
  });

  const notebookLmStatus = notebookLmStatusQuery.data;
  const notebookLmWorkspace = notebookLmStatus?.workspace || null;
  const notebookLmCourseSummary =
    notebookLmStatus?.courseSummary || notebookLmWorkspace?.courseSummary || null;
  const notebookLmSourceDocuments = notebookLmStatus?.sourceDocuments || [];
  const notebookLmOpenUrl =
    String(
      notebookLmWorkspace?.metadata?.notebookLmUrl ||
        notebookLmStatus?.notebookLmUrl ||
        NOTEBOOK_LM_HOME_URL,
    ).trim() || NOTEBOOK_LM_HOME_URL;

  const googleDriveExportQuery = useQuery({
    queryKey: [
      "academy-google-vids-drive-exports",
      String(googleVidsWorkspace?.driveFolderId || ""),
    ],
    enabled: Boolean(googleWorkflowReady && googleVidsWorkspace?.driveFolderId),
    queryFn: async () => {
      const response = await academyGoogleWorkspaceService.listDriveFiles({
        folderId: googleVidsWorkspace?.driveFolderId || undefined,
        pageSize: 60,
      });
      return (Array.isArray(response.files) ? response.files : [])
        .filter((file) => isDriveExportVideo(file))
        .map((file) => mapDriveExportCandidate(file))
        .sort(
          (left, right) =>
            Date.parse(String(right.modifiedTime || "")) -
            Date.parse(String(left.modifiedTime || "")),
        );
    },
  });

  const googleDriveExportCandidates = googleDriveExportQuery.data || [];

  const bindDriveExportMutation = useMutation({
    mutationFn: async (file: AcademyCurriculumDriveExportCandidate) => {
      if (!activeCourse?.id) {
        throw new Error(
          tt(
            "Velg et kurs før du kobler eksporten tilbake.",
            "Select a course before binding the export back.",
          ),
        );
      }

      const sharedFile = await academyGoogleWorkspaceService
        .shareDriveFile(file.id, {
          shareMode: "link",
          ensureAccessible: true,
        })
        .catch(() => null);
      const resolvedFile = sharedFile || file;
      const playbackUrl =
        buildDrivePlaybackUrl(resolvedFile) || String(file.playbackUrl || "").trim();
      if (!playbackUrl) {
        throw new Error(
          tt(
            "Fant ikke en spillbar MP4-lenke for denne eksporten.",
            "Could not resolve a playable MP4 link for this export.",
          ),
        );
      }

      const nowIso = new Date().toISOString();
      const resolvedDuration = await probeVideoDurationSeconds(playbackUrl).catch(
        () => null,
      );
      const nextWorkflow = mergeGoogleProductionWorkflowDraft(
        {
          ...googleProductionWorkflowDraft,
          googleRequired: true,
          googleConnectedEmail: googleWorkspaceEmail || undefined,
          driveExportFileId: file.id,
          driveExportName:
            String(resolvedFile.name || file.name || "").trim() || undefined,
          driveExportMimeType:
            String(resolvedFile.mimeType || file.mimeType || "").trim() ||
            undefined,
          driveExportUrl:
            String(resolvedFile.webViewLink || file.externalUrl || "").trim() ||
            undefined,
          driveExportPlaybackUrl: playbackUrl,
          driveExportVersion: normalizeMediaVersion(
            resolvedFile.version,
            normalizeMediaVersion(file.version, 1),
          ),
          driveExportModifiedAt:
            String(resolvedFile.modifiedTime || file.modifiedTime || "").trim() ||
            undefined,
          videoBoundAt: nowIso,
        },
        generatedVidsPresenterPlan.scenes,
      );

      const nextCourse: Course = {
        ...activeCourse,
        videoUrl: playbackUrl,
        videoSourceType: "google-drive-video",
        googleDriveFileId: file.id,
        googleDriveMimeType:
          String(resolvedFile.mimeType || file.mimeType || "").trim() ||
          undefined,
        googleDriveWebViewLink:
          String(resolvedFile.webViewLink || file.externalUrl || "").trim() ||
          undefined,
        googleDrivePlaybackUrl: playbackUrl,
        linkedVideoAssetId: buildGoogleDriveMediaAssetId(file.id),
        linkedVideoAssetVersion: normalizeMediaVersion(
          resolvedFile.version,
          normalizeMediaVersion(file.version, 1),
        ),
        linkedVideoAssetName:
          String(resolvedFile.name || file.name || "").trim() || undefined,
        linkedVideoUpdatedAt: nowIso,
        linkedVideoFingerprint:
          buildUrlMediaFingerprint(playbackUrl) || undefined,
        linkedVideoPosterUrl:
          String(resolvedFile.thumbnailLink || file.thumbnailLink || "").trim() ||
          undefined,
        duration: resolvedDuration || activeCourse.duration,
        googleProductionWorkflow: {
          ...nextWorkflow,
          updatedAt: nowIso,
        },
        updatedAt: nowIso,
      };

      await updateCourse(nextCourse);
      setCurrentCourse(nextCourse);
      setGoogleProductionWorkflowDraft(nextWorkflow);
      return nextCourse;
    },
    onSuccess: (course) => {
      setSaveMessage(
        tt(
          "Drive-eksport koblet tilbake som kursvideo.",
          "Drive export linked back as the course video.",
        ),
      );
      analytics.trackEvent("academy_curriculum_drive_export_bound", {
        courseId: course.id,
        driveFileId: course.googleDriveFileId || null,
        timestamp: Date.now(),
      });
    },
    onError: (error) => {
      setSaveMessage(
        error instanceof Error
          ? error.message
          : tt(
              "Kunne ikke koble Drive-eksporten tilbake.",
              "Could not bind the Drive export back.",
            ),
      );
    },
  });

  const completedProductionSceneCount = productionSceneDrafts.filter(
    (scene) => scene.status === "done",
  ).length;
  const activeBoundDriveFileId =
    String(
      activeCourse?.googleDriveFileId ||
        googleProductionWorkflowDraft.driveExportFileId ||
        "",
    ).trim() || null;
  const hasBoundCourseVideo =
    activeCourse?.videoSourceType === "google-drive-video" &&
    Boolean(activeBoundDriveFileId);

  const openMediaStudioForCourseVideo = useCallback(() => {
    const query = new URLSearchParams();
    if (activeCourse?.id) {
      query.set("courseId", String(activeCourse.id));
      query.set("bind", "course");
    }
    query.set("source", "google-drive");
    query.set(
      "returnTo",
      typeof window !== "undefined"
        ? `${window.location.pathname}${window.location.search}`
        : activeCourse?.id
          ? `/academy/curriculum?courseId=${encodeURIComponent(String(activeCourse.id))}`
          : "/academy/curriculum",
    );
    const suffix = query.toString();
    setLocation(suffix ? `/academy/media?${suffix}` : "/academy/media");
  }, [activeCourse?.id, setLocation]);

  const updateArchitectureField = useCallback(
    (
      field:
        | "purpose"
        | "audience"
        | "transformation"
        | "learningJourney"
        | "practiceDesign"
        | "proofOfLearning",
      value: string,
    ) => {
      setArchitectureDraft((prev) => ({ ...prev, [field]: value }));
    },
    [],
  );

  const addSkillMapRow = useCallback(
    (prefill?: Partial<PedagogicalSkillMapItem>) => {
      setArchitectureDraft((prev) => ({
        ...prev,
        skillMap: [
          ...normalizeSkillMapItems(prev.skillMap),
          createSkillMapItem(prefill?.title || "", prefill?.focus || ""),
        ],
      }));
    },
    [],
  );

  const updateSkillMapRow = useCallback(
    (index: number, field: "title" | "focus", value: string) => {
      setArchitectureDraft((prev) => ({
        ...prev,
        skillMap: normalizeSkillMapItems(prev.skillMap).map((row, rowIndex) =>
          rowIndex === index ? { ...row, [field]: value } : row,
        ),
      }));
    },
    [],
  );

  const removeSkillMapRow = useCallback((index: number) => {
    setArchitectureDraft((prev) => ({
      ...prev,
      skillMap: normalizeSkillMapItems(prev.skillMap).filter(
        (_, rowIndex) => rowIndex !== index,
      ),
    }));
  }, []);

  const addCustomSkillMapRow = useCallback(() => {
    const title = newSkillMapTitle.trim();
    const focus = newSkillMapFocus.trim();
    if (!title && !focus) return;
    addSkillMapRow({ title, focus });
    setNewSkillMapTitle("");
    setNewSkillMapFocus("");
  }, [addSkillMapRow, newSkillMapFocus, newSkillMapTitle]);

  const updateCompetencyMapRow = useCallback(
    (
      index: number,
      field:
        | "title"
        | "description"
        | "basic"
        | "operational"
        | "advanced",
      value: string,
    ) => {
      setArchitectureDraft((prev) => {
        const rows = normalizeCompetencyMapItems(prev.competencyMap, true);
        return {
          ...prev,
          competencyMap: rows.map((row, rowIndex) => {
            if (rowIndex !== index) return row;
            if (field === "title" || field === "description") {
              return { ...row, [field]: value };
            }
            return {
              ...row,
              [field]: value
                .split("\n")
                .map((entry) => entry.trim())
                .filter((entry) => entry.length > 0)
                .slice(0, 6),
            };
          }),
        };
      });
    },
    [],
  );

  const updateStudioSkillSuggestionAtIndex = useCallback(
    (
      index: number,
      field:
        | "title"
        | "competency"
        | "level"
        | "objective"
        | "recommendedDurationMinutes",
      value: string,
    ) => {
      setArchitectureDraft((prev) => {
        const suggestions = normalizeStudioSuggestions(prev.studioSuggestions, true);
        return {
          ...prev,
          studioSuggestions: {
            ...suggestions,
            skills: suggestions.skills.map((item, itemIndex) =>
              itemIndex === index
                ? {
                    ...item,
                    [field]:
                      field === "recommendedDurationMinutes"
                        ? Math.max(2, Math.min(45, Number(value || 8) || 8))
                        : value,
                  }
                : item,
            ),
          },
        };
      });
    },
    [],
  );

  const updateStudioQuizSuggestionAtIndex = useCallback(
    (
      index: number,
      field:
        | "prompt"
        | "hint"
        | "competency"
        | "skillTitle"
        | "level"
        | "type"
        | "explanation"
        | "duration"
        | "timestampRatio"
        | "acceptedAnswers"
        | "tags",
      value: string,
    ) => {
      setArchitectureDraft((prev) => {
        const suggestions = normalizeStudioSuggestions(prev.studioSuggestions, true);
        return {
          ...prev,
          studioSuggestions: {
            ...suggestions,
            quiz: suggestions.quiz.map((item, itemIndex) =>
              itemIndex === index
                ? {
                    ...item,
                    [field]:
                      field === "duration"
                        ? Math.max(4, Math.min(45, Number(value || 12) || 12))
                        : field === "timestampRatio"
                          ? Math.max(
                              0,
                              Math.min(0.98, Number(value || 0) || 0),
                            )
                          : field === "acceptedAnswers" || field === "tags"
                            ? value
                                .split(/\n|,/)
                                .map((entry) => entry.trim())
                                .filter((entry) => entry.length > 0)
                                .slice(0, 8)
                          : value,
                  }
                : item,
            ),
          },
        };
      });
    },
    [],
  );

  const updateStudioQuizOptionAtIndex = useCallback(
    (
      suggestionIndex: number,
      optionIndex: number,
      field: "text" | "isCorrect" | "explanation",
      value: string | boolean,
    ) => {
      setArchitectureDraft((prev) => {
        const suggestions = normalizeStudioSuggestions(prev.studioSuggestions, true);
        return {
          ...prev,
          studioSuggestions: {
            ...suggestions,
            quiz: suggestions.quiz.map((item, itemIndex) => {
              if (itemIndex !== suggestionIndex) return item;
              return {
                ...item,
                options: item.options.map((option, currentOptionIndex) => {
                  if (currentOptionIndex !== optionIndex) {
                    if (field === "isCorrect" && item.type !== "multi-select") {
                      return { ...option, isCorrect: false };
                    }
                    return option;
                  }
                  return {
                    ...option,
                    [field]: value,
                  };
                }),
              };
            }),
          },
        };
      });
    },
    [],
  );

  const updateStudioAnnotationSuggestionAtIndex = useCallback(
    (
      index: number,
      field:
        | "type"
        | "title"
        | "content"
        | "competency"
        | "skillTitle"
        | "level"
        | "startRatio"
        | "endRatio"
        | "actionType"
        | "actionTarget",
      value: string,
    ) => {
      setArchitectureDraft((prev) => {
        const suggestions = normalizeStudioSuggestions(prev.studioSuggestions, true);
        return {
          ...prev,
          studioSuggestions: {
            ...suggestions,
            annotations: suggestions.annotations.map((item, itemIndex) =>
              itemIndex === index
                ? {
                    ...item,
                    [field]:
                      field === "startRatio" || field === "endRatio"
                        ? Math.max(0, Math.min(1, Number(value || 0) || 0))
                        : value,
                  }
                : item,
            ),
          },
        };
      });
    },
    [],
  );

  const addCompetencyMapRow = useCallback(() => {
    setArchitectureDraft((prev) => ({
      ...prev,
      competencyMap: [
        ...normalizeCompetencyMapItems(prev.competencyMap, true),
        createCompetencyMapItem(),
      ],
    }));
  }, []);

  const removeCompetencyMapRow = useCallback((index: number) => {
    setArchitectureDraft((prev) => ({
      ...prev,
      competencyMap: normalizeCompetencyMapItems(prev.competencyMap, true).filter(
        (_, rowIndex) => rowIndex !== index,
      ),
    }));
  }, []);

  const moveCompetencyMapRow = useCallback(
    (index: number, direction: -1 | 1) => {
      setArchitectureDraft((prev) => ({
        ...prev,
        competencyMap: reorderItems(
          normalizeCompetencyMapItems(prev.competencyMap, true),
          index,
          direction,
        ),
      }));
    },
    [],
  );

  const toggleCompetencyMapRowLocked = useCallback((index: number) => {
    setArchitectureDraft((prev) => ({
      ...prev,
      competencyMap: normalizeCompetencyMapItems(prev.competencyMap, true).map(
        (row, rowIndex) =>
          rowIndex === index ? { ...row, locked: !row.locked } : row,
      ),
    }));
  }, []);

  const addStudioSkillSuggestionRow = useCallback(() => {
    setArchitectureDraft((prev) => {
      const suggestions = normalizeStudioSuggestions(prev.studioSuggestions, true);
      return {
        ...prev,
        studioSuggestions: {
          ...suggestions,
          skills: [...suggestions.skills, createSkillSuggestionItem()],
        },
      };
    });
  }, []);

  const removeStudioSkillSuggestionRow = useCallback((index: number) => {
    setArchitectureDraft((prev) => {
      const suggestions = normalizeStudioSuggestions(prev.studioSuggestions, true);
      return {
        ...prev,
        studioSuggestions: {
          ...suggestions,
          skills: suggestions.skills.filter((_, itemIndex) => itemIndex !== index),
        },
      };
    });
  }, []);

  const moveStudioSkillSuggestionRow = useCallback(
    (index: number, direction: -1 | 1) => {
      setArchitectureDraft((prev) => {
        const suggestions = normalizeStudioSuggestions(prev.studioSuggestions, true);
        return {
          ...prev,
          studioSuggestions: {
            ...suggestions,
            skills: reorderItems(suggestions.skills, index, direction),
          },
        };
      });
    },
    [],
  );

  const toggleStudioSkillSuggestionLocked = useCallback((index: number) => {
    setArchitectureDraft((prev) => {
      const suggestions = normalizeStudioSuggestions(prev.studioSuggestions, true);
      return {
        ...prev,
        studioSuggestions: {
          ...suggestions,
          skills: suggestions.skills.map((item, itemIndex) =>
            itemIndex === index ? { ...item, locked: !item.locked } : item,
          ),
        },
      };
    });
  }, []);

  const addStudioQuizSuggestionRow = useCallback(() => {
    setArchitectureDraft((prev) => {
      const suggestions = normalizeStudioSuggestions(prev.studioSuggestions, true);
      return {
        ...prev,
        studioSuggestions: {
          ...suggestions,
          quiz: [...suggestions.quiz, createQuizSuggestionItem()],
        },
      };
    });
  }, []);

  const removeStudioQuizSuggestionRow = useCallback((index: number) => {
    setArchitectureDraft((prev) => {
      const suggestions = normalizeStudioSuggestions(prev.studioSuggestions, true);
      return {
        ...prev,
        studioSuggestions: {
          ...suggestions,
          quiz: suggestions.quiz.filter((_, itemIndex) => itemIndex !== index),
        },
      };
    });
  }, []);

  const moveStudioQuizSuggestionRow = useCallback(
    (index: number, direction: -1 | 1) => {
      setArchitectureDraft((prev) => {
        const suggestions = normalizeStudioSuggestions(prev.studioSuggestions, true);
        return {
          ...prev,
          studioSuggestions: {
            ...suggestions,
            quiz: reorderItems(suggestions.quiz, index, direction),
          },
        };
      });
    },
    [],
  );

  const toggleStudioQuizSuggestionLocked = useCallback((index: number) => {
    setArchitectureDraft((prev) => {
      const suggestions = normalizeStudioSuggestions(prev.studioSuggestions, true);
      return {
        ...prev,
        studioSuggestions: {
          ...suggestions,
          quiz: suggestions.quiz.map((item, itemIndex) =>
            itemIndex === index ? { ...item, locked: !item.locked } : item,
          ),
        },
      };
    });
  }, []);

  const addStudioAnnotationSuggestionRow = useCallback(() => {
    setArchitectureDraft((prev) => {
      const suggestions = normalizeStudioSuggestions(prev.studioSuggestions, true);
      return {
        ...prev,
        studioSuggestions: {
          ...suggestions,
          annotations: [...suggestions.annotations, createAnnotationSuggestionItem()],
        },
      };
    });
  }, []);

  const removeStudioAnnotationSuggestionRow = useCallback((index: number) => {
    setArchitectureDraft((prev) => {
      const suggestions = normalizeStudioSuggestions(prev.studioSuggestions, true);
      return {
        ...prev,
        studioSuggestions: {
          ...suggestions,
          annotations: suggestions.annotations.filter(
            (_, itemIndex) => itemIndex !== index,
          ),
        },
      };
    });
  }, []);

  const moveStudioAnnotationSuggestionRow = useCallback(
    (index: number, direction: -1 | 1) => {
      setArchitectureDraft((prev) => {
        const suggestions = normalizeStudioSuggestions(prev.studioSuggestions, true);
        return {
          ...prev,
          studioSuggestions: {
            ...suggestions,
            annotations: reorderItems(suggestions.annotations, index, direction),
          },
        };
      });
    },
    [],
  );

  const toggleStudioAnnotationSuggestionLocked = useCallback((index: number) => {
    setArchitectureDraft((prev) => {
      const suggestions = normalizeStudioSuggestions(prev.studioSuggestions, true);
      return {
        ...prev,
        studioSuggestions: {
          ...suggestions,
          annotations: suggestions.annotations.map((item, itemIndex) =>
            itemIndex === index ? { ...item, locked: !item.locked } : item,
          ),
        },
      };
    });
  }, []);

  const addProblem = useCallback(() => {
    const trimmed = newProblem.trim();
    if (!trimmed) return;
    setProblemItems((prev) => {
      const hasDuplicate = prev.some(
        (item) => item.toLowerCase() === trimmed.toLowerCase(),
      );
      if (hasDuplicate) return prev;
      return [...prev, trimmed];
    });
    setNewProblem("");
  }, [newProblem]);

  const updateProblemAtIndex = useCallback((index: number, value: string) => {
    setProblemItems((prev) =>
      prev.map((item, itemIndex) => (itemIndex === index ? value : item)),
    );
  }, []);

  const removeProblemAtIndex = useCallback((index: number) => {
    setProblemItems((prev) =>
      prev.filter((_, itemIndex) => itemIndex !== index),
    );
  }, []);

  const updateCompetencyAtIndex = useCallback(
    (index: number, value: string) => {
      setCompetencyItems((prev) =>
        prev.map((item, itemIndex) => {
          if (itemIndex !== index) return item;
          if (
            selectedCompetencyName !== ALL_COMPETENCIES_OPTION &&
            item.trim().toLowerCase() === selectedCompetencyName.toLowerCase()
          ) {
            const nextLabel = value.trim();
            setSelectedCompetencyName(nextLabel || ALL_COMPETENCIES_OPTION);
          }
          return value;
        }),
      );
    },
    [selectedCompetencyName],
  );

  const removeCompetencyAtIndex = useCallback((index: number) => {
    setCompetencyItems((prev) =>
      prev.filter((_, itemIndex) => itemIndex !== index),
    );
  }, []);

  const addSkill = useCallback(() => {
    const trimmed = newSkill.trim();
    if (!trimmed) return;
    setSkillItems((prev) => {
      const hasDuplicate = prev.some(
        (item) => item.toLowerCase() === trimmed.toLowerCase(),
      );
      if (hasDuplicate) return prev;
      return [...prev, trimmed];
    });
    setNewSkill("");
  }, [newSkill]);

  const updateSkillAtIndex = useCallback((index: number, value: string) => {
    setSkillItems((prev) =>
      prev.map((item, itemIndex) => (itemIndex === index ? value : item)),
    );
  }, []);

  const removeSkillAtIndex = useCallback((index: number) => {
    setSkillItems((prev) => prev.filter((_, itemIndex) => itemIndex !== index));
  }, []);

  const addTransformation = useCallback(() => {
    const trimmed = newTransformation.trim();
    if (!trimmed) return;
    setTransformationItems((prev) => {
      const hasDuplicate = prev.some(
        (item) => item.toLowerCase() === trimmed.toLowerCase(),
      );
      if (hasDuplicate) return prev;
      return [...prev, trimmed];
    });
    setNewTransformation("");
  }, [newTransformation]);

  const updateTransformationAtIndex = useCallback(
    (index: number, value: string) => {
      setTransformationItems((prev) =>
        prev.map((item, itemIndex) => (itemIndex === index ? value : item)),
      );
    },
    [],
  );

  const removeTransformationAtIndex = useCallback((index: number) => {
    setTransformationItems((prev) =>
      prev.filter((_, itemIndex) => itemIndex !== index),
    );
  }, []);

  const createCompetencyFromComposer = useCallback(async () => {
    const trimmed = newCompetency.trim();
    if (!trimmed) {
      setSaveMessage(
        tt(
          "Skriv et navn på kompetansen først.",
          "Enter a competency name first.",
        ),
      );
      return;
    }

    const hasDuplicate = courseItems.some(
      (item) => item.title.trim().toLowerCase() === trimmed.toLowerCase(),
    );
    if (hasDuplicate) {
      setSaveMessage(
        tt("Kompetansen finnes allerede.", "Competency already exists."),
      );
      return;
    }

    setSaving(true);
    try {
      const normalizedCompetencies = Array.from(
        new Set(
          [trimmed, ...competencyItems]
            .map((item) => String(item || "").trim())
            .filter((item) => item.length > 0),
        ),
      );
      const normalizedArchitecture = normalizeArchitecture({
        ...emptyArchitecture,
        ...architectureDraft,
        skillMap: skillMapRows,
        problemsSolved: problemItems,
        skills: skillItems,
        transformations: transformationItems,
        competencies:
          normalizedCompetencies.length > 0
            ? normalizedCompetencies
            : [trimmed],
      });

      const nextLearningOutcomes = buildDerivedLearningOutcomes(
        normalizedArchitecture,
        [],
      );
      const fallbackInstructor = activeCourse?.instructor || {
        id: "academy-instructor",
        name: "CreatorHub Academy",
        avatar: "",
        bio: "",
        profession: "videographer" as const,
      };
      const leadInstructor = selectedLeadInstructor || null;

      const createdCourse = await createCourse({
        title: trimmed,
        description: "",
        instructor: leadInstructor
          ? {
              id: leadInstructor.id,
              name: leadInstructor.name,
              avatar: leadInstructor.avatar,
              bio: leadInstructor.bio,
              profession: leadInstructor.profession,
            }
          : fallbackInstructor,
        competencyLeadInstructorId:
          leadInstructor?.id || String(fallbackInstructor.id || "").trim() || undefined,
        thumbnail: "",
        videoUrl: activeCourse?.videoUrl || "",
        duration: 0,
        level: activeCourse?.level || "beginner",
        category: activeCourse?.category || "business",
        tags: Array.from(
          new Set([...(activeCourse?.tags || []), "academy", "competency"]),
        ),
        price: 0,
        isFree: true,
        isPublished: false,
        rating: 0,
        studentCount: 0,
        lessons: [],
        prerequisites: [],
        learningOutcomes: nextLearningOutcomes,
        pedagogicalArchitecture: normalizedArchitecture,
        curriculumProjectTemplateId:
          String(selectedProjectTemplateId || "").trim() || undefined,
        resources: [],
      });
      const createdCourseId = String(createdCourse.id || "").trim();
      const createdArchitecture = toArchitectureDraft(createdCourse);
      const createdScopeId = buildCurriculumFoundationScopeId(createdCourseId);
      const createdSnapshot = normalizeCurriculumFoundationSnapshot({
        architecture: createdArchitecture,
        selectedProjectTemplateId:
          String(selectedProjectTemplateId || "").trim() || undefined,
        selectedLeadInstructorId:
          leadInstructor?.id || String(fallbackInstructor.id || "").trim() || undefined,
        selectedCompetencyName:
          createdArchitecture.competencies[0] || ALL_COMPETENCIES_OPTION,
      });
      const createdSavedAt = new Date().toISOString();
      writeCurriculumFoundationDraftEntry({
        ...createdSnapshot,
        scopeId: createdScopeId,
        courseId: createdCourseId || undefined,
        courseTitle: String(createdCourse.title || trimmed).trim() || undefined,
        savedAt: createdSavedAt,
        signature: createCurriculumFoundationSignature(createdSnapshot),
      });
      const createdVersionEntry: CurriculumFoundationVersionEntry = {
        ...createdSnapshot,
        id: `curriculum-version-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        label: tt("Ny kompetanse opprettet", "New competency created"),
        scopeId: createdScopeId,
        courseId: createdCourseId || undefined,
        courseTitle: String(createdCourse.title || trimmed).trim() || undefined,
        savedAt: createdSavedAt,
        signature: createCurriculumFoundationSignature(createdSnapshot),
      };
      writeCurriculumFoundationVersionEntries(createdScopeId, [createdVersionEntry]);

      analytics.trackEvent("academy_curriculum_competency_created", {
        courseId: createdCourse.id,
        competencyName: trimmed,
        competencyCount: 1,
        timestamp: Date.now(),
      });

      setCurrentCourse(createdCourse);
      setArchitectureDraft(createdArchitecture);
      setProblemItems(createdArchitecture.problemsSolved);
      setCompetencyItems(createdArchitecture.competencies);
      setSkillItems(createdArchitecture.skills);
      setTransformationItems(createdArchitecture.transformations);
      setSelectedCompetencyName(
        createdArchitecture.competencies[0] || ALL_COMPETENCIES_OPTION,
      );
      setNewCompetency("");
      setShowCompetencyComposer(false);
      setNewProblem("");
      setNewSkill("");
      setNewTransformation("");
      setCurriculumLastSavedAt(createdSavedAt);
      setCurriculumAutosaveState("saved");
      setCurriculumVersionEntries([createdVersionEntry]);
      setSelectedCurriculumVersionId(createdVersionEntry.id);
      setSaveMessage(tt("Ny kompetanse opprettet.", "New competency created."));
      if (createdCourseId) {
        setSelectedCourseId(createdCourseId);
        setLocation(
          `/academy/curriculum?courseId=${encodeURIComponent(createdCourseId)}`,
        );
      }
      void loadCourses();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : tt(
              "Kunne ikke opprette kompetanse.",
              "Failed to create competency.",
            );
      setSaveMessage(message);
        debugging.logIntegration("error", "Academy competency create failed", {
          courseId: activeCourse?.id || null,
          message,
        });
    } finally {
      setSaving(false);
    }
  }, [
    activeCourse,
    analytics,
    architectureDraft,
    courseItems,
    createCourse,
    debugging,
    loadCourses,
    newCompetency,
    competencyItems,
    problemItems,
    selectedProjectTemplateId,
    setCurrentCourse,
    setLocation,
    selectedLeadInstructor,
    skillItems,
    skillMapRows,
    tt,
    transformationItems,
  ]);

  const saveCurriculum = useCallback(
    async (publish: boolean) => {
      setSaving(true);
      setSaveMessage("");

      const normalizedArchitecture = normalizeArchitecture({
        ...architectureDraft,
        problemsSolved: problemItems,
        competencies: competencyItems,
        skills: skillItems,
        transformations: transformationItems,
      });
      const nextLearningOutcomes = buildDerivedLearningOutcomes(
        normalizedArchitecture,
        activeCourse?.learningOutcomes || [],
      );
      const saveTimestamp = new Date().toISOString();
      const leadInstructor = selectedLeadInstructor || null;
      const fallbackInstructor = activeCourse?.instructor || {
        id: "academy-instructor",
        name: "CreatorHub Academy",
        avatar: "",
        bio: "",
        profession: "videographer" as const,
      };

      try {
        if (
          activeCourse?.id &&
          Array.isArray(state?.courses) &&
          state.courses.some(
            (course) => String(course.id) === String(activeCourse.id),
          )
        ) {
          const existingAssignmentStudio = (
            activeCourse as CourseWithAssignmentStudio
          ).assignmentStudio;
          const hasPersistedAssignments =
            Array.isArray(existingAssignmentStudio?.assignments) &&
            existingAssignmentStudio.assignments.length > 0;
          const nextAssignmentStudio = hasPersistedAssignments
            ? {
                ...existingAssignmentStudio,
                selectedCourseId: String(
                  existingAssignmentStudio?.selectedCourseId || "all",
                ),
                updatedAt: saveTimestamp,
              }
            : buildAssignmentStudioFromArchitecture(
                String(activeCourse.id),
                normalizedArchitecture,
                tt,
              );

          const nextCourse: CourseWithAssignmentStudio = {
            ...activeCourse,
            instructor: leadInstructor
              ? {
                  id: leadInstructor.id,
                  name: leadInstructor.name,
                  avatar: leadInstructor.avatar,
                  bio: leadInstructor.bio,
                  profession: leadInstructor.profession,
                }
              : fallbackInstructor,
            competencyLeadInstructorId:
              leadInstructor?.id ||
              String(
                activeCourse.competencyLeadInstructorId ||
                  fallbackInstructor.id ||
                  "",
              ).trim() ||
              undefined,
            description:
              normalizedArchitecture.purpose || activeCourse.description,
            learningOutcomes: nextLearningOutcomes,
            pedagogicalArchitecture: normalizedArchitecture,
            curriculumProjectTemplateId:
              String(
                selectedProjectTemplateId ||
                  activeCourse.curriculumProjectTemplateId ||
                  "",
              ).trim() || undefined,
            googleProductionWorkflow: mergeGoogleProductionWorkflowDraft(
              {
                ...googleProductionWorkflowDraft,
                googleRequired: true,
                googleConnectedEmail:
                  googleWorkspaceEmail ||
                  String(
                    googleProductionWorkflowDraft.googleConnectedEmail || "",
                  ).trim() ||
                  undefined,
                updatedAt: saveTimestamp,
              },
              generatedVidsPresenterPlan.scenes,
            ),
            assignmentStudio: nextAssignmentStudio,
            isPublished: publish ? true : activeCourse.isPublished,
            updatedAt: saveTimestamp,
          };

          await updateCourse(nextCourse);
        }

        onSave?.({
          courseId: activeCourse?.id || null,
          pedagogicalArchitecture: normalizedArchitecture,
          learningOutcomes: nextLearningOutcomes,
          publish,
          updatedAt: saveTimestamp,
        });

        analytics.trackEvent(
          publish ? "academy_curriculum_publish" : "academy_curriculum_save",
          {
            courseId: activeCourse?.id || null,
            section: "pedagogical_architecture",
            problemsCount: normalizedArchitecture.problemsSolved.length,
            filledSections: filledSectionCount,
            publish,
            timestamp: Date.now(),
          },
        );

        const currentSnapshot = buildCurriculumSnapshot({
          architecture: normalizedArchitecture,
          selectedProjectTemplateId:
            String(selectedProjectTemplateId || "").trim() || undefined,
          selectedLeadInstructorId:
            leadInstructor?.id ||
            String(
              activeCourse?.competencyLeadInstructorId ||
                fallbackInstructor.id ||
                "",
            ).trim() ||
            undefined,
        });
        persistCurriculumDraft(currentSnapshot, {
          savedAt: saveTimestamp,
          publishedAt: publish ? saveTimestamp : undefined,
        });
        recordCurriculumVersion(
          currentSnapshot,
          publish
            ? tt("Publisert", "Published")
            : tt("Manuell lagring", "Manual save"),
          {
            savedAt: saveTimestamp,
            publishedAt: publish ? saveTimestamp : undefined,
          },
        );

        setSaveMessage(
          publish
            ? tt(
                "Pedagogisk arkitektur publisert.",
                "Pedagogical architecture published.",
              )
            : tt(
                "Pedagogisk arkitektur lagret.",
                "Pedagogical architecture saved.",
              ),
        );
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : tt(
                "Kunne ikke lagre pedagogisk arkitektur.",
                "Failed to save pedagogical architecture.",
              );
        setSaveMessage(message);
        debugging.logIntegration("error", "Academy curriculum save failed", {
          courseId: activeCourse?.id || null,
          message,
        });
      } finally {
        setSaving(false);
      }
    },
    [
      activeCourse,
      architectureDraft,
      buildCurriculumSnapshot,
      debugging,
      filledSectionCount,
      onSave,
      competencyItems,
      persistCurriculumDraft,
      problemItems,
      recordCurriculumVersion,
      skillItems,
      state?.courses,
      selectedLeadInstructor,
      selectedProjectTemplateId,
      tt,
      transformationItems,
      updateCourse,
      analytics,
    ],
  );

  return (
    <Box
      sx={{
        minHeight: "100vh",
        height: "100vh",
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
          height: "100vh",
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
            setShowCompetencyComposer(true);
          }}
          tt={tt}
          navLabel={navLabel}
        />

        <Box
          sx={{
            flex: 1,
            minWidth: 0,
            minHeight: 0,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
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
            <Typography
              sx={{
                letterSpacing: "0.22em",
                fontSize: 15,
                color: "rgba(237,240,247,0.82)",
              }}
            >
              CREATOR STUDIO
            </Typography>

            <Stack
              direction="row"
              spacing={1.2}
              alignItems="center"
              flexWrap="nowrap"
              useFlexGap
              sx={{
                overflowX: "auto",
                pb: 0.2,
                "& > *": { flexShrink: 0 },
                "&::-webkit-scrollbar": { height: 6 },
                "&::-webkit-scrollbar-thumb": {
                  backgroundColor: "rgba(255,255,255,0.18)",
                  borderRadius: 999,
                },
              }}
            >
              <Chip
                size="small"
                label={autosaveStatusLabel}
                sx={{
                  color:
                    curriculumAutosaveState === "saved"
                      ? "#d8f4df"
                      : curriculumAutosaveState === "saving"
                        ? "#f8d56f"
                        : "#edf0f7",
                  bgcolor:
                    curriculumAutosaveState === "saved"
                      ? "rgba(92,180,128,0.16)"
                      : curriculumAutosaveState === "saving"
                        ? "rgba(248,179,33,0.12)"
                        : "rgba(255,255,255,0.08)",
                  border:
                    curriculumAutosaveState === "saved"
                      ? "var(--academy-hairline-width, 1px) solid rgba(92,180,128,0.28)"
                      : curriculumAutosaveState === "saving"
                        ? "var(--academy-hairline-width, 1px) solid rgba(248,179,33,0.24)"
                        : "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.16)",
                  fontWeight: 700,
                }}
              />
              <Button
                startIcon={<VisibilityOff />}
                onClick={() => setLocation("/academy/player-studio")}
                sx={{
                  textTransform: "none",
                  color: "#edf0f7",
                  border:
                    "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.18)",
                  borderRadius: 1,
                }}
              >
                {tt("Forhåndsvis (student)", "Preview (learner)")}
              </Button>
              <Button
                startIcon={<Save />}
                onClick={() => void saveCurriculum(false)}
                disabled={saving}
                sx={{
                  textTransform: "none",
                  color: "#edf0f7",
                  border:
                    "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.18)",
                  borderRadius: 1,
                }}
              >
                {tt("Lagre", "Save")}
              </Button>
              <Button
                startIcon={<Publish />}
                onClick={() => void saveCurriculum(true)}
                disabled={saving}
                sx={{
                  textTransform: "none",
                  borderRadius: 1,
                  color: "#0f0f0f",
                  background: "linear-gradient(180deg, #ffd44e, #f2a616)",
                  boxShadow: "0 10px 24px rgba(248,179,33,0.25)",
                  fontWeight: 700,
                }}
              >
                {tt("Publiser", "Publish")}
              </Button>
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
              gridTemplateColumns: { xs: "1fr", xl: "minmax(0, 1fr) 360px" },
              gap: 2,
              px: 2,
              py: 2,
              overflow: "hidden",
            }}
          >
            <Box
              sx={{
                minHeight: 0,
                overflow: "auto",
                pr: 0.5,
                ...curriculumFieldContainerSx,
              }}
            >
              <Stack spacing={1.2}>
                <Stack
                  direction={{ xs: "column", lg: "row" }}
                  spacing={1}
                  justifyContent="space-between"
                  alignItems={{ xs: "stretch", lg: "center" }}
                >
                  <Box>
                    <Typography sx={sectionLabelSx}>
                      {tt("Kompetansegrunnlag", "Competency Foundation")}
                    </Typography>
                    <Typography
                      sx={{
                        fontSize: "clamp(1.24rem, 1.02rem + 0.4vw, 1.62rem)",
                        fontWeight: 700,
                      }}
                    >
                      {tt(
                        "Læreplan · Pedagogisk arkitektur",
                        "Curriculum · Pedagogical Architecture",
                      )}
                    </Typography>
                  </Box>

                  <Select
                    size="small"
                    value={selectedCompetencyName}
                    onChange={(event) =>
                      setSelectedCompetencyName(String(event.target.value))
                    }
                    sx={{
                      minWidth: 200,
                      color: "#edf0f7",
                      bgcolor: "rgba(255,255,255,0.04)",
                      "& .MuiOutlinedInput-notchedOutline": {
                        borderColor: "rgba(255,255,255,0.16)",
                      },
                    }}
                  >
                    <MenuItem value={ALL_COMPETENCIES_OPTION}>
                      {tt("Alle kompetanser", "All competencies")}
                    </MenuItem>
                    {competencyDropdownItems.map((competency) => (
                      <MenuItem key={competency} value={competency}>
                        {competency}
                      </MenuItem>
                    ))}
                  </Select>
                </Stack>

                <Stack
                  direction={{ xs: "column", lg: "row" }}
                  spacing={0.8}
                  alignItems={{ xs: "stretch", lg: "center" }}
                >
                  <Select
                    size="small"
                    value={selectedLeadInstructorId}
                    onChange={(event) =>
                      setSelectedLeadInstructorId(String(event.target.value))
                    }
                    displayEmpty
                    sx={{
                      minWidth: { xs: "100%", lg: 260 },
                      color: "#edf0f7",
                      bgcolor: "rgba(255,255,255,0.04)",
                      "& .MuiOutlinedInput-notchedOutline": {
                        borderColor: "rgba(255,255,255,0.16)",
                      },
                    }}
                  >
                    <MenuItem value="">
                      {tt("Velg fagansvarlig", "Select competency lead")}
                    </MenuItem>
                    {instructorItems.map((instructor) => (
                      <MenuItem
                        key={`curriculum-lead-${instructor.id}`}
                        value={instructor.id}
                      >
                        {instructor.name}
                      </MenuItem>
                    ))}
                  </Select>
                  <Button
                    onClick={() =>
                      void assignLeadInstructorToCourse(selectedLeadInstructorId)
                    }
                    disabled={!activeCourse?.id || !selectedLeadInstructorId || saving}
                    sx={{
                      textTransform: "none",
                      color: "#edf0f7",
                      border:
                        "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.16)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {tt("Lagre fagansvarlig", "Save competency lead")}
                  </Button>
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

                <Box
                  sx={{
                    position: "sticky",
                    top: 0,
                    zIndex: 4,
                    ...panelSx,
                    p: 1,
                    backdropFilter: "blur(16px)",
                  }}
                >
                  <Stack
                    direction={{ xs: "column", lg: "row" }}
                    spacing={0.8}
                    justifyContent="space-between"
                    alignItems={{ xs: "stretch", lg: "center" }}
                  >
                    <Stack
                      direction="row"
                      spacing={0.6}
                      useFlexGap
                      flexWrap="wrap"
                    >
                      {(
                        [
                          {
                            id: "clarify",
                            label: tt("Avklar", "Clarify"),
                            ready: foundationStepStatuses.clarify,
                          },
                          {
                            id: "structure",
                            label: tt("Strukturer", "Structure"),
                            ready: foundationStepStatuses.structure,
                          },
                          {
                            id: "suggestions",
                            label: tt("Foreslå", "Suggest"),
                            ready: foundationStepStatuses.suggestions,
                          },
                          {
                            id: "templates",
                            label: tt("Lagre som mal", "Save as template"),
                            ready: foundationStepStatuses.templates,
                          },
                        ] as Array<{
                          id: FoundationFlowSection;
                          label: string;
                          ready: boolean;
                        }>
                      ).map((step) => (
                        <Button
                          key={step.id}
                          onClick={() => setActiveFoundationSection(step.id)}
                          sx={{
                            textTransform: "none",
                            color:
                              activeFoundationSection === step.id
                                ? "#0f0f0f"
                                : "#edf0f7",
                            background:
                              activeFoundationSection === step.id
                                ? "linear-gradient(180deg, #ffd44e, #f2a616)"
                                : "rgba(255,255,255,0.04)",
                            border:
                              activeFoundationSection === step.id
                                ? "none"
                                : "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.14)",
                            minWidth: 0,
                            whiteSpace: "nowrap",
                            fontWeight: 700,
                          }}
                        >
                          {step.label}
                          {step.ready ? ` · ${tt("klar", "ready")}` : ""}
                        </Button>
                      ))}
                    </Stack>

                    <Stack
                      direction="row"
                      spacing={0.6}
                      useFlexGap
                      flexWrap="wrap"
                    >
                      <Button
                        onClick={() =>
                          setFoundationEditorMode((current) =>
                            current === "simple" ? "edit" : "simple",
                          )
                        }
                        sx={{
                          textTransform: "none",
                          color:
                            foundationEditorMode === "simple"
                              ? "#0f0f0f"
                              : "#edf0f7",
                          background:
                            foundationEditorMode === "simple"
                              ? "linear-gradient(180deg, #ffd44e, #f2a616)"
                              : "rgba(255,255,255,0.04)",
                          border:
                            foundationEditorMode === "simple"
                              ? "none"
                              : "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.14)",
                          fontWeight: 700,
                        }}
                      >
                        {foundationEditorMode === "simple"
                          ? tt("Enkel", "Simple")
                          : tt("Rediger", "Edit")}
                      </Button>
                      <Button
                        onClick={() =>
                          setShowAdvancedFoundationFields((current) => !current)
                        }
                        sx={{
                          textTransform: "none",
                          color: "#edf0f7",
                          border:
                            "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.14)",
                          background: showAdvancedFoundationFields
                            ? "rgba(111,149,219,0.14)"
                            : "rgba(255,255,255,0.04)",
                          fontWeight: 700,
                        }}
                      >
                        {showAdvancedFoundationFields
                          ? tt("Avansert: På", "Advanced: On")
                          : tt("Avansert", "Advanced")}
                      </Button>
                    </Stack>
                  </Stack>
                </Box>

                <Box sx={{ ...panelSx, p: 1.1 }}>
                  <Typography sx={sectionLabelSx}>
                    {tt("AI-oppsummering", "AI summary")}
                  </Typography>
                  <Stack spacing={0.6} sx={{ mt: 0.8 }}>
                    <Typography sx={{ color: "#f7f8fb", fontSize: 16, fontWeight: 700 }}>
                      {foundationSummary.title}
                    </Typography>
                    <Typography sx={{ color: "rgba(237,240,247,0.78)", fontSize: 13 }}>
                      {tt("For", "For")}: {foundationSummary.audience}
                    </Typography>
                    <Typography sx={{ color: "rgba(237,240,247,0.78)", fontSize: 13 }}>
                      {tt("Mål", "Goal")}: {foundationSummary.transformation}
                    </Typography>
                    <Stack direction="row" spacing={0.6} useFlexGap flexWrap="wrap">
                      {foundationSummary.skills.map((entry) => (
                        <Chip
                          key={`foundation-summary-skill-${entry}`}
                          size="small"
                          label={entry}
                          sx={{
                            color: "#edf0f7",
                            bgcolor: "rgba(255,255,255,0.06)",
                            border:
                              "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.12)",
                          }}
                        />
                      ))}
                    </Stack>
                  </Stack>
                </Box>

                <Box sx={{ ...panelSx, p: 1.1 }}>
                  <Stack
                    direction={{ xs: "column", md: "row" }}
                    spacing={0.9}
                    alignItems={{ xs: "stretch", md: "flex-start" }}
                    justifyContent="space-between"
                  >
                    <Box sx={{ minWidth: 0 }}>
                      <Stack
                        direction="row"
                        spacing={0.7}
                        alignItems="center"
                        useFlexGap
                        flexWrap="wrap"
                      >
                        <Videocam
                          sx={{ fontSize: 18, color: "rgba(248,179,33,0.9)" }}
                        />
                        <Typography sx={sectionLabelSx}>
                          Google Vids opptaksplan
                        </Typography>
                      </Stack>
                      <Typography
                        sx={{
                          mt: 0.65,
                          color: "rgba(237,240,247,0.78)",
                          fontSize: 13,
                          lineHeight: 1.5,
                        }}
                      >
                        {tt(
                          "Dette er en presenter-led plan som bruker Record myself i Google Vids. CreatorHub bygger sceneplan, opptaksmodus og teleprompter-manus fra kursgrunnlaget.",
                          "This is a presenter-led plan that uses Record myself in Google Vids. CreatorHub builds the scene plan, recording mode, and teleprompter script from the course foundation.",
                        )}
                      </Typography>
                    </Box>
                    <Stack
                      direction="row"
                      spacing={0.6}
                      useFlexGap
                      flexWrap="wrap"
                    >
                      <Chip
                        size="small"
                        label={`${vidsPresenterPlan.readiness}% ${tt(
                          "klar",
                          "ready",
                        )}`}
                        sx={{
                          color: "#0f0f0f",
                          bgcolor: "rgba(248,179,33,0.9)",
                          fontWeight: 700,
                        }}
                      />
                      <Chip
                        size="small"
                        label={academyVidsRecordingModeLabel(
                          vidsPresenterPlan.primaryMode,
                          isNorwegian,
                        )}
                        sx={{
                          color: "#edf0f7",
                          bgcolor: "rgba(115,160,255,0.16)",
                          border:
                            "var(--academy-hairline-width, 1px) solid rgba(115,160,255,0.24)",
                        }}
                      />
                    </Stack>
                  </Stack>

                  <Box
                    sx={{
                      mt: 1,
                      display: "grid",
                      gap: 0.75,
                      gridTemplateColumns: {
                        xs: "1fr",
                        sm: "repeat(3, minmax(0, 1fr))",
                      },
                    }}
                  >
                    {[
                      {
                        label: tt("Scener", "Scenes"),
                        value: String(vidsPresenterPlan.scenes.length),
                        helper: tt(
                          "Korte takes for Vids",
                          "Short takes for Vids",
                        ),
                      },
                      {
                        label: tt("Estimert lengde", "Estimated runtime"),
                        value: `${vidsPresenterPlan.totalDurationMinutes.toFixed(1)} ${tt(
                          "min",
                          "min",
                        )}`,
                        helper: tt(
                          "Presenter-led opptak",
                          "Presenter-led recording",
                        ),
                      },
                      {
                        label: tt("Vids-modus", "Vids mode"),
                        value: academyVidsRecordingModeLabel(
                          vidsPresenterPlan.primaryMode,
                          isNorwegian,
                        ),
                        helper: tt(
                          "Record myself som standard",
                          "Record myself as default",
                        ),
                      },
                    ].map((item) => (
                      <Box
                        key={item.label}
                        sx={{
                          borderRadius: 1,
                          border:
                            "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.1)",
                          bgcolor: "rgba(255,255,255,0.03)",
                          px: 0.85,
                          py: 0.8,
                        }}
                      >
                        <Typography
                          sx={{
                            fontSize: 11,
                            textTransform: "uppercase",
                            letterSpacing: "0.08em",
                            color: "rgba(237,240,247,0.54)",
                          }}
                        >
                          {item.label}
                        </Typography>
                        <Typography
                          sx={{
                            mt: 0.45,
                            fontSize: 18,
                            fontWeight: 700,
                            color: "#f7f8fb",
                          }}
                        >
                          {item.value}
                        </Typography>
                        <Typography
                          sx={{
                            mt: 0.2,
                            fontSize: 11.5,
                            color: "rgba(237,240,247,0.58)",
                          }}
                        >
                          {item.helper}
                        </Typography>
                      </Box>
                    ))}
                  </Box>

                  {vidsPresenterPlan.missingFields.length > 0 ? (
                    <Box
                      sx={{
                        mt: 0.95,
                        px: 0.9,
                        py: 0.8,
                        borderRadius: 1,
                        border:
                          "var(--academy-hairline-width, 1px) solid rgba(248,179,33,0.24)",
                        bgcolor: "rgba(248,179,33,0.08)",
                      }}
                    >
                      <Typography
                        sx={{
                          fontSize: 12.5,
                          color: "rgba(237,240,247,0.82)",
                          lineHeight: 1.45,
                        }}
                      >
                        {tt(
                          "Fyll spesielt ut disse feltene for a skjerpe manus og opptaksplan:",
                          "Fill these fields next to sharpen the script and recording plan:",
                        )}{" "}
                        {vidsPresenterPlan.missingFields.join(", ")}
                      </Typography>
                    </Box>
                  ) : null}

                  <Box
                    sx={{
                      mt: 0.95,
                      px: 0.9,
                      py: 0.85,
                      borderRadius: 1,
                      border:
                        "var(--academy-hairline-width, 1px) solid rgba(115,160,255,0.2)",
                      bgcolor: "rgba(115,160,255,0.08)",
                    }}
                  >
                    <Stack
                      direction={{ xs: "column", md: "row" }}
                      spacing={0.8}
                      justifyContent="space-between"
                      alignItems={{ xs: "flex-start", md: "center" }}
                    >
                      <Box sx={{ minWidth: 0 }}>
                        <Typography
                          sx={{
                            fontSize: 12,
                            fontWeight: 700,
                            textTransform: "uppercase",
                            letterSpacing: "0.08em",
                            color: "rgba(237,240,247,0.58)",
                          }}
                        >
                          {tt("Google-konto kreves", "Google sign-in required")}
                        </Typography>
                        <Typography
                          sx={{
                            mt: 0.35,
                            fontSize: 13,
                            lineHeight: 1.5,
                            color: "rgba(237,240,247,0.84)",
                          }}
                        >
                          {googleWorkspaceStatusQuery.isLoading
                            ? tt(
                                "Verifiserer Google-SSO-en din.",
                                "Verifying your Google SSO session.",
                              )
                            : !googleWorkflowReady
                              ? tt(
                                  "Du må logge inn med Google-kontoen din for å skrive Vids-dokumenter til Drive, åpne Google Vids og synke NotebookLM.",
                                  "You must sign in with your Google account to write Vids documents to Drive, open Google Vids, and sync NotebookLM.",
                                )
                              : googleVidsStatus?.reason ||
                                tt(
                                  "Google er koblet til. Nå kan du synke brief, redigere scener, eksportere MP4 og sende kurset til NotebookLM.",
                                  "Google is connected. You can now sync the brief, edit scenes, export the MP4, and send the course to NotebookLM.",
                                )}
                        </Typography>
                        {googleWorkspaceEmail ? (
                          <Typography
                            sx={{
                              mt: 0.4,
                              fontSize: 12,
                              color: "rgba(237,240,247,0.62)",
                            }}
                          >
                            {tt("Google-konto", "Google account")}:{" "}
                            {googleWorkspaceEmail}
                          </Typography>
                        ) : null}
                        {googleVidsWorkspace?.lastSyncedAt ? (
                          <Typography
                            sx={{
                              mt: 0.18,
                              fontSize: 12,
                              color: "rgba(237,240,247,0.62)",
                            }}
                          >
                            {tt("Sist Vids-sync", "Last Vids sync")}:{" "}
                            {new Date(
                              googleVidsWorkspace.lastSyncedAt,
                            ).toLocaleString(isNorwegian ? "nb-NO" : "en-US")}
                          </Typography>
                        ) : null}
                      </Box>
                      <Stack
                        direction="row"
                        spacing={0.6}
                        useFlexGap
                        flexWrap="wrap"
                      >
                        <Chip
                          size="small"
                          label={
                            googleWorkspaceConnected
                              ? tt("Google tilkoblet", "Google connected")
                              : tt("Google mangler", "Google not connected")
                          }
                          sx={{
                            color: "#edf0f7",
                            bgcolor: googleWorkspaceConnected
                              ? "rgba(79,201,150,0.16)"
                              : "rgba(255,255,255,0.06)",
                            border:
                              "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.12)",
                          }}
                        />
                        <Chip
                          size="small"
                          label={
                            googleWorkspaceDriveReady
                              ? tt("Drive-scope klar", "Drive scope ready")
                              : tt("Drive-scope mangler", "Drive scope missing")
                          }
                          sx={{
                            color: "#edf0f7",
                            bgcolor: googleWorkspaceDriveReady
                              ? "rgba(79,201,150,0.16)"
                              : "rgba(255,255,255,0.06)",
                            border:
                              "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.12)",
                          }}
                        />
                        <Chip
                          size="small"
                          label={
                            googleWorkspaceDocsReady
                              ? tt("Docs-scope klar", "Docs scope ready")
                              : tt("Docs-scope mangler", "Docs scope missing")
                          }
                          sx={{
                            color: "#edf0f7",
                            bgcolor: googleWorkspaceDocsReady
                              ? "rgba(79,201,150,0.16)"
                              : "rgba(255,255,255,0.06)",
                            border:
                              "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.12)",
                          }}
                        />
                        <Chip
                          size="small"
                          label={
                            googleVidsWorkspace
                              ? tt("Drive docs klare", "Drive docs ready")
                              : tt("Ingen docs ennå", "No docs yet")
                          }
                          sx={{
                            color: "#edf0f7",
                            bgcolor: googleVidsWorkspace
                              ? "rgba(248,179,33,0.16)"
                              : "rgba(255,255,255,0.06)",
                            border:
                              "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.12)",
                          }}
                        />
                      </Stack>
                    </Stack>
                  </Box>

                  <Stack
                    direction={{ xs: "column", md: "row" }}
                    spacing={0.7}
                    useFlexGap
                    flexWrap="wrap"
                    sx={{ mt: 1 }}
                  >
                    {!googleWorkflowReady ? (
                      <Button
                        startIcon={<LockOpen fontSize="small" />}
                        onClick={() => googleWorkspaceConnectMutation.mutate()}
                        disabled={googleWorkspaceConnectMutation.isPending}
                        sx={{
                          textTransform: "none",
                          color: "#0f0f0f",
                          background:
                            "linear-gradient(180deg, #7af0b1, #44c886)",
                          fontWeight: 700,
                        }}
                      >
                        {googleWorkspaceConnectMutation.isPending
                          ? tt("Starter Google-login...", "Starting Google sign-in...")
                          : tt("Logg inn med Google", "Sign in with Google")}
                      </Button>
                    ) : null}
                    <Button
                      startIcon={<Publish fontSize="small" />}
                      onClick={() => googleVidsSyncMutation.mutate()}
                      disabled={
                        !googleWorkflowReady ||
                        !googleVidsWorkspaceSnapshot ||
                        googleVidsSyncMutation.isPending
                      }
                      sx={{
                        textTransform: "none",
                        color: "#0f0f0f",
                        background:
                          "linear-gradient(180deg, #7af0b1, #44c886)",
                        fontWeight: 700,
                        "&.Mui-disabled": {
                          color: "rgba(15,15,15,0.45)",
                          background: "rgba(122,240,177,0.24)",
                        },
                      }}
                    >
                      {googleVidsSyncMutation.isPending
                        ? tt("Synker til Drive...", "Syncing to Drive...")
                        : googleVidsWorkspace
                          ? tt("Oppdater Drive docs", "Update Drive docs")
                          : tt("Synk brief til Drive", "Sync brief to Drive")}
                    </Button>
                    <Button
                      startIcon={<Save fontSize="small" />}
                      onClick={() => void saveGoogleProductionWorkflow()}
                      disabled={googleProductionWorkflowSaving}
                      sx={{
                        textTransform: "none",
                        color: "#edf0f7",
                        border:
                          "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.16)",
                      }}
                    >
                      {googleProductionWorkflowSaving
                        ? tt("Lagrer plan...", "Saving plan...")
                        : tt("Lagre opptaksplan", "Save recording plan")}
                    </Button>
                    <Button
                      startIcon={<OpenInNew fontSize="small" />}
                      onClick={openGoogleVidsComposer}
                      disabled={!googleWorkflowReady}
                      sx={{
                        textTransform: "none",
                        color: "#0f0f0f",
                        background:
                          "linear-gradient(180deg, #ffd44e, #f2a616)",
                        fontWeight: 700,
                        "&.Mui-disabled": {
                          color: "rgba(15,15,15,0.45)",
                          background: "rgba(255,212,78,0.24)",
                        },
                      }}
                    >
                      {tt("Aapne Google Vids", "Open Google Vids")}
                    </Button>
                    {googleVidsWorkspace?.briefDocumentUrl ? (
                      <Button
                        startIcon={<OpenInNew fontSize="small" />}
                        onClick={() =>
                          openGoogleVidsWorkspaceUrl(
                            googleVidsWorkspace.briefDocumentUrl,
                          )
                        }
                        sx={{
                          textTransform: "none",
                          color: "#edf0f7",
                          border:
                            "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.16)",
                        }}
                      >
                        {tt("Aapne brief-doc", "Open brief doc")}
                      </Button>
                    ) : null}
                    {googleVidsWorkspace?.teleprompterDocumentUrl ? (
                      <Button
                        startIcon={<OpenInNew fontSize="small" />}
                        onClick={() =>
                          openGoogleVidsWorkspaceUrl(
                            googleVidsWorkspace.teleprompterDocumentUrl,
                          )
                        }
                        sx={{
                          textTransform: "none",
                          color: "#edf0f7",
                          border:
                            "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.16)",
                        }}
                      >
                        {tt("Aapne teleprompter-doc", "Open teleprompter doc")}
                      </Button>
                    ) : null}
                    {googleVidsWorkspace?.driveFolderUrl ? (
                      <Button
                        startIcon={<OpenInNew fontSize="small" />}
                        onClick={() =>
                          openGoogleVidsWorkspaceUrl(
                            googleVidsWorkspace.driveFolderUrl,
                          )
                        }
                        sx={{
                          textTransform: "none",
                          color: "#edf0f7",
                          border:
                            "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.16)",
                        }}
                      >
                        {tt("Aapne Drive-mappe", "Open Drive folder")}
                      </Button>
                    ) : null}
                    <Button
                      startIcon={<ContentCopy fontSize="small" />}
                      onClick={() =>
                        void copyTextToClipboard(
                          vidsPresenterPlan.brief,
                          tt(
                            "Vids-brief kopiert til utklippstavlen.",
                            "Vids brief copied to the clipboard.",
                          ),
                        )
                      }
                      sx={{
                        textTransform: "none",
                        color: "#edf0f7",
                        border:
                          "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.16)",
                      }}
                    >
                      {tt("Kopier Vids-brief", "Copy Vids brief")}
                    </Button>
                    <Button
                      startIcon={<ContentCopy fontSize="small" />}
                      onClick={() =>
                        void copyTextToClipboard(
                          vidsPresenterPlan.teleprompterScript,
                          tt(
                            "Teleprompter-manus kopiert til utklippstavlen.",
                            "Teleprompter script copied to the clipboard.",
                          ),
                        )
                      }
                      sx={{
                        textTransform: "none",
                        color: "#edf0f7",
                        border:
                          "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.16)",
                      }}
                    >
                      {tt("Kopier teleprompter", "Copy teleprompter script")}
                    </Button>
                    <Button
                      startIcon={<ContentCopy fontSize="small" />}
                      onClick={() =>
                        void copyTextToClipboard(
                          vidsPresenterPlan.starterPrompt,
                          tt(
                            "Starter prompt kopiert til utklippstavlen.",
                            "Starter prompt copied to the clipboard.",
                          ),
                        )
                      }
                      sx={{
                        textTransform: "none",
                        color: "#edf0f7",
                        border:
                          "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.16)",
                      }}
                    >
                      {tt("Kopier starter prompt", "Copy starter prompt")}
                    </Button>
                  </Stack>

                  <Box
                    sx={{
                      mt: 1,
                      px: 0.95,
                      py: 0.9,
                      borderRadius: 1,
                      border:
                        "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.1)",
                      bgcolor: "rgba(255,255,255,0.03)",
                    }}
                  >
                    <Stack
                      direction={{ xs: "column", md: "row" }}
                      spacing={0.8}
                      justifyContent="space-between"
                      alignItems={{ xs: "flex-start", md: "center" }}
                    >
                      <Box sx={{ minWidth: 0 }}>
                        <Typography sx={sectionLabelSx}>
                          {tt("NotebookLM Studio", "NotebookLM Studio")}
                        </Typography>
                        <Typography
                          sx={{
                            mt: 0.4,
                            fontSize: 12.5,
                            lineHeight: 1.5,
                            color: "rgba(237,240,247,0.76)",
                          }}
                        >
                          {notebookLmStatus?.reason ||
                            tt(
                              "Bruk NotebookLM til å lage FAQ, study guide og lydoppsummeringer fra kursgrunnlaget og sceneplanen.",
                              "Use NotebookLM to create FAQs, study guides, and audio summaries from the course foundation and scene plan.",
                            )}
                        </Typography>
                        {notebookLmWorkspace?.lastSyncedAt ? (
                          <Typography
                            sx={{
                              mt: 0.18,
                              fontSize: 12,
                              color: "rgba(237,240,247,0.62)",
                            }}
                          >
                            {tt("Sist NotebookLM-sync", "Last NotebookLM sync")}:{" "}
                            {new Date(
                              notebookLmWorkspace.lastSyncedAt,
                            ).toLocaleString(isNorwegian ? "nb-NO" : "en-US")}
                          </Typography>
                        ) : null}
                      </Box>
                      <Stack
                        direction="row"
                        spacing={0.6}
                        useFlexGap
                        flexWrap="wrap"
                      >
                        <Chip
                          size="small"
                          label={
                            notebookLmWorkspace
                              ? tt("NotebookLM klart", "NotebookLM ready")
                              : tt("Ikke synket ennå", "Not synced yet")
                          }
                          sx={{
                            color: "#edf0f7",
                            bgcolor: notebookLmWorkspace
                              ? "rgba(248,179,33,0.16)"
                              : "rgba(255,255,255,0.06)",
                            border:
                              "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.12)",
                          }}
                        />
                        {notebookLmCourseSummary ? (
                          <Chip
                            size="small"
                            label={`${notebookLmSourceDocuments.length} ${tt("kilder", "sources")}`}
                            sx={{
                              color: "#edf0f7",
                              bgcolor: "rgba(115,160,255,0.16)",
                              border:
                                "var(--academy-hairline-width, 1px) solid rgba(115,160,255,0.24)",
                            }}
                          />
                        ) : null}
                      </Stack>
                    </Stack>
                    <Stack
                      direction={{ xs: "column", md: "row" }}
                      spacing={0.7}
                      useFlexGap
                      flexWrap="wrap"
                      sx={{ mt: 0.9 }}
                    >
                      <Button
                        startIcon={<Publish fontSize="small" />}
                        onClick={() => notebookLmSyncMutation.mutate()}
                        disabled={
                          !googleWorkflowReady || notebookLmSyncMutation.isPending
                        }
                        sx={{
                          textTransform: "none",
                          color: "#0f0f0f",
                          background:
                            "linear-gradient(180deg, #7af0b1, #44c886)",
                          fontWeight: 700,
                        }}
                      >
                        {notebookLmSyncMutation.isPending
                          ? tt("Synker NotebookLM...", "Syncing NotebookLM...")
                          : notebookLmWorkspace
                            ? tt("Oppdater NotebookLM", "Update NotebookLM")
                            : tt("Synk til NotebookLM", "Sync to NotebookLM")}
                      </Button>
                      <Button
                        startIcon={<OpenInNew fontSize="small" />}
                        onClick={() => openGoogleVidsWorkspaceUrl(notebookLmOpenUrl)}
                        disabled={!googleWorkflowReady}
                        sx={{
                          textTransform: "none",
                          color: "#edf0f7",
                          border:
                            "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.16)",
                        }}
                      >
                        {tt("Aapne NotebookLM", "Open NotebookLM")}
                      </Button>
                      {notebookLmWorkspace?.workspaceDocumentUrl ? (
                        <Button
                          startIcon={<OpenInNew fontSize="small" />}
                          onClick={() =>
                            openGoogleVidsWorkspaceUrl(
                              notebookLmWorkspace.workspaceDocumentUrl,
                            )
                          }
                          sx={{
                            textTransform: "none",
                            color: "#edf0f7",
                            border:
                              "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.16)",
                          }}
                        >
                          {tt("Aapne oversiktsdoc", "Open overview doc")}
                        </Button>
                      ) : null}
                      {notebookLmWorkspace?.driveFolderUrl ? (
                        <Button
                          startIcon={<OpenInNew fontSize="small" />}
                          onClick={() =>
                            openGoogleVidsWorkspaceUrl(
                              notebookLmWorkspace.driveFolderUrl,
                            )
                          }
                          sx={{
                            textTransform: "none",
                            color: "#edf0f7",
                            border:
                              "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.16)",
                          }}
                        >
                          {tt("Aapne NotebookLM-mappe", "Open NotebookLM folder")}
                        </Button>
                      ) : null}
                    </Stack>
                    {notebookLmSourceDocuments.length > 0 ? (
                      <Stack spacing={0.45} sx={{ mt: 0.9 }}>
                        {notebookLmSourceDocuments.slice(0, 4).map((document) => (
                          <Typography
                            key={document.id}
                            sx={{
                              fontSize: 12.25,
                              color: "rgba(237,240,247,0.68)",
                            }}
                          >
                            {`${document.order + 1}. ${document.title}`}
                          </Typography>
                        ))}
                      </Stack>
                    ) : null}
                  </Box>

                  <Box
                    sx={{
                      mt: 1,
                      px: 0.95,
                      py: 0.9,
                      borderRadius: 1,
                      border:
                        "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.1)",
                      bgcolor: "rgba(255,255,255,0.03)",
                    }}
                  >
                    <Stack
                      direction={{ xs: "column", md: "row" }}
                      spacing={0.8}
                      justifyContent="space-between"
                      alignItems={{ xs: "flex-start", md: "center" }}
                    >
                      <Box sx={{ minWidth: 0 }}>
                        <Typography sx={sectionLabelSx}>
                          {tt("Drive-eksporter tilbake til kurs", "Drive exports back to the course")}
                        </Typography>
                        <Typography
                          sx={{
                            mt: 0.4,
                            fontSize: 12.5,
                            lineHeight: 1.5,
                            color: "rgba(237,240,247,0.76)",
                          }}
                        >
                          {googleDriveExportQuery.isLoading
                            ? tt(
                                "Henter nylige videoeksporter fra Vids-mappen.",
                                "Loading recent video exports from the Vids folder.",
                              )
                            : googleDriveExportCandidates.length > 0
                              ? tt(
                                  "Velg en MP4 eller annen spillbar Drive-video og bind den direkte som kursvideo.",
                                  "Pick an MP4 or other playable Drive video and bind it directly as the course video.",
                                )
                              : tt(
                                  "Ingen videoeksporter funnet ennå. Eksporter ferdig video fra Google Vids til den samme Drive-mappen først.",
                                  "No video exports found yet. Export the finished video from Google Vids to the same Drive folder first.",
                                )}
                        </Typography>
                      </Box>
                      <Stack
                        direction="row"
                        spacing={0.6}
                        useFlexGap
                        flexWrap="wrap"
                      >
                        <Chip
                          size="small"
                          label={
                            hasBoundCourseVideo
                              ? tt("Kursvideo koblet", "Course video linked")
                              : tt("Kursvideo mangler", "Course video missing")
                          }
                          sx={{
                            color: "#edf0f7",
                            bgcolor: hasBoundCourseVideo
                              ? "rgba(79,201,150,0.16)"
                              : "rgba(255,255,255,0.06)",
                            border:
                              "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.12)",
                          }}
                        />
                        <Chip
                          size="small"
                          label={`${completedProductionSceneCount}/${productionSceneDrafts.length} ${tt("scener markert ferdig", "scenes marked done")}`}
                          sx={{
                            color: "#edf0f7",
                            bgcolor: "rgba(115,160,255,0.16)",
                            border:
                              "var(--academy-hairline-width, 1px) solid rgba(115,160,255,0.24)",
                          }}
                        />
                      </Stack>
                    </Stack>
                    <Stack spacing={0.65} sx={{ mt: 0.9 }}>
                      {googleDriveExportCandidates.slice(0, 5).map((file) => {
                        const isBound = activeBoundDriveFileId === file.id;
                        return (
                          <Box
                            key={file.id}
                            sx={{
                              px: 0.85,
                              py: 0.8,
                              borderRadius: 1,
                              border:
                                "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.12)",
                              bgcolor: isBound
                                ? "rgba(79,201,150,0.08)"
                                : "rgba(9,12,19,0.56)",
                            }}
                          >
                            <Stack
                              direction={{ xs: "column", md: "row" }}
                              spacing={0.8}
                              justifyContent="space-between"
                              alignItems={{ xs: "flex-start", md: "center" }}
                            >
                              <Box sx={{ minWidth: 0 }}>
                                <Typography sx={{ fontSize: 13.5, fontWeight: 700 }}>
                                  {file.name}
                                </Typography>
                                <Typography
                                  sx={{
                                    mt: 0.2,
                                    fontSize: 12,
                                    color: "rgba(237,240,247,0.64)",
                                  }}
                                >
                                  {file.modifiedTime
                                    ? `${tt("Oppdatert", "Updated")} ${new Date(
                                        file.modifiedTime,
                                      ).toLocaleString(
                                        isNorwegian ? "nb-NO" : "en-US",
                                      )}`
                                    : tt(
                                        "Tidspunkt mangler fra Drive.",
                                        "Drive timestamp unavailable.",
                                      )}
                                </Typography>
                              </Box>
                              <Stack
                                direction="row"
                                spacing={0.6}
                                useFlexGap
                                flexWrap="wrap"
                              >
                                {file.externalUrl ? (
                                  <Button
                                    startIcon={<OpenInNew fontSize="small" />}
                                    onClick={() =>
                                      openGoogleVidsWorkspaceUrl(file.externalUrl)
                                    }
                                    sx={{
                                      textTransform: "none",
                                      color: "#edf0f7",
                                      border:
                                        "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.16)",
                                    }}
                                  >
                                    {tt("Aapne i Drive", "Open in Drive")}
                                  </Button>
                                ) : null}
                                <Button
                                  startIcon={<Publish fontSize="small" />}
                                  onClick={() => bindDriveExportMutation.mutate(file)}
                                  disabled={bindDriveExportMutation.isPending}
                                  sx={{
                                    textTransform: "none",
                                    color: "#0f0f0f",
                                    background: isBound
                                      ? "linear-gradient(180deg, #8dd8ff, #5fb4df)"
                                      : "linear-gradient(180deg, #ffd44e, #f2a616)",
                                    fontWeight: 700,
                                  }}
                                >
                                  {bindDriveExportMutation.isPending
                                    ? tt("Kobler...", "Binding...")
                                    : isBound
                                      ? tt("Allerede koblet", "Already linked")
                                      : tt("Koble som kursvideo", "Bind as course video")}
                                </Button>
                              </Stack>
                            </Stack>
                          </Box>
                        );
                      })}
                    </Stack>
                    <Stack
                      direction={{ xs: "column", md: "row" }}
                      spacing={0.7}
                      useFlexGap
                      flexWrap="wrap"
                      sx={{ mt: 0.9 }}
                    >
                      <Button
                        onClick={() => void googleDriveExportQuery.refetch()}
                        startIcon={<Refresh fontSize="small" />}
                        sx={{
                          textTransform: "none",
                          color: "#edf0f7",
                          border:
                            "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.16)",
                        }}
                      >
                        {tt("Oppdater eksportliste", "Refresh export list")}
                      </Button>
                      <Button
                        onClick={openMediaStudioForCourseVideo}
                        sx={{
                          textTransform: "none",
                          color: "#edf0f7",
                          border:
                            "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.16)",
                        }}
                      >
                        {tt("Aapne Media Studio", "Open Media Studio")}
                      </Button>
                    </Stack>
                  </Box>

                  <Box
                    sx={{
                      mt: 1,
                      borderRadius: 1,
                      border:
                        "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.1)",
                      bgcolor: "rgba(255,255,255,0.03)",
                      overflow: "hidden",
                    }}
                  >
                    <Box
                      sx={{
                        px: 0.9,
                        py: 0.75,
                        borderBottom:
                          "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.08)",
                        bgcolor: "rgba(255,255,255,0.02)",
                      }}
                    >
                      <Stack
                        direction={{ xs: "column", md: "row" }}
                        spacing={0.7}
                        justifyContent="space-between"
                        alignItems={{ xs: "flex-start", md: "center" }}
                      >
                        <Typography
                          sx={{
                            fontSize: 12,
                            fontWeight: 700,
                            textTransform: "uppercase",
                            letterSpacing: "0.08em",
                            color: "rgba(237,240,247,0.56)",
                          }}
                        >
                          {tt("Scene-editor for Google Vids", "Scene editor for Google Vids")}
                        </Typography>
                        <Button
                          size="small"
                          startIcon={<Add fontSize="small" />}
                          onClick={addProductionScene}
                          sx={{
                            textTransform: "none",
                            color: "#edf0f7",
                            border:
                              "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.16)",
                          }}
                        >
                          {tt("Legg til scene", "Add scene")}
                        </Button>
                      </Stack>
                    </Box>
                    <Stack spacing={0}>
                      {productionSceneDrafts.map((scene, index) => (
                        <Box
                          key={scene.id}
                          sx={{
                            px: 0.9,
                            py: 0.95,
                            borderTop:
                              index === 0
                                ? "none"
                                : "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.06)",
                          }}
                        >
                          <Stack
                            direction={{ xs: "column", md: "row" }}
                            spacing={0.75}
                            justifyContent="space-between"
                            alignItems={{ xs: "stretch", md: "center" }}
                          >
                            <TextField
                              fullWidth
                              size="small"
                              label={tt("Scenetittel", "Scene title")}
                              value={scene.title}
                              onChange={(event) =>
                                updateProductionSceneDraft(
                                  scene.id,
                                  "title",
                                  event.target.value,
                                )
                              }
                            />
                            <Stack direction="row" spacing={0.5} useFlexGap flexWrap="wrap">
                              <IconButton
                                size="small"
                                onClick={() => moveProductionScene(scene.id, -1)}
                                disabled={index === 0}
                                sx={{ color: "#edf0f7" }}
                              >
                                <ArrowUpward fontSize="small" />
                              </IconButton>
                              <IconButton
                                size="small"
                                onClick={() => moveProductionScene(scene.id, 1)}
                                disabled={index === productionSceneDrafts.length - 1}
                                sx={{ color: "#edf0f7" }}
                              >
                                <ArrowDownward fontSize="small" />
                              </IconButton>
                              <IconButton
                                size="small"
                                onClick={() => removeProductionScene(scene.id)}
                                disabled={productionSceneDrafts.length <= 1}
                                sx={{ color: "#f8d56f" }}
                              >
                                <DeleteOutline fontSize="small" />
                              </IconButton>
                            </Stack>
                          </Stack>
                          <Stack
                            direction={{ xs: "column", md: "row" }}
                            spacing={0.75}
                            sx={{ mt: 0.8 }}
                          >
                            <TextField
                              fullWidth
                              size="small"
                              multiline
                              minRows={2}
                              label={tt("Læringsmål", "Learning objective")}
                              value={scene.objective}
                              onChange={(event) =>
                                updateProductionSceneDraft(
                                  scene.id,
                                  "objective",
                                  event.target.value,
                                )
                              }
                            />
                            <TextField
                              fullWidth
                              size="small"
                              multiline
                              minRows={2}
                              label={tt("Visuell cue", "Visual cue")}
                              value={scene.visualCue}
                              onChange={(event) =>
                                updateProductionSceneDraft(
                                  scene.id,
                                  "visualCue",
                                  event.target.value,
                                )
                              }
                            />
                          </Stack>
                          <Stack
                            direction={{ xs: "column", md: "row" }}
                            spacing={0.75}
                            sx={{ mt: 0.8 }}
                          >
                            <Box sx={{ minWidth: { md: 210 } }}>
                              <Typography
                                sx={{
                                  mb: 0.35,
                                  fontSize: 11,
                                  textTransform: "uppercase",
                                  letterSpacing: "0.08em",
                                  color: "rgba(237,240,247,0.52)",
                                }}
                              >
                                {tt("Opptaksmodus", "Recording mode")}
                              </Typography>
                              <Select
                                fullWidth
                                size="small"
                                value={scene.recordingMode}
                                onChange={(event) =>
                                  updateProductionSceneDraft(
                                    scene.id,
                                    "recordingMode",
                                    String(event.target.value),
                                  )
                                }
                              >
                                {["camera", "camera-and-screen", "screen", "voiceover"].map(
                                  (mode) => (
                                    <MenuItem key={mode} value={mode}>
                                      {academyVidsRecordingModeLabel(
                                        mode as AcademyVidsPresenterScene["recordingMode"],
                                        isNorwegian,
                                      )}
                                    </MenuItem>
                                  ),
                                )}
                              </Select>
                            </Box>
                            <TextField
                              size="small"
                              type="number"
                              label={tt("Minutter", "Minutes")}
                              value={scene.durationMinutes}
                              onChange={(event) =>
                                updateProductionSceneDraft(
                                  scene.id,
                                  "durationMinutes",
                                  event.target.value,
                                )
                              }
                              inputProps={{ min: 0.5, step: 0.25 }}
                              sx={{ width: { xs: "100%", md: 140 } }}
                            />
                            <Box sx={{ minWidth: { md: 190 } }}>
                              <Typography
                                sx={{
                                  mb: 0.35,
                                  fontSize: 11,
                                  textTransform: "uppercase",
                                  letterSpacing: "0.08em",
                                  color: "rgba(237,240,247,0.52)",
                                }}
                              >
                                {tt("Scene-status", "Scene status")}
                              </Typography>
                              <Select
                                fullWidth
                                size="small"
                                value={scene.status || "planned"}
                                onChange={(event) =>
                                  updateProductionSceneDraft(
                                    scene.id,
                                    "status",
                                    String(event.target.value),
                                  )
                                }
                              >
                                <MenuItem value="planned">{tt("Planlagt", "Planned")}</MenuItem>
                                <MenuItem value="recording">{tt("Taes opp", "Recording")}</MenuItem>
                                <MenuItem value="ready">{tt("Klar for eksport", "Ready for export")}</MenuItem>
                                <MenuItem value="done">{tt("Ferdig", "Done")}</MenuItem>
                              </Select>
                            </Box>
                          </Stack>
                          <TextField
                            fullWidth
                            size="small"
                            multiline
                            minRows={3}
                            label={tt("Teleprompter-manus", "Teleprompter script")}
                            value={scene.teleprompterScript}
                            onChange={(event) =>
                              updateProductionSceneDraft(
                                scene.id,
                                "teleprompterScript",
                                event.target.value,
                              )
                            }
                            sx={{ mt: 0.8 }}
                          />
                          <TextField
                            fullWidth
                            size="small"
                            multiline
                            minRows={2}
                            label={tt("Produsentnotat", "Producer note")}
                            value={scene.notes || ""}
                            onChange={(event) =>
                              updateProductionSceneDraft(
                                scene.id,
                                "notes",
                                event.target.value,
                              )
                            }
                            sx={{ mt: 0.8 }}
                          />
                        </Box>
                      ))}
                    </Stack>
                  </Box>

                  <Box
                    sx={{
                      mt: 1,
                      display: "grid",
                      gap: 0.8,
                      gridTemplateColumns: {
                        xs: "1fr",
                        md: "repeat(2, minmax(0, 1fr))",
                      },
                    }}
                  >
                    <Box
                      sx={{
                        borderRadius: 1,
                        border:
                          "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.1)",
                        bgcolor: "rgba(255,255,255,0.03)",
                        px: 0.9,
                        py: 0.85,
                      }}
                    >
                      <Typography sx={sectionLabelSx}>
                        {tt("Produksjonsflyt", "Production workflow")}
                      </Typography>
                      <Stack spacing={0.15} sx={{ mt: 0.7 }}>
                        {[
                          {
                            key: "recordingStartedAt",
                            label: tt("Opptak er startet", "Recording has started"),
                          },
                          {
                            key: "recordingCompletedAt",
                            label: tt("Alle opptak er ferdige", "All recording is complete"),
                          },
                          {
                            key: "ctaApprovedAt",
                            label: tt("CTA er kvalitetssikret", "CTA has been checked"),
                          },
                          {
                            key: "proofApprovedAt",
                            label: tt("Proof of learning er med", "Proof of learning is included"),
                          },
                          {
                            key: "runtimeApprovedAt",
                            label: tt("Total lengde er godkjent", "Total runtime is approved"),
                          },
                        ].map((item) => (
                          <Stack
                            key={item.key}
                            direction="row"
                            spacing={0.8}
                            alignItems="center"
                            justifyContent="space-between"
                            sx={{
                              px: 0.1,
                              py: 0.2,
                            }}
                          >
                            <Typography
                              sx={{
                                fontSize: 12.5,
                                color: "rgba(237,240,247,0.78)",
                              }}
                            >
                              {item.label}
                            </Typography>
                            <Switch
                              checked={hasWorkflowTimestamp(
                                googleProductionWorkflowDraft[
                                  item.key as keyof AcademyGoogleProductionWorkflow
                                ],
                              )}
                              onChange={(event) =>
                                toggleProductionMilestone(
                                  item.key as
                                    | "recordingStartedAt"
                                    | "recordingCompletedAt"
                                    | "ctaApprovedAt"
                                    | "proofApprovedAt"
                                    | "runtimeApprovedAt",
                                  event.target.checked,
                                )
                              }
                            />
                          </Stack>
                        ))}
                      </Stack>
                    </Box>
                    <Box
                      sx={{
                        borderRadius: 1,
                        border:
                          "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.1)",
                        bgcolor: "rgba(255,255,255,0.03)",
                        px: 0.9,
                        py: 0.85,
                      }}
                    >
                      <Typography sx={sectionLabelSx}>
                        {tt("Opptakscheckliste", "Recording checklist")}
                      </Typography>
                      <Stack spacing={0.5} sx={{ mt: 0.7 }}>
                        {vidsPresenterPlan.setupChecklist.map((item) => (
                          <Typography
                            key={item}
                            sx={{
                              fontSize: 12.5,
                              color: "rgba(237,240,247,0.76)",
                              lineHeight: 1.45,
                            }}
                          >
                            {`• ${item}`}
                          </Typography>
                        ))}
                      </Stack>
                      <Typography
                        sx={{
                          mt: 0.9,
                          fontSize: 12.5,
                          color: "rgba(248,213,111,0.86)",
                          lineHeight: 1.45,
                        }}
                      >
                        {tt(
                          "Produksjonsnotater:",
                          "Production notes:",
                        )}{" "}
                        {vidsPresenterPlan.productionNotes.join(" ")}
                      </Typography>
                    </Box>
                  </Box>
                </Box>

                <Box ref={competencyComposerRef} sx={{ ...panelSx, p: 1.2 }}>
                  <Stack
                    direction={{ xs: "column", sm: "row" }}
                    spacing={0.8}
                    alignItems={{ xs: "stretch", sm: "center" }}
                    justifyContent="space-between"
                  >
                    <Box>
                      <Typography sx={sectionLabelSx}>
                        {tt("Ny kompetanse", "New competency")}
                      </Typography>
                      <Typography
                        sx={{ color: "rgba(237,240,247,0.74)", fontSize: 13 }}
                      >
                        {tt(
                          "Navngi kompetansen før du bygger ferdigheter i Ferdighetsbygger.",
                          "Name the competency before building skills in Skills Builder.",
                        )}
                      </Typography>
                    </Box>
                    {!showCompetencyComposer ? (
                      <Button
                        onClick={() => setShowCompetencyComposer(true)}
                        sx={{
                          textTransform: "none",
                          color: "#0f0f0f",
                          background:
                            "linear-gradient(180deg, #ffd44e, #f2a616)",
                          fontWeight: 700,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {tt("Opprett ny kompetanse", "Create new competency")}
                      </Button>
                    ) : null}
                  </Stack>

                  {showCompetencyComposer ? (
                    <Stack
                      direction={{ xs: "column", sm: "row" }}
                      spacing={0.7}
                      sx={{ mt: 1 }}
                    >
                      <TextField
                        fullWidth
                        size="small"
                        inputRef={competencyNameInputRef}
                        value={newCompetency}
                        onChange={(event) =>
                          setNewCompetency(event.target.value)
                        }
                        onKeyDown={(event) => {
                          if (event.key !== "Enter") return;
                          event.preventDefault();
                          void createCompetencyFromComposer();
                        }}
                        label={tt("Kompetansenavn", "Competency name")}
                        placeholder={tt(
                          "F.eks. Lyssetting for portrett",
                          "e.g. Portrait lighting",
                        )}
                      />
                      <Button
                        onClick={() => void createCompetencyFromComposer()}
                        disabled={saving}
                        sx={{
                          textTransform: "none",
                          color: "#edf0f7",
                          border:
                            "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.16)",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {tt("Legg til kompetanse", "Add competency")}
                      </Button>
                      <Button
                        onClick={() => {
                          setShowCompetencyComposer(false);
                          setNewCompetency("");
                        }}
                        sx={{
                          textTransform: "none",
                          color: "rgba(237,240,247,0.78)",
                          border:
                            "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.16)",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {tt("Avbryt", "Cancel")}
                      </Button>
                    </Stack>
                  ) : null}
                </Box>

                {activeFoundationSection === "clarify" ? (
                  <Box sx={{ ...panelSx, p: 1.2 }}>
                  <Stack
                    direction={{ xs: "column", lg: "row" }}
                    spacing={1}
                    alignItems={{ xs: "stretch", lg: "flex-start" }}
                    justifyContent="space-between"
                  >
                    <Box sx={{ minWidth: 0 }}>
                      <Stack
                        direction="row"
                        spacing={0.7}
                        alignItems="center"
                        useFlexGap
                        flexWrap="wrap"
                      >
                        <Typography sx={sectionLabelSx}>
                          {tt(
                            "AI-guidet kompetanseintervju",
                            "AI-guided competency interview",
                          )}
                        </Typography>
                        <Chip
                          size="small"
                          icon={
                            foundationInterviewCompleted ? (
                              <CheckCircleOutline fontSize="small" />
                            ) : foundationInterviewLoading ? (
                              <HourglassTop fontSize="small" />
                            ) : (
                              <AutoAwesome fontSize="small" />
                            )
                          }
                          label={
                            foundationInterviewCompleted
                              ? tt("Fullført", "Completed")
                              : `${Math.min(
                                  foundationInterviewAnswers.length + 1,
                                  FOUNDATION_INTERVIEW_TOTAL_QUESTIONS,
                                )}/${FOUNDATION_INTERVIEW_TOTAL_QUESTIONS}`
                          }
                          sx={{
                            color: foundationInterviewCompleted
                              ? "#d8f4df"
                              : "#f8d56f",
                            bgcolor: foundationInterviewCompleted
                              ? "rgba(92,180,128,0.16)"
                              : "rgba(248,179,33,0.12)",
                            border:
                              foundationInterviewCompleted
                                ? "var(--academy-hairline-width, 1px) solid rgba(92,180,128,0.28)"
                                : "var(--academy-hairline-width, 1px) solid rgba(248,179,33,0.24)",
                            fontWeight: 700,
                          }}
                        />
                        {foundationInterviewProvider ? (
                          <Chip
                            size="small"
                            label={
                              foundationInterviewProvider === "qwen"
                                ? foundationInterviewModel
                                  ? `Qwen · ${foundationInterviewModel}`
                                  : "Qwen"
                                : tt("Heuristikk", "Heuristic")
                            }
                            sx={{
                              color: "rgba(237,240,247,0.82)",
                              bgcolor: "rgba(255,255,255,0.08)",
                            }}
                          />
                        ) : null}
                        {(foundationInterviewDomainResolution?.profile ||
                          foundationInterviewIndustryProfile ||
                          foundationInterviewLoading) && foundationInterviewProfileLabel ? (
                          <Chip
                            size="small"
                            label={
                              foundationInterviewDomainResolution
                                ? `${tt("Oppdaget domene", "Detected domain")}: ${foundationInterviewProfileLabel} · ${Math.max(
                                    1,
                                    Math.round(
                                      (foundationInterviewDomainResolution.confidence || 0) * 100,
                                    ),
                                  )}%`
                                : foundationInterviewProfileLabel
                            }
                            sx={{
                              color: "#edf0f7",
                              bgcolor: "rgba(111,149,219,0.14)",
                              border:
                                "var(--academy-hairline-width, 1px) solid rgba(111,149,219,0.24)",
                              fontWeight: 700,
                            }}
                          />
                        ) : null}
                        {foundationInterviewTemplateMatch ? (
                          <Chip
                            size="small"
                            label={`${tt("Malminne", "Template memory")}: ${foundationInterviewTemplateMatch.name}`}
                            sx={{
                              color: "#edf0f7",
                              bgcolor: "rgba(92,180,128,0.12)",
                              border:
                                "var(--academy-hairline-width, 1px) solid rgba(92,180,128,0.22)",
                              fontWeight: 700,
                            }}
                          />
                        ) : null}
                        {foundationInterviewDomainResolution?.needsConfirmation ? (
                          <Chip
                            size="small"
                            label={tt("Trenger avklaring", "Needs clarification")}
                            sx={{
                              color: "#f8d56f",
                              bgcolor: "rgba(248,179,33,0.1)",
                              border:
                                "var(--academy-hairline-width, 1px) solid rgba(248,179,33,0.24)",
                              fontWeight: 700,
                            }}
                          />
                        ) : null}
                        {foundationInterviewDisplayProgress?.phase ? (
                          <Chip
                            size="small"
                            label={foundationInterviewDisplayProgress.phase}
                            sx={{
                              color: "rgba(237,240,247,0.82)",
                              bgcolor: "rgba(255,255,255,0.06)",
                              border:
                                "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.12)",
                            }}
                          />
                        ) : null}
                      </Stack>
                      <Typography
                        sx={{
                          mt: 0.45,
                          color: "rgba(237,240,247,0.74)",
                          fontSize: 13,
                          maxWidth: 820,
                        }}
                      >
                        {tt(
                          "Svar på ett spørsmål om gangen. AI-en bruker svarene dine til å foreslå hele kompetansegrunnlaget, inkludert formål, målgruppe, kompetanser, ferdigheter og proof of learning.",
                          "Answer one question at a time. The AI uses your answers to propose the full competency foundation, including purpose, audience, competencies, skills, and proof of learning.",
                        )}
                      </Typography>
                      <Stack
                        direction={{ xs: "column", md: "row" }}
                        spacing={0.8}
                        alignItems={{ xs: "stretch", md: "center" }}
                        sx={{ mt: 0.9 }}
                      >
                        <Box sx={{ minWidth: { xs: "100%", md: 260 } }}>
                          <Typography
                            sx={{
                              color: "rgba(237,240,247,0.58)",
                              fontSize: 11,
                              fontWeight: 700,
                              letterSpacing: "0.12em",
                              textTransform: "uppercase",
                              mb: 0.35,
                            }}
                          >
                            {tt("Domeneoverstyring", "Domain override")}
                          </Typography>
                          <Select
                            fullWidth
                            size="small"
                            displayEmpty
                            value={foundationInterviewManualProfile}
                            onChange={(event) =>
                              void handleFoundationManualProfileChange(
                                String(event.target.value || ""),
                              )
                            }
                            sx={{
                              color: "#edf0f7",
                              backgroundColor: "rgba(255,255,255,0.04)",
                              "& .MuiOutlinedInput-notchedOutline": {
                                borderColor: "rgba(255,255,255,0.16)",
                              },
                            }}
                          >
                            <MenuItem value="">
                              {tt("Auto-detekter", "Auto-detect")}
                            </MenuItem>
                            {foundationProfileOptions.map((option) => (
                              <MenuItem key={`foundation-profile-${option.id}`} value={option.id}>
                                {option.label}
                              </MenuItem>
                            ))}
                          </Select>
                        </Box>
                        <Box sx={{ minWidth: 0, flex: 1 }}>
                          {foundationInterviewDomainResolution?.reasoning?.length ? (
                            <Stack direction="row" spacing={0.6} useFlexGap flexWrap="wrap">
                              {foundationInterviewDomainResolution.reasoning.map((entry) => (
                                <Chip
                                  key={`foundation-domain-reasoning-${entry}`}
                                  size="small"
                                  label={entry}
                                  sx={{
                                    color: "rgba(237,240,247,0.84)",
                                    bgcolor: "rgba(255,255,255,0.06)",
                                    border:
                                      "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.12)",
                                  }}
                                />
                              ))}
                            </Stack>
                          ) : null}
                          {foundationInterviewDomainResolution?.alternatives?.length ? (
                            <Stack
                              direction="row"
                              spacing={0.6}
                              useFlexGap
                              flexWrap="wrap"
                              sx={{ mt: foundationInterviewDomainResolution.reasoning?.length ? 0.7 : 0 }}
                            >
                              {foundationInterviewDomainResolution.alternatives.map((entry) => (
                                <Chip
                                  key={`foundation-domain-alt-${entry.profile}`}
                                  size="small"
                                  label={`${entry.label} · ${Math.round(
                                    entry.confidence * 100,
                                  )}%`}
                                  onClick={() =>
                                    void handleFoundationManualProfileChange(entry.profile)
                                  }
                                  sx={{
                                    color: "#edf0f7",
                                    bgcolor: "rgba(255,255,255,0.05)",
                                    border:
                                      "var(--academy-hairline-width, 1px) dashed rgba(255,255,255,0.18)",
                                    cursor: "pointer",
                                  }}
                                />
                              ))}
                            </Stack>
                          ) : null}
                        </Box>
                      </Stack>
                      {foundationInterviewGeneratedAt ? (
                        <Typography
                          sx={{
                            mt: 0.45,
                            color: "rgba(237,240,247,0.52)",
                            fontSize: 12,
                          }}
                        >
                          {tt("Sist oppdatert", "Last updated")}:{" "}
                          {new Date(foundationInterviewGeneratedAt).toLocaleTimeString(
                            isNorwegian ? "no-NO" : "en-US",
                            {
                              hour: "2-digit",
                              minute: "2-digit",
                            },
                          )}
                        </Typography>
                      ) : null}
                      {foundationInterviewGenerationStage?.nextSections?.length ? (
                        <Typography
                          sx={{
                            mt: 0.55,
                            color: "rgba(237,240,247,0.62)",
                            fontSize: 12,
                          }}
                        >
                          {tt("AI fyller nå", "AI is filling now")}:{" "}
                          {foundationInterviewGenerationStage.nextSections.join(" · ")}
                        </Typography>
                      ) : null}
                    </Box>

                    <Stack
                      direction="row"
                      spacing={0.7}
                      useFlexGap
                      flexWrap="wrap"
                    >
                      <Button
                        onClick={resetFoundationInterview}
                        disabled={foundationInterviewLoading}
                        startIcon={<Refresh />}
                        sx={{
                          textTransform: "none",
                          color: "#edf0f7",
                          border:
                            "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.16)",
                        }}
                      >
                        {tt("Start på nytt", "Restart")}
                      </Button>
                    </Stack>
                  </Stack>

                  {foundationInterviewDisplayProgress ? (
                    <Box sx={{ mt: 1 }}>
                      <LinearProgress
                        variant="determinate"
                        value={Math.max(
                          6,
                          Math.min(
                            100,
                            Number(foundationInterviewDisplayProgress.percent || 0),
                          ),
                        )}
                        sx={{
                          height: 6,
                          borderRadius: 999,
                          bgcolor: "rgba(255,255,255,0.08)",
                          "& .MuiLinearProgress-bar": {
                            borderRadius: 999,
                            background:
                              foundationInterviewCompleted
                                ? "linear-gradient(90deg, #4cb879 0%, #8ce6ae 100%)"
                                : "linear-gradient(90deg, #f8b321 0%, #ffd26a 100%)",
                          },
                        }}
                      />
                      <Typography
                        sx={{
                          mt: 0.7,
                          color: "#f8d56f",
                          fontSize: 12.5,
                          fontWeight: 700,
                        }}
                      >
                        {foundationInterviewLoading
                          ? tt(
                              "AI foreslår nå kompetansegrunnlaget…",
                              "AI is now proposing the competency foundation…",
                            )
                          : foundationInterviewDisplayProgress.phase}
                      </Typography>
                      <Typography
                        sx={{
                          mt: 0.4,
                          color: "rgba(237,240,247,0.74)",
                          fontSize: 12.5,
                        }}
                      >
                        {foundationInterviewDisplayProgress.statusMessage}
                      </Typography>
                      {foundationInterviewDisplayProgress.focusAreas.length > 0 ? (
                        <Stack
                          direction="row"
                          spacing={0.6}
                          useFlexGap
                          flexWrap="wrap"
                          sx={{ mt: 0.9 }}
                        >
                          {foundationInterviewDisplayProgress.focusAreas.map((entry) => (
                            <Chip
                              key={`foundation-focus-${entry}`}
                              size="small"
                              label={entry}
                              sx={{
                                color: "#edf0f7",
                                bgcolor: "rgba(255,255,255,0.06)",
                                border:
                                  "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.12)",
                              }}
                            />
                          ))}
                        </Stack>
                      ) : null}
                      {foundationInterviewDisplayProgress.appliedSections.length > 0 ? (
                        <Stack
                          direction="row"
                          spacing={0.6}
                          useFlexGap
                          flexWrap="wrap"
                          sx={{ mt: 0.7 }}
                        >
                          {foundationInterviewDisplayProgress.appliedSections.map((entry) => (
                            <Chip
                              key={`foundation-section-${entry}`}
                              size="small"
                              label={entry}
                              sx={{
                                color: "#f8d56f",
                                bgcolor: "rgba(248,179,33,0.1)",
                                border:
                                  "var(--academy-hairline-width, 1px) solid rgba(248,179,33,0.22)",
                                fontWeight: 700,
                              }}
                            />
                          ))}
                        </Stack>
                      ) : null}
                    </Box>
                  ) : null}

                  {foundationInterviewAnswers.length > 0 ? (
                    <Stack
                      direction="row"
                      spacing={0.6}
                      useFlexGap
                      flexWrap="wrap"
                      sx={{ mt: 1 }}
                    >
                      {foundationInterviewAnswers.map((entry) => (
                        <Chip
                          key={`foundation-answer-${entry.id}`}
                          size="small"
                          label={`${entry.question}: ${entry.answer}`}
                          sx={{
                            maxWidth: "100%",
                            color: "rgba(237,240,247,0.84)",
                            bgcolor: "rgba(255,255,255,0.06)",
                            border:
                              "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.12)",
                            "& .MuiChip-label": {
                              display: "block",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            },
                          }}
                        />
                      ))}
                    </Stack>
                  ) : null}

                  {foundationInterviewQuestion ? (
                    <Box
                      sx={{
                        mt: 1,
                        p: 1,
                        borderRadius: 1,
                        border:
                          "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.1)",
                        background:
                          "linear-gradient(145deg, rgba(12,16,24,0.92), rgba(8,11,18,0.98))",
                      }}
                    >
                      <Typography
                        sx={{
                          fontSize: 15,
                          fontWeight: 700,
                          color: "#f7f8fb",
                        }}
                      >
                        {foundationInterviewQuestion.question}
                      </Typography>
                      <Typography
                        sx={{
                          mt: 0.45,
                          color: "rgba(237,240,247,0.68)",
                          fontSize: 12.5,
                        }}
                      >
                        {foundationInterviewQuestion.helpText}
                      </Typography>

                      <Stack
                        direction={{ xs: "column", md: "row" }}
                        spacing={0.8}
                        sx={{ mt: 1 }}
                      >
                        <TextField
                          fullWidth
                          size="small"
                          label={tt("Svar", "Answer")}
                          placeholder={foundationInterviewQuestion.placeholder}
                          value={foundationInterviewInput}
                          onChange={(event) =>
                            setFoundationInterviewInput(event.target.value)
                          }
                          onKeyDown={(event) => {
                            if (event.key !== "Enter") return;
                            event.preventDefault();
                            void submitFoundationInterviewAnswer();
                          }}
                        />
                        <Button
                          onClick={() => void submitFoundationInterviewAnswer()}
                          disabled={foundationInterviewLoading}
                          sx={{
                            textTransform: "none",
                            color: "#0f0f0f",
                            background:
                              "linear-gradient(180deg, #ffd44e, #f2a616)",
                            fontWeight: 700,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {tt("Neste spørsmål", "Next question")}
                        </Button>
                        <Button
                          onClick={() => void skipFoundationInterviewQuestion()}
                          disabled={foundationInterviewLoading}
                          sx={{
                            textTransform: "none",
                            color: "#edf0f7",
                            border:
                              "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.16)",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {tt("Hopp over", "Skip")}
                        </Button>
                      </Stack>

                      {foundationInterviewQuestion.suggestions.length > 0 ? (
                        <Stack
                          direction="row"
                          spacing={0.6}
                          useFlexGap
                          flexWrap="wrap"
                          sx={{ mt: 1 }}
                        >
                          {foundationInterviewQuestion.suggestions.map(
                            (suggestion) => (
                              <Chip
                                key={`foundation-suggestion-${suggestion}`}
                                label={suggestion}
                                onClick={() => setFoundationInterviewInput(suggestion)}
                                sx={{
                                  color: "rgba(237,240,247,0.84)",
                                  bgcolor: "rgba(255,255,255,0.06)",
                                  border:
                                    "var(--academy-hairline-width, 1px) dashed rgba(255,255,255,0.2)",
                                  cursor: "pointer",
                                }}
                              />
                            ),
                          )}
                        </Stack>
                      ) : null}
                    </Box>
                  ) : (
                    <Box
                      sx={{
                        mt: 1,
                        p: 1,
                        borderRadius: 1,
                        border:
                          "var(--academy-hairline-width, 1px) solid rgba(92,180,128,0.24)",
                        background: "rgba(92,180,128,0.08)",
                      }}
                    >
                      <Typography
                        sx={{ color: "#d8f4df", fontWeight: 700, fontSize: 14 }}
                      >
                        {tt(
                          "Intervjuet er fullført. Utkastet er oppdatert med anbefalt kompetansegrunnlag.",
                          "The interview is complete. The draft has been updated with the recommended competency foundation.",
                        )}
                      </Typography>
                    </Box>
                  )}

                  {foundationInterviewRationale.length > 0 ? (
                    <Stack
                      direction="row"
                      spacing={0.6}
                      useFlexGap
                      flexWrap="wrap"
                      sx={{ mt: 1 }}
                    >
                      {foundationInterviewRationale.map((entry) => (
                        <Chip
                          key={`foundation-rationale-${entry}`}
                          size="small"
                          label={entry}
                          sx={{
                            color: "#edf0f7",
                            bgcolor: "rgba(111,149,219,0.14)",
                            border:
                              "var(--academy-hairline-width, 1px) solid rgba(111,149,219,0.24)",
                          }}
                        />
                      ))}
                    </Stack>
                  ) : null}

                  {showAdvancedFoundationFields &&
                  foundationInterviewSectionRationales.length > 0 ? (
                    <Stack spacing={0.8} sx={{ mt: 1 }}>
                      {foundationInterviewSectionRationales.map((entry) => (
                        <Box
                          key={`foundation-section-rationale-${entry.section}`}
                          sx={{
                            p: 0.9,
                            borderRadius: 1,
                            border:
                              "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.1)",
                            background:
                              "linear-gradient(145deg, rgba(12,16,24,0.72), rgba(8,11,18,0.9))",
                          }}
                        >
                          <Typography
                            sx={{
                              color: "#f7f8fb",
                              fontWeight: 700,
                              fontSize: 13.5,
                            }}
                          >
                            {entry.section}
                          </Typography>
                          <Typography
                            sx={{
                              mt: 0.35,
                              color: "rgba(237,240,247,0.76)",
                              fontSize: 12.5,
                            }}
                          >
                            {entry.reason}
                          </Typography>
                          <Typography
                            sx={{
                              mt: 0.35,
                              color: "#f8d56f",
                              fontSize: 12,
                            }}
                          >
                            {tt("Basert på", "Based on")}: {entry.evidence}
                          </Typography>
                        </Box>
                      ))}
                    </Stack>
                  ) : null}
                </Box>
                ) : null}

                {activeFoundationSection === "templates" ? (
                <Box sx={{ ...panelSx, p: 1.2 }}>
                  <Typography sx={sectionLabelSx}>
                    {tt(
                      "Kompetansegrunnlagsmal",
                      "Competency foundation template",
                    )}
                  </Typography>
                  <Typography
                    sx={{ mt: 0.45, color: "rgba(237,240,247,0.72)", fontSize: 13 }}
                  >
                    {tt(
                      "AI-svarene og redigeringene dine styrer innholdet. Her kan du lagre det ferdige grunnlaget som en gjenbrukbar mal og hente det inn senere.",
                      "Your AI answers and edits drive the content. Here you can save the finished foundation as a reusable template and load it later.",
                    )}
                  </Typography>
                  <TextField
                    fullWidth
                    size="small"
                    label={tt("Malnavn", "Template name")}
                    value={foundationTemplateName}
                    onChange={(event) =>
                      setFoundationTemplateName(event.target.value)
                    }
                    placeholder={tt(
                      "F.eks. B2B-salg onboarding",
                      "e.g. B2B sales onboarding",
                    )}
                    sx={{ mt: 1 }}
                  />
                  <Stack
                    direction={{ xs: "column", sm: "row" }}
                    spacing={0.7}
                    sx={{ mt: 1 }}
                  >
                    <Select
                      fullWidth
                      size="small"
                      value={selectedFoundationTemplateId}
                      onChange={(event) =>
                        setSelectedFoundationTemplateId(String(event.target.value || ""))
                      }
                      displayEmpty
                      sx={{
                        color: "#edf0f7",
                        bgcolor: "rgba(255,255,255,0.04)",
                        "& .MuiOutlinedInput-notchedOutline": {
                          borderColor: "rgba(255,255,255,0.16)",
                        },
                      }}
                    >
                      <MenuItem value="">
                        {tt(
                          "Velg lagret kompetansegrunnlagsmal",
                          "Select saved competency foundation template",
                        )}
                      </MenuItem>
                      {savedFoundationTemplates.map((template) => (
                        <MenuItem key={template.id} value={template.id}>
                          {template.name}
                        </MenuItem>
                      ))}
                    </Select>
                    <Button
                      onClick={saveCurrentAsFoundationTemplate}
                      sx={{
                        textTransform: "none",
                        color: "#0f0f0f",
                        background: "linear-gradient(180deg, #ffd44e, #f2a616)",
                        fontWeight: 700,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {tt("Lagre som mal", "Save as template")}
                    </Button>
                    <Button
                      onClick={() => loadSavedFoundationTemplate()}
                      sx={{
                        textTransform: "none",
                        color: "#edf0f7",
                        border:
                          "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.16)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {tt("Hent mal", "Load template")}
                    </Button>
                    <Button
                      onClick={deleteSavedFoundationTemplate}
                      sx={{
                        textTransform: "none",
                        color: "#edf0f7",
                        border:
                          "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.16)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {tt("Slett mal", "Delete template")}
                    </Button>
                  </Stack>
                  {suggestedProjectTemplate ? (
                    <Box
                      sx={{
                        mt: 0.9,
                        p: 0.85,
                        borderRadius: 1,
                        border:
                          "var(--academy-hairline-width, 1px) solid rgba(248,179,33,0.18)",
                        bgcolor: "rgba(248,179,33,0.08)",
                      }}
                    >
                      <Typography
                        sx={{ color: "#f8d56f", fontSize: 12.5, fontWeight: 700 }}
                      >
                        {tt(
                          "AI-forslått A-Å-oppsett",
                          "AI-suggested A-Z flow",
                        )}
                        : {tt(
                          suggestedProjectTemplate.nameNo,
                          suggestedProjectTemplate.nameEn,
                        )}
                      </Typography>
                      <Typography
                        sx={{
                          mt: 0.3,
                          color: "rgba(237,240,247,0.72)",
                          fontSize: 12.5,
                        }}
                      >
                        {tt(
                          "Dette er kun et anbefalt produksjonsoppsett. Det styrer ikke narrativet eller kompetanseinnholdet i grunnlaget.",
                          "This is only a suggested production flow. It does not drive the narrative or competency content in the foundation.",
                        )}
                      </Typography>
                    </Box>
                  ) : null}
                </Box>
                ) : null}

                {activeFoundationSection === "structure" ? (
                <Box sx={{ ...panelSx, p: 1.2 }}>
                  <Typography sx={sectionLabelSx}>
                    {tt(
                      "Formål • Målgruppe • Transformasjon",
                      "Purpose • Audience • Transformation",
                    )}
                  </Typography>
                  <Stack spacing={0.9} sx={{ mt: 1 }}>
                    <TextField
                      fullWidth
                      label={tt("Formål", "Purpose")}
                      placeholder={tt(
                        "Hva er hovedmålet med kurset? (f.eks. fra usikker til trygg i lyssetting)",
                        "What is the core goal of this course? (e.g. from uncertain to confident in lighting)",
                      )}
                      value={architectureDraft.purpose}
                      onChange={(event) =>
                        updateArchitectureField("purpose", event.target.value)
                      }
                      multiline
                      minRows={2}
                    />
                    <TextField
                      fullWidth
                      label={tt("Målgruppe", "Audience")}
                      placeholder={tt(
                        "Hvem er dette for? (f.eks. nybegynnere som vil levere profesjonelt)",
                        "Who is this for? (e.g. beginners who want pro-level delivery)",
                      )}
                      value={architectureDraft.audience}
                      onChange={(event) =>
                        updateArchitectureField("audience", event.target.value)
                      }
                      multiline
                      minRows={2}
                    />
                    <TextField
                      fullWidth
                      label={tt("Transformasjon", "Transformation")}
                      placeholder={tt(
                        "Hvilken konkret endring skal studenten oppnå etter kurset?",
                        "What concrete transformation should students achieve after this course?",
                      )}
                      value={architectureDraft.transformation}
                      onChange={(event) =>
                        updateArchitectureField(
                          "transformation",
                          event.target.value,
                        )
                      }
                      multiline
                      minRows={2}
                    />
                  </Stack>
                </Box>
                ) : null}

                {activeFoundationSection === "structure" ? (
                <Box sx={{ ...panelSx, p: 1.2 }}>
                  <Typography sx={sectionLabelSx}>
                    {tt(
                      "Kursarkitektur (resultatbasert)",
                      "Course Architecture (Result-based)",
                    )}
                  </Typography>
                  <Stack spacing={0.7} sx={{ mt: 0.9, mb: 1 }}>
                    <Typography
                      sx={{ color: "rgba(237,240,247,0.78)", fontSize: 13 }}
                    >
                      {tt(
                        "Modul-LMS: Kapittel / Leksjon / Video",
                        "Module LMS: Chapter / Lesson / Video",
                      )}
                    </Typography>
                    <Typography
                      sx={{ color: "#f8d56f", fontSize: 13, fontWeight: 700 }}
                    >
                      {tt(
                        "Kursarkitektur: Kompetanse / Ferdighet / Transformasjon",
                        "Course Architecture: Competency / Skill / Transformation",
                      )}
                    </Typography>
                  </Stack>

                  <Stack spacing={1}>
                    <Typography sx={{ fontWeight: 700, fontSize: 14 }}>
                      {tt("Kompetanser", "Competencies")}
                    </Typography>
                    {competencyItems.map((item, index) => {
                      const isActiveCompetency =
                        selectedCompetencyName !== ALL_COMPETENCIES_OPTION &&
                        item.trim().toLowerCase() ===
                          selectedCompetencyName.toLowerCase();
                      return (
                        <Stack
                          key={`competency-${index}`}
                          direction="row"
                          spacing={0.7}
                        >
                          <TextField
                            fullWidth
                            size="small"
                            value={item}
                            onFocus={() => setSelectedCompetencyName(item)}
                            onChange={(event) =>
                              updateCompetencyAtIndex(index, event.target.value)
                            }
                            placeholder={tt(
                              "Kjernekompetanse",
                              "Core competency",
                            )}
                            sx={
                              isActiveCompetency
                                ? {
                                    "& .MuiOutlinedInput-root": {
                                      backgroundColor: "rgba(248,179,33,0.12)",
                                    },
                                    "& .MuiOutlinedInput-notchedOutline": {
                                      borderColor: "rgba(248,179,33,0.56)",
                                    },
                                  }
                                : undefined
                            }
                          />
                          <IconButton
                            onClick={() => removeCompetencyAtIndex(index)}
                            size="small"
                            sx={{
                              color: "rgba(237,240,247,0.78)",
                              border:
                                "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.16)",
                            }}
                          >
                            <DeleteOutline fontSize="small" />
                          </IconButton>
                        </Stack>
                      );
                    })}

                    <Divider sx={{ borderColor: "rgba(255,255,255,0.08)" }} />

                    <Typography sx={{ fontWeight: 700, fontSize: 14 }}>
                      {tt("Ferdigheter", "Skills")}
                    </Typography>
                    {skillItems.map((item, index) => (
                      <Stack
                        key={`skill-${index}`}
                        direction="row"
                        spacing={0.7}
                      >
                        <TextField
                          fullWidth
                          size="small"
                          value={item}
                          onChange={(event) =>
                            updateSkillAtIndex(index, event.target.value)
                          }
                          placeholder={tt(
                            "Målbar ferdighet",
                            "Measurable skill",
                          )}
                        />
                        <IconButton
                          onClick={() => removeSkillAtIndex(index)}
                          size="small"
                          sx={{
                            color: "rgba(237,240,247,0.78)",
                            border:
                              "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.16)",
                          }}
                        >
                          <DeleteOutline fontSize="small" />
                        </IconButton>
                      </Stack>
                    ))}
                    <Stack direction="row" spacing={0.7}>
                      <TextField
                        fullWidth
                        size="small"
                        value={newSkill}
                        onChange={(event) => setNewSkill(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key !== "Enter") return;
                          event.preventDefault();
                          addSkill();
                        }}
                        placeholder={tt("Legg til ferdighet", "Add skill")}
                      />
                      <Button
                        onClick={addSkill}
                        sx={{
                          textTransform: "none",
                          color: "#edf0f7",
                          border:
                            "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.16)",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {tt("Legg til", "Add")}
                      </Button>
                    </Stack>

                    <Divider sx={{ borderColor: "rgba(255,255,255,0.08)" }} />

                    <Typography sx={{ fontWeight: 700, fontSize: 14 }}>
                      {tt("Transformasjoner", "Transformations")}
                    </Typography>
                    {transformationItems.map((item, index) => (
                      <Stack
                        key={`transformation-${index}`}
                        direction="row"
                        spacing={0.7}
                      >
                        <TextField
                          fullWidth
                          size="small"
                          value={item}
                          onChange={(event) =>
                            updateTransformationAtIndex(
                              index,
                              event.target.value,
                            )
                          }
                          placeholder={tt(
                            "Observerbar endring hos studenten",
                            "Observable learner transformation",
                          )}
                        />
                        <IconButton
                          onClick={() => removeTransformationAtIndex(index)}
                          size="small"
                          sx={{
                            color: "rgba(237,240,247,0.78)",
                            border:
                              "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.16)",
                          }}
                        >
                          <DeleteOutline fontSize="small" />
                        </IconButton>
                      </Stack>
                    ))}
                    <Stack direction="row" spacing={0.7}>
                      <TextField
                        fullWidth
                        size="small"
                        value={newTransformation}
                        onChange={(event) =>
                          setNewTransformation(event.target.value)
                        }
                        onKeyDown={(event) => {
                          if (event.key !== "Enter") return;
                          event.preventDefault();
                          addTransformation();
                        }}
                        placeholder={tt(
                          "Legg til transformasjon",
                          "Add transformation",
                        )}
                      />
                      <Button
                        onClick={addTransformation}
                        sx={{
                          textTransform: "none",
                          color: "#edf0f7",
                          border:
                            "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.16)",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {tt("Legg til", "Add")}
                      </Button>
                    </Stack>
                  </Stack>
                </Box>
                ) : null}

                {activeFoundationSection === "suggestions" ? (
                <Box sx={{ ...panelSx, p: 1.2 }}>
                  <Stack
                    direction="row"
                    spacing={1}
                    alignItems="center"
                    justifyContent="space-between"
                  >
                    <Typography sx={sectionLabelSx}>
                      {tt(
                        "Kompetansekart per nivå",
                        "Competency Map by Level",
                      )}
                    </Typography>
                    <Button
                      size="small"
                      startIcon={<Add fontSize="small" />}
                      onClick={addCompetencyMapRow}
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
                  <Typography
                    sx={{
                      mt: 0.7,
                      color: "rgba(237,240,247,0.72)",
                      fontSize: 13,
                    }}
                  >
                    {tt(
                      "AI foreslår et nivåkart for hver kompetanse med progresjon fra grunnleggende til operativ og avansert mestring.",
                      "AI proposes a level map for each competency with progression from basic to operational and advanced mastery.",
                    )}
                  </Typography>
                  <Stack spacing={0.9} sx={{ mt: 1 }}>
                    {competencyMapRows.length === 0 ? (
                      <Typography
                        sx={{ color: "rgba(237,240,247,0.62)", fontSize: 13 }}
                      >
                        {tt(
                          "Kompetansekartet fylles ut når AI-intervjuet har nok kontekst.",
                          "The competency map is filled when the AI interview has enough context.",
                        )}
                      </Typography>
                    ) : null}
                    {competencyMapRows.map((row, index) => (
                      <Box
                        key={row.id}
                        sx={{
                          p: 1,
                          borderRadius: 1,
                          border:
                            "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.1)",
                          background:
                            "linear-gradient(145deg, rgba(12,16,24,0.72), rgba(8,11,18,0.9))",
                          display: "grid",
                          gap: 0.9,
                        }}
                      >
                        <Stack
                          direction="row"
                          spacing={0.6}
                          alignItems="center"
                          justifyContent="space-between"
                        >
                          <Stack direction="row" spacing={0.6} alignItems="center">
                            <Typography
                              sx={{
                                color: "rgba(237,240,247,0.68)",
                                fontSize: 12,
                                fontWeight: 700,
                                letterSpacing: "0.04em",
                                textTransform: "uppercase",
                              }}
                            >
                              {tt(
                                `Kompetansekart ${index + 1}`,
                                `Competency map ${index + 1}`,
                              )}
                            </Typography>
                            {row.locked ? (
                              <Chip
                                size="small"
                                label={tt("Beholdt", "Kept")}
                                sx={{
                                  color: "#f8d56f",
                                  bgcolor: "rgba(248,179,33,0.14)",
                                }}
                              />
                            ) : null}
                          </Stack>
                          <Stack direction="row" spacing={0.5}>
                            <IconButton
                              size="small"
                              onClick={() => toggleCompetencyMapRowLocked(index)}
                              sx={compactActionButtonSx}
                              aria-label={tt("Behold forslag", "Keep suggestion")}
                            >
                              {row.locked ? (
                                <LockOutlined fontSize="small" />
                              ) : (
                                <LockOpen fontSize="small" />
                              )}
                            </IconButton>
                            <IconButton
                              size="small"
                              onClick={() => moveCompetencyMapRow(index, -1)}
                              sx={compactActionButtonSx}
                              disabled={index === 0}
                              aria-label={tt("Flytt opp", "Move up")}
                            >
                              <ArrowUpward fontSize="small" />
                            </IconButton>
                            <IconButton
                              size="small"
                              onClick={() => moveCompetencyMapRow(index, 1)}
                              sx={compactActionButtonSx}
                              disabled={index === competencyMapRows.length - 1}
                              aria-label={tt("Flytt ned", "Move down")}
                            >
                              <ArrowDownward fontSize="small" />
                            </IconButton>
                            <IconButton
                              size="small"
                              onClick={() => removeCompetencyMapRow(index)}
                              sx={compactActionButtonSx}
                              aria-label={tt("Fjern", "Remove")}
                            >
                              <DeleteOutline fontSize="small" />
                            </IconButton>
                          </Stack>
                        </Stack>

                        <Stack
                          direction={{ xs: "column", lg: "row" }}
                          spacing={0.8}
                        >
                          <TextField
                            fullWidth
                            size="small"
                            label={tt("Kompetanse", "Competency")}
                            value={row.title}
                            onChange={(event) =>
                              updateCompetencyMapRow(
                                index,
                                "title",
                                event.target.value,
                              )
                            }
                            placeholder={tt(
                              "F.eks. Verdibaserte salgsdialoger",
                              "e.g. Value-based sales conversations",
                            )}
                          />
                          <TextField
                            fullWidth
                            size="small"
                            label={tt("Beskrivelse", "Description")}
                            value={row.description}
                            onChange={(event) =>
                              updateCompetencyMapRow(
                                index,
                                "description",
                                event.target.value,
                              )
                            }
                            placeholder={tt(
                              "Hva kjennetegner mestring i denne kompetansen?",
                              "What defines mastery in this competency?",
                            )}
                          />
                        </Stack>

                        <Stack
                          direction={{ xs: "column", lg: "row" }}
                          spacing={0.8}
                        >
                          {([
                            {
                              key: "basic",
                              label: tt("Grunnleggende", "Basic"),
                              items: row.basic,
                              tint: "rgba(111,149,219,0.12)",
                              border: "rgba(111,149,219,0.24)",
                            },
                            {
                              key: "operational",
                              label: tt("Operativ", "Operational"),
                              items: row.operational,
                              tint: "rgba(248,179,33,0.12)",
                              border: "rgba(248,179,33,0.24)",
                            },
                            {
                              key: "advanced",
                              label: tt("Avansert", "Advanced"),
                              items: row.advanced,
                              tint: "rgba(92,180,128,0.12)",
                              border: "rgba(92,180,128,0.24)",
                            },
                          ] as Array<{
                            key: "basic" | "operational" | "advanced";
                            label: string;
                            items: string[];
                            tint: string;
                            border: string;
                          }>).map((level) => (
                            <Box
                              key={`${row.id}-${level.key}`}
                              sx={{
                                flex: 1,
                                minWidth: 0,
                                p: 0.9,
                                borderRadius: 1,
                                border: `var(--academy-hairline-width, 1px) solid ${level.border}`,
                                bgcolor: level.tint,
                                display: "grid",
                                gap: 0.65,
                              }}
                            >
                              <Typography
                                sx={{
                                  fontSize: 12,
                                  fontWeight: 700,
                                  letterSpacing: "0.05em",
                                  textTransform: "uppercase",
                                  color: "#f7f8fb",
                                }}
                              >
                                {level.label}
                              </Typography>
                              <TextField
                                fullWidth
                                size="small"
                                multiline
                                minRows={4}
                                value={level.items.join("\n")}
                                onChange={(event) =>
                                  updateCompetencyMapRow(
                                    index,
                                    level.key,
                                    event.target.value,
                                  )
                                }
                                placeholder={tt(
                                  "Én ferdighet eller indikator per linje",
                                  "One skill or indicator per line",
                                )}
                              />
                            </Box>
                          ))}
                        </Stack>
                      </Box>
                    ))}
                  </Stack>
                </Box>
                ) : null}

                {activeFoundationSection === "structure" && showAdvancedFoundationFields ? (
                <Box sx={{ ...panelSx, p: 1.2 }}>
                  <Typography sx={sectionLabelSx}>
                    {tt("Forslag til studioene", "Studio Suggestions")}
                  </Typography>
                  <Typography
                    sx={{
                      mt: 0.7,
                      color: "rgba(237,240,247,0.72)",
                      fontSize: 13,
                    }}
                  >
                    {tt(
                      "Det samme intervjuet brukes videre til forslag i ferdighetsbygger, Quiz Studio og Annoteringsstudio.",
                      "The same interview is reused for downstream suggestions in the skill builder, Quiz Studio, and Annotation Studio.",
                    )}
                  </Typography>
                  <Typography
                    sx={{
                      mt: 0.45,
                      color: "rgba(248,213,111,0.84)",
                      fontSize: 12.5,
                    }}
                  >
                    {tt(
                      "Lås forslag som skal beholdes før du kjører AI-intervjuet videre.",
                      "Lock suggestions you want to keep before running the AI interview further.",
                    )}
                  </Typography>

                  <Stack
                    direction="row"
                    spacing={0.6}
                    useFlexGap
                    flexWrap="wrap"
                    sx={{ mt: 1 }}
                  >
                    <Chip
                      size="small"
                      label={tt(
                        `${studioSuggestions.skills.length} ferdighetsforslag`,
                        `${studioSuggestions.skills.length} skill suggestions`,
                      )}
                      sx={{
                        color: "#edf0f7",
                        bgcolor: "rgba(111,149,219,0.12)",
                      }}
                    />
                    <Chip
                      size="small"
                      label={tt(
                        `${studioSuggestions.quiz.length} quizforslag`,
                        `${studioSuggestions.quiz.length} quiz suggestions`,
                      )}
                      sx={{
                        color: "#edf0f7",
                        bgcolor: "rgba(248,179,33,0.12)",
                      }}
                    />
                    <Chip
                      size="small"
                      label={tt(
                        `${studioSuggestions.annotations.length} annoteringsforslag`,
                        `${studioSuggestions.annotations.length} annotation suggestions`,
                      )}
                      sx={{
                        color: "#edf0f7",
                        bgcolor: "rgba(92,180,128,0.12)",
                      }}
                    />
                  </Stack>

                  <Stack spacing={0.9} sx={{ mt: 1 }}>
                    <Box
                      sx={{
                        p: 1,
                        borderRadius: 1,
                        border:
                          "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.1)",
                        background:
                          "linear-gradient(145deg, rgba(12,16,24,0.72), rgba(8,11,18,0.9))",
                        display: "grid",
                        gap: 0.8,
                      }}
                    >
                      <Stack
                        direction="row"
                        spacing={1}
                        alignItems="center"
                        justifyContent="space-between"
                      >
                        <Typography sx={{ fontWeight: 700, fontSize: 13.5 }}>
                          {tt("Ferdighetsbygger", "Skill builder")}
                        </Typography>
                        <Button
                          size="small"
                          startIcon={<Add fontSize="small" />}
                          onClick={addStudioSkillSuggestionRow}
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
                      {studioSuggestions.skills.length === 0 ? (
                        <Typography
                          sx={{ color: "rgba(237,240,247,0.62)", fontSize: 13 }}
                        >
                          {tt(
                            "Ingen ferdighetsforslag ennå. Legg til manuelt eller hent nye AI-forslag.",
                            "No skill suggestions yet. Add one manually or fetch new AI suggestions.",
                          )}
                        </Typography>
                      ) : null}
                      {studioSuggestions.skills.map((suggestion, suggestionIndex) => (
                          <Box
                            key={suggestion.id}
                            sx={{
                              p: 0.9,
                              borderRadius: 1,
                              border:
                                "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.08)",
                              bgcolor: "rgba(255,255,255,0.025)",
                              display: "grid",
                              gap: 0.75,
                            }}
                          >
                            <Stack
                              direction="row"
                              spacing={0.6}
                              alignItems="center"
                              justifyContent="space-between"
                            >
                              <Stack
                                direction="row"
                                spacing={0.6}
                                alignItems="center"
                                flexWrap="wrap"
                                useFlexGap
                              >
                                <Typography
                                  sx={{
                                    color: "rgba(237,240,247,0.68)",
                                    fontSize: 12,
                                    fontWeight: 700,
                                    letterSpacing: "0.04em",
                                    textTransform: "uppercase",
                                  }}
                                >
                                  {tt(
                                    `Ferdighetsforslag ${suggestionIndex + 1}`,
                                    `Skill suggestion ${suggestionIndex + 1}`,
                                  )}
                                </Typography>
                                <Chip
                                  size="small"
                                  label={competencyLevelLabel(suggestion.level, tt)}
                                  sx={{
                                    color: "#f8d56f",
                                    bgcolor: "rgba(248,179,33,0.12)",
                                  }}
                                />
                                {suggestion.locked ? (
                                  <Chip
                                    size="small"
                                    label={tt("Beholdt", "Kept")}
                                    sx={{
                                      color: "#edf0f7",
                                      bgcolor: "rgba(111,149,219,0.18)",
                                    }}
                                  />
                                ) : null}
                              </Stack>
                              <Stack direction="row" spacing={0.5}>
                                <IconButton
                                  size="small"
                                  onClick={() =>
                                    toggleStudioSkillSuggestionLocked(suggestionIndex)
                                  }
                                  sx={compactActionButtonSx}
                                  aria-label={tt("Behold forslag", "Keep suggestion")}
                                >
                                  {suggestion.locked ? (
                                    <LockOutlined fontSize="small" />
                                  ) : (
                                    <LockOpen fontSize="small" />
                                  )}
                                </IconButton>
                                <IconButton
                                  size="small"
                                  onClick={() =>
                                    moveStudioSkillSuggestionRow(suggestionIndex, -1)
                                  }
                                  sx={compactActionButtonSx}
                                  disabled={suggestionIndex === 0}
                                  aria-label={tt("Flytt opp", "Move up")}
                                >
                                  <ArrowUpward fontSize="small" />
                                </IconButton>
                                <IconButton
                                  size="small"
                                  onClick={() =>
                                    moveStudioSkillSuggestionRow(suggestionIndex, 1)
                                  }
                                  sx={compactActionButtonSx}
                                  disabled={
                                    suggestionIndex === studioSuggestions.skills.length - 1
                                  }
                                  aria-label={tt("Flytt ned", "Move down")}
                                >
                                  <ArrowDownward fontSize="small" />
                                </IconButton>
                                <IconButton
                                  size="small"
                                  onClick={() =>
                                    removeStudioSkillSuggestionRow(suggestionIndex)
                                  }
                                  sx={compactActionButtonSx}
                                  aria-label={tt("Fjern", "Remove")}
                                >
                                  <DeleteOutline fontSize="small" />
                                </IconButton>
                                <Button
                                  size="small"
                                  onClick={() =>
                                    toggleSuggestionEditorExpanded(
                                      "skill",
                                      suggestion.id,
                                    )
                                  }
                                  sx={{
                                    textTransform: "none",
                                    color: "#edf0f7",
                                    border:
                                      "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.14)",
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  {foundationEditorMode === "edit" ||
                                  isSuggestionEditorExpanded("skill", suggestion.id)
                                    ? tt("Skjul", "Hide")
                                    : tt("Rediger", "Edit")}
                                </Button>
                              </Stack>
                            </Stack>
                            <Typography
                              sx={{
                                color: "#f7f8fb",
                                fontSize: 14,
                                fontWeight: 700,
                              }}
                            >
                              {suggestion.title || tt("Ny ferdighet", "New skill")}
                            </Typography>
                            <Typography
                              sx={{
                                color: "rgba(237,240,247,0.72)",
                                fontSize: 12.5,
                              }}
                            >
                              {suggestion.objective ||
                                tt(
                                  "Legg til et læringsmål for å beskrive hvorfor denne ferdigheten finnes.",
                                  "Add a learning objective to describe why this skill exists.",
                                )}
                            </Typography>

                            <Collapse
                              in={
                                foundationEditorMode === "edit" ||
                                isSuggestionEditorExpanded("skill", suggestion.id)
                              }
                            >
                              <Stack spacing={0.75} sx={{ mt: 0.75 }}>
                                <Stack
                                  direction={{ xs: "column", lg: "row" }}
                                  spacing={0.8}
                                >
                                  <TextField
                                    fullWidth
                                    size="small"
                                    label={tt("Ferdighet", "Skill")}
                                    value={suggestion.title}
                                    onChange={(event) =>
                                      updateStudioSkillSuggestionAtIndex(
                                        suggestionIndex,
                                        "title",
                                        event.target.value,
                                      )
                                    }
                                  />
                                  <TextField
                                    fullWidth
                                    size="small"
                                    label={tt("Kompetanse", "Competency")}
                                    value={suggestion.competency}
                                    onChange={(event) =>
                                      updateStudioSkillSuggestionAtIndex(
                                        suggestionIndex,
                                        "competency",
                                        event.target.value,
                                      )
                                    }
                                  />
                                </Stack>

                                <Stack
                                  direction={{ xs: "column", lg: "row" }}
                                  spacing={0.8}
                                >
                                  <TextField
                                    select
                                    fullWidth
                                    size="small"
                                    label={tt("Nivå", "Level")}
                                    value={suggestion.level}
                                    onChange={(event) =>
                                      updateStudioSkillSuggestionAtIndex(
                                        suggestionIndex,
                                        "level",
                                        event.target.value,
                                      )
                                    }
                                  >
                                    <MenuItem value="basic">
                                      {tt("Grunnleggende", "Basic")}
                                    </MenuItem>
                                    <MenuItem value="operational">
                                      {tt("Operativ", "Operational")}
                                    </MenuItem>
                                    <MenuItem value="advanced">
                                      {tt("Avansert", "Advanced")}
                                    </MenuItem>
                                  </TextField>
                                  <TextField
                                    fullWidth
                                    size="small"
                                    type="number"
                                    label={tt("Anbefalt lengde (min)", "Recommended length (min)")}
                                    value={suggestion.recommendedDurationMinutes}
                                    onChange={(event) =>
                                      updateStudioSkillSuggestionAtIndex(
                                        suggestionIndex,
                                        "recommendedDurationMinutes",
                                        event.target.value,
                                      )
                                    }
                                    inputProps={{ min: 2, max: 45 }}
                                  />
                                </Stack>

                                <TextField
                                  fullWidth
                                  size="small"
                                  multiline
                                  minRows={2}
                                  label={tt("Læringsmål", "Learning objective")}
                                  value={suggestion.objective}
                                  onChange={(event) =>
                                    updateStudioSkillSuggestionAtIndex(
                                      suggestionIndex,
                                      "objective",
                                      event.target.value,
                                    )
                                  }
                                />
                              </Stack>
                            </Collapse>
                          </Box>
                        ))}
                    </Box>

                    <Box
                      sx={{
                        p: 1,
                        borderRadius: 1,
                        border:
                          "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.1)",
                        background:
                          "linear-gradient(145deg, rgba(12,16,24,0.72), rgba(8,11,18,0.9))",
                        display: "grid",
                        gap: 0.8,
                      }}
                    >
                      <Stack
                        direction="row"
                        spacing={1}
                        alignItems="center"
                        justifyContent="space-between"
                      >
                        <Typography sx={{ fontWeight: 700, fontSize: 13.5 }}>
                          {tt("Quiz Studio", "Quiz Studio")}
                        </Typography>
                        <Button
                          size="small"
                          startIcon={<Add fontSize="small" />}
                          onClick={addStudioQuizSuggestionRow}
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
                      {studioSuggestions.quiz.length === 0 ? (
                        <Typography
                          sx={{ color: "rgba(237,240,247,0.62)", fontSize: 13 }}
                        >
                          {tt(
                            "Ingen quizforslag ennå. Legg til manuelt eller hent nye AI-forslag.",
                            "No quiz suggestions yet. Add one manually or fetch new AI suggestions.",
                          )}
                        </Typography>
                      ) : null}
                      {studioSuggestions.quiz.map((suggestion, suggestionIndex) => (
                          <Box
                            key={suggestion.id}
                            sx={{
                              p: 0.9,
                              borderRadius: 1,
                              border:
                                "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.08)",
                              bgcolor: "rgba(255,255,255,0.025)",
                              display: "grid",
                              gap: 0.75,
                            }}
                          >
                            <Stack
                              direction="row"
                              spacing={0.6}
                              alignItems="center"
                              justifyContent="space-between"
                            >
                              <Stack
                                direction="row"
                                spacing={0.6}
                                alignItems="center"
                                flexWrap="wrap"
                                useFlexGap
                              >
                                <Typography
                                  sx={{
                                    color: "rgba(237,240,247,0.68)",
                                    fontSize: 12,
                                    fontWeight: 700,
                                    letterSpacing: "0.04em",
                                    textTransform: "uppercase",
                                  }}
                                >
                                  {tt(
                                    `Quizforslag ${suggestionIndex + 1}`,
                                    `Quiz suggestion ${suggestionIndex + 1}`,
                                  )}
                                </Typography>
                                <Chip
                                  size="small"
                                  label={competencyLevelLabel(suggestion.level, tt)}
                                  sx={{
                                    color: "#f8d56f",
                                    bgcolor: "rgba(248,179,33,0.12)",
                                  }}
                                />
                                {suggestion.locked ? (
                                  <Chip
                                    size="small"
                                    label={tt("Beholdt", "Kept")}
                                    sx={{
                                      color: "#edf0f7",
                                      bgcolor: "rgba(111,149,219,0.18)",
                                    }}
                                  />
                                ) : null}
                              </Stack>
                              <Stack direction="row" spacing={0.5}>
                                <IconButton
                                  size="small"
                                  onClick={() =>
                                    toggleStudioQuizSuggestionLocked(suggestionIndex)
                                  }
                                  sx={compactActionButtonSx}
                                  aria-label={tt("Behold forslag", "Keep suggestion")}
                                >
                                  {suggestion.locked ? (
                                    <LockOutlined fontSize="small" />
                                  ) : (
                                    <LockOpen fontSize="small" />
                                  )}
                                </IconButton>
                                <IconButton
                                  size="small"
                                  onClick={() =>
                                    moveStudioQuizSuggestionRow(suggestionIndex, -1)
                                  }
                                  sx={compactActionButtonSx}
                                  disabled={suggestionIndex === 0}
                                  aria-label={tt("Flytt opp", "Move up")}
                                >
                                  <ArrowUpward fontSize="small" />
                                </IconButton>
                                <IconButton
                                  size="small"
                                  onClick={() =>
                                    moveStudioQuizSuggestionRow(suggestionIndex, 1)
                                  }
                                  sx={compactActionButtonSx}
                                  disabled={
                                    suggestionIndex === studioSuggestions.quiz.length - 1
                                  }
                                  aria-label={tt("Flytt ned", "Move down")}
                                >
                                  <ArrowDownward fontSize="small" />
                                </IconButton>
                                <IconButton
                                  size="small"
                                  onClick={() =>
                                    removeStudioQuizSuggestionRow(suggestionIndex)
                                  }
                                  sx={compactActionButtonSx}
                                  aria-label={tt("Fjern", "Remove")}
                                >
                                  <DeleteOutline fontSize="small" />
                                </IconButton>
                                <Button
                                  size="small"
                                  onClick={() =>
                                    toggleSuggestionEditorExpanded(
                                      "quiz",
                                      suggestion.id,
                                    )
                                  }
                                  sx={{
                                    textTransform: "none",
                                    color: "#edf0f7",
                                    border:
                                      "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.14)",
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  {foundationEditorMode === "edit" ||
                                  isSuggestionEditorExpanded("quiz", suggestion.id)
                                    ? tt("Skjul", "Hide")
                                    : tt("Rediger", "Edit")}
                                </Button>
                              </Stack>
                            </Stack>

                            <Typography
                              sx={{
                                color: "#f7f8fb",
                                fontSize: 14,
                                fontWeight: 700,
                              }}
                            >
                              {suggestion.prompt || tt("Nytt quizspørsmål", "New quiz question")}
                            </Typography>
                            <Typography
                              sx={{
                                color: "rgba(237,240,247,0.72)",
                                fontSize: 12.5,
                              }}
                            >
                              {suggestion.hint ||
                                tt(
                                  "Legg til et kort hint eller la AI-forslaget stå som utgangspunkt.",
                                  "Add a short hint or keep the AI suggestion as the starting point.",
                                )}
                            </Typography>

                            <Collapse
                              in={
                                foundationEditorMode === "edit" ||
                                isSuggestionEditorExpanded("quiz", suggestion.id)
                              }
                            >
                              <Stack spacing={0.75} sx={{ mt: 0.75 }}>
                                <TextField
                                  fullWidth
                                  size="small"
                                  multiline
                                  minRows={2}
                                  label={tt("Spørsmål", "Question")}
                                  value={suggestion.prompt}
                                  onChange={(event) =>
                                    updateStudioQuizSuggestionAtIndex(
                                      suggestionIndex,
                                      "prompt",
                                      event.target.value,
                                    )
                                  }
                                />

                                <Stack
                                  direction={{ xs: "column", lg: "row" }}
                                  spacing={0.8}
                                >
                                  <TextField
                                    fullWidth
                                    size="small"
                                    label={tt("Hint", "Hint")}
                                    value={suggestion.hint}
                                    onChange={(event) =>
                                      updateStudioQuizSuggestionAtIndex(
                                        suggestionIndex,
                                        "hint",
                                        event.target.value,
                                      )
                                    }
                                  />
                                  <TextField
                                    fullWidth
                                    size="small"
                                    label={tt("Kompetanse", "Competency")}
                                    value={suggestion.competency}
                                    onChange={(event) =>
                                      updateStudioQuizSuggestionAtIndex(
                                        suggestionIndex,
                                        "competency",
                                        event.target.value,
                                      )
                                    }
                                  />
                                  <TextField
                                    fullWidth
                                    size="small"
                                    label={tt("Ferdighet", "Skill")}
                                    value={suggestion.skillTitle || ""}
                                    onChange={(event) =>
                                      updateStudioQuizSuggestionAtIndex(
                                        suggestionIndex,
                                        "skillTitle",
                                        event.target.value,
                                      )
                                    }
                                  />
                                </Stack>

                                <Stack
                                  direction={{ xs: "column", lg: "row" }}
                                  spacing={0.8}
                                >
                                  <TextField
                                    select
                                    fullWidth
                                    size="small"
                                    label={tt("Nivå", "Level")}
                                    value={suggestion.level}
                                    onChange={(event) =>
                                      updateStudioQuizSuggestionAtIndex(
                                        suggestionIndex,
                                        "level",
                                        event.target.value,
                                      )
                                    }
                                  >
                                    <MenuItem value="basic">
                                      {tt("Grunnleggende", "Basic")}
                                    </MenuItem>
                                    <MenuItem value="operational">
                                      {tt("Operativ", "Operational")}
                                    </MenuItem>
                                    <MenuItem value="advanced">
                                      {tt("Avansert", "Advanced")}
                                    </MenuItem>
                                  </TextField>
                                  <TextField
                                    select
                                    fullWidth
                                    size="small"
                                    label={tt("Type", "Type")}
                                    value={suggestion.type}
                                    onChange={(event) =>
                                      updateStudioQuizSuggestionAtIndex(
                                        suggestionIndex,
                                        "type",
                                        event.target.value,
                                      )
                                    }
                                  >
                                    <MenuItem value="single-choice">
                                      {tt("Ett riktig svar", "Single choice")}
                                    </MenuItem>
                                    <MenuItem value="multi-select">
                                      {tt("Flere riktige svar", "Multi-select")}
                                    </MenuItem>
                                    <MenuItem value="true-false">
                                      {tt("Sant/usant", "True/false")}
                                    </MenuItem>
                                    <MenuItem value="short-answer">
                                      {tt("Kort svar", "Short answer")}
                                    </MenuItem>
                                  </TextField>
                                </Stack>

                                <Stack
                                  direction={{ xs: "column", lg: "row" }}
                                  spacing={0.8}
                                >
                                  <TextField
                                    fullWidth
                                    size="small"
                                    type="number"
                                    label={tt("Varighet (sek)", "Duration (sec)")}
                                    value={suggestion.duration}
                                    onChange={(event) =>
                                      updateStudioQuizSuggestionAtIndex(
                                        suggestionIndex,
                                        "duration",
                                        event.target.value,
                                      )
                                    }
                                    inputProps={{ min: 4, max: 45 }}
                                  />
                                  <TextField
                                    fullWidth
                                    size="small"
                                    type="number"
                                    label={tt("Plassering i video (%)", "Placement in video (%)")}
                                    value={Math.round(suggestion.timestampRatio * 100)}
                                    onChange={(event) =>
                                      updateStudioQuizSuggestionAtIndex(
                                        suggestionIndex,
                                        "timestampRatio",
                                        String((Number(event.target.value || 0) || 0) / 100),
                                      )
                                    }
                                    inputProps={{ min: 0, max: 98 }}
                                  />
                                </Stack>

                                <TextField
                                  fullWidth
                                  size="small"
                                  multiline
                                  minRows={2}
                                  label={tt("Forklaring", "Explanation")}
                                  value={suggestion.explanation || ""}
                                  onChange={(event) =>
                                    updateStudioQuizSuggestionAtIndex(
                                      suggestionIndex,
                                      "explanation",
                                      event.target.value,
                                    )
                                  }
                                />

                                {showAdvancedFoundationFields ? (
                                  <TextField
                                    fullWidth
                                    size="small"
                                    label={tt("Tags", "Tags")}
                                    value={suggestion.tags.join(", ")}
                                    onChange={(event) =>
                                      updateStudioQuizSuggestionAtIndex(
                                        suggestionIndex,
                                        "tags",
                                        event.target.value,
                                      )
                                    }
                                    placeholder={tt(
                                      "F.eks. discovery, innvendinger, CRM",
                                      "e.g. discovery, objections, CRM",
                                    )}
                                  />
                                ) : null}

                                {suggestion.type === "short-answer" ? (
                                  showAdvancedFoundationFields ? (
                                    <TextField
                                      fullWidth
                                      size="small"
                                      multiline
                                      minRows={2}
                                      label={tt(
                                        "Godkjente svar",
                                        "Accepted answers",
                                      )}
                                      value={(suggestion.acceptedAnswers || []).join("\n")}
                                      onChange={(event) =>
                                        updateStudioQuizSuggestionAtIndex(
                                          suggestionIndex,
                                          "acceptedAnswers",
                                          event.target.value,
                                        )
                                      }
                                      placeholder={tt(
                                        "Ett svar per linje",
                                        "One answer per line",
                                      )}
                                    />
                                  ) : null
                                ) : (
                                  <Stack spacing={0.7}>
                                    {(suggestion.options || []).map((option, optionIndex) => (
                                      <Box
                                        key={`${suggestion.id}-${option.label}-${optionIndex}`}
                                        sx={{
                                          p: 0.75,
                                          borderRadius: 1,
                                          border:
                                            "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.08)",
                                          bgcolor: "rgba(255,255,255,0.03)",
                                          display: "grid",
                                          gap: 0.7,
                                        }}
                                      >
                                        <Stack
                                          direction="row"
                                          spacing={0.8}
                                          alignItems="center"
                                          justifyContent="space-between"
                                        >
                                          <Typography
                                            sx={{
                                              color: "#f7f8fb",
                                              fontSize: 12.5,
                                              fontWeight: 700,
                                            }}
                                          >
                                            {tt("Alternativ", "Option")} {option.label}
                                          </Typography>
                                          <Stack
                                            direction="row"
                                            spacing={0.6}
                                            alignItems="center"
                                          >
                                            <Typography
                                              sx={{
                                                color: "rgba(237,240,247,0.68)",
                                                fontSize: 12,
                                              }}
                                            >
                                              {tt("Riktig", "Correct")}
                                            </Typography>
                                            <Switch
                                              size="small"
                                              checked={Boolean(option.isCorrect)}
                                              onChange={(event) =>
                                                updateStudioQuizOptionAtIndex(
                                                  suggestionIndex,
                                                  optionIndex,
                                                  "isCorrect",
                                                  event.target.checked,
                                                )
                                              }
                                            />
                                          </Stack>
                                        </Stack>
                                        <TextField
                                          fullWidth
                                          size="small"
                                          label={tt("Svartekst", "Answer text")}
                                          value={option.text}
                                          onChange={(event) =>
                                            updateStudioQuizOptionAtIndex(
                                              suggestionIndex,
                                              optionIndex,
                                              "text",
                                              event.target.value,
                                            )
                                          }
                                        />
                                        {showAdvancedFoundationFields ? (
                                          <TextField
                                            fullWidth
                                            size="small"
                                            label={tt("Forklaring", "Explanation")}
                                            value={option.explanation || ""}
                                            onChange={(event) =>
                                              updateStudioQuizOptionAtIndex(
                                                suggestionIndex,
                                                optionIndex,
                                                "explanation",
                                                event.target.value,
                                              )
                                            }
                                          />
                                        ) : null}
                                      </Box>
                                    ))}
                                  </Stack>
                                )}
                              </Stack>
                            </Collapse>
                          </Box>
                        ))}
                    </Box>

                    <Box
                      sx={{
                        p: 1,
                        borderRadius: 1,
                        border:
                          "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.1)",
                        background:
                          "linear-gradient(145deg, rgba(12,16,24,0.72), rgba(8,11,18,0.9))",
                        display: "grid",
                        gap: 0.8,
                      }}
                    >
                      <Stack
                        direction="row"
                        spacing={1}
                        alignItems="center"
                        justifyContent="space-between"
                      >
                        <Typography sx={{ fontWeight: 700, fontSize: 13.5 }}>
                          {tt("Annoteringsstudio", "Annotation Studio")}
                        </Typography>
                        <Button
                          size="small"
                          startIcon={<Add fontSize="small" />}
                          onClick={addStudioAnnotationSuggestionRow}
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
                      {studioSuggestions.annotations.length === 0 ? (
                        <Typography
                          sx={{ color: "rgba(237,240,247,0.62)", fontSize: 13 }}
                        >
                          {tt(
                            "Ingen annoteringsforslag ennå. Legg til manuelt eller hent nye AI-forslag.",
                            "No annotation suggestions yet. Add one manually or fetch new AI suggestions.",
                          )}
                        </Typography>
                      ) : null}
                      {studioSuggestions.annotations.map((suggestion, suggestionIndex) => (
                          <Box
                            key={suggestion.id}
                            sx={{
                              p: 0.9,
                              borderRadius: 1,
                              border:
                                "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.08)",
                              bgcolor: "rgba(255,255,255,0.025)",
                              display: "grid",
                              gap: 0.75,
                            }}
                          >
                            <Stack
                              direction="row"
                              spacing={0.6}
                              alignItems="center"
                              justifyContent="space-between"
                            >
                              <Stack
                                direction="row"
                                spacing={0.6}
                                alignItems="center"
                                flexWrap="wrap"
                                useFlexGap
                              >
                                <Typography
                                  sx={{
                                    color: "rgba(237,240,247,0.68)",
                                    fontSize: 12,
                                    fontWeight: 700,
                                    letterSpacing: "0.04em",
                                    textTransform: "uppercase",
                                  }}
                                >
                                  {tt(
                                    `Annoteringsforslag ${suggestionIndex + 1}`,
                                    `Annotation suggestion ${suggestionIndex + 1}`,
                                  )}
                                </Typography>
                                <Chip
                                  size="small"
                                  label={competencyLevelLabel(suggestion.level, tt)}
                                  sx={{
                                    color: "#f8d56f",
                                    bgcolor: "rgba(248,179,33,0.12)",
                                  }}
                                />
                                {suggestion.locked ? (
                                  <Chip
                                    size="small"
                                    label={tt("Beholdt", "Kept")}
                                    sx={{
                                      color: "#edf0f7",
                                      bgcolor: "rgba(111,149,219,0.18)",
                                    }}
                                  />
                                ) : null}
                              </Stack>
                              <Stack direction="row" spacing={0.5}>
                                <IconButton
                                  size="small"
                                  onClick={() =>
                                    toggleStudioAnnotationSuggestionLocked(suggestionIndex)
                                  }
                                  sx={compactActionButtonSx}
                                  aria-label={tt("Behold forslag", "Keep suggestion")}
                                >
                                  {suggestion.locked ? (
                                    <LockOutlined fontSize="small" />
                                  ) : (
                                    <LockOpen fontSize="small" />
                                  )}
                                </IconButton>
                                <IconButton
                                  size="small"
                                  onClick={() =>
                                    moveStudioAnnotationSuggestionRow(
                                      suggestionIndex,
                                      -1,
                                    )
                                  }
                                  sx={compactActionButtonSx}
                                  disabled={suggestionIndex === 0}
                                  aria-label={tt("Flytt opp", "Move up")}
                                >
                                  <ArrowUpward fontSize="small" />
                                </IconButton>
                                <IconButton
                                  size="small"
                                  onClick={() =>
                                    moveStudioAnnotationSuggestionRow(
                                      suggestionIndex,
                                      1,
                                    )
                                  }
                                  sx={compactActionButtonSx}
                                  disabled={
                                    suggestionIndex ===
                                    studioSuggestions.annotations.length - 1
                                  }
                                  aria-label={tt("Flytt ned", "Move down")}
                                >
                                  <ArrowDownward fontSize="small" />
                                </IconButton>
                                <IconButton
                                  size="small"
                                  onClick={() =>
                                    removeStudioAnnotationSuggestionRow(suggestionIndex)
                                  }
                                  sx={compactActionButtonSx}
                                  aria-label={tt("Fjern", "Remove")}
                                >
                                  <DeleteOutline fontSize="small" />
                                </IconButton>
                                <Button
                                  size="small"
                                  onClick={() =>
                                    toggleSuggestionEditorExpanded(
                                      "annotation",
                                      suggestion.id,
                                    )
                                  }
                                  sx={{
                                    textTransform: "none",
                                    color: "#edf0f7",
                                    border:
                                      "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.14)",
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  {foundationEditorMode === "edit" ||
                                  isSuggestionEditorExpanded("annotation", suggestion.id)
                                    ? tt("Skjul", "Hide")
                                    : tt("Rediger", "Edit")}
                                </Button>
                              </Stack>
                            </Stack>
                            <Typography
                              sx={{
                                color: "#f7f8fb",
                                fontSize: 14,
                                fontWeight: 700,
                              }}
                            >
                              {suggestion.title || tt("Ny annotering", "New annotation")}
                            </Typography>
                            <Typography
                              sx={{
                                color: "rgba(237,240,247,0.72)",
                                fontSize: 12.5,
                              }}
                            >
                              {suggestion.content ||
                                tt(
                                  "Legg til kort innhold som studenten skal se i spilleren.",
                                  "Add short content for what the learner should see in the player.",
                                )}
                            </Typography>

                            <Collapse
                              in={
                                foundationEditorMode === "edit" ||
                                isSuggestionEditorExpanded("annotation", suggestion.id)
                              }
                            >
                              <Stack spacing={0.75} sx={{ mt: 0.75 }}>
                                <Stack
                                  direction={{ xs: "column", lg: "row" }}
                                  spacing={0.8}
                                >
                                  <TextField
                                    select
                                    fullWidth
                                    size="small"
                                    label={tt("Type", "Type")}
                                    value={suggestion.type}
                                    onChange={(event) =>
                                      updateStudioAnnotationSuggestionAtIndex(
                                        suggestionIndex,
                                        "type",
                                        event.target.value,
                                      )
                                    }
                                  >
                                    <MenuItem value="callout">Callout</MenuItem>
                                    <MenuItem value="note">{tt("Notat", "Note")}</MenuItem>
                                    <MenuItem value="hotspot">Hotspot</MenuItem>
                                    <MenuItem value="quiz">Quiz</MenuItem>
                                    <MenuItem value="link">{tt("Lenke", "Link")}</MenuItem>
                                    <MenuItem value="image">{tt("Bilde", "Image")}</MenuItem>
                                    <MenuItem value="video">Video</MenuItem>
                                  </TextField>
                                  <TextField
                                    select
                                    fullWidth
                                    size="small"
                                    label={tt("Nivå", "Level")}
                                    value={suggestion.level}
                                    onChange={(event) =>
                                      updateStudioAnnotationSuggestionAtIndex(
                                        suggestionIndex,
                                        "level",
                                        event.target.value,
                                      )
                                    }
                                  >
                                    <MenuItem value="basic">
                                      {tt("Grunnleggende", "Basic")}
                                    </MenuItem>
                                    <MenuItem value="operational">
                                      {tt("Operativ", "Operational")}
                                    </MenuItem>
                                    <MenuItem value="advanced">
                                      {tt("Avansert", "Advanced")}
                                    </MenuItem>
                                  </TextField>
                                </Stack>

                                <Stack
                                  direction={{ xs: "column", lg: "row" }}
                                  spacing={0.8}
                                >
                                  <TextField
                                    fullWidth
                                    size="small"
                                    label={tt("Tittel", "Title")}
                                    value={suggestion.title}
                                    onChange={(event) =>
                                      updateStudioAnnotationSuggestionAtIndex(
                                        suggestionIndex,
                                        "title",
                                        event.target.value,
                                      )
                                    }
                                  />
                                  <TextField
                                    fullWidth
                                    size="small"
                                    label={tt("Kompetanse", "Competency")}
                                    value={suggestion.competency}
                                    onChange={(event) =>
                                      updateStudioAnnotationSuggestionAtIndex(
                                        suggestionIndex,
                                        "competency",
                                        event.target.value,
                                      )
                                    }
                                  />
                                  <TextField
                                    fullWidth
                                    size="small"
                                    label={tt("Ferdighet", "Skill")}
                                    value={suggestion.skillTitle || ""}
                                    onChange={(event) =>
                                      updateStudioAnnotationSuggestionAtIndex(
                                        suggestionIndex,
                                        "skillTitle",
                                        event.target.value,
                                      )
                                    }
                                  />
                                </Stack>

                                <TextField
                                  fullWidth
                                  size="small"
                                  multiline
                                  minRows={2}
                                  label={tt("Innhold", "Content")}
                                  value={suggestion.content}
                                  onChange={(event) =>
                                    updateStudioAnnotationSuggestionAtIndex(
                                      suggestionIndex,
                                      "content",
                                      event.target.value,
                                    )
                                  }
                                />

                                <Stack
                                  direction={{ xs: "column", lg: "row" }}
                                  spacing={0.8}
                                >
                                  <TextField
                                    fullWidth
                                    size="small"
                                    type="number"
                                    label={tt("Start i video (%)", "Start in video (%)")}
                                    value={Math.round(suggestion.startRatio * 100)}
                                    onChange={(event) =>
                                      updateStudioAnnotationSuggestionAtIndex(
                                        suggestionIndex,
                                        "startRatio",
                                        String((Number(event.target.value || 0) || 0) / 100),
                                      )
                                    }
                                    inputProps={{ min: 0, max: 100 }}
                                  />
                                  <TextField
                                    fullWidth
                                    size="small"
                                    type="number"
                                    label={tt("Slutt i video (%)", "End in video (%)")}
                                    value={Math.round(suggestion.endRatio * 100)}
                                    onChange={(event) =>
                                      updateStudioAnnotationSuggestionAtIndex(
                                        suggestionIndex,
                                        "endRatio",
                                        String((Number(event.target.value || 0) || 0) / 100),
                                      )
                                    }
                                    inputProps={{ min: 0, max: 100 }}
                                  />
                                </Stack>

                                <Stack
                                  direction={{ xs: "column", lg: "row" }}
                                  spacing={0.8}
                                >
                                  <TextField
                                    select
                                    fullWidth
                                    size="small"
                                    label={tt("Handling", "Action")}
                                    value={suggestion.actionType || ""}
                                    onChange={(event) =>
                                      updateStudioAnnotationSuggestionAtIndex(
                                        suggestionIndex,
                                        "actionType",
                                        event.target.value,
                                      )
                                    }
                                  >
                                    <MenuItem value="">
                                      {tt("Kun vis innhold", "Show content only")}
                                    </MenuItem>
                                    <MenuItem value="showContent">
                                      {tt("Vis innhold", "Show content")}
                                    </MenuItem>
                                    <MenuItem value="showQuiz">Quiz</MenuItem>
                                    <MenuItem value="openLink">{tt("Åpne lenke", "Open link")}</MenuItem>
                                    <MenuItem value="playVideo">{tt("Spill video", "Play video")}</MenuItem>
                                    <MenuItem value="navigate">{tt("Naviger", "Navigate")}</MenuItem>
                                  </TextField>
                                  {showAdvancedFoundationFields ? (
                                    <TextField
                                      fullWidth
                                      size="small"
                                      label={tt("Handlingstarget", "Action target")}
                                      value={suggestion.actionTarget || ""}
                                      onChange={(event) =>
                                        updateStudioAnnotationSuggestionAtIndex(
                                          suggestionIndex,
                                          "actionTarget",
                                          event.target.value,
                                        )
                                      }
                                      placeholder={tt(
                                        "Lenke, video-id eller intern destinasjon",
                                        "Link, video id, or internal destination",
                                      )}
                                    />
                                  ) : null}
                                </Stack>
                              </Stack>
                            </Collapse>
                          </Box>
                        ))}
                    </Box>
                  </Stack>
                </Box>
                ) : null}

                {activeFoundationSection === "structure" && showAdvancedFoundationFields ? (
                <Box sx={{ ...panelSx, p: 1.2 }}>
                  <Typography sx={sectionLabelSx}>
                    {tt("Kompetansekart", "Skill Map")}
                  </Typography>
                  <Typography
                    sx={{
                      mt: 0.7,
                      color: "rgba(237,240,247,0.72)",
                      fontSize: 13,
                    }}
                  >
                    {tt(
                      "Dynamisk kart basert på kurset. Instruktør kan selv definere hvilke områder og mestringsmål som gjelder.",
                      "Dynamic map based on the course. Instructors define the areas and mastery goals they need.",
                    )}
                  </Typography>

                  <Stack spacing={0.8} sx={{ mt: 0.9 }}>
                    {skillMapRows.length === 0 ? (
                      <Typography
                        sx={{ color: "rgba(237,240,247,0.62)", fontSize: 13 }}
                      >
                        {tt(
                          "Ingen skill map-elementer lagt til ennå.",
                          "No skill map items added yet.",
                        )}
                      </Typography>
                    ) : null}

                    {skillMapRows.map((row, index) => (
                      <Stack
                        key={row.id}
                        direction={{ xs: "column", md: "row" }}
                        spacing={0.7}
                        alignItems={{ xs: "stretch", md: "center" }}
                      >
                        <TextField
                          fullWidth
                          size="small"
                          label={tt("Område", "Area")}
                          value={row.title}
                          onChange={(event) =>
                            updateSkillMapRow(
                              index,
                              "title",
                              event.target.value,
                            )
                          }
                          placeholder={tt("F.eks. Kamera", "e.g. Camera")}
                        />
                        <TextField
                          fullWidth
                          size="small"
                          label={tt("Mestringsmål", "Mastery Goal")}
                          value={row.focus}
                          onChange={(event) =>
                            updateSkillMapRow(
                              index,
                              "focus",
                              event.target.value,
                            )
                          }
                          placeholder={tt(
                            "Hva skal studenten mestre i dette området?",
                            "What should students master in this area?",
                          )}
                        />
                        <IconButton
                          onClick={() => removeSkillMapRow(index)}
                          size="small"
                          sx={{
                            color: "rgba(237,240,247,0.78)",
                            border:
                              "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.16)",
                            alignSelf: { xs: "flex-start", md: "center" },
                          }}
                        >
                          <DeleteOutline fontSize="small" />
                        </IconButton>
                      </Stack>
                    ))}

                    <Stack
                      direction={{ xs: "column", md: "row" }}
                      spacing={0.7}
                      alignItems={{ xs: "stretch", md: "center" }}
                    >
                      <TextField
                        fullWidth
                        size="small"
                        value={newSkillMapTitle}
                        onChange={(event) =>
                          setNewSkillMapTitle(event.target.value)
                        }
                        onKeyDown={(event) => {
                          if (event.key !== "Enter") return;
                          event.preventDefault();
                          addCustomSkillMapRow();
                        }}
                        placeholder={tt("Nytt område", "New area")}
                      />
                      <TextField
                        fullWidth
                        size="small"
                        value={newSkillMapFocus}
                        onChange={(event) =>
                          setNewSkillMapFocus(event.target.value)
                        }
                        onKeyDown={(event) => {
                          if (event.key !== "Enter") return;
                          event.preventDefault();
                          addCustomSkillMapRow();
                        }}
                        placeholder={tt(
                          "Nytt mestringsmål",
                          "New mastery goal",
                        )}
                      />
                      <Button
                        onClick={addCustomSkillMapRow}
                        sx={{
                          textTransform: "none",
                          color: "#edf0f7",
                          border:
                            "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.16)",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {tt("Legg til", "Add")}
                      </Button>
                    </Stack>

                    <Stack
                      direction="row"
                      spacing={0.6}
                      useFlexGap
                      flexWrap="wrap"
                      sx={{ pt: 0.2 }}
                    >
                      {suggestedSkillMapTemplate.map((template) => {
                        const alreadyExists = skillMapRows.some(
                          (row) =>
                            row.title.trim().toLowerCase() ===
                              template.title.toLowerCase() &&
                            row.focus.trim().toLowerCase() ===
                              template.focus.toLowerCase(),
                        );
                        return (
                          <Chip
                            key={`suggested-skill-map-${template.title}-${template.focus}`}
                            label={`${template.title}`}
                            onClick={() => {
                              if (alreadyExists) return;
                              addSkillMapRow(template);
                            }}
                            sx={{
                              color: alreadyExists
                                ? "rgba(237,240,247,0.44)"
                                : "rgba(237,240,247,0.78)",
                              bgcolor: alreadyExists
                                ? "rgba(255,255,255,0.03)"
                                : "rgba(255,255,255,0.06)",
                              border:
                                "var(--academy-hairline-width, 1px) dashed rgba(255,255,255,0.2)",
                              cursor: alreadyExists ? "default" : "pointer",
                            }}
                          />
                        );
                      })}
                    </Stack>
                  </Stack>
                </Box>
                ) : null}

                {activeFoundationSection === "structure" && showAdvancedFoundationFields ? (
                <Box sx={{ ...panelSx, p: 1.2 }}>
                  <Typography sx={sectionLabelSx}>Problems Solved</Typography>
                  <Typography
                    sx={{
                      mt: 0.7,
                      color: "rgba(237,240,247,0.72)",
                      fontSize: 13,
                    }}
                  >
                    {tt(
                      "Problem-drevet liste: hvorfor oppleves innholdet vanskelig i dag?",
                      "Problem-driven list: why does this feel hard today?",
                    )}
                  </Typography>
                  <Stack spacing={0.8} sx={{ mt: 0.9 }}>
                    {problemItems.map((problem, index) => (
                      <Stack
                        key={`problem-${index}`}
                        direction="row"
                        spacing={0.7}
                      >
                        <TextField
                          fullWidth
                          size="small"
                          value={problem}
                          onChange={(event) =>
                            updateProblemAtIndex(index, event.target.value)
                          }
                          placeholder={tt(
                            "Hvorfor feiler studenten her?",
                            "What problem fails students here?",
                          )}
                        />
                        <IconButton
                          onClick={() => removeProblemAtIndex(index)}
                          size="small"
                          sx={{
                            color: "rgba(237,240,247,0.78)",
                            border:
                              "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.16)",
                          }}
                        >
                          <DeleteOutline fontSize="small" />
                        </IconButton>
                      </Stack>
                    ))}
                    <Stack direction="row" spacing={0.7}>
                      <TextField
                        fullWidth
                        size="small"
                        value={newProblem}
                        onChange={(event) => setNewProblem(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key !== "Enter") return;
                          event.preventDefault();
                          addProblem();
                        }}
                        placeholder={tt(
                          "Problemer kurset løser",
                          "Problems this course solves",
                        )}
                      />
                      <Button
                        onClick={addProblem}
                        sx={{
                          textTransform: "none",
                          color: "#edf0f7",
                          border:
                            "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.16)",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {tt("Legg til", "Add")}
                      </Button>
                    </Stack>
                  </Stack>
                  <Stack
                    direction="row"
                    spacing={0.6}
                    useFlexGap
                    flexWrap="wrap"
                    sx={{ mt: 0.9 }}
                  >
                    {[
                      tt(
                        "Hvorfor bryllupsfilmer føles kjedelige",
                        "Why wedding films feel boring",
                      ),
                      tt(
                        "Hvorfor opptak ser flate ut",
                        "Why footage looks flat",
                      ),
                      tt(
                        "Hvorfor historiefortelling feiler",
                        "Why storytelling fails",
                      ),
                      tt(
                        "Hvorfor lyssetting ser amatør ut",
                        "Why lighting looks amateur",
                      ),
                    ].map((example) => (
                      <Chip
                        key={example}
                        label={example}
                        size="small"
                        sx={{
                          color: "rgba(237,240,247,0.78)",
                          bgcolor: "rgba(255,255,255,0.06)",
                          border:
                            "var(--academy-hairline-width, 1px) dashed rgba(255,255,255,0.2)",
                        }}
                      />
                    ))}
                  </Stack>
                </Box>
                ) : null}

                {activeFoundationSection === "structure" && showAdvancedFoundationFields ? (
                <Box sx={{ ...panelSx, p: 1.2 }}>
                  <Typography sx={sectionLabelSx}>
                    {tt("Læringsreise", "Learning Journey")}
                  </Typography>
                  <TextField
                    fullWidth
                    multiline
                    minRows={4}
                    sx={{ mt: 1 }}
                    label={tt("Læringsreise", "Learning Journey")}
                    placeholder={tt(
                      "Beskriv progresjon steg-for-steg fra introduksjon til mestring.",
                      "Describe step-by-step progression from introduction to mastery.",
                    )}
                    value={architectureDraft.learningJourney}
                    onChange={(event) =>
                      updateArchitectureField(
                        "learningJourney",
                        event.target.value,
                      )
                    }
                  />
                </Box>
                ) : null}

                {activeFoundationSection === "structure" && showAdvancedFoundationFields ? (
                <Box sx={{ ...panelSx, p: 1.2 }}>
                  <Typography sx={sectionLabelSx}>
                    {tt("Øvingsdesign", "Practice Design")}
                  </Typography>
                  <TextField
                    fullWidth
                    multiline
                    minRows={4}
                    sx={{ mt: 1 }}
                    label={tt("Øvingsdesign", "Practice Design")}
                    placeholder={tt(
                      "Hvordan skal studenten øve, få tilbakemelding og forbedre seg?",
                      "How should students practice, get feedback, and improve?",
                    )}
                    value={architectureDraft.practiceDesign}
                    onChange={(event) =>
                      updateArchitectureField(
                        "practiceDesign",
                        event.target.value,
                      )
                    }
                  />
                </Box>
                ) : null}

                {activeFoundationSection === "structure" && showAdvancedFoundationFields ? (
                <Box sx={{ ...panelSx, p: 1.2 }}>
                  <Typography sx={sectionLabelSx}>
                    Evaluering (Proof of Learning)
                  </Typography>
                  <TextField
                    fullWidth
                    multiline
                    minRows={4}
                    sx={{ mt: 1 }}
                    label={tt(
                      "Hvordan skal studentene bevise mestring?",
                      "How will students prove mastery?",
                    )}
                    placeholder={tt(
                      "Definer konkrete vurderingskriterier, oppgaver eller milepæler.",
                      "Define clear assessment criteria, assignments, or milestones.",
                    )}
                    value={architectureDraft.proofOfLearning}
                    onChange={(event) =>
                      updateArchitectureField(
                        "proofOfLearning",
                        event.target.value,
                      )
                    }
                  />
                </Box>
                ) : null}
              </Stack>
            </Box>

            <Box
              sx={{
                ...panelSx,
                minHeight: 0,
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
              }}
            >
              <Box sx={{ p: 1.2 }}>
                <Typography sx={{ fontSize: 20, fontWeight: 700 }}>
                  {activeCourse?.title ||
                    tt("Kompetansegrunnlag", "Competency Foundation")}
                </Typography>
                <Typography sx={{ mt: 0.3, color: "rgba(237,240,247,0.7)" }}>
                  {tt(
                    "Læreplanen her styrer pedagogisk retning, ikke modulbygging.",
                    "This curriculum controls pedagogical direction, not module building.",
                  )}
                </Typography>
              </Box>

              <Divider sx={{ borderColor: "rgba(255,255,255,0.08)" }} />

              <Box sx={{ p: 1.2, overflow: "auto", minHeight: 0 }}>
                <Stack spacing={1}>
                  <Box sx={{ ...panelSx, p: 1 }}>
                    <Typography sx={{ fontWeight: 700 }}>
                      {tt("Status", "Status")}
                    </Typography>
                    <Stack direction="row" spacing={0.7} sx={{ mt: 0.8 }}>
                      <Chip
                        size="small"
                        label={`${filledSectionCount}/15 ${tt("felt fylt", "fields filled")}`}
                        sx={{
                          color: "#edf0f7",
                          bgcolor: "rgba(255,255,255,0.12)",
                        }}
                      />
                      <Chip
                        size="small"
                        label={`${problemItems.length} ${tt("problemer", "problems")}`}
                        sx={{
                          color: "#111",
                          bgcolor: "rgba(248,179,33,0.9)",
                          fontWeight: 700,
                        }}
                      />
                      <Chip
                        size="small"
                        label={`${competencyItems.length}/${skillItems.length}/${transformationItems.length}`}
                        sx={{
                          color: "#edf0f7",
                          bgcolor: "rgba(111,149,219,0.22)",
                          border:
                            "var(--academy-hairline-width, 1px) solid rgba(111,149,219,0.35)",
                        }}
                      />
                    </Stack>
                  </Box>

                  <Box sx={{ ...panelSx, p: 1 }}>
                    <Stack
                      direction="row"
                      spacing={0.8}
                      alignItems="center"
                      justifyContent="space-between"
                    >
                      <Typography sx={{ fontWeight: 700 }}>
                        {tt("Versjonshistorikk", "Version history")}
                      </Typography>
                      <Chip
                        size="small"
                        label={autosaveStatusLabel}
                        sx={{
                          color:
                            curriculumAutosaveState === "saved"
                              ? "#d8f4df"
                              : curriculumAutosaveState === "saving"
                                ? "#f8d56f"
                                : "#edf0f7",
                          bgcolor:
                            curriculumAutosaveState === "saved"
                              ? "rgba(92,180,128,0.16)"
                              : curriculumAutosaveState === "saving"
                                ? "rgba(248,179,33,0.12)"
                                : "rgba(255,255,255,0.08)",
                          border:
                            curriculumAutosaveState === "saved"
                              ? "var(--academy-hairline-width, 1px) solid rgba(92,180,128,0.28)"
                              : curriculumAutosaveState === "saving"
                                ? "var(--academy-hairline-width, 1px) solid rgba(248,179,33,0.24)"
                                : "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.16)",
                          fontWeight: 700,
                        }}
                      />
                    </Stack>
                    <Typography
                      sx={{
                        mt: 0.7,
                        color: "rgba(237,240,247,0.68)",
                        fontSize: 12.5,
                      }}
                    >
                      {curriculumLastSavedAt
                        ? `${tt("Siste autosave", "Last autosave")}: ${new Date(
                            curriculumLastSavedAt,
                          ).toLocaleString(isNorwegian ? "no-NO" : "en-US", {
                            day: "2-digit",
                            month: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}`
                        : tt(
                            "Utkastet lagres automatisk lokalt mens du jobber.",
                            "The draft is saved locally while you work.",
                          )}
                    </Typography>
                    <Stack spacing={0.8} sx={{ mt: 1 }}>
                      {curriculumVersionEntries.length === 0 ? (
                        <Typography
                          sx={{
                            color: "rgba(237,240,247,0.62)",
                            fontSize: 13,
                          }}
                        >
                          {tt(
                            "Ingen versjoner lagret ennå. Første manuelle lagring eller AI-oppdatering oppretter historikk.",
                            "No versions saved yet. The first manual save or AI update creates history.",
                          )}
                        </Typography>
                      ) : (
                        curriculumVersionEntries.map((entry) => (
                          <Box
                            key={entry.id}
                            sx={{
                              p: 0.85,
                              borderRadius: 1,
                              border:
                                selectedCurriculumVersionId === entry.id
                                  ? "var(--academy-hairline-width, 1px) solid rgba(248,179,33,0.35)"
                                  : "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.08)",
                              background:
                                selectedCurriculumVersionId === entry.id
                                  ? "rgba(248,179,33,0.08)"
                                  : "rgba(255,255,255,0.03)",
                            }}
                          >
                            <Stack
                              direction="row"
                              spacing={0.8}
                              alignItems="center"
                              justifyContent="space-between"
                            >
                              <Box sx={{ minWidth: 0 }}>
                                <Typography
                                  sx={{ fontSize: 13, fontWeight: 700 }}
                                  noWrap
                                >
                                  {entry.label}
                                </Typography>
                                <Typography
                                  sx={{
                                    color: "rgba(237,240,247,0.64)",
                                    fontSize: 12,
                                  }}
                                  noWrap
                                >
                                  {new Date(entry.savedAt).toLocaleString(
                                    isNorwegian ? "no-NO" : "en-US",
                                    {
                                      day: "2-digit",
                                      month: "2-digit",
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    },
                                  )}
                                </Typography>
                              </Box>
                              <Button
                                onClick={() => restoreCurriculumVersion(entry.id)}
                                sx={{
                                  textTransform: "none",
                                  color: "#edf0f7",
                                  border:
                                    "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.16)",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {tt("Gjenopprett", "Restore")}
                              </Button>
                            </Stack>
                          </Box>
                        ))
                      )}
                    </Stack>
                  </Box>

                  <Box sx={{ ...panelSx, p: 1 }}>
                    <Typography sx={{ fontWeight: 700, mb: 0.7 }}>
                      {tt("Fagansvarlig", "Competency lead")}
                    </Typography>
                    <Stack direction="row" spacing={0.8} alignItems="center">
                      <Avatar
                        src={
                          selectedLeadInstructor?.avatar ||
                          activeCourse?.instructor?.avatar ||
                          undefined
                        }
                        sx={{
                          width: 34,
                          height: 34,
                          bgcolor: "#f8b321",
                          color: "#111",
                        }}
                      >
                        {String(
                          selectedLeadInstructor?.name ||
                            activeCourse?.instructor?.name ||
                            "N",
                        )
                          .charAt(0)
                          .toUpperCase()}
                      </Avatar>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography sx={{ fontWeight: 700 }} noWrap>
                          {selectedLeadInstructor?.name ||
                            activeCourse?.instructor?.name ||
                            tt("Ikke satt", "Not assigned")}
                        </Typography>
                        <Typography
                          sx={{ color: "rgba(237,240,247,0.68)", fontSize: 12 }}
                          noWrap
                        >
                          {selectedLeadInstructor?.profession ||
                            activeCourse?.instructor?.profession ||
                            tt("Ikke definert", "Not defined")}
                        </Typography>
                      </Box>
                    </Stack>
                  </Box>

                  <Box sx={{ ...panelSx, p: 1 }}>
                    <Typography sx={{ fontWeight: 700, mb: 0.7 }}>
                      {tt("Problems solved", "Problems solved")}
                    </Typography>
                    <Stack spacing={0.6}>
                      {(problemItems.length > 0
                        ? problemItems
                        : [tt("Ingen ennå", "None yet")]
                      ).map((item, index) => (
                        <Typography
                          key={`${item}-${index}`}
                          sx={{ color: "rgba(237,240,247,0.76)", fontSize: 13 }}
                        >
                          {item}
                        </Typography>
                      ))}
                    </Stack>
                  </Box>

                  <Box sx={{ ...panelSx, p: 1 }}>
                    <Typography sx={{ fontWeight: 700, mb: 0.8 }}>
                      {tt("Handlinger", "Actions")}
                    </Typography>
                    <Stack spacing={0.7}>
                      <Button
                        startIcon={<Save />}
                        onClick={() => void saveCurriculum(false)}
                        disabled={saving}
                        sx={{
                          textTransform: "none",
                          color: "#edf0f7",
                          border:
                            "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.16)",
                        }}
                      >
                        {tt("Lagre grunnlag", "Save foundation")}
                      </Button>
                      <Button
                        startIcon={<Publish />}
                        onClick={() => void saveCurriculum(true)}
                        disabled={saving}
                        sx={{
                          textTransform: "none",
                          color: "#0f0f0f",
                          background:
                            "linear-gradient(180deg, #ffd44e, #f2a616)",
                          fontWeight: 700,
                        }}
                      >
                        {tt("Publiser grunnlag", "Publish foundation")}
                      </Button>
                      <Button
                        onClick={() => {
                          if (onCancel) {
                            onCancel();
                          } else {
                            setLocation("/academy/course-creator");
                          }
                        }}
                        sx={{
                          textTransform: "none",
                          color: "rgba(237,240,247,0.78)",
                          border:
                            "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.16)",
                        }}
                      >
                        {tt("Lukk", "Close")}
                      </Button>
                    </Stack>
                  </Box>
                </Stack>
              </Box>
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

export default withUniversalIntegration(AcademyCurriculumStudio, {
  componentId: "academy-curriculum-studio",
  componentName: "Academy Curriculum Studio",
  componentType: "manager",
  componentCategory: "academy",
  featureIds: [
    "course-foundation",
    "pedagogical-architecture",
    "problem-driven-design",
    "proof-of-learning",
  ],
});
