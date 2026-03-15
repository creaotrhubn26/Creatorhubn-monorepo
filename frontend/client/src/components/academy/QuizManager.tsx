import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  Slider,
  Stack,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  AdsClick,
  Add,
  AutoFixHigh,
  Check,
  CloudDone,
  CloudOff,
  CloudSync,
  CropSquare,
  Edit,
  MailOutline,
  NotificationsNone,
  Pause,
  PlayArrow,
  Publish,
  RadioButtonUnchecked,
  Redo,
  Save,
  Search,
  Undo,
  Visibility,
  VisibilityOff,
  WarningAmber,
} from '@mui/icons-material';
import { useLocation } from 'wouter';
import {
  useAcademy,
  type CourseResource,
  type Lesson,
  type LessonResource,
  type PedagogicalQuizSuggestion,
} from '@/contexts/AcademyContext';
import { useEnhancedMasterIntegration } from '@/integration/EnhancedMasterIntegrationProvider';
import { withUniversalIntegration } from '@/integration/UniversalIntegrationHOC';
import { useAcademyLocale } from './academyLocale';
import AcademyLocaleSwitcher from './AcademyLocaleSwitcher';
import AcademyLeftSidebar from './AcademyLeftSidebar';
import AcademyPlayerStudio from './AcademyPlayerStudio';
import { resolveAcademyVideoUrl } from './academyVideoSourceUtils';
import {
  formatToolSavedTime,
  hasSavedDraftNewerThanPublished,
  syncCourseIdInLocation,
  useAcademyToolUx,
  useToolAutoSaveState,
  useToolHistory,
  useToolUndoRedoShortcuts,
} from './academyToolCore';

interface QuizOption {
  id: string;
  label: string;
  text: string;
  isCorrect: boolean;
  responses: number;
  explanation?: string;
}

type QuizQuestionType = 'single-choice' | 'multi-select' | 'true-false' | 'short-answer';

interface QuizQuestion {
  id: string;
  type: QuizQuestionType;
  prompt: string;
  hint: string;
  timestamp: number;
  duration: number;
  tags: string[];
  weight: number;
  shortAnswerAccepted: string[];
  options: QuizOption[];
}

interface QuizManagerProps {
  courseId?: string;
  onSave?: (payload: Record<string, unknown>) => void;
  onCancel?: () => void;
}

type RightTab = 'analytics' | 'results' | 'insights' | 'markers';
type QuizScope = 'course' | 'skill';
type QuizEditorMode = 'select' | 'edit';

interface QuizStoreEntry {
  questions: QuizQuestion[];
  participants: number;
  attempts: number;
  duration: number;
  rules: QuizRules;
  updatedAt: string;
  publishedAt?: string;
}

type QuizStoreMap = Record<string, QuizStoreEntry>;

interface QuizRules {
  randomizeQuestions: boolean;
  randomQuestionCount: number;
  maxRetries: number;
  revealAnswerAfterRetries: boolean;
  passingScore: number;
  negativeMarking: boolean;
}

interface QuizQualityIssue {
  id: string;
  questionId?: string;
  messageNo: string;
  messageEn: string;
}

interface StudentAnswerState {
  selectedIds: string[];
  shortAnswer: string;
  retries: number;
  submitted: boolean;
  correct: boolean | null;
  score: number;
  showAnswer: boolean;
  feedback: string;
}

const VIDEO_PLACEHOLDER = '/assets/academy/intro-video.mp4';
const QUIZ_STORE_KEY = 'academyQuizManagerStoreV2';
const QUIZ_RESOURCE_COURSE_PREFIX = 'quiz-config-course-';
const QUIZ_RESOURCE_SKILL_PREFIX = 'quiz-config-skill-';
const QUIZ_MIN_DURATION_SECONDS = 4;
const QUIZ_SAFE_AREA_MARGIN_PERCENT = 5;
const QUIZ_SNAP_STEP_SECONDS = 0.5;
const QUIZ_SNAP_TO_PLAYHEAD_THRESHOLD_SECONDS = 0.35;

const defaultQuizRules = (): QuizRules => ({
  randomizeQuestions: false,
  randomQuestionCount: 5,
  maxRetries: 2,
  revealAnswerAfterRetries: true,
  passingScore: 70,
  negativeMarking: false,
});

const defaultQuestions = (): QuizQuestion[] => [
  {
    id: `question-${Date.now()}-1`,
    type: 'single-choice',
    prompt: 'What is the primary function of a key light in film lighting?',
    hint: 'Watch the clip then choose the correct answer to proceed.',
    timestamp: 135,
    duration: 15,
    tags: ['lighting', 'fundamentals'],
    weight: 1,
    shortAnswerAccepted: [],
    options: [
      {
        id: 'opt-a',
        label: 'A',
        text: 'Fill in shadows',
        isCorrect: false,
        responses: 192,
        explanation: 'Fill light handles shadows, not key light.',
      },
      {
        id: 'opt-b',
        label: 'B',
        text: 'Provide a dramatic backlight',
        isCorrect: false,
        responses: 18,
        explanation: 'Backlight separates subject from background.',
      },
      {
        id: 'opt-c',
        label: 'C',
        text: 'Open up background detail',
        isCorrect: false,
        responses: 18,
        explanation: 'Background detail is controlled by overall exposure and fill.',
      },
      {
        id: 'opt-d',
        label: 'D',
        text: 'Highlight the main subject',
        isCorrect: true,
        responses: 310,
        explanation: 'Key light is the primary light shaping the subject.',
      },
    ],
  },
];

const cinematicPanelSx = {
  borderRadius: 1.4,
  border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.08)',
  background: 'linear-gradient(145deg, rgba(20,24,36,0.88), rgba(11,14,22,0.96))',
};
const QUIZ_CONTROL_BUTTON_SX = {
  height: 34,
  borderRadius: 1,
  textTransform: 'none',
  transition: 'all 140ms ease',
};
const QUIZ_NEUTRAL_OUTLINED_BUTTON_SX = {
  ...QUIZ_CONTROL_BUTTON_SX,
  borderColor: 'rgba(255,255,255,0.2)',
  color: '#edf0f7',
  bgcolor: 'rgba(255,255,255,0.02)',
  '&:hover': {
    borderColor: 'rgba(255,255,255,0.34)',
    bgcolor: 'rgba(255,255,255,0.06)',
  },
};
const QUIZ_WARNING_OUTLINED_BUTTON_SX = {
  ...QUIZ_CONTROL_BUTTON_SX,
  borderColor: 'rgba(248,179,33,0.35)',
  color: '#f8d675',
  bgcolor: 'rgba(248,179,33,0.06)',
  '&:hover': {
    borderColor: 'rgba(248,179,33,0.5)',
    bgcolor: 'rgba(248,179,33,0.14)',
  },
};
const QUIZ_NEUTRAL_ICON_BUTTON_SX = {
  width: 34,
  height: 34,
  color: '#edf0f7',
  border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.2)',
  borderRadius: 1,
  transition: 'all 140ms ease',
  '&:hover': {
    borderColor: 'rgba(255,255,255,0.34)',
    bgcolor: 'rgba(255,255,255,0.06)',
  },
};
const QUIZ_SAVE_BUTTON_SX = {
  ...QUIZ_NEUTRAL_OUTLINED_BUTTON_SX,
  minWidth: 104,
};
const QUIZ_PUBLISH_BUTTON_SX = {
  ...QUIZ_CONTROL_BUTTON_SX,
  minWidth: 112,
  color: '#0f0f0f',
  background: 'linear-gradient(180deg, #ffd44e, #f2a616)',
  border: 'var(--academy-hairline-width, 1px) solid rgba(248,179,33,0.68)',
  boxShadow: '0 8px 20px rgba(248,179,33,0.25)',
  '&:hover': {
    background: 'linear-gradient(180deg, #ffe07a, #f5b53a)',
    boxShadow: '0 10px 24px rgba(248,179,33,0.35)',
  },
};
const QUIZ_TOOLBAR_GROUP_SX = {
  p: 0.3,
  borderRadius: 1,
  border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.14)',
  bgcolor: 'rgba(255,255,255,0.03)',
  display: 'flex',
  gap: 0.4,
  flexWrap: 'wrap',
  alignItems: 'center',
};
const QUIZ_SECTION_LABEL_SX = {
  fontSize: 12,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: 'rgba(237,240,247,0.68)',
  fontWeight: 700,
};
const QUIZ_EDITOR_SECTION_SX = {
  borderRadius: 1,
  border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.1)',
  background: 'linear-gradient(145deg, rgba(255,255,255,0.035), rgba(255,255,255,0.015))',
  p: 1,
  display: 'grid',
  gap: 0.85,
};
const QUIZ_EDITOR_ACTION_BUTTON_SX = {
  textTransform: 'none',
  border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.2)',
  color: '#edf0f7',
};

const formatTime = (seconds: number): string => {
  const safe = Number.isFinite(seconds) && seconds >= 0 ? seconds : 0;
  const min = Math.floor(safe / 60);
  const sec = Math.floor(safe % 60);
  return `${min}:${sec.toString().padStart(2, '0')}`;
};

const parseMinuteSecondTime = (value: string, fallback: number): number => {
  const raw = String(value || '').trim();
  if (!raw) return fallback;
  if (!raw.includes(':')) {
    const parsedSeconds = Number(raw);
    if (Number.isFinite(parsedSeconds)) return parsedSeconds;
    return fallback;
  }
  const [rawMinutes, rawSeconds] = raw.split(':');
  const minutes = Number(rawMinutes);
  const seconds = Number(rawSeconds);
  if (!Number.isFinite(minutes) || !Number.isFinite(seconds)) return fallback;
  return minutes * 60 + seconds;
};

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));
const quizGold = '#f8b321';
const quizGoldSoft = alpha(quizGold, 0.16);
const quizGoldBorder = alpha(quizGold, 0.5);

const snapTimelineTime = (value: number, playhead: number, max: number): number => {
  const rounded = Math.round(value / QUIZ_SNAP_STEP_SECONDS) * QUIZ_SNAP_STEP_SECONDS;
  const safeRounded = clamp(rounded, 0, max);
  if (Math.abs(safeRounded - playhead) <= QUIZ_SNAP_TO_PLAYHEAD_THRESHOLD_SECONDS) {
    return clamp(playhead, 0, max);
  }
  return safeRounded;
};

const isEditableTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName.toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
  return Boolean(target.closest('[contenteditable="true"], [role="textbox"], [role="combobox"]'));
};

const decodeResourceJson = (url: string): unknown => {
  const raw = String(url || '');
  if (!raw) return null;
  try {
    if (raw.startsWith('data:')) {
      const delimiter = raw.indexOf(',');
      if (delimiter === -1) return null;
      return JSON.parse(decodeURIComponent(raw.slice(delimiter + 1)));
    }
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const normalizeQuizQuestion = (entry: unknown, index: number): QuizQuestion => {
  const fallbackId = `question-${Date.now()}-${index + 1}`;
  const source = (entry && typeof entry === 'object' ? entry : {}) as Record<string, unknown>;
  const typeRaw = String(source.type || 'single-choice').trim().toLowerCase();
  const type: QuizQuestionType =
    typeRaw === 'multi-select'
      ? 'multi-select'
      : typeRaw === 'true-false'
        ? 'true-false'
        : typeRaw === 'short-answer'
          ? 'short-answer'
          : 'single-choice';
  const rawTags = Array.isArray(source.tags) ? source.tags : [];
  const tags = rawTags
    .map((tag) => String(tag || '').trim().toLowerCase())
    .filter((tag) => tag.length > 0)
    .slice(0, 8);
  const rawShortAnswerAccepted = Array.isArray(source.shortAnswerAccepted)
    ? source.shortAnswerAccepted
    : [];
  const shortAnswerAccepted = rawShortAnswerAccepted
    .map((answer) => String(answer || '').trim().toLowerCase())
    .filter((answer) => answer.length > 0)
    .slice(0, 10);
  const weight = clamp(Number(source.weight || 1) || 1, 0.1, 5);

  const rawOptions = Array.isArray(source.options) ? source.options : [];
  const normalizedOptions: QuizOption[] = rawOptions
    .map((option, optionIndex) => {
      const optionSource = (option && typeof option === 'object' ? option : {}) as Record<string, unknown>;
      const label = String(optionSource.label || String.fromCharCode(65 + optionIndex)).slice(0, 1).toUpperCase();
      const text = String(optionSource.text || '').trim() || `Option ${label}`;
      return {
        id: String(optionSource.id || `${fallbackId}-opt-${optionIndex}`),
        label,
        text,
        isCorrect: Boolean(optionSource.isCorrect),
        responses: Math.max(0, Number(optionSource.responses || 0) || 0),
        explanation: String(optionSource.explanation || '').trim(),
      };
    })
    .slice(0, 6);

  while (normalizedOptions.length < 2) {
    const optionIndex = normalizedOptions.length;
    const label = String.fromCharCode(65 + optionIndex);
    normalizedOptions.push({
      id: `${fallbackId}-opt-${optionIndex}`,
      label,
      text: `Option ${label}`,
      isCorrect: optionIndex === 0,
      responses: 0,
      explanation: '',
    });
  }

  let fixedOptions = normalizedOptions;
  if (type !== 'short-answer') {
    const correctIndices = normalizedOptions.reduce<number[]>((acc, option, optionIndex) => {
      if (option.isCorrect) acc.push(optionIndex);
      return acc;
    }, []);
    if (type === 'multi-select') {
      const hasCorrect = correctIndices.length > 0;
      fixedOptions = normalizedOptions.map((option, optionIndex) => ({
        ...option,
        isCorrect: hasCorrect ? correctIndices.includes(optionIndex) : optionIndex === 0,
      }));
    } else {
      const firstCorrect = correctIndices[0] ?? 0;
      fixedOptions = normalizedOptions.map((option, optionIndex) => ({
        ...option,
        isCorrect: optionIndex === firstCorrect,
      }));
    }
  }

  const normalizedTrueFalseOptions: QuizOption[] =
    type === 'true-false'
      ? [
          {
            id: `${fallbackId}-true`,
            label: 'A',
            text: 'True',
            isCorrect: fixedOptions.some((option) => option.isCorrect && option.text.toLowerCase() === 'true')
              ? true
              : fixedOptions.some((option) => option.isCorrect && option.text.toLowerCase() === 'false')
                ? false
                : true,
            responses: fixedOptions.find((option) => option.text.toLowerCase() === 'true')?.responses || 0,
            explanation: fixedOptions.find((option) => option.text.toLowerCase() === 'true')?.explanation || '',
          },
          {
            id: `${fallbackId}-false`,
            label: 'B',
            text: 'False',
            isCorrect: fixedOptions.some((option) => option.isCorrect && option.text.toLowerCase() === 'false'),
            responses: fixedOptions.find((option) => option.text.toLowerCase() === 'false')?.responses || 0,
            explanation: fixedOptions.find((option) => option.text.toLowerCase() === 'false')?.explanation || '',
          },
        ]
      : fixedOptions;

  const timestamp = Math.max(0, Number(source.timestamp || 0) || 0);
  const questionDuration = Math.max(
    QUIZ_MIN_DURATION_SECONDS,
    Number(source.duration || QUIZ_MIN_DURATION_SECONDS) || QUIZ_MIN_DURATION_SECONDS,
  );

  return {
    id: String(source.id || fallbackId),
    type,
    prompt: String(source.prompt || '').trim() || `Question ${index + 1}`,
    hint: String(source.hint || '').trim() || 'Select one answer.',
    timestamp,
    duration: questionDuration,
    tags,
    weight,
    shortAnswerAccepted,
    options: normalizedTrueFalseOptions,
  };
};

const normalizeQuizQuestions = (entries: unknown): QuizQuestion[] => {
  if (!Array.isArray(entries)) return defaultQuestions();
  const normalized = entries.map((entry, index) => normalizeQuizQuestion(entry, index));
  if (normalized.length === 0) return defaultQuestions();
  return normalized;
};

const normalizeInterviewQuizSuggestions = (
  value: unknown,
): PedagogicalQuizSuggestion[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry, index) => {
      if (!entry || typeof entry !== 'object') return null;
      const source = entry as Record<string, unknown>;
      const prompt = String(source.prompt || '').trim();
      const competency = String(source.competency || '').trim();
      if (!prompt || !competency) return null;
      const typeRaw = String(source.type || '').trim().toLowerCase();
      const type: PedagogicalQuizSuggestion['type'] =
        typeRaw === 'multi-select'
          ? 'multi-select'
          : typeRaw === 'true-false'
            ? 'true-false'
            : typeRaw === 'short-answer'
              ? 'short-answer'
              : 'single-choice';
      const levelRaw = String(source.level || '').trim().toLowerCase();
      const level =
        levelRaw === 'basic'
          ? 'basic'
          : levelRaw === 'advanced'
            ? 'advanced'
            : 'operational';
      return {
        id:
          String(source.id || '').trim() ||
          `interview-quiz-${`${competency}-${prompt}`.toLowerCase().replace(/[^a-z0-9]+/g, "-") || index + 1}`,
        prompt,
        hint: String(source.hint || '').trim(),
        competency,
        skillTitle: String(source.skillTitle || '').trim() || undefined,
        level,
        type,
        options: Array.isArray(source.options)
          ? source.options
              .map((option, optionIndex) => {
                if (!option || typeof option !== 'object') return null;
                const optionSource = option as Record<string, unknown>;
                const text = String(optionSource.text || '').trim();
                if (!text) return null;
                return {
                  label:
                    String(optionSource.label || String.fromCharCode(65 + optionIndex))
                      .trim()
                      .slice(0, 1)
                      .toUpperCase() || String.fromCharCode(65 + optionIndex),
                  text,
                  isCorrect: Boolean(optionSource.isCorrect),
                  explanation: String(optionSource.explanation || '').trim() || undefined,
                };
              })
              .filter(
                (
                  option,
                ): option is {
                  label: string;
                  text: string;
                  isCorrect: boolean;
                  explanation?: string;
                } => Boolean(option),
              )
              .slice(0, 6)
          : [],
        acceptedAnswers: Array.isArray(source.acceptedAnswers)
          ? source.acceptedAnswers
              .map((answer) => String(answer || '').trim())
              .filter((answer) => answer.length > 0)
              .slice(0, 8)
          : [],
        explanation: String(source.explanation || '').trim() || undefined,
        timestampRatio: clamp(Number(source.timestampRatio || 0.12) || 0.12, 0, 0.98),
        duration: clamp(Number(source.duration || 12) || 12, 4, 45),
        tags: Array.isArray(source.tags)
          ? source.tags
              .map((tag) => String(tag || '').trim().toLowerCase())
              .filter((tag) => tag.length > 0)
              .slice(0, 8)
          : [],
      } satisfies PedagogicalQuizSuggestion;
    })
    .filter((entry): entry is PedagogicalQuizSuggestion => Boolean(entry))
    .slice(0, 12);
};

const buildQuizQuestionsFromInterviewSuggestions = (
  suggestions: PedagogicalQuizSuggestion[],
  durationSeconds: number,
): QuizQuestion[] => {
  const safeDuration = Math.max(60, Number(durationSeconds || 0) || 0);
  return normalizeQuizQuestions(
    suggestions.map((suggestion, index) => ({
      id: String(suggestion.id || `interview-question-${Date.now()}-${index + 1}`),
      type: suggestion.type,
      prompt: suggestion.prompt,
      hint: suggestion.hint || 'Velg riktig svar.',
      timestamp: clamp(
        Math.round(safeDuration * clamp(suggestion.timestampRatio, 0, 0.98)),
        0,
        Math.max(0, safeDuration - QUIZ_MIN_DURATION_SECONDS),
      ),
      duration: clamp(
        Number(suggestion.duration || QUIZ_MIN_DURATION_SECONDS) || QUIZ_MIN_DURATION_SECONDS,
        QUIZ_MIN_DURATION_SECONDS,
        Math.max(QUIZ_MIN_DURATION_SECONDS, safeDuration),
      ),
      tags:
        suggestion.tags.length > 0
          ? suggestion.tags
          : [
              String(suggestion.competency || '').trim().toLowerCase(),
              String(suggestion.skillTitle || '').trim().toLowerCase(),
              String(suggestion.level || '').trim(),
            ].filter((entry) => entry.length > 0),
      weight: suggestion.level === 'advanced' ? 1.3 : suggestion.level === 'basic' ? 0.9 : 1,
      shortAnswerAccepted:
        suggestion.type === 'short-answer'
          ? suggestion.acceptedAnswers.map((answer) => answer.toLowerCase())
          : [],
      options: suggestion.options.map((option, optionIndex) => ({
        id: `${suggestion.id}-opt-${optionIndex}`,
        label: option.label,
        text: option.text,
        isCorrect: option.isCorrect,
        responses: 0,
        explanation: option.explanation || suggestion.explanation || '',
      })),
    })),
  );
};

const isQuizResourceMatch = (
  resource: CourseResource | LessonResource,
  courseId: string,
  scope: QuizScope,
  lessonId?: string,
): boolean => {
  if (resource.type !== 'code') return false;
  const id = String(resource.id || '');
  if (scope === 'skill' && lessonId) {
    return id === `${QUIZ_RESOURCE_SKILL_PREFIX}${lessonId}`;
  }
  return (
    id === `${QUIZ_RESOURCE_COURSE_PREFIX}${courseId}` ||
    id === `quiz-config-${courseId}` ||
    id.startsWith('quiz-config-course-')
  );
};

const readQuizStore = (): QuizStoreMap => {
  if (typeof window === 'undefined') return {};
  try {
    const parsed = JSON.parse(window.localStorage.getItem(QUIZ_STORE_KEY) || '{}') as QuizStoreMap;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

const writeQuizStore = (store: QuizStoreMap): void => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(QUIZ_STORE_KEY, JSON.stringify(store));
  } catch {
    // ignore storage errors in local preview mode
  }
};

const normalizeQuizRules = (entry: unknown): QuizRules => {
  const source = (entry && typeof entry === 'object' ? entry : {}) as Record<string, unknown>;
  const defaults = defaultQuizRules();
  return {
    randomizeQuestions: Boolean(source.randomizeQuestions ?? defaults.randomizeQuestions),
    randomQuestionCount: clamp(
      Number(source.randomQuestionCount || defaults.randomQuestionCount) || defaults.randomQuestionCount,
      1,
      100,
    ),
    maxRetries: clamp(Number(source.maxRetries || defaults.maxRetries) || defaults.maxRetries, 1, 10),
    revealAnswerAfterRetries: Boolean(
      source.revealAnswerAfterRetries ?? defaults.revealAnswerAfterRetries,
    ),
    passingScore: clamp(Number(source.passingScore || defaults.passingScore) || defaults.passingScore, 0, 100),
    negativeMarking: Boolean(source.negativeMarking ?? defaults.negativeMarking),
  };
};

const seededRandom = (seed: number): (() => number) => {
  let state = Math.floor(seed) % 2147483647;
  if (state <= 0) state += 2147483646;
  return () => {
    state = (state * 16807) % 2147483647;
    return (state - 1) / 2147483646;
  };
};

const shuffleWithSeed = <T,>(items: T[], seed: number): T[] => {
  const next = [...items];
  const rand = seededRandom(seed);
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(rand() * (index + 1));
    const temp = next[index];
    next[index] = next[swapIndex];
    next[swapIndex] = temp;
  }
  return next;
};

function QuizManager({ courseId, onSave, onCancel }: QuizManagerProps) {
  const [location, setLocation] = useLocation();
  const { state, getCourse, getInstructor, updateCourse, setCurrentCourse } = useAcademy();
  const { analytics, debugging } = useEnhancedMasterIntegration();
  
  const { navLabel, tt } = useAcademyLocale();

  const videoRef = useRef<HTMLVideoElement>(null);

  const [leftNav, setLeftNav] = useState('tool-quiz');
  const [rightTab, setRightTab] = useState<RightTab>('results');
  const [editorMode, setEditorMode] = useState<QuizEditorMode>('select');
  const [previewMode, setPreviewMode] = useState<'instructor' | 'student'>('instructor');
  const [searchValue, setSearchValue] = useState('');
  const [tagFilter, setTagFilter] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [questions, setQuestions] = useState<QuizQuestion[]>(defaultQuestions);
  const [quizRules, setQuizRules] = useState<QuizRules>(defaultQuizRules);
  const [activeQuestionId, setActiveQuestionId] = useState('');
  const [studentQuestionIndex, setStudentQuestionIndex] = useState(0);
  const [studentSeed, setStudentSeed] = useState(() => Date.now());
  const [studentAnswers, setStudentAnswers] = useState<Record<string, StudentAnswerState>>({});
  const [selectedOptionId, setSelectedOptionId] = useState('');
  const [selectedOptionIds, setSelectedOptionIds] = useState<string[]>([]);
  const [shortAnswerInput, setShortAnswerInput] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [participants, setParticipants] = useState(370);
  const [attempts, setAttempts] = useState(0);
  const [individualScore, setIndividualScore] = useState(0);
  const [saveMessage, setSaveMessage] = useState('');

  const [currentTime, setCurrentTime] = useState(156);
  const [duration, setDuration] = useState(336);
  const [durationInput, setDurationInput] = useState(formatTime(336));
  const [isPlaying, setIsPlaying] = useState(false);
  const [safeAreaEnabled, setSafeAreaEnabled] = useState(true);
  const [timelineSnapEnabled, setTimelineSnapEnabled] = useState(true);
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [quizScope, setQuizScope] = useState<QuizScope>('course');
  const [selectedSkillId, setSelectedSkillId] = useState('');
  const timelineTrackRef = useRef<HTMLDivElement | null>(null);
  const draggingQuestionIdRef = useRef<string | null>(null);
  const hasDragSnapshotRef = useRef(false);
  const hydratedScopeKeyRef = useRef('');
  const autoSaveHydratedRef = useRef(false);
  const lastAutoSavedSignatureRef = useRef('');
  const { autoSaveState, lastSavedAt, markDirty, markSaving, markSaved } = useToolAutoSaveState();
  const [lastPublishedAt, setLastPublishedAt] = useState('');
  const [hasSavedChangesSincePublish, setHasSavedChangesSincePublish] = useState(false);
  const {
    simpleMode,
    toggleSimpleMode,
    shouldShowAdvanced,
  } = useAcademyToolUx('quiz');

  const routeCourseId = useMemo(() => {
    if (typeof window === 'undefined') return '';
    try {
      return String(new URLSearchParams(window.location.search).get('courseId') || '').trim();
    } catch {
      return '';
    }
  }, [location]);

  const routeLessonId = useMemo(() => {
    if (typeof window === 'undefined') return '';
    try {
      const params = new URLSearchParams(window.location.search);
      return String(params.get('lessonId') || params.get('skillId') || '').trim();
    } catch {
      return '';
    }
  }, [location]);

  const courseItems = useMemo(() => {
    return state.courses.map((course) => ({
      id: String(course.id),
      title: String(course.title || tt('Uten tittel', 'Untitled')),
    }));
  }, [state.courses, tt]);

  const courseOptionIds = useMemo(() => courseItems.map((course) => course.id), [courseItems]);

  useEffect(() => {
    const preferred = String(
      selectedCourseId || courseId || routeCourseId || state.currentCourse?.id || state.courses[0]?.id || '',
    ).trim();
    if (preferred && preferred !== selectedCourseId) {
      setSelectedCourseId(preferred);
    }
  }, [courseId, routeCourseId, selectedCourseId, state.courses, state.currentCourse?.id]);

  const selectedCourseValue = useMemo(() => {
    const preferredId = String(selectedCourseId || courseId || routeCourseId || state.currentCourse?.id || '').trim();
    if (preferredId && courseOptionIds.includes(preferredId)) return preferredId;
    return courseOptionIds[0] || '';
  }, [courseId, courseOptionIds, routeCourseId, selectedCourseId, state.currentCourse?.id]);

  useEffect(() => {
    if (selectedCourseValue && selectedCourseValue !== selectedCourseId) {
      setSelectedCourseId(selectedCourseValue);
    }
  }, [selectedCourseId, selectedCourseValue]);

  const resolvedCourseId = selectedCourseValue;

  const activeCourse = useMemo(() => {
    if (!resolvedCourseId) {
      return state.currentCourse || state.courses[0] || null;
    }
    return getCourse(resolvedCourseId) || state.currentCourse || state.courses[0] || null;
  }, [getCourse, resolvedCourseId, state.courses, state.currentCourse]);

  useEffect(() => {
    if (!activeCourse?.id) return;
    if (String(state.currentCourse?.id || '') === String(activeCourse.id)) return;
    setCurrentCourse(activeCourse);
  }, [activeCourse, setCurrentCourse, state.currentCourse?.id]);

  const skillOptions = useMemo<Lesson[]>(() => {
    return Array.isArray(activeCourse?.lessons) ? activeCourse.lessons : [];
  }, [activeCourse?.lessons]);

  useEffect(() => {
    const nextRouteLessonId = String(routeLessonId || '').trim();
    if (!nextRouteLessonId) return;
    if (quizScope !== 'skill') {
      setQuizScope('skill');
    }
    if (nextRouteLessonId !== selectedSkillId) {
      setSelectedSkillId(nextRouteLessonId);
    }
  }, [quizScope, routeLessonId, selectedSkillId]);

  const selectedSkill = useMemo(() => {
    if (!selectedSkillId) return null;
    return skillOptions.find((lesson) => String(lesson.id) === String(selectedSkillId)) || null;
  }, [selectedSkillId, skillOptions]);

  useEffect(() => {
    if (quizScope !== 'skill') return;
    if (skillOptions.length === 0) {
      setQuizScope('course');
      setSelectedSkillId('');
      return;
    }
    if (selectedSkill) return;
    const fallbackSkill = routeLessonId
      ? skillOptions.find((lesson) => String(lesson.id) === String(routeLessonId))
      : null;
    setSelectedSkillId(String((fallbackSkill || skillOptions[0]).id));
  }, [quizScope, routeLessonId, selectedSkill, skillOptions]);

  const effectiveScope: QuizScope = quizScope === 'skill' && selectedSkill ? 'skill' : 'course';

  const interviewQuizSuggestions = useMemo(() => {
    const allSuggestions = normalizeInterviewQuizSuggestions(
      activeCourse?.pedagogicalArchitecture?.studioSuggestions?.quiz,
    );
    if (effectiveScope !== 'skill' || !selectedSkill) {
      return allSuggestions;
    }
    const skillKey = String(selectedSkill.title || '').trim().toLowerCase();
    if (!skillKey) return allSuggestions.slice(0, 4);
    const exactSkillMatches = allSuggestions.filter(
      (suggestion) =>
        String(suggestion.skillTitle || '').trim().toLowerCase() === skillKey,
    );
    if (exactSkillMatches.length > 0) return exactSkillMatches;
    const filtered = allSuggestions.filter((suggestion) => {
      const competency = String(suggestion.competency || '').trim().toLowerCase();
      const suggestionSkill = String(suggestion.skillTitle || '').trim().toLowerCase();
      const prompt = String(suggestion.prompt || '').trim().toLowerCase();
      const tags = suggestion.tags.map((tag) => String(tag || '').trim().toLowerCase());
      return (
        suggestionSkill.includes(skillKey) ||
        competency.includes(skillKey) ||
        prompt.includes(skillKey) ||
        tags.includes(skillKey)
      );
    });
    return filtered.length > 0 ? filtered : allSuggestions.slice(0, 4);
  }, [
    activeCourse?.pedagogicalArchitecture?.studioSuggestions?.quiz,
    effectiveScope,
    selectedSkill,
  ]);

  const activeLesson = useMemo(() => {
    if (effectiveScope === 'skill' && selectedSkill) {
      return selectedSkill;
    }
    const lessons = skillOptions;
    if (lessons.length === 0) return null;
    const preferredLessonId = String(routeLessonId || state.currentLesson?.id || '').trim();
    if (preferredLessonId) {
      const matched = lessons.find((lesson) => String(lesson.id) === preferredLessonId);
      if (matched) return matched;
    }
    return lessons[0] || null;
  }, [effectiveScope, routeLessonId, selectedSkill, skillOptions, state.currentLesson?.id]);

  const buildRouteWithContext = useCallback(
    (route: string, options?: { includeLesson?: boolean; courseId?: string }) => {
      const includeLesson = options?.includeLesson !== false;
      const [rawPathname, rawQuery = ''] = String(route || '').split('?');
      const pathname = rawPathname || '/academy/quiz-manager';
      const params = new URLSearchParams(rawQuery);
      const nextCourseId = String(options?.courseId || resolvedCourseId || '').trim();
      if (nextCourseId) {
        params.set('courseId', nextCourseId);
      } else {
        params.delete('courseId');
      }
      params.delete('course_id');

      const nextSkillId = String(selectedSkill?.id || '').trim();
      if (includeLesson && effectiveScope === 'skill' && nextSkillId) {
        params.set('lessonId', nextSkillId);
        params.delete('skillId');
      } else {
        params.delete('lessonId');
        params.delete('skillId');
      }

      const suffix = params.toString();
      return suffix ? `${pathname}?${suffix}` : pathname;
    },
    [effectiveScope, resolvedCourseId, selectedSkill?.id],
  );

  const setLocationWithContext = useCallback(
    (route: string, includeLesson = true) => {
      setLocation(buildRouteWithContext(route, { includeLesson }));
    },
    [buildRouteWithContext, setLocation],
  );

  const syncCourseIdInRoute = useCallback(
    (nextCourseId: string) => {
      const normalizedCourseId = String(nextCourseId || '').trim();
      syncCourseIdInLocation(location, setLocation, normalizedCourseId);
      const [pathname, rawQuery = ''] = String(location || '').split('?');
      const params = new URLSearchParams(rawQuery);
      if (normalizedCourseId) {
        params.set('courseId', normalizedCourseId);
      } else {
        params.delete('courseId');
      }
      params.delete('course_id');
      if (effectiveScope === 'skill' && selectedSkill?.id) {
        params.set('lessonId', String(selectedSkill.id));
        params.delete('skillId');
      } else {
        params.delete('lessonId');
        params.delete('skillId');
      }
      const suffix = params.toString();
      const target = suffix ? `${pathname}?${suffix}` : pathname;
      if (target !== location) {
        setLocation(target);
      }
    },
    [effectiveScope, location, selectedSkill?.id, setLocation],
  );

  useEffect(() => {
    const [pathname, rawQuery = ''] = String(location || '').split('?');
    const params = new URLSearchParams(rawQuery);
    let changed = false;

    if (resolvedCourseId && params.get('courseId') !== resolvedCourseId) {
      params.set('courseId', resolvedCourseId);
      changed = true;
    }
    if (!resolvedCourseId && params.has('courseId')) {
      params.delete('courseId');
      changed = true;
    }
    if (params.has('course_id')) {
      params.delete('course_id');
      changed = true;
    }

    if (effectiveScope === 'skill' && selectedSkill?.id) {
      const lessonId = String(selectedSkill.id);
      if (params.get('lessonId') !== lessonId) {
        params.set('lessonId', lessonId);
        changed = true;
      }
      if (params.has('skillId')) {
        params.delete('skillId');
        changed = true;
      }
    } else {
      if (params.has('lessonId')) {
        params.delete('lessonId');
        changed = true;
      }
      if (params.has('skillId')) {
        params.delete('skillId');
        changed = true;
      }
    }

    if (!changed) return;
    const suffix = params.toString();
    const next = suffix ? `${pathname}?${suffix}` : pathname;
    if (next !== location) {
      setLocation(next);
    }
  }, [effectiveScope, location, resolvedCourseId, selectedSkill?.id, setLocation]);

  const effectiveInstructor = useMemo(() => {
    const lessonInstructorId = String(activeLesson?.videoInstructorId || '').trim();
    if (lessonInstructorId) {
      const lessonInstructor = getInstructor(lessonInstructorId);
      if (lessonInstructor) {
        return {
          id: String(lessonInstructor.id || '').trim(),
          name: String(lessonInstructor.name || '').trim(),
          avatar: String(lessonInstructor.avatar || '').trim(),
        };
      }
    }

    const leadInstructorId = String(
      activeCourse?.competencyLeadInstructorId || activeCourse?.instructor?.id || '',
    ).trim();
    if (leadInstructorId) {
      const leadInstructor = getInstructor(leadInstructorId);
      if (leadInstructor) {
        return {
          id: String(leadInstructor.id || '').trim(),
          name: String(leadInstructor.name || '').trim(),
          avatar: String(leadInstructor.avatar || '').trim(),
        };
      }
    }

    const fallbackName = String(activeCourse?.instructor?.name || '').trim();
    if (!fallbackName) return null;
    return {
      id: String(activeCourse?.instructor?.id || '').trim() || 'legacy-course-instructor',
      name: fallbackName,
      avatar: String(activeCourse?.instructor?.avatar || '').trim(),
    };
  }, [
    activeCourse?.competencyLeadInstructorId,
    activeCourse?.instructor?.avatar,
    activeCourse?.instructor?.id,
    activeCourse?.instructor?.name,
    activeLesson?.videoInstructorId,
    getInstructor,
  ]);

  const effectiveVideoUrl = useMemo(
    () =>
      resolveAcademyVideoUrl({
        course: activeCourse,
        preferredLessonId:
          effectiveScope === 'skill' ? selectedSkill?.id || null : activeLesson?.id || null,
        fallbackUrl: VIDEO_PLACEHOLDER,
      }),
    [activeCourse, activeLesson?.id, effectiveScope, selectedSkill?.id],
  );

  const {
    versions,
    selectedVersionId,
    setSelectedVersionId,
    snapshotBeforeChange,
    replaceWithoutHistory,
    undo,
    redo,
    canUndo,
    canRedo,
    restoreVersion,
    bindUndoRedoShortcuts,
  } = useToolHistory<QuizQuestion>({
    items: questions,
    setItems: setQuestions,
  });

  useToolUndoRedoShortcuts(bindUndoRedoShortcuts);

  const scopeStorageKey = useMemo(() => {
    const course = String(resolvedCourseId || '').trim();
    if (!course) return '';
    if (effectiveScope === 'skill') {
      const lesson = String(selectedSkill?.id || '').trim();
      if (!lesson) return '';
      return `quiz:${course}:skill:${lesson}`;
    }
    return `quiz:${course}:course`;
  }, [effectiveScope, resolvedCourseId, selectedSkill?.id]);

  const scopeResources = useMemo<Array<CourseResource | LessonResource>>(() => {
    if (effectiveScope === 'skill') {
      return selectedSkill?.resources || [];
    }
    return activeCourse?.resources || [];
  }, [activeCourse?.resources, effectiveScope, selectedSkill?.resources]);

  const resourceDerivedQuiz = useMemo(() => {
    const matchedResource = scopeResources.find((resource) =>
      isQuizResourceMatch(resource, resolvedCourseId, effectiveScope, selectedSkill?.id),
    );
    if (!matchedResource) return null;
    const decoded = decodeResourceJson(String(matchedResource.url || ''));
    if (!decoded || typeof decoded !== 'object') return null;
    const parsed = decoded as Record<string, unknown>;
    return {
      questions: normalizeQuizQuestions(parsed.questions),
      participants: Math.max(0, Number(parsed.participants || 0) || 0),
      attempts: Math.max(0, Number(parsed.attempts || 0) || 0),
      duration: Math.max(60, Number(parsed.duration || duration) || duration),
      rules: normalizeQuizRules(parsed.rules),
    };
  }, [duration, effectiveScope, resolvedCourseId, scopeResources, selectedSkill?.id]);

  useEffect(() => {
    if (!scopeStorageKey) return;
    if (hydratedScopeKeyRef.current === scopeStorageKey) return;
    hydratedScopeKeyRef.current = scopeStorageKey;

    const localStore = readQuizStore();
    const localEntry = localStore[scopeStorageKey];

    if (localEntry) {
      replaceWithoutHistory(normalizeQuizQuestions(localEntry.questions));
      setParticipants(Math.max(0, Number(localEntry.participants || 0) || 0));
      setAttempts(Math.max(0, Number(localEntry.attempts || 0) || 0));
      setDuration(Math.max(60, Number(localEntry.duration || duration) || duration));
      setQuizRules(normalizeQuizRules(localEntry.rules));
      setLastPublishedAt(String(localEntry.publishedAt || ''));
      setHasSavedChangesSincePublish(hasSavedDraftNewerThanPublished(localEntry.updatedAt, localEntry.publishedAt));
      setStudentAnswers({});
      setStudentQuestionIndex(0);
      setSelectedOptionId('');
      setSelectedOptionIds([]);
      setShortAnswerInput('');
      setSubmitted(false);
      setIndividualScore(0);
      markSaved();
      return;
    }

    if (resourceDerivedQuiz) {
      replaceWithoutHistory(resourceDerivedQuiz.questions);
      setParticipants(resourceDerivedQuiz.participants);
      setAttempts(resourceDerivedQuiz.attempts);
      setDuration(resourceDerivedQuiz.duration);
      setQuizRules(resourceDerivedQuiz.rules);
      setLastPublishedAt('');
      setHasSavedChangesSincePublish(false);
      setStudentAnswers({});
      setStudentQuestionIndex(0);
      setSelectedOptionId('');
      setSelectedOptionIds([]);
      setShortAnswerInput('');
      setSubmitted(false);
      setIndividualScore(0);
      markSaved();
      return;
    }

    if (interviewQuizSuggestions.length > 0) {
      const suggestedQuestions = buildQuizQuestionsFromInterviewSuggestions(
        interviewQuizSuggestions,
        duration,
      );
      replaceWithoutHistory(suggestedQuestions);
      setParticipants(0);
      setAttempts(0);
      setDuration(Math.max(duration, 240));
      setQuizRules(defaultQuizRules());
      setLastPublishedAt('');
      setHasSavedChangesSincePublish(false);
      setStudentAnswers({});
      setStudentQuestionIndex(0);
      setSelectedOptionId('');
      setSelectedOptionIds([]);
      setShortAnswerInput('');
      setSubmitted(false);
      setIndividualScore(0);
      setSaveMessage(
        tt(
          'Quizutkast er hentet fra AI-intervjuet.',
          'Quiz draft was loaded from the AI interview.',
        ),
      );
      markSaved();
      return;
    }

    const defaults = defaultQuestions();
    replaceWithoutHistory(defaults);
    setParticipants(370);
    setAttempts(0);
    setDuration(336);
    setQuizRules(defaultQuizRules());
    setLastPublishedAt('');
    setHasSavedChangesSincePublish(false);
    setStudentAnswers({});
    setStudentQuestionIndex(0);
    setSelectedOptionId('');
    setSelectedOptionIds([]);
    setShortAnswerInput('');
    setSubmitted(false);
    setIndividualScore(0);
    markSaved();
  }, [
    duration,
    interviewQuizSuggestions,
    markSaved,
    replaceWithoutHistory,
    resourceDerivedQuiz,
    scopeStorageKey,
    tt,
  ]);

  const autoSaveSignature = useMemo(
    () =>
      JSON.stringify({
        scopeStorageKey,
        duration,
        participants,
        attempts,
        questions,
        quizRules,
      }),
    [attempts, duration, participants, questions, quizRules, scopeStorageKey],
  );

  useEffect(() => {
    if (!scopeStorageKey) return;
    if (!autoSaveHydratedRef.current) {
      autoSaveHydratedRef.current = true;
      lastAutoSavedSignatureRef.current = autoSaveSignature;
      markSaved();
      return;
    }
    if (autoSaveSignature === lastAutoSavedSignatureRef.current) return;

    markDirty();
    const timer = window.setTimeout(() => {
      markSaving();
      const store = readQuizStore();
      const previousEntry = store[scopeStorageKey];
      store[scopeStorageKey] = {
        questions: normalizeQuizQuestions(questions),
        participants,
        attempts,
        duration,
        rules: quizRules,
        updatedAt: new Date().toISOString(),
        publishedAt: previousEntry?.publishedAt,
      };
      writeQuizStore(store);
      lastAutoSavedSignatureRef.current = autoSaveSignature;
      setLastPublishedAt(String(previousEntry?.publishedAt || ''));
      setHasSavedChangesSincePublish(Boolean(previousEntry?.publishedAt));
      markSaved();
    }, 650);

    return () => window.clearTimeout(timer);
  }, [
    attempts,
    autoSaveSignature,
    duration,
    markDirty,
    markSaved,
    markSaving,
    participants,
    questions,
    quizRules,
    scopeStorageKey,
  ]);

  useEffect(() => {
    autoSaveHydratedRef.current = false;
    lastAutoSavedSignatureRef.current = '';
  }, [scopeStorageKey]);

  useEffect(() => {
    setDurationInput(formatTime(duration));
  }, [duration]);

  useEffect(() => {
    if (questions.length === 0) {
      if (activeQuestionId) {
        setActiveQuestionId('');
      }
      return;
    }
    if (!activeQuestionId || !questions.some((question) => question.id === activeQuestionId)) {
      setActiveQuestionId(questions[0].id);
    }
  }, [questions, activeQuestionId]);

  const activeQuestion = useMemo(() => {
    return questions.find((question) => question.id === activeQuestionId) || questions[0] || null;
  }, [questions, activeQuestionId]);

  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    questions.forEach((question) => {
      question.tags.forEach((tag) => tagSet.add(tag));
    });
    return Array.from(tagSet).sort();
  }, [questions]);

  const randomizedQuestions = useMemo(() => {
    if (!quizRules.randomizeQuestions) return questions;
    const shuffled = shuffleWithSeed(questions, studentSeed);
    const count = clamp(
      Math.round(quizRules.randomQuestionCount || shuffled.length) || shuffled.length,
      1,
      Math.max(1, shuffled.length),
    );
    return shuffled.slice(0, count);
  }, [questions, quizRules.randomQuestionCount, quizRules.randomizeQuestions, studentSeed]);

  const studentQuestionPool = useMemo(
    () => (previewMode === 'student' ? randomizedQuestions : questions),
    [previewMode, questions, randomizedQuestions],
  );

  useEffect(() => {
    if (studentQuestionPool.length === 0) {
      if (studentQuestionIndex !== 0) setStudentQuestionIndex(0);
      return;
    }
    if (studentQuestionIndex < studentQuestionPool.length) return;
    setStudentQuestionIndex(studentQuestionPool.length - 1);
  }, [studentQuestionIndex, studentQuestionPool]);

  const activePreviewQuestion = useMemo(() => {
    if (previewMode !== 'student') return activeQuestion;
    if (studentQuestionPool.length === 0) return null;
    return studentQuestionPool[studentQuestionIndex] || studentQuestionPool[0] || null;
  }, [activeQuestion, previewMode, studentQuestionIndex, studentQuestionPool]);

  useEffect(() => {
    if (!activePreviewQuestion) {
      setSelectedOptionId('');
      setSelectedOptionIds([]);
      setShortAnswerInput('');
      setSubmitted(false);
      setIndividualScore(0);
      return;
    }
    const answerState = studentAnswers[activePreviewQuestion.id];
    const nextSelectedIds = answerState?.selectedIds || [];
    setSelectedOptionIds(nextSelectedIds);
    setSelectedOptionId(nextSelectedIds[0] || '');
    setShortAnswerInput(answerState?.shortAnswer || '');
    setSubmitted(Boolean(answerState?.submitted));
    setIndividualScore(answerState?.score || 0);
  }, [activePreviewQuestion, studentAnswers]);

  const selectedOptions = useMemo(() => {
    if (!activePreviewQuestion) return [];
    return activePreviewQuestion.options.filter((option) => selectedOptionIds.includes(option.id));
  }, [activePreviewQuestion, selectedOptionIds]);

  const selectedOption = useMemo(() => selectedOptions[0] || null, [selectedOptions]);

  const questionResults = useMemo(() => {
    if (!activeQuestion) {
      return { correctRate: 0, avgScore: 0 };
    }

    const correctResponses = activeQuestion.options.find((option) => option.isCorrect)?.responses || 0;
    const correctRate = clamp(Math.round((correctResponses / Math.max(participants, 1)) * 100), 0, 100);
    const avgScore = clamp(correctRate + 2, 0, 100);
    return { correctRate, avgScore };
  }, [activeQuestion, participants]);

  const questionAnalytics = useMemo(() => {
    return questions.map((question, index) => {
      const totalResponses = question.options.reduce(
        (sum, option) => sum + Math.max(0, Number(option.responses || 0) || 0),
        0,
      );
      const correctResponses = question.options
        .filter((option) => option.isCorrect)
        .reduce((sum, option) => sum + Math.max(0, Number(option.responses || 0) || 0), 0);
      const correctRate = totalResponses > 0 ? (correctResponses / totalResponses) * 100 : 0;
      const difficulty = clamp(Math.round(100 - correctRate), 0, 100);
      const tooEasy = correctRate >= 85;
      const tooHard = correctRate <= 35;
      const dropOff = clamp(
        Math.round(((participants - totalResponses) / Math.max(participants, 1)) * 100),
        0,
        100,
      );
      return {
        questionId: question.id,
        index,
        totalResponses,
        correctResponses,
        correctRate: Math.round(correctRate),
        difficulty,
        tooEasy,
        tooHard,
        dropOff,
      };
    });
  }, [participants, questions]);

  const activeQuestionMetrics = useMemo(() => {
    if (!activeQuestion) return null;
    return questionAnalytics.find((entry) => entry.questionId === activeQuestion.id) || null;
  }, [activeQuestion, questionAnalytics]);

  const qualityIssues = useMemo<QuizQualityIssue[]>(() => {
    const issues: QuizQualityIssue[] = [];
    let previousEnd = 0;

    questions.forEach((question, index) => {
      const questionLabel = tt(`Spørsmål ${index + 1}`, `Question ${index + 1}`);
      if (String(question.prompt || '').trim().length < 8) {
        issues.push({
          id: `${question.id}-prompt-short`,
          questionId: question.id,
          messageNo: `${questionLabel}: Tittel er for kort.`,
          messageEn: `${questionLabel}: Prompt is too short.`,
        });
      }

      if (String(question.prompt || '').trim().length > 140) {
        issues.push({
          id: `${question.id}-prompt-long`,
          questionId: question.id,
          messageNo: `${questionLabel}: Tekst kan bli for lang på mobil.`,
          messageEn: `${questionLabel}: Prompt may be too long on mobile.`,
        });
      }

      if (question.duration < QUIZ_MIN_DURATION_SECONDS) {
        issues.push({
          id: `${question.id}-duration-short`,
          questionId: question.id,
          messageNo: `${questionLabel}: For kort varighet.`,
          messageEn: `${questionLabel}: Duration is too short.`,
        });
      }

      if (question.timestamp < 0 || question.timestamp > Math.max(0, duration - QUIZ_MIN_DURATION_SECONDS)) {
        issues.push({
          id: `${question.id}-timestamp-bounds`,
          questionId: question.id,
          messageNo: `${questionLabel}: Starttid er utenfor videoen.`,
          messageEn: `${questionLabel}: Start time is out of video bounds.`,
        });
      }

      if (question.timestamp + question.duration > duration) {
        issues.push({
          id: `${question.id}-end-bounds`,
          questionId: question.id,
          messageNo: `${questionLabel}: Går utover videolengde.`,
          messageEn: `${questionLabel}: Extends beyond video duration.`,
        });
      }

      if (question.type === 'short-answer') {
        if (question.shortAnswerAccepted.length === 0) {
          issues.push({
            id: `${question.id}-short-answer-empty`,
            questionId: question.id,
            messageNo: `${questionLabel}: Mangler godkjente svar.`,
            messageEn: `${questionLabel}: Missing accepted answers.`,
          });
        }
      } else {
        const correctCount = question.options.filter((option) => option.isCorrect).length;
        if (question.type === 'multi-select') {
          if (correctCount < 1) {
            issues.push({
              id: `${question.id}-correct-count-multi`,
              questionId: question.id,
              messageNo: `${questionLabel}: Må ha minst ett korrekt svar.`,
              messageEn: `${questionLabel}: Must have at least one correct answer.`,
            });
          }
        } else if (correctCount !== 1) {
          issues.push({
            id: `${question.id}-correct-count`,
            questionId: question.id,
            messageNo: `${questionLabel}: Må ha nøyaktig ett korrekt svar.`,
            messageEn: `${questionLabel}: Must have exactly one correct answer.`,
          });
        }

        if (question.options.some((option) => String(option.text || '').trim().length === 0)) {
          issues.push({
            id: `${question.id}-empty-option`,
            questionId: question.id,
            messageNo: `${questionLabel}: Tomt svaralternativ.`,
            messageEn: `${questionLabel}: Empty answer option.`,
          });
        }
      }

      if (question.weight <= 0) {
        issues.push({
          id: `${question.id}-invalid-weight`,
          questionId: question.id,
          messageNo: `${questionLabel}: Vekt må være større enn 0.`,
          messageEn: `${questionLabel}: Weight must be greater than 0.`,
        });
      }

      if (question.timestamp < previousEnd) {
        issues.push({
          id: `${question.id}-overlap`,
          questionId: question.id,
          messageNo: `${questionLabel}: Overlapper forrige spørsmål.`,
          messageEn: `${questionLabel}: Overlaps the previous question.`,
        });
      }
      previousEnd = Math.max(previousEnd, question.timestamp + question.duration);
    });

    return issues;
  }, [duration, questions, tt]);

  const filteredQuestions = useMemo(() => {
    const query = searchValue.trim().toLowerCase();
    const normalizedTagFilter = String(tagFilter || '').trim().toLowerCase();
    const base = normalizedTagFilter
      ? questions.filter((question) =>
          question.tags.some((tag) => tag.toLowerCase().includes(normalizedTagFilter)),
        )
      : questions;
    if (!query) return base;
    return base.filter((question) => {
      return (
        question.tags.some((tag) => tag.toLowerCase().includes(query)) ||
        question.type.toLowerCase().includes(query) ||
        question.prompt.toLowerCase().includes(query) ||
        question.options.some((option) => option.text.toLowerCase().includes(query))
      );
    });
  }, [questions, searchValue, tagFilter]);

  const publishBlockingIssues = useMemo(() => {
    const blockers: string[] = [];
    if (questions.length === 0) {
      blockers.push(tt('Quiz må ha minst ett spørsmål.', 'Quiz must contain at least one question.'));
    }
    if (quizRules.randomizeQuestions && quizRules.randomQuestionCount > questions.length) {
      blockers.push(
        tt(
          'Random antall er høyere enn antall spørsmål i banken.',
          'Random question count is higher than available question bank.',
        ),
      );
    }
    if (quizRules.passingScore < 0 || quizRules.passingScore > 100) {
      blockers.push(tt('Beståttgrense må være mellom 0 og 100.', 'Passing score must be between 0 and 100.'));
    }
    const severeQualityIssues = qualityIssues.filter((issue) => {
      return (
        issue.id.includes('short-answer-empty') ||
        issue.id.includes('correct-count') ||
        issue.id.includes('empty-option') ||
        issue.id.includes('prompt-short') ||
        issue.id.includes('timestamp-bounds') ||
        issue.id.includes('end-bounds')
      );
    });
    if (severeQualityIssues.length > 0) {
      blockers.push(
        tt(
          `Rett ${severeQualityIssues.length} kritiske kvalitetssjekker før publisering.`,
          `Fix ${severeQualityIssues.length} critical quality checks before publishing.`,
        ),
      );
    }
    return blockers;
  }, [qualityIssues, questions.length, quizRules.passingScore, quizRules.randomQuestionCount, quizRules.randomizeQuestions, tt]);

  const applySnap = useCallback(
    (value: number) => {
      if (!timelineSnapEnabled) {
        return clamp(value, 0, duration);
      }
      return snapTimelineTime(value, currentTime, duration);
    },
    [currentTime, duration, timelineSnapEnabled],
  );

  const overlapQuestionIds = useMemo(() => {
    const sorted = [...questions].sort((left, right) => left.timestamp - right.timestamp);
    const overlapIds = new Set<string>();
    let previousEnd = 0;
    sorted.forEach((question) => {
      if (question.timestamp < previousEnd) {
        overlapIds.add(question.id);
      }
      previousEnd = Math.max(previousEnd, question.timestamp + question.duration);
    });
    return overlapIds;
  }, [questions]);

  const studentScoreSummary = useMemo(() => {
    const totalPossible = studentQuestionPool.reduce(
      (sum, question) => sum + Math.max(0, question.weight * 100),
      0,
    );
    const earned = studentQuestionPool.reduce((sum, question) => {
      const entry = studentAnswers[question.id];
      return sum + (entry?.score || 0);
    }, 0);
    const normalized = totalPossible > 0 ? clamp(Math.round((earned / totalPossible) * 100), 0, 100) : 0;
    const answeredCount = studentQuestionPool.filter((question) =>
      Boolean(studentAnswers[question.id]?.submitted),
    ).length;
    const passed = normalized >= quizRules.passingScore;
    return {
      earned,
      totalPossible,
      normalized,
      answeredCount,
      totalCount: studentQuestionPool.length,
      passed,
    };
  }, [quizRules.passingScore, studentAnswers, studentQuestionPool]);

  useEffect(() => {
    analytics.trackEvent('quiz_manager_opened', {
      courseId: resolvedCourseId || null,
      lessonId: activeLesson?.id || null,
      instructorId: effectiveInstructor?.id || null,
      questionCount: questions.length,
      timestamp: Date.now(),
    });

    debugging.logIntegration('info', 'QuizManager opened', {
      courseId: resolvedCourseId || null,
      lessonId: activeLesson?.id || null,
      instructorId: effectiveInstructor?.id || null,
      questionCount: questions.length,
    });
  }, [
    activeLesson?.id,
    analytics,
    debugging,
    effectiveInstructor?.id,
    questions.length,
    resolvedCourseId,
  ]);

  const handleLoadedMetadata = useCallback(() => {
    const measured = videoRef.current?.duration;
    if (typeof measured !== 'number' || !Number.isFinite(measured) || measured <= 0) return;
    const nextDuration = Math.max(60, Math.round(measured));
    setDuration(nextDuration);
    setCurrentTime((prev) => Math.min(prev, nextDuration));
  }, []);

  const handleTimeUpdate = useCallback(() => {
    const nextTime = videoRef.current?.currentTime;
    if (typeof nextTime === 'number' && Number.isFinite(nextTime)) {
      setCurrentTime(nextTime);
    }
  }, []);

  const handleSeek = useCallback((_: Event, newValue: number | number[]) => {
    const value = Array.isArray(newValue) ? newValue[0] : newValue;
    const nextValue = clamp(value, 0, duration);
    if (videoRef.current) {
      videoRef.current.currentTime = nextValue;
    }
    setCurrentTime(nextValue);
  }, [duration]);

  const togglePlayback = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      video.play().catch(() => undefined);
      setIsPlaying(true);
    } else {
      video.pause();
      setIsPlaying(false);
    }
  }, []);

  const toggleStudentPreview = useCallback(() => {
    setPreviewMode((prev) => (prev === 'student' ? 'instructor' : 'student'));
  }, []);

  const commitDurationInput = useCallback(() => {
    const parsed = parseMinuteSecondTime(durationInput, duration);
    const next = Math.max(60, parsed);
    setDuration(next);
    setCurrentTime((prev) => Math.min(prev, next));
    setDurationInput(formatTime(next));
  }, [duration, durationInput]);

  const commitQuestionsChange = useCallback(
    (labelNo: string, labelEn: string, updater: (current: QuizQuestion[]) => QuizQuestion[]) => {
      snapshotBeforeChange(tt(labelNo, labelEn));
      setQuestions((prev) => normalizeQuizQuestions(updater(prev)));
      markDirty();
    },
    [markDirty, snapshotBeforeChange, tt],
  );

  const handleQuestionSelect = useCallback((questionId: string) => {
    setActiveQuestionId(questionId);
    if (previewMode === 'student') {
      const nextIndex = studentQuestionPool.findIndex((question) => question.id === questionId);
      if (nextIndex >= 0) setStudentQuestionIndex(nextIndex);
    }
    setSelectedOptionId('');
    setSelectedOptionIds([]);
    setShortAnswerInput('');
    setSubmitted(false);
    setIndividualScore(0);
  }, [previewMode, studentQuestionPool]);

  const evaluateSubmission = useCallback(
    (
      question: QuizQuestion,
      selectedIds: string[],
      shortAnswer: string,
    ): {
      isCorrect: boolean;
      score: number;
      feedback: string;
      incrementOptionIds: string[];
      normalizedShortAnswer: string;
    } => {
      const normalizedSelectedIds = selectedIds.filter((id) => id.length > 0);
      const normalizedShortAnswer = String(shortAnswer || '').trim().toLowerCase();
      let isCorrect = false;
      let feedback = '';

      if (question.type === 'short-answer') {
        isCorrect = question.shortAnswerAccepted.some(
          (accepted) => String(accepted || '').trim().toLowerCase() === normalizedShortAnswer,
        );
        feedback = isCorrect
          ? tt('Riktig kortsvar.', 'Short answer is correct.')
          : tt('Svaret matcher ikke godkjent fasit.', 'Answer does not match accepted answer.');
      } else if (question.type === 'multi-select') {
        const correctIds = question.options
          .filter((option) => option.isCorrect)
          .map((option) => option.id)
          .sort();
        const picked = [...normalizedSelectedIds].sort();
        isCorrect =
          picked.length === correctIds.length &&
          picked.every((id, index) => id === correctIds[index]);
        feedback = isCorrect
          ? tt('Alle riktige alternativer valgt.', 'All correct options selected.')
          : tt('Velg alle riktige alternativer og unngå feil.', 'Select all correct options and avoid incorrect ones.');
      } else {
        const selectedId = normalizedSelectedIds[0] || '';
        const selected = question.options.find((option) => option.id === selectedId);
        isCorrect = Boolean(selected?.isCorrect);
        feedback = isCorrect
          ? tt('Riktig svar.', 'Correct answer.')
          : tt('Feil svar.', 'Incorrect answer.');
      }

      const optionFeedback = normalizedSelectedIds
        .map((selectedId) => question.options.find((option) => option.id === selectedId)?.explanation || '')
        .map((entry) => String(entry || '').trim())
        .filter((entry) => entry.length > 0)
        .join(' ');

      if (optionFeedback) {
        feedback = `${feedback} ${optionFeedback}`.trim();
      }

      const baseScore = Math.round(question.weight * 100);
      const score = isCorrect ? baseScore : quizRules.negativeMarking ? -Math.round(question.weight * 25) : 0;

      return {
        isCorrect,
        score,
        feedback,
        incrementOptionIds: question.type === 'short-answer' ? [] : normalizedSelectedIds.slice(0, 6),
        normalizedShortAnswer,
      };
    },
    [quizRules.negativeMarking, tt],
  );

  const handleOptionPick = useCallback((optionId: string) => {
    if (!activePreviewQuestion) return;
    if (submitted && previewMode === 'student') return;

    if (activePreviewQuestion.type === 'multi-select') {
      setSelectedOptionIds((prev) => {
        const exists = prev.includes(optionId);
        const next = exists ? prev.filter((id) => id !== optionId) : [...prev, optionId];
        return next;
      });
      return;
    }

    setSelectedOptionId(optionId);
    setSelectedOptionIds([optionId]);
  }, [activePreviewQuestion, previewMode, submitted]);

  const resetCurrentAttempt = useCallback(() => {
    if (!activePreviewQuestion) return;
    setSubmitted(false);
    setIndividualScore(0);
    setStudentAnswers((prev) => {
      const current = prev[activePreviewQuestion.id];
      if (!current) return prev;
      return {
        ...prev,
        [activePreviewQuestion.id]: {
          ...current,
          submitted: false,
          correct: null,
          score: 0,
          feedback: '',
          showAnswer: false,
        },
      };
    });
  }, [activePreviewQuestion]);

  const handleSubmitAnswer = useCallback(() => {
    const question = activePreviewQuestion;
    if (!question) return;

    const pickedIds =
      question.type === 'multi-select'
        ? selectedOptionIds
        : question.type === 'short-answer'
          ? []
          : [selectedOptionId].filter((id) => id.length > 0);
    const hasAnswer =
      question.type === 'short-answer'
        ? String(shortAnswerInput || '').trim().length > 0
        : pickedIds.length > 0;
    if (!hasAnswer) return;

    const evaluation = evaluateSubmission(question, pickedIds, shortAnswerInput);

    commitQuestionsChange('Svar registrert', 'Answer registered', (prev) =>
      prev.map((entry) => {
        if (entry.id !== question.id) return entry;
        return {
          ...entry,
          options: entry.options.map((option) => {
            if (!evaluation.incrementOptionIds.includes(option.id)) return option;
            return { ...option, responses: option.responses + 1 };
          }),
        };
      }),
    );

    setParticipants((prev) => prev + 1);
    setAttempts((prev) => prev + 1);
    setSubmitted(true);
    setIndividualScore(evaluation.score);

    const previousState = studentAnswers[question.id];
    const nextRetries = (previousState?.retries || 0) + 1;
    const canRetry = !evaluation.isCorrect && nextRetries < quizRules.maxRetries;
    const showAnswer =
      !evaluation.isCorrect &&
      quizRules.revealAnswerAfterRetries &&
      nextRetries >= quizRules.maxRetries;

    setStudentAnswers((prev) => ({
      ...prev,
      [question.id]: {
        selectedIds: pickedIds,
        shortAnswer: evaluation.normalizedShortAnswer,
        retries: nextRetries,
        submitted: true,
        correct: evaluation.isCorrect,
        score: evaluation.score,
        showAnswer,
        feedback: canRetry
          ? `${evaluation.feedback} ${tt('Prøv igjen.', 'Try again.')}`
          : evaluation.feedback,
      },
    }));

    analytics.trackEvent('quiz_submitted', {
      courseId: resolvedCourseId || null,
      lessonId: activeLesson?.id || null,
      instructorId: effectiveInstructor?.id || null,
      questionId: question.id,
      questionType: question.type,
      selectedOptionIds: pickedIds,
      shortAnswer: question.type === 'short-answer' ? evaluation.normalizedShortAnswer : undefined,
      isCorrect: evaluation.isCorrect,
      retries: nextRetries,
      score: evaluation.score,
      timestamp: Date.now(),
    });
  }, [
    activeLesson?.id,
    activePreviewQuestion,
    analytics,
    commitQuestionsChange,
    effectiveInstructor?.id,
    evaluateSubmission,
    quizRules.maxRetries,
    quizRules.revealAnswerAfterRetries,
    resolvedCourseId,
    selectedOptionId,
    selectedOptionIds,
    shortAnswerInput,
    studentAnswers,
    tt,
  ]);

  const runAutoFix = useCallback(() => {
    if (qualityIssues.length === 0) return;
    snapshotBeforeChange(tt('Auto-fiks quiz', 'Auto-fix quiz'), { force: true });

    setQuestions((prev) => {
      let previousEnd = 0;
      return prev.map((question, index) => {
        let prompt = String(question.prompt || '').trim();
        let hint = String(question.hint || '').trim();
        let timestamp = clamp(Number(question.timestamp || 0) || 0, 0, Math.max(0, duration - QUIZ_MIN_DURATION_SECONDS));
        let questionDuration = Math.max(
          QUIZ_MIN_DURATION_SECONDS,
          Number(question.duration || QUIZ_MIN_DURATION_SECONDS) || QUIZ_MIN_DURATION_SECONDS,
        );

        if (timestamp < previousEnd) {
          timestamp = previousEnd;
        }

        if (timelineSnapEnabled) {
          timestamp = applySnap(timestamp);
        }

        timestamp = clamp(timestamp, 0, Math.max(0, duration - QUIZ_MIN_DURATION_SECONDS));

        if (timestamp + questionDuration > duration) {
          questionDuration = clamp(duration - timestamp, QUIZ_MIN_DURATION_SECONDS, duration);
        }

        if (!prompt) {
          prompt = tt(`Spørsmål ${index + 1}`, `Question ${index + 1}`);
        }
        if (!hint) {
          hint = tt('Velg ett korrekt svar.', 'Choose one correct answer.');
        }

        const normalizedOptions = question.options.map((option, optionIndex) => {
          const label = String(option.label || String.fromCharCode(65 + optionIndex)).slice(0, 1).toUpperCase();
          const text = String(option.text || '').trim() || `Option ${label}`;
          return {
            ...option,
            label,
            text,
            explanation: String(option.explanation || '').trim(),
          };
        });

        let fixedOptions = normalizedOptions;
        if (question.type !== 'short-answer') {
          const correctIndices = normalizedOptions.reduce<number[]>((acc, option, optionIndex) => {
            if (option.isCorrect) acc.push(optionIndex);
            return acc;
          }, []);

          if (question.type === 'multi-select') {
            const hasCorrect = correctIndices.length > 0;
            fixedOptions = normalizedOptions.map((option, optionIndex) => ({
              ...option,
              isCorrect: hasCorrect ? correctIndices.includes(optionIndex) : optionIndex === 0,
            }));
          } else {
            const firstCorrect = correctIndices[0] ?? 0;
            fixedOptions = normalizedOptions.map((option, optionIndex) => ({
              ...option,
              isCorrect: optionIndex === firstCorrect,
            }));
          }
        }

        const normalizedTags = question.tags
          .map((tag) => String(tag || '').trim().toLowerCase())
          .filter((tag) => tag.length > 0)
          .slice(0, 8);
        const normalizedShortAnswers = question.shortAnswerAccepted
          .map((answer) => String(answer || '').trim().toLowerCase())
          .filter((answer) => answer.length > 0)
          .slice(0, 10);

        previousEnd = timestamp + questionDuration;

        return {
          ...question,
          prompt,
          hint,
          timestamp,
          duration: questionDuration,
          tags: normalizedTags,
          weight: clamp(question.weight || 1, 0.1, 5),
          shortAnswerAccepted:
            question.type === 'short-answer' && normalizedShortAnswers.length === 0
              ? ['example']
              : normalizedShortAnswers,
          options: fixedOptions,
        };
      });
    });

    markDirty();
    setSaveMessage(
      tt(
        `Auto-fiks brukte ${qualityIssues.length} justeringer.`,
        `Auto-fix applied ${qualityIssues.length} adjustments.`,
      ),
    );
  }, [applySnap, duration, markDirty, qualityIssues.length, snapshotBeforeChange, timelineSnapEnabled, tt]);

  const applyInterviewQuizSuggestions = useCallback(() => {
    if (interviewQuizSuggestions.length === 0) return;
    const suggestedQuestions = buildQuizQuestionsFromInterviewSuggestions(
      interviewQuizSuggestions,
      duration,
    );
    snapshotBeforeChange(tt('Bruk intervjuforslag', 'Apply interview suggestions'), {
      force: true,
    });
    replaceWithoutHistory(suggestedQuestions);
    setActiveQuestionId(suggestedQuestions[0]?.id || '');
    setParticipants(0);
    setAttempts(0);
    setStudentAnswers({});
    setStudentQuestionIndex(0);
    setSelectedOptionId('');
    setSelectedOptionIds([]);
    setShortAnswerInput('');
    setSubmitted(false);
    setIndividualScore(0);
    markDirty();
    setSaveMessage(
      tt(
        'Quizutkast oppdatert fra kompetanseintervjuet.',
        'Quiz draft updated from the competency interview.',
      ),
    );
  }, [
    duration,
    interviewQuizSuggestions,
    markDirty,
    replaceWithoutHistory,
    snapshotBeforeChange,
    tt,
  ]);

  const handleSaveQuiz = useCallback(async (publish: boolean) => {
    if (publish && publishBlockingIssues.length > 0) {
      setSaveMessage(
        tt(
          `Kan ikke publisere enda. ${publishBlockingIssues[0]}`,
          `Cannot publish yet. ${publishBlockingIssues[0]}`,
        ),
      );
      setRightTab('markers');
      return;
    }

    const now = new Date().toISOString();
    const payload = {
      id:
        effectiveScope === 'skill' && selectedSkill?.id
          ? `${QUIZ_RESOURCE_SKILL_PREFIX}${selectedSkill.id}`
          : `${QUIZ_RESOURCE_COURSE_PREFIX}${resolvedCourseId || 'local'}`,
      title: `${activeCourse?.title || 'Academy'} Quiz`,
      updatedAt: now,
      courseId: activeCourse?.id || null,
      lessonId: effectiveScope === 'skill' ? selectedSkill?.id || null : null,
      scope: effectiveScope,
      instructorId: effectiveInstructor?.id || null,
      participants,
      attempts,
      duration,
      questions,
      rules: quizRules,
      publish,
    };
    let persistedPublishedAt = '';

    setSaveMessage('');

    try {
      if (resolvedCourseId) {
        const course = getCourse(resolvedCourseId);
        if (course) {
          if (effectiveScope === 'skill' && selectedSkill?.id) {
            const nextLessons = (course.lessons || []).map((lesson) => {
              if (String(lesson.id) !== String(selectedSkill.id)) return lesson;
              const lessonResources = Array.isArray(lesson.resources) ? lesson.resources : [];
              const withoutQuiz = lessonResources.filter(
                (resource) => !isQuizResourceMatch(resource, resolvedCourseId, 'skill', String(lesson.id)),
              );

              const quizConfigResource: LessonResource = {
                id: `${QUIZ_RESOURCE_SKILL_PREFIX}${lesson.id}`,
                type: 'code',
                title: 'Quiz Configuration',
                description: 'Serialized quiz manager state for this skill.',
                url: `data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify(payload))}`,
              };

              return {
                ...lesson,
                resources: [...withoutQuiz, quizConfigResource],
              };
            });

            await updateCourse({
              ...course,
              lessons: nextLessons,
              isPublished: publish ? true : course.isPublished,
              updatedAt: new Date().toISOString(),
            });
          } else {
            const resources = Array.isArray(course.resources) ? course.resources : [];
            const withoutQuiz = resources.filter(
              (resource) => !isQuizResourceMatch(resource, resolvedCourseId, 'course'),
            );

            const quizConfigResource: CourseResource = {
              id: `${QUIZ_RESOURCE_COURSE_PREFIX}${resolvedCourseId}`,
              type: 'code',
              title: 'Quiz Configuration',
              description: 'Serialized quiz manager state for this course.',
              url: `data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify(payload))}`,
            };

            await updateCourse({
              ...course,
              resources: [...withoutQuiz, quizConfigResource],
              isPublished: publish ? true : course.isPublished,
              updatedAt: new Date().toISOString(),
            });
          }
        }
      }

      onSave?.(payload);
      if (scopeStorageKey) {
        const store = readQuizStore();
        const previousEntry = store[scopeStorageKey];
        persistedPublishedAt = String(previousEntry?.publishedAt || '');
        store[scopeStorageKey] = {
          questions: normalizeQuizQuestions(questions),
          participants,
          attempts,
          duration,
          rules: quizRules,
          updatedAt: now,
          publishedAt: publish ? now : persistedPublishedAt || undefined,
        };
        writeQuizStore(store);
      }
      markSaved();
      if (publish) {
        setLastPublishedAt(now);
        setHasSavedChangesSincePublish(false);
      } else {
        setLastPublishedAt(persistedPublishedAt);
        setHasSavedChangesSincePublish(Boolean(persistedPublishedAt));
      }
      setSaveMessage(
        publish
          ? tt('Quiz publisert.', 'Quiz published.')
          : tt('Quiz lagret.', 'Quiz saved.'),
      );
    } catch (error) {
      debugging.logIntegration('error', 'Failed to save quiz manager payload', {
        error: error instanceof Error ? error.message : String(error),
      });
      setSaveMessage(tt('Kunne ikke lagre quiz.', 'Could not save quiz.'));
    }
  }, [
    activeCourse?.id,
    activeCourse?.title,
    attempts,
    debugging,
    effectiveInstructor?.id,
    effectiveScope,
    getCourse,
    markSaved,
    onSave,
    participants,
    publishBlockingIssues,
    quizRules,
    questions,
    resolvedCourseId,
    scopeStorageKey,
    selectedSkill?.id,
    tt,
    updateCourse,
    duration,
  ]);

  const applyCurrentQuizToAllSkills = useCallback(async () => {
    if (!activeCourse || effectiveScope !== 'skill') return;
    if (!selectedSkill?.id || skillOptions.length <= 1) return;
    try {
      const course = getCourse(String(activeCourse.id));
      if (!course) return;
      const updatedAt = new Date().toISOString();
      const nextLessons = (course.lessons || []).map((lesson) => {
        const resources = Array.isArray(lesson.resources) ? lesson.resources : [];
        const withoutQuiz = resources.filter(
          (resource) => !isQuizResourceMatch(resource, String(course.id), 'skill', String(lesson.id)),
        );

        const payload = {
          id: `${QUIZ_RESOURCE_SKILL_PREFIX}${lesson.id}`,
          title: `${course.title || 'Academy'} Quiz`,
          updatedAt,
          courseId: course.id,
          lessonId: lesson.id,
          scope: 'skill',
          instructorId: effectiveInstructor?.id || null,
          participants,
          attempts,
          duration,
          questions,
          rules: quizRules,
          publish: false,
        };

        const resource: LessonResource = {
          id: `${QUIZ_RESOURCE_SKILL_PREFIX}${lesson.id}`,
          type: 'code',
          title: 'Quiz Configuration',
          description: 'Serialized quiz manager state for this skill.',
          url: `data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify(payload))}`,
        };

        return {
          ...lesson,
          resources: [...withoutQuiz, resource],
        };
      });

      await updateCourse({
        ...course,
        lessons: nextLessons,
        updatedAt,
      });

      const store = readQuizStore();
      skillOptions.forEach((lesson) => {
        const key = `quiz:${String(course.id)}:skill:${String(lesson.id)}`;
        const previousEntry = store[key];
        store[key] = {
          questions: normalizeQuizQuestions(questions),
          participants,
          attempts,
          duration,
          rules: quizRules,
          updatedAt,
          publishedAt: previousEntry?.publishedAt,
        };
      });
      writeQuizStore(store);
      setSaveMessage(tt('Quiz kopiert til alle ferdigheter.', 'Quiz copied to all skills.'));
    } catch (error) {
      setSaveMessage(
        error instanceof Error
          ? error.message
          : tt('Kunne ikke kopiere quiz til alle ferdigheter.', 'Could not copy quiz to all skills.'),
      );
    }
  }, [
    activeCourse,
    attempts,
    duration,
    effectiveInstructor?.id,
    effectiveScope,
    getCourse,
    participants,
    quizRules,
    questions,
    selectedSkill?.id,
    skillOptions,
    tt,
    updateCourse,
  ]);

  const undoQuestions = useCallback(() => {
    if (!canUndo) return;
    undo();
    setSaveMessage(tt('Angret siste quiz-endring.', 'Undid last quiz change.'));
  }, [canUndo, tt, undo]);

  const redoQuestions = useCallback(() => {
    if (!canRedo) return;
    redo();
    setSaveMessage(tt('Gjorde om siste quiz-endring.', 'Redid last quiz change.'));
  }, [canRedo, redo, tt]);

  const updateActiveQuestion = useCallback((updater: (question: QuizQuestion) => QuizQuestion) => {
    commitQuestionsChange('Oppdater spørsmål', 'Update question', (prev) =>
      prev.map((question) => (question.id === activeQuestionId ? updater(question) : question)),
    );
  }, [activeQuestionId, commitQuestionsChange]);

  const removeQuestion = useCallback((questionId: string) => {
    commitQuestionsChange('Fjern spørsmål', 'Remove question', (prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((question) => question.id !== questionId);
    });
    setActiveQuestionId((previousId) => {
      if (previousId !== questionId) return previousId;
      const next = questions.find((question) => question.id !== questionId);
      return next?.id || '';
    });
    setSelectedOptionId('');
    setSelectedOptionIds([]);
    setShortAnswerInput('');
    setStudentAnswers((prev) => {
      if (!(questionId in prev)) return prev;
      const next = { ...prev };
      delete next[questionId];
      return next;
    });
    setSubmitted(false);
    setIndividualScore(0);
  }, [commitQuestionsChange, questions]);

  const nudgeActiveQuestion = useCallback((delta: number) => {
    if (!activeQuestionId) return;
    commitQuestionsChange('Flytt spørsmål', 'Move question', (prev) =>
      prev.map((question) => {
        if (question.id !== activeQuestionId) return question;
        const shifted = question.timestamp + delta;
        const snapped = applySnap(shifted);
        const bounded = clamp(snapped, 0, Math.max(0, duration - question.duration));
        return { ...question, timestamp: bounded };
      }),
    );
  }, [activeQuestionId, applySnap, commitQuestionsChange, duration]);

  const addQuestion = useCallback(() => {
    const id = `question-${Date.now()}`;
    const start = clamp(applySnap(Math.floor(currentTime)), 0, Math.max(0, duration - 20));
    const next: QuizQuestion = {
      id,
      type: 'single-choice',
      prompt: tt('Nytt spørsmål', 'New quiz question'),
      hint: tt('Legg inn hint til deltakerne', 'Add hint for learners'),
      timestamp: start,
      duration: 20,
      tags: [],
      weight: 1,
      shortAnswerAccepted: [],
      options: [
        {
          id: `${id}-a`,
          label: 'A',
          text: 'Option A',
          isCorrect: true,
          responses: 0,
          explanation: '',
        },
        {
          id: `${id}-b`,
          label: 'B',
          text: 'Option B',
          isCorrect: false,
          responses: 0,
          explanation: '',
        },
        {
          id: `${id}-c`,
          label: 'C',
          text: 'Option C',
          isCorrect: false,
          responses: 0,
          explanation: '',
        },
        {
          id: `${id}-d`,
          label: 'D',
          text: 'Option D',
          isCorrect: false,
          responses: 0,
          explanation: '',
        },
      ],
    };

    snapshotBeforeChange(tt('Legg til spørsmål', 'Add question'), { force: true });
    setQuestions((prev) => [...prev, next]);
    setActiveQuestionId(id);
    setSelectedOptionId('');
    setSubmitted(false);
    setIndividualScore(0);
    markDirty();
  }, [applySnap, currentTime, duration, markDirty, snapshotBeforeChange, tt]);

  const updateQuestionTimeFromClientX = useCallback(
    (questionId: string, clientX: number) => {
      const track = timelineTrackRef.current;
      if (!track) return;
      const rect = track.getBoundingClientRect();
      if (rect.width <= 0) return;
      const ratio = clamp((clientX - rect.left) / rect.width, 0, 1);
      const rawTime = ratio * duration;
      const snappedTime = applySnap(rawTime);
      setQuestions((prev) =>
        prev.map((question) => {
          if (question.id !== questionId) return question;
          return {
            ...question,
            timestamp: clamp(snappedTime, 0, Math.max(0, duration - question.duration)),
          };
        }),
      );
      markDirty();
    },
    [applySnap, duration, markDirty],
  );

  const startQuestionDrag = useCallback(
    (questionId: string, clientX: number) => {
      if (!hasDragSnapshotRef.current) {
        snapshotBeforeChange(tt('Dra spørsmål i tidslinje', 'Drag question in timeline'), {
          force: true,
        });
        hasDragSnapshotRef.current = true;
      }
      draggingQuestionIdRef.current = questionId;
      updateQuestionTimeFromClientX(questionId, clientX);
    },
    [snapshotBeforeChange, tt, updateQuestionTimeFromClientX],
  );

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const handleMove = (event: MouseEvent): void => {
      if (!draggingQuestionIdRef.current) return;
      updateQuestionTimeFromClientX(draggingQuestionIdRef.current, event.clientX);
    };
    const handleUp = (): void => {
      draggingQuestionIdRef.current = null;
      hasDragSnapshotRef.current = false;
    };
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [updateQuestionTimeFromClientX]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (isEditableTarget(event.target)) return;
      const lower = event.key.toLowerCase();

      if (lower === 'v') {
        event.preventDefault();
        setEditorMode('select');
        return;
      }
      if (lower === 'e') {
        event.preventDefault();
        setEditorMode('edit');
        return;
      }

      if (editorMode !== 'select' || !activeQuestionId) return;

      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        nudgeActiveQuestion(-QUIZ_SNAP_STEP_SECONDS);
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        nudgeActiveQuestion(QUIZ_SNAP_STEP_SECONDS);
      } else if (event.key === 'Backspace') {
        event.preventDefault();
        removeQuestion(activeQuestionId);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeQuestionId, editorMode, nudgeActiveQuestion, removeQuestion]);

  const saveStatusIndicator = useMemo(() => {
    if (autoSaveState === 'saving') {
      return {
        icon: <CloudSync fontSize="small" className="academy-save-spin" />,
        tooltip: tt('Lagrer endringer ...', 'Saving changes ...'),
        bgColor: 'rgba(116,173,255,0.22)',
        textColor: '#b9d7ff',
        borderColor: 'rgba(116,173,255,0.38)',
      };
    }
    if (autoSaveState === 'dirty') {
      return {
        icon: <CloudOff fontSize="small" />,
        tooltip: tt('Ikke lagret', 'Unsaved'),
        bgColor: 'rgba(248,179,33,0.2)',
        textColor: '#f8d675',
        borderColor: 'rgba(248,179,33,0.36)',
      };
    }
    const formatted = formatToolSavedTime(lastSavedAt, tt('nb-NO', 'en-US'));
    return {
      icon: <CloudDone fontSize="small" />,
      tooltip: `${tt('Lagret', 'Saved')} • ${formatted}`,
      bgColor: 'rgba(126,232,179,0.16)',
      textColor: '#9ef1ca',
      borderColor: 'rgba(126,232,179,0.36)',
    };
  }, [autoSaveState, lastSavedAt, tt]);

  const draftStatusChip = useMemo(() => {
    const publishedAtMs = Date.parse(lastPublishedAt);
    const hasPublishedVersion = Number.isFinite(publishedAtMs) && publishedAtMs > 0;
    const publishedFormatted = hasPublishedVersion
      ? formatToolSavedTime(lastPublishedAt, tt('nb-NO', 'en-US'))
      : '--:--';
    if (autoSaveState === 'saving') {
      return {
        label: hasPublishedVersion
          ? tt('Oppdaterer utkast ...', 'Updating draft ...')
          : tt('Utkast lagres ...', 'Draft saving ...'),
        tooltip: hasPublishedVersion
          ? `${tt('Sist publisert', 'Last published')} • ${publishedFormatted}`
          : tt(
              'Utkast synkroniseres. Ikke publisert ennå.',
              'Draft is syncing. Not published yet.',
            ),
      };
    }
    if (autoSaveState === 'dirty') {
      return {
        label: hasPublishedVersion
          ? tt('Publisert · nye endringer', 'Published · new changes')
          : tt('Utkast ikke lagret', 'Draft unsaved'),
        tooltip: hasPublishedVersion
          ? tt(
              'Det finnes en publisert versjon, men nye endringer er ikke publisert ennå.',
              'A published version exists, but new changes are not published yet.',
            )
          : tt(
              'Du har ulagrede endringer. Ikke publisert.',
              'You have unsaved changes. Not published.',
            ),
      };
    }
    if (hasPublishedVersion && !hasSavedChangesSincePublish) {
      return {
        label: tt('Publisert', 'Published'),
        tooltip: `${tt('Publisert', 'Published')} • ${publishedFormatted}`,
      };
    }
    if (hasPublishedVersion && hasSavedChangesSincePublish) {
      const formatted = formatToolSavedTime(lastSavedAt, tt('nb-NO', 'en-US'));
      return {
        label: tt('Utkast lagret (nyere enn publisert)', 'Draft saved (newer than published)'),
        tooltip: `${tt('Lagret', 'Saved')} • ${formatted} • ${tt('Sist publisert', 'Last published')} • ${publishedFormatted}`,
      };
    }
    const formatted = formatToolSavedTime(lastSavedAt, tt('nb-NO', 'en-US'));
    return {
      label: tt('Utkast lagret (ikke publisert)', 'Draft saved (not published)'),
      tooltip: `${tt('Lagret', 'Saved')} • ${formatted} • ${tt('Ikke publisert', 'Not published')}`,
    };
  }, [autoSaveState, hasSavedChangesSincePublish, lastPublishedAt, lastSavedAt, tt]);

  return (
    <Box
      sx={{
        minHeight: '100vh',
        color: '#edf0f7',
        bgcolor: '#06080d',
        fontFamily: '"Manrope", "Segoe UI", sans-serif',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(circle at 74% 12%, rgba(248,179,33,0.24), rgba(5,8,13,0) 42%), radial-gradient(circle at 16% 74%, rgba(82,121,204,0.14), rgba(6,8,14,0) 44%), linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0) 32%)',
          pointerEvents: 'none',
        }}
      />

      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', lg: 'row' }, minHeight: '100vh', position: 'relative', zIndex: 1, width: 'min(100%, var(--academy-shell-max-width, 1920px))', mx: 'auto' }}>
        <AcademyLeftSidebar
          activeNav={leftNav}
          onNavigate={(navId, route) => {
            setLeftNav(navId);
            setLocationWithContext(route);
          }}
          onCreateCourse={() => {
            setLeftNav('curriculum');
            setLocationWithContext('/academy/curriculum?createCompetency=1', false);
          }}
          tt={tt}
          navLabel={navLabel}
        />

        <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <Box
            sx={{
              height: 74,
              px: 3,
              borderBottom: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'linear-gradient(180deg, rgba(13,16,25,0.95), rgba(10,13,20,0.9))',
            }}
          >
            <Stack direction="row" spacing={2} alignItems="center">
              <Typography sx={{ letterSpacing: '0.22em', fontSize: 15, color: 'rgba(237,240,247,0.82)' }}>
                CREATOR STUDIO
              </Typography>
              <Tooltip title={draftStatusChip.tooltip}>
                <Chip
                  label={draftStatusChip.label}
                  size="small"
                  sx={{
                    bgcolor: saveStatusIndicator.bgColor,
                    color: saveStatusIndicator.textColor,
                    border: `var(--academy-hairline-width, 1px) solid ${saveStatusIndicator.borderColor}`,
                    fontWeight: 600,
                  }}
                />
              </Tooltip>
              <Tooltip title={saveStatusIndicator.tooltip}>
                <Box
                  role="status"
                  aria-label={saveStatusIndicator.tooltip}
                  sx={{
                    width: 30,
                    height: 30,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: 1,
                    bgcolor: saveStatusIndicator.bgColor,
                    color: saveStatusIndicator.textColor,
                    border: `var(--academy-hairline-width, 1px) solid ${saveStatusIndicator.borderColor}`,
                    '@keyframes academySaveSpin': {
                      from: { transform: 'rotate(0deg)' },
                      to: { transform: 'rotate(360deg)' },
                    },
                    '& .academy-save-spin': {
                      animation: 'academySaveSpin 1.05s linear infinite',
                    },
                  }}
                >
                  {saveStatusIndicator.icon}
                </Box>
              </Tooltip>
            </Stack>

            <Stack direction="row" spacing={1.2} alignItems="center">
              <AcademyLocaleSwitcher />
              <IconButton
                size="small"
                onClick={() => setLocationWithContext('/academy/settings?tab=notifications', false)}
                aria-label={tt('Varsler', 'Notifications')}
                sx={{ color: 'rgba(237,240,247,0.75)' }}
              >
                <NotificationsNone fontSize="small" />
              </IconButton>
              <IconButton
                size="small"
                onClick={() => setLocationWithContext('/academy/settings?tab=messages', false)}
                aria-label={tt('Meldinger', 'Messages')}
                sx={{ color: 'rgba(237,240,247,0.75)' }}
              >
                <MailOutline fontSize="small" />
              </IconButton>
              <IconButton
                size="small"
                onClick={() => setLocationWithContext('/academy/settings?tab=profile', false)}
                aria-label={tt('Profil', 'Profile')}
                sx={{ p: 0 }}
              >
                <Avatar sx={{ width: 34, height: 34, bgcolor: '#f8b321', color: '#111' }}>
                  {String(effectiveInstructor?.name || 'N').charAt(0).toUpperCase()}
                </Avatar>
              </IconButton>
            </Stack>
          </Box>

          <Box
            sx={{
              flex: 1,
              minHeight: 0,
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1fr) var(--academy-right-panel-width, 390px)' },
              gap: 2,
              px: 2,
              py: 2,
            }}
          >
            <Box sx={{ minHeight: 0, display: 'flex', flexDirection: 'column', gap: 1.4 }}>
              <Stack
                direction={{ xs: 'column', md: 'row' }}
                spacing={1.2}
                justifyContent="space-between"
                alignItems={{ xs: 'stretch', md: 'center' }}
              >
                <Stack direction="row" spacing={1.2} alignItems="center" flexWrap="wrap" useFlexGap>
                  <Typography sx={{ fontSize: 'clamp(1.65rem, 1.3rem + 1.1vw, 2.05rem)', fontWeight: 700, letterSpacing: '0.015em', lineHeight: 1.1 }}>
                    {tt('Quiz Studio', 'Quiz Studio')}
                  </Typography>
                </Stack>

                <Stack
                  direction="row"
                  spacing={0.8}
                  flexWrap="wrap"
                  useFlexGap
                  sx={{
                    minWidth: 0,
                    justifyContent: { xs: 'flex-start', lg: 'flex-end' },
                    rowGap: 0.8,
                  }}
                >
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={toggleSimpleMode}
                    sx={{
                      ...QUIZ_NEUTRAL_OUTLINED_BUTTON_SX,
                      color: simpleMode ? '#edf0f7' : '#f8d675',
                      borderColor: simpleMode ? 'rgba(255,255,255,0.2)' : 'rgba(248,179,33,0.35)',
                      bgcolor: simpleMode ? 'rgba(255,255,255,0.02)' : 'rgba(248,179,33,0.1)',
                    }}
                  >
                    {simpleMode
                      ? tt('Pro-modus', 'Pro mode')
                      : tt('Tilbake til enkel', 'Back to simple')}
                  </Button>
                  <Tooltip title={tt('Angre (Cmd/Ctrl+Z)', 'Undo (Cmd/Ctrl+Z)')}>
                    <span>
                      <IconButton size="small" onClick={undoQuestions} disabled={!canUndo} sx={QUIZ_NEUTRAL_ICON_BUTTON_SX}>
                        <Undo fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                  <Tooltip title={tt('Gjør om (Cmd/Ctrl+Shift+Z)', 'Redo (Cmd/Ctrl+Shift+Z)')}>
                    <span>
                      <IconButton size="small" onClick={redoQuestions} disabled={!canRedo} sx={QUIZ_NEUTRAL_ICON_BUTTON_SX}>
                        <Redo fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                  <Button
                    variant="outlined"
                    startIcon={<AutoFixHigh />}
                    disabled={qualityIssues.length === 0}
                    onClick={runAutoFix}
                    sx={QUIZ_WARNING_OUTLINED_BUTTON_SX}
                  >
                    {tt('Auto-fiks', 'Auto-fix')}
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={previewMode === 'student' ? <Visibility /> : <VisibilityOff />}
                    onClick={toggleStudentPreview}
                    sx={{
                      ...QUIZ_NEUTRAL_OUTLINED_BUTTON_SX,
                      borderColor: previewMode === 'student' ? 'rgba(248,179,33,0.45)' : 'rgba(255,255,255,0.2)',
                      color: previewMode === 'student' ? '#f8d675' : '#edf0f7',
                      bgcolor: previewMode === 'student' ? 'rgba(248,179,33,0.12)' : 'transparent',
                    }}
                  >
                    {previewMode === 'student'
                      ? tt('Forhåndsvisning på', 'Preview on')
                      : tt('Forhåndsvis (student)', 'Preview (learner)')}
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={<Save />}
                    onClick={() => void handleSaveQuiz(false)}
                    sx={QUIZ_SAVE_BUTTON_SX}
                  >
                    {tt('Lagre', 'Save')}
                  </Button>
                  <Button
                    variant="contained"
                    startIcon={<Publish />}
                    onClick={() => void handleSaveQuiz(true)}
                    sx={QUIZ_PUBLISH_BUTTON_SX}
                  >
                    {tt('Publiser', 'Publish')}
                  </Button>
                  {onCancel && (
                    <Button
                      variant="text"
                      onClick={onCancel}
                      sx={{
                        textTransform: 'none',
                        color: 'rgba(237,240,247,0.78)',
                      }}
                    >
                      {tt('Avbryt', 'Cancel')}
                    </Button>
                  )}
                </Stack>
              </Stack>

              <Stack
                direction={{ xs: 'column', md: 'row' }}
                spacing={1}
                alignItems={{ xs: 'stretch', md: 'center' }}
                sx={{ ...cinematicPanelSx, px: 1, py: 0.9 }}
              >
                <Select
                  size="small"
                  value={selectedCourseValue}
                  displayEmpty
                  renderValue={(value) => {
                    const matchedCourse = courseItems.find(
                      (course) => String(course.id) === String(value || ''),
                    );
                    return matchedCourse?.title || tt('Kompetanse', 'Competency');
                  }}
                  onChange={(event) => {
                    const nextCourseId = String(event.target.value);
                    setSelectedCourseId(nextCourseId);
                    syncCourseIdInRoute(nextCourseId);
                  }}
                  sx={{
                    minWidth: { xs: '100%', md: 250 },
                    color: '#edf0f7',
                    bgcolor: 'rgba(255,255,255,0.04)',
                    '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' },
                  }}
                >
                  <MenuItem value="" disabled>
                    {tt('Kompetanse', 'Competency')}
                  </MenuItem>
                  {courseItems.map((course) => (
                    <MenuItem key={course.id} value={String(course.id)}>
                      {course.title}
                    </MenuItem>
                  ))}
                </Select>
                <Select
                  size="small"
                  value={quizScope}
                  onChange={(event) => setQuizScope(event.target.value as QuizScope)}
                  sx={{
                    minWidth: { xs: '100%', md: 150 },
                    color: '#edf0f7',
                    bgcolor: 'rgba(255,255,255,0.04)',
                    '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' },
                  }}
                >
                  <MenuItem value="course">{tt('Ferdighet', 'Skill')}</MenuItem>
                  <MenuItem value="skill">{tt('Ferdighet', 'Skill')}</MenuItem>
                </Select>
                {quizScope === 'skill' && (
                  <Select
                    size="small"
                    value={selectedSkill ? String(selectedSkill.id) : ''}
                    onChange={(event) => setSelectedSkillId(String(event.target.value))}
                    displayEmpty
                    disabled={skillOptions.length === 0}
                    sx={{
                      minWidth: { xs: '100%', md: 210 },
                      color: '#edf0f7',
                      bgcolor: 'rgba(255,255,255,0.04)',
                      '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' },
                    }}
                  >
                    {skillOptions.length === 0 && (
                      <MenuItem value="">
                        {tt('Ingen ferdigheter tilgjengelig', 'No skills available')}
                      </MenuItem>
                    )}
                    {skillOptions.map((lesson) => (
                      <MenuItem key={lesson.id} value={String(lesson.id)}>
                        {lesson.title}
                      </MenuItem>
                    ))}
                  </Select>
                )}
                <TextField
                  size="small"
                  label={tt('Tid (min:sek)', 'Time (min:sec)')}
                  value={durationInput}
                  onChange={(event) => setDurationInput(event.target.value)}
                  onBlur={commitDurationInput}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      commitDurationInput();
                    }
                  }}
                  inputProps={{ inputMode: 'numeric', pattern: '[0-9:]*' }}
                  sx={{
                    width: { xs: '100%', md: 156 },
                    '& .MuiInputBase-root': { color: '#edf0f7' },
                    '& .MuiInputLabel-root': { color: 'rgba(237,240,247,0.64)' },
                    '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' },
                  }}
                />
                <Chip
                  size="small"
                  avatar={
                    effectiveInstructor?.name ? (
                      <Avatar sx={{ width: 22, height: 22 }}>
                        {effectiveInstructor.name.charAt(0).toUpperCase()}
                      </Avatar>
                    ) : undefined
                  }
                  label={
                    effectiveInstructor?.name
                      ? `${tt('Instruktør', 'Instructor')}: ${effectiveInstructor.name}`
                      : tt('Instruktør ikke satt', 'Instructor not assigned')
                  }
                  sx={{
                    maxWidth: { xs: '100%', md: 320 },
                    color: '#edf0f7',
                    bgcolor: 'rgba(255,255,255,0.08)',
                    '& .MuiChip-label': {
                      display: 'block',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    },
                  }}
                />
              </Stack>

              {shouldShowAdvanced ? (
                <>
                  <Stack
                    direction={{ xs: 'column', lg: 'row' }}
                    spacing={0.8}
                    alignItems={{ xs: 'stretch', lg: 'center' }}
                    sx={{ ...cinematicPanelSx, px: 1, py: 0.75 }}
                  >
                    <Stack direction="row" spacing={0.4} sx={QUIZ_TOOLBAR_GROUP_SX}>
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<AdsClick />}
                        onClick={() => setEditorMode('select')}
                        sx={{
                          ...QUIZ_NEUTRAL_OUTLINED_BUTTON_SX,
                          minWidth: 0,
                          px: 1,
                          color: editorMode === 'select' ? '#0f0f0f' : '#edf0f7',
                          bgcolor: editorMode === 'select' ? '#f8d675' : 'transparent',
                          borderColor: editorMode === 'select' ? 'rgba(248,179,33,0.52)' : 'rgba(255,255,255,0.2)',
                        }}
                      >
                        {tt('Velg', 'Select')}
                      </Button>
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<Edit />}
                        onClick={() => setEditorMode('edit')}
                        sx={{
                          ...QUIZ_NEUTRAL_OUTLINED_BUTTON_SX,
                          minWidth: 0,
                          px: 1,
                          color: editorMode === 'edit' ? '#0f0f0f' : '#edf0f7',
                          bgcolor: editorMode === 'edit' ? '#f8d675' : 'transparent',
                          borderColor: editorMode === 'edit' ? 'rgba(248,179,33,0.52)' : 'rgba(255,255,255,0.2)',
                        }}
                      >
                        {tt('Rediger', 'Edit')}
                      </Button>
                    </Stack>
                    <Stack direction="row" spacing={0.4} sx={QUIZ_TOOLBAR_GROUP_SX}>
                      <Button
                        size="small"
                        startIcon={<CropSquare />}
                        onClick={() => setSafeAreaEnabled((prev) => !prev)}
                        sx={{
                          ...QUIZ_NEUTRAL_OUTLINED_BUTTON_SX,
                          color: safeAreaEnabled ? '#f8d675' : '#edf0f7',
                          borderColor: safeAreaEnabled ? 'rgba(248,179,33,0.5)' : 'rgba(255,255,255,0.2)',
                        }}
                      >
                        {safeAreaEnabled
                          ? tt('Safe area: På', 'Safe area: On')
                          : tt('Safe area: Av', 'Safe area: Off')}
                      </Button>
                      <Button
                        size="small"
                        onClick={() => setTimelineSnapEnabled((prev) => !prev)}
                        sx={{
                          ...QUIZ_NEUTRAL_OUTLINED_BUTTON_SX,
                          color: timelineSnapEnabled ? '#f8d675' : '#edf0f7',
                          borderColor: timelineSnapEnabled ? 'rgba(248,179,33,0.5)' : 'rgba(255,255,255,0.2)',
                        }}
                      >
                        {timelineSnapEnabled
                          ? tt('Snap: 0.5s + playhead', 'Snap: 0.5s + playhead')
                          : tt('Snap: Av', 'Snap: Off')}
                      </Button>
                      {effectiveScope === 'skill' && skillOptions.length > 1 && (
                        <Button
                          size="small"
                          onClick={() => {
                            void applyCurrentQuizToAllSkills();
                          }}
                          sx={QUIZ_WARNING_OUTLINED_BUTTON_SX}
                        >
                          {tt('Bruk på alle ferdigheter', 'Apply to all skills')}
                        </Button>
                      )}
                      {interviewQuizSuggestions.length > 0 && (
                        <Button
                          size="small"
                          onClick={applyInterviewQuizSuggestions}
                          sx={QUIZ_NEUTRAL_OUTLINED_BUTTON_SX}
                        >
                          {tt('Bruk intervjuforslag', 'Apply interview suggestions')}
                        </Button>
                      )}
                    </Stack>
                    <Stack direction="row" spacing={0.6} flexWrap="wrap" useFlexGap sx={{ ml: { lg: 'auto' } }}>
                      <Chip
                        size="small"
                        icon={<WarningAmber sx={{ fontSize: 16 }} />}
                        label={tt(`${qualityIssues.length} kvalitetssjekker`, `${qualityIssues.length} quality checks`)}
                        sx={{
                          bgcolor:
                            qualityIssues.length === 0
                              ? 'rgba(126,232,179,0.16)'
                              : 'rgba(248,179,33,0.16)',
                          color:
                            qualityIssues.length === 0
                              ? '#9ef1ca'
                              : '#f8d675',
                        }}
                      />
                      {publishBlockingIssues.length > 0 && (
                        <Chip
                          size="small"
                          icon={<WarningAmber sx={{ fontSize: 16 }} />}
                          label={tt(
                            `${publishBlockingIssues.length} publiseringsblokker`,
                            `${publishBlockingIssues.length} publishing blockers`,
                          )}
                          sx={{
                            bgcolor: 'rgba(255,108,108,0.16)',
                            color: '#ffbbbb',
                          }}
                        />
                      )}
                    </Stack>
                  </Stack>

                  <Stack
                    direction={{ xs: 'column', md: 'row' }}
                    spacing={0.8}
                    flexWrap="wrap"
                    useFlexGap
                    alignItems={{ xs: 'stretch', md: 'center' }}
                    sx={{ ...cinematicPanelSx, px: 1, py: 0.75 }}
                  >
                <Button
                  size="small"
                  variant={quizRules.randomizeQuestions ? 'contained' : 'outlined'}
                  onClick={() =>
                    setQuizRules((prev) => ({
                      ...prev,
                      randomizeQuestions: !prev.randomizeQuestions,
                    }))
                  }
                  sx={{
                    textTransform: 'none',
                    borderColor: 'rgba(255,255,255,0.2)',
                    color: quizRules.randomizeQuestions ? '#0f0f0f' : '#edf0f7',
                    bgcolor: quizRules.randomizeQuestions ? '#f8d675' : 'transparent',
                  }}
                >
                  {tt('Random spørsmål', 'Random questions')}
                </Button>
                <TextField
                  size="small"
                  label={tt('Antall random', 'Random count')}
                  value={String(quizRules.randomQuestionCount)}
                  onChange={(event) => {
                    const parsed = Number.parseInt(event.target.value, 10);
                    if (!Number.isFinite(parsed)) return;
                    setQuizRules((prev) => ({
                      ...prev,
                      randomQuestionCount: clamp(parsed, 1, Math.max(1, questions.length)),
                    }));
                  }}
                  sx={{
                    width: { xs: '100%', md: 140 },
                    '& .MuiInputBase-root': { color: '#edf0f7' },
                    '& .MuiInputLabel-root': { color: 'rgba(237,240,247,0.64)' },
                    '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' },
                  }}
                />
                <TextField
                  size="small"
                  label={tt('Maks forsøk', 'Max retries')}
                  value={String(quizRules.maxRetries)}
                  onChange={(event) => {
                    const parsed = Number.parseInt(event.target.value, 10);
                    if (!Number.isFinite(parsed)) return;
                    setQuizRules((prev) => ({
                      ...prev,
                      maxRetries: clamp(parsed, 1, 10),
                    }));
                  }}
                  sx={{
                    width: { xs: '100%', md: 120 },
                    '& .MuiInputBase-root': { color: '#edf0f7' },
                    '& .MuiInputLabel-root': { color: 'rgba(237,240,247,0.64)' },
                    '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' },
                  }}
                />
                <TextField
                  size="small"
                  label={tt('Bestått %', 'Pass %')}
                  value={String(quizRules.passingScore)}
                  onChange={(event) => {
                    const parsed = Number.parseInt(event.target.value, 10);
                    if (!Number.isFinite(parsed)) return;
                    setQuizRules((prev) => ({
                      ...prev,
                      passingScore: clamp(parsed, 0, 100),
                    }));
                  }}
                  sx={{
                    width: { xs: '100%', md: 110 },
                    '& .MuiInputBase-root': { color: '#edf0f7' },
                    '& .MuiInputLabel-root': { color: 'rgba(237,240,247,0.64)' },
                    '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' },
                  }}
                />
                <Button
                  size="small"
                  onClick={() =>
                    setQuizRules((prev) => ({
                      ...prev,
                      revealAnswerAfterRetries: !prev.revealAnswerAfterRetries,
                    }))
                  }
                  sx={{
                    textTransform: 'none',
                    color: quizRules.revealAnswerAfterRetries ? '#f8d675' : '#edf0f7',
                    border: `var(--academy-hairline-width, 1px) solid ${
                      quizRules.revealAnswerAfterRetries ? 'rgba(248,179,33,0.5)' : 'rgba(255,255,255,0.2)'
                    }`,
                    borderRadius: 1,
                  }}
                >
                  {quizRules.revealAnswerAfterRetries
                    ? tt('Vis fasit etter forsøk', 'Reveal answer after retries')
                    : tt('Fasit av', 'Reveal off')}
                </Button>
                <Button
                  size="small"
                  onClick={() =>
                    setQuizRules((prev) => ({
                      ...prev,
                      negativeMarking: !prev.negativeMarking,
                    }))
                  }
                  sx={{
                    textTransform: 'none',
                    color: quizRules.negativeMarking ? '#f8d675' : '#edf0f7',
                    border: `var(--academy-hairline-width, 1px) solid ${
                      quizRules.negativeMarking ? 'rgba(248,179,33,0.5)' : 'rgba(255,255,255,0.2)'
                    }`,
                    borderRadius: 1,
                  }}
                >
                  {quizRules.negativeMarking
                    ? tt('Negativ scoring: På', 'Negative scoring: On')
                    : tt('Negativ scoring: Av', 'Negative scoring: Off')}
                </Button>
                <Button
                  size="small"
                  onClick={() => setStudentSeed(Date.now())}
                  sx={{
                    textTransform: 'none',
                    color: '#edf0f7',
                    border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.2)',
                    borderRadius: 1,
                  }}
                >
                  {tt('Ny random-seed', 'New random seed')}
                </Button>
                <Chip
                  size="small"
                  label={tt(
                    `Student score: ${studentScoreSummary.normalized}%`,
                    `Student score: ${studentScoreSummary.normalized}%`,
                  )}
                  sx={{
                    bgcolor: studentScoreSummary.passed ? 'rgba(126,232,179,0.16)' : 'rgba(255,255,255,0.08)',
                    color: studentScoreSummary.passed ? '#9ef1ca' : '#edf0f7',
                  }}
                />
                  </Stack>
                </>
              ) : (
                <Stack
                  direction={{ xs: 'column', lg: 'row' }}
                  spacing={0.8}
                  alignItems={{ xs: 'stretch', lg: 'center' }}
                  sx={{ ...cinematicPanelSx, px: 1, py: 0.75 }}
                >
                  <Stack direction="row" spacing={0.4} sx={QUIZ_TOOLBAR_GROUP_SX}>
                    <Button
                      size="small"
                      startIcon={<CropSquare />}
                      onClick={() => setSafeAreaEnabled((prev) => !prev)}
                      sx={{
                        ...QUIZ_NEUTRAL_OUTLINED_BUTTON_SX,
                        color: safeAreaEnabled ? '#f8d675' : '#edf0f7',
                        borderColor: safeAreaEnabled ? 'rgba(248,179,33,0.5)' : 'rgba(255,255,255,0.2)',
                      }}
                    >
                      {safeAreaEnabled
                        ? tt('Safe area: På', 'Safe area: On')
                        : tt('Safe area: Av', 'Safe area: Off')}
                    </Button>
                    <Button
                      size="small"
                      onClick={() => setTimelineSnapEnabled((prev) => !prev)}
                      sx={{
                        ...QUIZ_NEUTRAL_OUTLINED_BUTTON_SX,
                        color: timelineSnapEnabled ? '#f8d675' : '#edf0f7',
                        borderColor: timelineSnapEnabled ? 'rgba(248,179,33,0.5)' : 'rgba(255,255,255,0.2)',
                      }}
                    >
                      {timelineSnapEnabled
                        ? tt('Snap: 0.5s + playhead', 'Snap: 0.5s + playhead')
                        : tt('Snap: Av', 'Snap: Off')}
                    </Button>
                  </Stack>
                  <Stack direction="row" spacing={0.6} flexWrap="wrap" useFlexGap sx={{ ml: { lg: 'auto' } }}>
                    <Chip
                      size="small"
                      icon={<WarningAmber sx={{ fontSize: 16 }} />}
                      label={tt(`${qualityIssues.length} kvalitetssjekker`, `${qualityIssues.length} quality checks`)}
                      sx={{
                        bgcolor:
                          qualityIssues.length === 0
                            ? 'rgba(126,232,179,0.16)'
                            : 'rgba(248,179,33,0.16)',
                        color:
                          qualityIssues.length === 0
                            ? '#9ef1ca'
                            : '#f8d675',
                      }}
                    />
                  </Stack>
                </Stack>
              )}

              <Stack
                direction="row"
                spacing={1.2}
                alignItems="center"
                sx={{
                  ...cinematicPanelSx,
                  px: 1.2,
                  py: 1,
                }}
              >
                <IconButton size="small" onClick={togglePlayback} sx={{ color: 'rgba(237,240,247,0.75)' }}>
                  {isPlaying ? <Pause fontSize="small" /> : <PlayArrow fontSize="small" />}
                </IconButton>

                <Slider
                  value={currentTime}
                  onChange={handleSeek}
                  min={0}
                  max={duration || 1}
                  sx={{
                    flex: 1,
                    color: '#f8b321',
                    '& .MuiSlider-thumb': {
                      width: 12,
                      height: 12,
                    },
                  }}
                />

                <Typography sx={{ fontSize: 14, color: 'rgba(237,240,247,0.8)', minWidth: 120, textAlign: 'right' }}>
                  {formatTime(currentTime)} · {formatTime(duration)}
                </Typography>
              </Stack>

              <Box
                sx={{
                  ...cinematicPanelSx,
                  position: 'relative',
                  p: 1,
                  minHeight: 510,
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <AcademyPlayerStudio
                  src={effectiveVideoUrl}
                  videoRef={videoRef}
                  onLoadedMetadata={handleLoadedMetadata}
                  onTimeUpdate={handleTimeUpdate}
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                >
                  {safeAreaEnabled && (
                    <Box
                      sx={{
                        position: 'absolute',
                        top: `${QUIZ_SAFE_AREA_MARGIN_PERCENT}%`,
                        right: `${QUIZ_SAFE_AREA_MARGIN_PERCENT}%`,
                        bottom: `${QUIZ_SAFE_AREA_MARGIN_PERCENT}%`,
                        left: `${QUIZ_SAFE_AREA_MARGIN_PERCENT}%`,
                        border: `1px dashed ${alpha('#f8d675', 0.72)}`,
                        borderRadius: 1,
                        pointerEvents: 'none',
                        zIndex: 1,
                      }}
                    />
                  )}

                  {activePreviewQuestion && (
                    <Box
                      sx={{
                        position: 'absolute',
                        left: '50%',
                        bottom: 18,
                        transform: 'translateX(-50%)',
                        width: 'min(84%, 860px)',
                        borderRadius: 1,
                        border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.12)',
                        background: 'linear-gradient(180deg, rgba(13,16,24,0.9), rgba(8,11,18,0.95))',
                        p: 2,
                        zIndex: 2,
                      }}
                    >
                      <Stack direction="row" spacing={0.8} alignItems="center" justifyContent="space-between">
                        <Chip
                          size="small"
                          label={
                            previewMode === 'student'
                              ? `${tt('Spørsmål', 'Question')} ${Math.min(studentQuestionIndex + 1, studentQuestionPool.length)} / ${Math.max(studentQuestionPool.length, 1)}`
                              : tt('Instruktør-forhåndsvisning', 'Instructor preview')
                          }
                          sx={{ bgcolor: 'rgba(255,255,255,0.1)', color: '#edf0f7' }}
                        />
                        <Chip
                          size="small"
                          label={tt(
                            `Type: ${activePreviewQuestion.type}`,
                            `Type: ${activePreviewQuestion.type}`,
                          )}
                          sx={{ bgcolor: 'rgba(106,196,255,0.14)', color: '#cbe8ff' }}
                        />
                        <Chip
                          size="small"
                          label={tt(
                            `Vekt ${activePreviewQuestion.weight.toFixed(1)}x`,
                            `Weight ${activePreviewQuestion.weight.toFixed(1)}x`,
                          )}
                          sx={{ bgcolor: 'rgba(248,179,33,0.14)', color: '#f8d675' }}
                        />
                      </Stack>

                      {editorMode === 'edit' && previewMode !== 'student' ? (
                        <Box
                          contentEditable
                          suppressContentEditableWarning
                          onBlur={(event) => {
                            const nextPrompt = String(event.currentTarget.textContent || '').trim();
                            if (!nextPrompt || nextPrompt === activePreviewQuestion.prompt) return;
                            updateActiveQuestion((question) => ({
                              ...question,
                              prompt: nextPrompt,
                            }));
                          }}
                          sx={{
                            fontSize: 34,
                            fontWeight: 600,
                            mt: 1.2,
                            mb: 1.4,
                            textAlign: 'center',
                            borderRadius: 1,
                            border: '1px dashed rgba(248,179,33,0.65)',
                            px: 1,
                            py: 0.4,
                            outline: 'none',
                            cursor: 'text',
                          }}
                        >
                          {activePreviewQuestion.prompt}
                        </Box>
                      ) : (
                        <Typography sx={{ fontSize: 34, fontWeight: 600, mt: 1.2, mb: 1.4, textAlign: 'center' }}>
                          {activePreviewQuestion.prompt}
                        </Typography>
                      )}

                      {activePreviewQuestion.type === 'short-answer' ? (
                        <TextField
                          fullWidth
                          size="small"
                          placeholder={tt('Skriv kortsvar...', 'Write short answer...')}
                          value={shortAnswerInput}
                          onChange={(event) => setShortAnswerInput(event.target.value)}
                          disabled={submitted && previewMode === 'student'}
                          sx={{
                            '& .MuiInputBase-root': {
                              color: '#edf0f7',
                              bgcolor: 'rgba(255,255,255,0.06)',
                            },
                            '& .MuiOutlinedInput-notchedOutline': {
                              borderColor: 'rgba(255,255,255,0.2)',
                            },
                          }}
                        />
                      ) : (
                        <Stack spacing={1}>
                          {activePreviewQuestion.options.map((option) => {
                            const selected = selectedOptionIds.includes(option.id);
                            const showCorrect = submitted && option.isCorrect;
                            const showWrong = submitted && selected && !option.isCorrect;
                            const inlineEditEnabled = editorMode === 'edit' && previewMode !== 'student';
                            return (
                              <Box
                                key={option.id}
                                component={inlineEditEnabled ? 'div' : 'button'}
                                onClick={
                                  inlineEditEnabled
                                    ? undefined
                                    : () => {
                                        handleOptionPick(option.id);
                                      }
                                }
                                sx={{
                                  width: '100%',
                                  justifyContent: 'flex-start',
                                  textAlign: 'left',
                                  color: '#edf0f7',
                                  borderRadius: 1,
                                  border: `var(--academy-hairline-width, 1px) solid ${
                                    showCorrect
                                      ? alpha(quizGold, 0.85)
                                      : showWrong
                                        ? 'rgba(255,108,108,0.7)'
                                        : selected
                                          ? quizGoldBorder
                                          : 'rgba(255,255,255,0.18)'
                                  }`,
                                  background:
                                    showCorrect
                                      ? `linear-gradient(90deg, ${alpha(quizGold, 0.22)}, ${alpha(quizGold, 0.08)})`
                                      : selected
                                        ? `linear-gradient(90deg, ${quizGoldSoft}, rgba(255,255,255,0.02))`
                                        : 'rgba(0,0,0,0.2)',
                                  '&:hover': {
                                    borderColor: alpha(quizGold, 0.62),
                                    background: `linear-gradient(90deg, ${alpha(quizGold, 0.17)}, rgba(255,255,255,0.03))`,
                                  },
                                  cursor: inlineEditEnabled ? 'default' : 'pointer',
                                  p: 1,
                                  outline: 'none',
                                }}
                              >
                                <Stack direction="row" spacing={1.2} alignItems="center" sx={{ width: '100%' }}>
                                  {selected ? (
                                    <Check sx={{ fontSize: 18, color: '#f8d56f' }} />
                                  ) : (
                                    <RadioButtonUnchecked sx={{ fontSize: 18, color: 'rgba(237,240,247,0.75)' }} />
                                  )}
                                  <Chip
                                    label={option.label}
                                    size="small"
                                    sx={{
                                      bgcolor: 'rgba(255,255,255,0.08)',
                                      color: '#edf0f7',
                                      minWidth: 28,
                                    }}
                                  />
                                  {inlineEditEnabled ? (
                                    <Box
                                      component="span"
                                      contentEditable
                                      suppressContentEditableWarning
                                      onBlur={(event) => {
                                        const nextText = String(event.currentTarget.textContent || '').trim();
                                        if (!nextText || nextText === option.text) return;
                                        updateActiveQuestion((question) => ({
                                          ...question,
                                          options: question.options.map((entry) =>
                                            entry.id === option.id ? { ...entry, text: nextText } : entry,
                                          ),
                                        }));
                                      }}
                                      sx={{
                                        fontSize: 27,
                                        textAlign: 'left',
                                        borderRadius: 0.8,
                                        border: '1px dashed rgba(248,179,33,0.55)',
                                        px: 0.6,
                                        py: 0.1,
                                        outline: 'none',
                                        cursor: 'text',
                                      }}
                                    >
                                      {option.text}
                                    </Box>
                                  ) : (
                                    <Typography sx={{ fontSize: 27, textAlign: 'left' }}>{option.text}</Typography>
                                  )}
                                  <Box sx={{ ml: 'auto' }}>
                                    {showCorrect && <Check sx={{ color: '#f8d56f' }} />}
                                  </Box>
                                </Stack>
                              </Box>
                            );
                          })}
                        </Stack>
                      )}

                      <Stack direction="row" alignItems="center" sx={{ mt: 1.4 }}>
                        <Typography sx={{ color: 'rgba(237,240,247,0.72)', fontSize: 20 }}>
                          {editorMode === 'edit' && previewMode !== 'student' ? (
                            <Box
                              component="span"
                              contentEditable
                              suppressContentEditableWarning
                              onBlur={(event) => {
                                const nextHint = String(event.currentTarget.textContent || '').trim();
                                if (!nextHint || nextHint === activePreviewQuestion.hint) return;
                                updateActiveQuestion((question) => ({
                                  ...question,
                                  hint: nextHint,
                                }));
                              }}
                              sx={{
                                display: 'inline-block',
                                borderRadius: 0.8,
                                border: '1px dashed rgba(248,179,33,0.55)',
                                px: 0.6,
                                py: 0.2,
                                outline: 'none',
                                cursor: 'text',
                              }}
                            >
                              {activePreviewQuestion.hint}
                            </Box>
                          ) : (
                            activePreviewQuestion.hint
                          )}
                        </Typography>
                        <Typography sx={{ ml: 'auto', color: 'rgba(237,240,247,0.72)', fontSize: 20 }}>
                          {formatTime(activePreviewQuestion.timestamp)}-{formatTime(activePreviewQuestion.timestamp + activePreviewQuestion.duration)}
                        </Typography>
                      </Stack>

                      {previewMode === 'student' && studentAnswers[activePreviewQuestion.id]?.submitted && (
                        <Box
                          sx={{
                            mt: 1.1,
                            p: 0.9,
                            borderRadius: 1,
                            border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.15)',
                            background: 'rgba(255,255,255,0.04)',
                          }}
                        >
                          <Typography sx={{ color: 'rgba(237,240,247,0.85)', fontSize: 13 }}>
                            {studentAnswers[activePreviewQuestion.id]?.feedback}
                          </Typography>
                          {studentAnswers[activePreviewQuestion.id]?.showAnswer && (
                            <Typography sx={{ mt: 0.6, color: '#f8d675', fontSize: 12 }}>
                              {tt('Fasit vises nå.', 'Answer key is now shown.')}
                            </Typography>
                          )}
                        </Box>
                      )}

                      <Stack direction="row" spacing={1} justifyContent="center" sx={{ mt: 1.5 }}>
                        <Button
                          onClick={handleSubmitAnswer}
                          disabled={
                            (activePreviewQuestion.type === 'short-answer'
                              ? String(shortAnswerInput || '').trim().length === 0
                              : selectedOptionIds.length === 0) ||
                            (submitted && previewMode === 'student')
                          }
                          sx={{
                            minWidth: 220,
                            textTransform: 'none',
                            color: '#0f0f0f',
                            fontWeight: 700,
                            background: 'linear-gradient(180deg, #ffd44e, #f2a616)',
                            '&.Mui-disabled': {
                              color: 'rgba(255,255,255,0.6)',
                              background: 'rgba(255,255,255,0.15)',
                            },
                          }}
                        >
                          {submitted ? tt('Svar sendt', 'Answer Submitted') : tt('Send svar', 'Submit Answer')}
                        </Button>
                        {previewMode === 'student' &&
                          submitted &&
                          studentAnswers[activePreviewQuestion.id]?.correct === false &&
                          (studentAnswers[activePreviewQuestion.id]?.retries || 0) < quizRules.maxRetries && (
                            <Button
                              onClick={resetCurrentAttempt}
                              sx={{
                                textTransform: 'none',
                                color: '#edf0f7',
                                border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.2)',
                              }}
                            >
                              {tt('Prøv igjen', 'Try again')}
                            </Button>
                          )}
                        {previewMode === 'student' && (
                          <Button
                            onClick={() =>
                              setStudentQuestionIndex((prev) =>
                                Math.min(prev + 1, Math.max(studentQuestionPool.length - 1, 0)),
                              )
                            }
                            disabled={studentQuestionIndex >= studentQuestionPool.length - 1}
                            sx={{
                              textTransform: 'none',
                              color: '#edf0f7',
                              border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.2)',
                            }}
                          >
                            {tt('Neste spørsmål', 'Next question')}
                          </Button>
                        )}
                      </Stack>
                    </Box>
                  )}
                </AcademyPlayerStudio>

                <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} sx={{ mt: 1.1 }}>
                  <TextField
                    value={searchValue}
                    onChange={(event) => setSearchValue(event.target.value)}
                    placeholder={tt('Søk kompetanser...', 'Search Competencies...')}
                    size="small"
                    InputProps={{
                      startAdornment: <Search fontSize="small" sx={{ mr: 0.7, color: 'rgba(237,240,247,0.6)' }} />,
                    }}
                    sx={{
                      flex: 1,
                      '& .MuiInputBase-root': {
                        bgcolor: 'rgba(11,14,22,0.8)',
                        color: '#edf0f7',
                      },
                    }}
                  />
                  <Button
                    startIcon={<Add />}
                    onClick={addQuestion}
                    sx={{
                      textTransform: 'none',
                      minWidth: 166,
                      color: '#f7f8fb',
                      border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.2)',
                      borderRadius: 1,
                    }}
                  >
                    {tt('Legg til spørsmål', 'Add Question')}
                  </Button>
                </Stack>

                <Box sx={{ mt: 1, ...cinematicPanelSx, p: 1 }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.8 }}>
                    <Typography sx={{ fontSize: 12, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'rgba(237,240,247,0.7)' }}>
                      {tt('Tidslinje spørsmål', 'Question Timeline')}
                    </Typography>
                    <Typography sx={{ fontSize: 12, color: 'rgba(237,240,247,0.7)' }}>
                      {tt('Dra markører for å flytte spørsmål', 'Drag markers to reposition questions')}
                    </Typography>
                  </Stack>
                  <Box
                    ref={timelineTrackRef}
                    sx={{
                      position: 'relative',
                      height: 64,
                      borderRadius: 1,
                      border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.14)',
                      background:
                        'linear-gradient(90deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.02) 100%)',
                      overflow: 'hidden',
                    }}
                  >
                    {questions.map((question, index) => {
                      const leftPercent = (question.timestamp / Math.max(duration, 1)) * 100;
                      const widthPercent = (question.duration / Math.max(duration, 1)) * 100;
                      const isActive = activeQuestion?.id === question.id;
                      const hasOverlap = overlapQuestionIds.has(question.id);
                      return (
                        <Box
                          key={`timeline-${question.id}`}
                          onMouseDown={(event) => {
                            event.preventDefault();
                            setActiveQuestionId(question.id);
                            startQuestionDrag(question.id, event.clientX);
                          }}
                          sx={{
                            position: 'absolute',
                            left: `${leftPercent}%`,
                            top: 12,
                            width: `${Math.max(widthPercent, 2.2)}%`,
                            minWidth: 26,
                            height: 40,
                            borderRadius: 0.8,
                            border: hasOverlap
                              ? '1px solid rgba(255,108,108,0.85)'
                              : isActive
                                ? '1px solid rgba(248,179,33,0.85)'
                                : '1px solid rgba(255,255,255,0.25)',
                            background: hasOverlap
                              ? 'linear-gradient(90deg, rgba(255,108,108,0.35), rgba(255,108,108,0.12))'
                              : isActive
                                ? 'linear-gradient(90deg, rgba(248,179,33,0.35), rgba(248,179,33,0.12))'
                                : 'linear-gradient(90deg, rgba(126,161,239,0.24), rgba(126,161,239,0.1))',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 11,
                            color: '#edf0f7',
                            cursor: 'ew-resize',
                            userSelect: 'none',
                          }}
                        >
                          {index + 1}
                        </Box>
                      );
                    })}
                    <Box
                      sx={{
                        position: 'absolute',
                        top: 0,
                        bottom: 0,
                        left: `${(currentTime / Math.max(duration, 1)) * 100}%`,
                        width: 2,
                        background: 'rgba(248,179,33,0.9)',
                        boxShadow: '0 0 12px rgba(248,179,33,0.45)',
                      }}
                    />
                  </Box>
                </Box>

                {!!saveMessage && (
                  <Typography sx={{ mt: 1, color: '#a8f7c4', fontSize: 12 }}>{saveMessage}</Typography>
                )}
              </Box>
            </Box>

            <Box sx={{ ...cinematicPanelSx, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
              <Tabs
                value={rightTab}
                onChange={(_, value: RightTab) => setRightTab(value)}
                textColor="inherit"
                sx={{
                  borderBottom: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.08)',
                  '& .MuiTabs-indicator': { backgroundColor: '#f8b321' },
                  '& .MuiTab-root': { color: 'rgba(237,240,247,0.78)', textTransform: 'none', minHeight: 44 },
                  '& .Mui-selected': { color: '#f7f8fb' },
                }}
              >
                <Tab label={tt('Quiz-analytikk', 'Quiz Analytics')} value="analytics" />
                <Tab label={tt('Resultater', 'Results')} value="results" />
                <Tab label={tt('Innsikt', 'Insights')} value="insights" />
                <Tab label={tt('Markører', 'Markers')} value="markers" />
              </Tabs>

              {(rightTab === 'analytics' || rightTab === 'results') && activeQuestion && (
                <Box sx={{ p: 1.3, display: 'flex', flexDirection: 'column', gap: 1.2 }}>
                  <Stack spacing={1}>
                    <Typography sx={{ fontSize: 26, fontWeight: 600 }}>
                      {participants} {tt('deltakere', 'participants')}
                    </Typography>
                    <Typography sx={{ fontSize: 26, fontWeight: 600 }}>
                      {tt('Gjennomsnitt', 'Average')}: {questionResults.avgScore}%
                    </Typography>
                    <LinearProgress
                      variant="determinate"
                      value={questionResults.avgScore}
                      sx={{
                        height: 8,
                        borderRadius: 4,
                        bgcolor: 'rgba(255,255,255,0.1)',
                        '& .MuiLinearProgress-bar': {
                          background: 'linear-gradient(90deg, #70b4ff, #f8b321)',
                        },
                      }}
                    />
                  </Stack>

                  <Box sx={{ ...cinematicPanelSx, p: 1.2 }}>
                    <Stack direction="row" alignItems="center" spacing={1.2}>
                      <Box
                        sx={{
                          width: 92,
                          height: 92,
                          borderRadius: '50%',
                          background: `conic-gradient(#f8b321 ${questionResults.correctRate * 3.6}deg, rgba(255,255,255,0.12) 0deg)`,
                          display: 'grid',
                          placeItems: 'center',
                        }}
                      >
                        <Box
                          sx={{
                            width: 62,
                            height: 62,
                            borderRadius: '50%',
                            bgcolor: '#0f1420',
                            display: 'grid',
                            placeItems: 'center',
                            fontWeight: 700,
                          }}
                        >
                          {questionResults.correctRate}%
                        </Box>
                      </Box>

                      <Box>
                        <Typography sx={{ fontSize: 30, fontWeight: 700 }}>{questionResults.correctRate}%</Typography>
                        <Typography sx={{ color: 'rgba(237,240,247,0.76)' }}>
                          {tt('Besvart riktig', 'Answered correctly')}
                        </Typography>
                        <Typography sx={{ color: 'rgba(237,240,247,0.64)', fontSize: 12 }}>
                          {tt('Drop-off', 'Drop-off')}: {activeQuestionMetrics?.dropOff || 0}% ·{' '}
                          {tt('Vanskelighet', 'Difficulty')}: {activeQuestionMetrics?.difficulty || 0}
                        </Typography>
                      </Box>
                    </Stack>

                    <Typography sx={{ mt: 1.2, mb: 0.8, fontWeight: 600 }}>
                      {tt('Svar-heatmap', 'Answer heatmap')}
                    </Typography>
                    <Stack spacing={0.8}>
                      {activeQuestion.options.map((option) => {
                        const responseRate = clamp(
                          Math.round((option.responses / Math.max(participants, 1)) * 100),
                          0,
                          100,
                        );
                        const heat = option.isCorrect
                          ? 'linear-gradient(90deg, #f8b321, #f9d77e)'
                          : responseRate >= 35
                            ? 'linear-gradient(90deg, #ff8a7a, #ffb0a4)'
                            : 'linear-gradient(90deg, #56709f, #7ca8e4)';
                        return (
                          <Stack key={option.id} direction="row" alignItems="center" spacing={0.8}>
                            <Chip
                              label={option.label}
                              size="small"
                              sx={{
                                minWidth: 28,
                                bgcolor: option.isCorrect ? 'rgba(248,179,33,0.25)' : 'rgba(255,255,255,0.1)',
                                color: '#edf0f7',
                              }}
                            />
                            <Typography sx={{ flex: 1, fontSize: 14 }} noWrap>
                              {option.text}
                            </Typography>
                            <Box sx={{ width: 120 }}>
                              <LinearProgress
                                variant="determinate"
                                value={responseRate}
                                sx={{
                                  height: 6,
                                  borderRadius: 4,
                                  bgcolor: 'rgba(255,255,255,0.1)',
                                  '& .MuiLinearProgress-bar': {
                                    background: heat,
                                  },
                                }}
                              />
                            </Box>
                            <Typography sx={{ minWidth: 34, textAlign: 'right', fontWeight: 600 }}>
                              {responseRate}%
                            </Typography>
                          </Stack>
                        );
                      })}
                    </Stack>
                  </Box>

                  <Box sx={{ ...cinematicPanelSx, p: 1.1 }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Typography sx={{ fontWeight: 600 }}>{tt('Individuelt resultat', 'Individual Result')}</Typography>
                      <Typography sx={{ color: selectedOption?.isCorrect ? '#9ceab9' : '#ff9b9b', fontWeight: 600 }}>
                        {submitted
                          ? selectedOption?.isCorrect
                            ? tt('Riktig', 'Correct')
                            : tt('Feil', 'Incorrect')
                          : tt('Venter', 'Pending')}
                      </Typography>
                    </Stack>
                    <Stack spacing={0.8} sx={{ mt: 0.9 }}>
                      <Stack direction="row" justifyContent="space-between">
                        <Typography sx={{ color: 'rgba(237,240,247,0.7)' }}>{tt('Score', 'Score')}</Typography>
                        <Typography sx={{ fontWeight: 700 }}>{individualScore}</Typography>
                      </Stack>
                      <LinearProgress
                        variant="determinate"
                        value={clamp(individualScore, 0, 100)}
                        sx={{
                          height: 7,
                          borderRadius: 4,
                          bgcolor: 'rgba(255,255,255,0.1)',
                          '& .MuiLinearProgress-bar': {
                            background: selectedOption?.isCorrect
                              ? 'linear-gradient(90deg, #7fd699, #b4f6ca)'
                              : 'linear-gradient(90deg, #ff9f8e, #ffc8bb)',
                          },
                        }}
                      />
                      <Stack direction="row" justifyContent="space-between">
                        <Typography sx={{ color: 'rgba(237,240,247,0.7)' }}>{tt('Forsøk', 'Attempts')}</Typography>
                        <Typography sx={{ fontWeight: 700 }}>{attempts}</Typography>
                      </Stack>
                    </Stack>
                  </Box>

                  <Box sx={{ ...cinematicPanelSx, p: 1.1 }}>
                    <Typography sx={{ fontWeight: 600, mb: 0.8 }}>
                      {tt('Vanskelighetsoversikt', 'Difficulty overview')}
                    </Typography>
                    <Stack spacing={0.7}>
                      {questionAnalytics.slice(0, 6).map((entry) => (
                        <Stack key={`difficulty-${entry.questionId}`} direction="row" spacing={0.8} alignItems="center">
                          <Chip
                            size="small"
                            label={`${tt('Spørsmål', 'Question')} ${entry.index + 1}`}
                            sx={{ bgcolor: 'rgba(255,255,255,0.08)', color: '#edf0f7' }}
                          />
                          <Typography sx={{ color: 'rgba(237,240,247,0.72)', fontSize: 12 }}>
                            {tt('Drop-off', 'Drop-off')}: {entry.dropOff}%
                          </Typography>
                          <Typography sx={{ color: 'rgba(237,240,247,0.72)', fontSize: 12 }}>
                            {tt('Vanskelighet', 'Difficulty')}: {entry.difficulty}
                          </Typography>
                          <Chip
                            size="small"
                            label={
                              entry.tooEasy
                                ? tt('For lett', 'Too easy')
                                : entry.tooHard
                                  ? tt('For vanskelig', 'Too hard')
                                  : tt('Balansert', 'Balanced')
                            }
                            sx={{
                              ml: 'auto',
                              bgcolor: entry.tooEasy
                                ? 'rgba(126,232,179,0.16)'
                                : entry.tooHard
                                  ? 'rgba(255,108,108,0.16)'
                                  : 'rgba(255,255,255,0.08)',
                              color: '#edf0f7',
                            }}
                          />
                        </Stack>
                      ))}
                    </Stack>
                  </Box>
                </Box>
              )}

              {rightTab === 'insights' && activeQuestion && (
                <Box sx={{ p: 1.3, display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <Box sx={QUIZ_EDITOR_SECTION_SX}>
                    <Typography sx={QUIZ_SECTION_LABEL_SX}>{tt('Spørsmålsbank', 'Question Bank')}</Typography>
                    <Stack direction={{ xs: 'column', md: 'row' }} spacing={0.8}>
                      <TextField
                        size="small"
                        value={searchValue}
                        onChange={(event) => setSearchValue(event.target.value)}
                        placeholder={tt('Søk i spørsmål, tags, typer ...', 'Search questions, tags, types ...')}
                        sx={{ flex: 1, '& .MuiInputBase-root': { color: '#edf0f7' } }}
                      />
                      <TextField
                        size="small"
                        value={tagFilter}
                        onChange={(event) => setTagFilter(event.target.value)}
                        placeholder={tt('Filtrer tag', 'Tag filter')}
                        sx={{ width: { xs: '100%', md: 150 }, '& .MuiInputBase-root': { color: '#edf0f7' } }}
                      />
                    </Stack>

                    <Stack direction="row" spacing={0.6} flexWrap="wrap" useFlexGap>
                      {allTags.slice(0, 12).map((tag) => (
                        <Chip
                          key={`tag-${tag}`}
                          size="small"
                          label={tag}
                          onClick={() => setTagFilter(tag)}
                          sx={{
                            bgcolor:
                              String(tagFilter || '').trim().toLowerCase() === tag
                                ? 'rgba(248,179,33,0.2)'
                                : 'rgba(255,255,255,0.08)',
                            color: '#edf0f7',
                          }}
                        />
                      ))}
                    </Stack>

                    <Stack spacing={0.7} sx={{ maxHeight: 228, overflowY: 'auto', pr: 0.2 }}>
                      {filteredQuestions.map((question) => (
                        <Button
                          key={question.id}
                          onClick={() => handleQuestionSelect(question.id)}
                          sx={{
                            justifyContent: 'flex-start',
                            textTransform: 'none',
                            color: '#edf0f7',
                            border:
                              question.id === activeQuestion.id
                                ? 'var(--academy-hairline-width, 1px) solid rgba(248,179,33,0.55)'
                                : 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.14)',
                            background:
                              question.id === activeQuestion.id
                                ? 'linear-gradient(90deg, rgba(248,179,33,0.22), rgba(248,179,33,0.04))'
                                : 'transparent',
                          }}
                        >
                          <Stack direction="row" spacing={0.8} alignItems="center" sx={{ width: '100%' }}>
                            <Typography sx={{ flex: 1 }} noWrap>
                              {question.prompt}
                            </Typography>
                            <Chip
                              size="small"
                              label={question.type}
                              sx={{ bgcolor: 'rgba(255,255,255,0.08)', color: '#edf0f7' }}
                            />
                          </Stack>
                        </Button>
                      ))}
                    </Stack>
                  </Box>

                  <Box sx={QUIZ_EDITOR_SECTION_SX}>
                    <Typography sx={QUIZ_SECTION_LABEL_SX}>{tt('Spørsmål', 'Question')}</Typography>
                    <TextField
                      label={tt('Tittel', 'Prompt')}
                      size="small"
                      value={activeQuestion.prompt}
                      onChange={(event) =>
                        updateActiveQuestion((question) => ({
                          ...question,
                          prompt: event.target.value,
                        }))
                      }
                      sx={{ '& .MuiInputBase-root': { color: '#edf0f7' } }}
                    />
                    <TextField
                      label={tt('Hint', 'Hint')}
                      size="small"
                      value={activeQuestion.hint}
                      onChange={(event) =>
                        updateActiveQuestion((question) => ({
                          ...question,
                          hint: event.target.value,
                        }))
                      }
                      sx={{ '& .MuiInputBase-root': { color: '#edf0f7' } }}
                    />
                  </Box>

                  <Box sx={QUIZ_EDITOR_SECTION_SX}>
                    <Typography sx={QUIZ_SECTION_LABEL_SX}>{tt('Timing og regler', 'Timing and rules')}</Typography>
                    <Stack direction={{ xs: 'column', md: 'row' }} spacing={0.8}>
                      <Select
                        size="small"
                        value={activeQuestion.type}
                        onChange={(event) => {
                          const nextType = String(event.target.value) as QuizQuestionType;
                          updateActiveQuestion((question) => {
                            if (nextType === question.type) return question;
                            if (nextType === 'short-answer') {
                              return {
                                ...question,
                                type: nextType,
                                shortAnswerAccepted:
                                  question.shortAnswerAccepted.length > 0
                                    ? question.shortAnswerAccepted
                                    : ['example'],
                              };
                            }
                            if (nextType === 'true-false') {
                              return {
                                ...question,
                                type: nextType,
                                options: [
                                  {
                                    id: `${question.id}-true`,
                                    label: 'A',
                                    text: 'True',
                                    isCorrect: true,
                                    responses: 0,
                                    explanation: '',
                                  },
                                  {
                                    id: `${question.id}-false`,
                                    label: 'B',
                                    text: 'False',
                                    isCorrect: false,
                                    responses: 0,
                                    explanation: '',
                                  },
                                ],
                              };
                            }
                            return {
                              ...question,
                              type: nextType,
                              options:
                                question.options.length >= 2
                                  ? question.options
                                  : [
                                      {
                                        id: `${question.id}-a`,
                                        label: 'A',
                                        text: 'Option A',
                                        isCorrect: true,
                                        responses: 0,
                                        explanation: '',
                                      },
                                      {
                                        id: `${question.id}-b`,
                                        label: 'B',
                                        text: 'Option B',
                                        isCorrect: false,
                                        responses: 0,
                                        explanation: '',
                                      },
                                    ],
                            };
                          });
                        }}
                        sx={{
                          minWidth: { xs: '100%', md: 170 },
                          color: '#edf0f7',
                          bgcolor: 'rgba(255,255,255,0.04)',
                          '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' },
                        }}
                      >
                        <MenuItem value="single-choice">{tt('Single choice', 'Single choice')}</MenuItem>
                        <MenuItem value="multi-select">{tt('Multi select', 'Multi select')}</MenuItem>
                        <MenuItem value="true-false">{tt('True / False', 'True / False')}</MenuItem>
                        <MenuItem value="short-answer">{tt('Kortsvar', 'Short answer')}</MenuItem>
                      </Select>
                      <TextField
                        size="small"
                        label={tt('Vekt', 'Weight')}
                        value={String(activeQuestion.weight)}
                        onChange={(event) => {
                          const parsed = Number.parseFloat(event.target.value);
                          if (!Number.isFinite(parsed)) return;
                          updateActiveQuestion((question) => ({
                            ...question,
                            weight: clamp(parsed, 0.1, 5),
                          }));
                        }}
                        sx={{ width: { xs: '100%', md: 110 }, '& .MuiInputBase-root': { color: '#edf0f7' } }}
                      />
                      <TextField
                        size="small"
                        label={tt('Start (min:sek)', 'Start (min:sec)')}
                        value={formatTime(activeQuestion.timestamp)}
                        onChange={(event) => {
                          const parsed = parseMinuteSecondTime(event.target.value, activeQuestion.timestamp);
                          updateActiveQuestion((question) => {
                            const snapped = applySnap(parsed);
                            const nextTimestamp = clamp(
                              snapped,
                              0,
                              Math.max(0, duration - Math.max(QUIZ_MIN_DURATION_SECONDS, question.duration)),
                            );
                            return { ...question, timestamp: nextTimestamp };
                          });
                        }}
                        sx={{ width: { xs: '100%', md: 170 }, '& .MuiInputBase-root': { color: '#edf0f7' } }}
                      />
                      <TextField
                        size="small"
                        label={tt('Varighet (sek)', 'Duration (sec)')}
                        value={String(Math.round(activeQuestion.duration))}
                        onChange={(event) => {
                          const parsed = Number.parseFloat(event.target.value);
                          if (!Number.isFinite(parsed)) return;
                          updateActiveQuestion((question) => ({
                            ...question,
                            duration: Math.max(QUIZ_MIN_DURATION_SECONDS, parsed),
                          }));
                        }}
                        sx={{ width: { xs: '100%', md: 170 }, '& .MuiInputBase-root': { color: '#edf0f7' } }}
                      />
                    </Stack>
                  </Box>

                  <Box sx={QUIZ_EDITOR_SECTION_SX}>
                    <Typography sx={QUIZ_SECTION_LABEL_SX}>{tt('Tags og handlinger', 'Tags and actions')}</Typography>
                    <Stack direction={{ xs: 'column', md: 'row' }} spacing={0.8}>
                      <TextField
                        size="small"
                        label={tt('Tags (komma)', 'Tags (comma separated)')}
                        value={tagInput}
                        onChange={(event) => setTagInput(event.target.value)}
                        sx={{ flex: 1, '& .MuiInputBase-root': { color: '#edf0f7' } }}
                      />
                      <Button
                        size="small"
                        onClick={() => {
                          const parsedTags = tagInput
                            .split(',')
                            .map((entry) => entry.trim().toLowerCase())
                            .filter((entry) => entry.length > 0);
                          if (parsedTags.length === 0) return;
                          updateActiveQuestion((question) => ({
                            ...question,
                            tags: Array.from(new Set([...question.tags, ...parsedTags])).slice(0, 8),
                          }));
                          setTagInput('');
                        }}
                        sx={QUIZ_EDITOR_ACTION_BUTTON_SX}
                      >
                        {tt('Legg til tags', 'Add tags')}
                      </Button>
                      <Button
                        size="small"
                        onClick={() => {
                          const next = clamp(activeQuestion.timestamp, 0, duration);
                          setCurrentTime(next);
                          if (videoRef.current) {
                            videoRef.current.currentTime = next;
                          }
                        }}
                        sx={QUIZ_EDITOR_ACTION_BUTTON_SX}
                      >
                        {tt('Gå til tid', 'Jump to time')}
                      </Button>
                      <Button
                        size="small"
                        color="error"
                        onClick={() => removeQuestion(activeQuestion.id)}
                        sx={{ textTransform: 'none' }}
                      >
                        {tt('Slett', 'Delete')}
                      </Button>
                    </Stack>

                    <Stack direction="row" spacing={0.6} flexWrap="wrap" useFlexGap>
                      {activeQuestion.tags.map((tag) => (
                        <Chip
                          key={`active-tag-${activeQuestion.id}-${tag}`}
                          size="small"
                          label={tag}
                          onDelete={() =>
                            updateActiveQuestion((question) => ({
                              ...question,
                              tags: question.tags.filter((entry) => entry !== tag),
                            }))
                          }
                          sx={{ bgcolor: 'rgba(255,255,255,0.1)', color: '#edf0f7' }}
                        />
                      ))}
                    </Stack>
                  </Box>

                  {activeQuestion.type === 'short-answer' && (
                    <Box sx={QUIZ_EDITOR_SECTION_SX}>
                      <Typography sx={QUIZ_SECTION_LABEL_SX}>{tt('Godkjente svar', 'Accepted answers')}</Typography>
                      <TextField
                        size="small"
                        label={tt('Godkjente svar (komma)', 'Accepted answers (comma separated)')}
                        value={activeQuestion.shortAnswerAccepted.join(', ')}
                        onChange={(event) => {
                          const values = event.target.value
                            .split(',')
                            .map((entry) => entry.trim().toLowerCase())
                            .filter((entry) => entry.length > 0);
                          updateActiveQuestion((question) => ({
                            ...question,
                            shortAnswerAccepted: values,
                          }));
                        }}
                        sx={{ '& .MuiInputBase-root': { color: '#edf0f7' } }}
                      />
                    </Box>
                  )}

                  {activeQuestion.type !== 'short-answer' && (
                    <Box sx={QUIZ_EDITOR_SECTION_SX}>
                      <Typography sx={QUIZ_SECTION_LABEL_SX}>{tt('Svar og forklaringer', 'Answers and explanations')}</Typography>
                      <Stack spacing={0.8}>
                        {activeQuestion.options.map((option) => (
                          <Box
                            key={`edit-${option.id}`}
                            sx={{
                              borderRadius: 0.9,
                              border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.12)',
                              background: option.isCorrect
                                ? 'linear-gradient(145deg, rgba(248,179,33,0.12), rgba(248,179,33,0.04))'
                                : 'rgba(255,255,255,0.02)',
                              p: 0.8,
                              display: 'grid',
                              gap: 0.55,
                            }}
                          >
                            <Stack direction={{ xs: 'column', md: 'row' }} spacing={0.8} alignItems={{ xs: 'stretch', md: 'center' }}>
                              <Chip
                                label={option.label}
                                size="small"
                                sx={{
                                  alignSelf: { xs: 'flex-start', md: 'center' },
                                  bgcolor: option.isCorrect ? 'rgba(248,179,33,0.28)' : 'rgba(255,255,255,0.1)',
                                  color: '#edf0f7',
                                }}
                              />
                              <TextField
                                size="small"
                                value={option.text}
                                onChange={(event) =>
                                  updateActiveQuestion((question) => ({
                                    ...question,
                                    options: question.options.map((entry) =>
                                      entry.id === option.id ? { ...entry, text: event.target.value } : entry,
                                    ),
                                  }))
                                }
                                sx={{
                                  flex: 1,
                                  '& .MuiInputBase-root': { color: '#edf0f7' },
                                }}
                              />
                              <Button
                                size="small"
                                onClick={() =>
                                  updateActiveQuestion((question) => ({
                                    ...question,
                                    options: question.options.map((entry) => ({
                                      ...entry,
                                      isCorrect:
                                        question.type === 'multi-select'
                                          ? entry.id === option.id
                                            ? !entry.isCorrect
                                            : entry.isCorrect
                                          : entry.id === option.id,
                                    })),
                                  }))
                                }
                                sx={{
                                  textTransform: 'none',
                                  color: option.isCorrect ? '#0f0f0f' : '#edf0f7',
                                  background: option.isCorrect
                                    ? 'linear-gradient(180deg, #ffd44e, #f2a616)'
                                    : 'rgba(255,255,255,0.1)',
                                }}
                              >
                                {option.isCorrect
                                  ? tt('Riktig', 'Correct')
                                  : activeQuestion.type === 'multi-select'
                                    ? tt('Toggle riktig', 'Toggle correct')
                                    : tt('Sett riktig', 'Set Correct')}
                              </Button>
                            </Stack>
                            <TextField
                              size="small"
                              placeholder={tt('Forklaring ved valg av dette alternativet', 'Explanation for this option')}
                              value={option.explanation || ''}
                              onChange={(event) =>
                                updateActiveQuestion((question) => ({
                                  ...question,
                                  options: question.options.map((entry) =>
                                    entry.id === option.id
                                      ? { ...entry, explanation: event.target.value }
                                      : entry,
                                  ),
                                }))
                              }
                              sx={{ '& .MuiInputBase-root': { color: '#edf0f7' } }}
                            />
                          </Box>
                        ))}
                      </Stack>
                    </Box>
                  )}
                </Box>
              )}

              {rightTab === 'markers' && (
                <Box sx={{ p: 1.3, display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <Typography sx={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'rgba(237,240,247,0.64)' }}>
                    {tt('Markører', 'Markers')}
                  </Typography>

                  {publishBlockingIssues.length > 0 && (
                    <Box
                      sx={{
                        borderRadius: 1,
                        border: 'var(--academy-hairline-width, 1px) solid rgba(255,108,108,0.55)',
                        background: 'rgba(255,108,108,0.1)',
                        p: 0.9,
                      }}
                    >
                      <Typography sx={{ fontWeight: 600, color: '#ffb7b7', mb: 0.5 }}>
                        {tt('Publiseringsblokker', 'Publishing blockers')}
                      </Typography>
                      <Stack spacing={0.4}>
                        {publishBlockingIssues.map((issue, index) => (
                          <Typography key={`publish-blocker-${index}`} sx={{ color: '#ffd1d1', fontSize: 12 }}>
                            • {issue}
                          </Typography>
                        ))}
                      </Stack>
                    </Box>
                  )}

                  <Stack spacing={0.7}>
                    {questions.map((question, index) => (
                      <Box
                        key={`marker-${question.id}`}
                        sx={{
                          borderRadius: 1,
                          border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.14)',
                          background: 'rgba(255,255,255,0.03)',
                          p: 0.9,
                        }}
                      >
                        <Stack direction="row" spacing={0.7} alignItems="center">
                          <Chip
                            size="small"
                            label={`${tt('Spørsmål', 'Question')} ${index + 1}`}
                            sx={{ bgcolor: 'rgba(248,179,33,0.14)', color: '#f8d56f' }}
                          />
                          <Typography sx={{ flex: 1, minWidth: 0 }} noWrap>
                            {question.prompt}
                          </Typography>
                          <Chip
                            size="small"
                            label={`${formatTime(question.timestamp)}-${formatTime(question.timestamp + question.duration)}`}
                            sx={{ bgcolor: 'rgba(255,255,255,0.08)', color: '#edf0f7' }}
                          />
                          {overlapQuestionIds.has(question.id) && (
                            <Chip
                              size="small"
                              label={tt('Overlap', 'Overlap')}
                              sx={{ bgcolor: 'rgba(255,108,108,0.2)', color: '#ffc3c3' }}
                            />
                          )}
                          <Button
                            size="small"
                            onClick={() => {
                              setActiveQuestionId(question.id);
                              setCurrentTime(question.timestamp);
                              if (videoRef.current) {
                                videoRef.current.currentTime = question.timestamp;
                              }
                            }}
                            sx={{
                              textTransform: 'none',
                              color: '#edf0f7',
                              border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.2)',
                            }}
                          >
                            {tt('Gå til', 'Jump')}
                          </Button>
                        </Stack>
                      </Box>
                    ))}
                  </Stack>

                  <Divider sx={{ borderColor: 'rgba(255,255,255,0.09)' }} />

                  <Typography sx={{ fontWeight: 600 }}>
                    {tt('Kvalitetssjekker', 'Quality checks')}
                  </Typography>
                  {qualityIssues.length === 0 ? (
                    <Typography sx={{ color: 'rgba(237,240,247,0.72)', fontSize: 12 }}>
                      {tt('Ingen funn.', 'No findings.')}
                    </Typography>
                  ) : (
                    <Stack spacing={0.4}>
                      {qualityIssues.slice(0, 12).map((issue) => (
                        <Typography key={issue.id} sx={{ color: '#f8d675', fontSize: 12 }}>
                          • {tt(issue.messageNo, issue.messageEn)}
                        </Typography>
                      ))}
                    </Stack>
                  )}

                  <Divider sx={{ borderColor: 'rgba(255,255,255,0.09)' }} />

                  <Typography sx={{ fontWeight: 600 }}>
                    {tt('Versjonshistorikk', 'Version History')}
                  </Typography>
                  {versions.length === 0 ? (
                    <Typography sx={{ color: 'rgba(237,240,247,0.7)', fontSize: 13 }}>
                      {tt('Ingen versjoner enda.', 'No versions yet.')}
                    </Typography>
                  ) : (
                    <Stack spacing={0.6}>
                      {versions.slice(0, 10).map((version) => (
                        <Button
                          key={version.id}
                          onClick={() => setSelectedVersionId(version.id)}
                          sx={{
                            justifyContent: 'space-between',
                            textTransform: 'none',
                            color: '#edf0f7',
                            border:
                              selectedVersionId === version.id
                                ? 'var(--academy-hairline-width, 1px) solid rgba(248,179,33,0.55)'
                                : 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.14)',
                            background:
                              selectedVersionId === version.id
                                ? 'linear-gradient(90deg, rgba(248,179,33,0.22), rgba(248,179,33,0.05))'
                                : 'rgba(255,255,255,0.02)',
                          }}
                        >
                          <span>{version.label}</span>
                          <span style={{ opacity: 0.7, fontSize: 12 }}>
                            {new Date(version.createdAt).toLocaleString()}
                          </span>
                        </Button>
                      ))}
                      <Button
                        variant="outlined"
                        startIcon={<Undo />}
                        disabled={!selectedVersionId}
                        onClick={() => restoreVersion(selectedVersionId)}
                        sx={{
                          alignSelf: 'flex-start',
                          textTransform: 'none',
                          borderColor: 'rgba(255,255,255,0.2)',
                          color: '#edf0f7',
                        }}
                      >
                        {tt('Gjenopprett valgt versjon', 'Restore selected version')}
                      </Button>
                    </Stack>
                  )}
                </Box>
              )}

              <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)' }} />

              <Stack direction="row" spacing={1} sx={{ p: 1.1 }}>
                <Button
                  fullWidth
                  onClick={() => {
                    if (onCancel) {
                      onCancel();
                    } else {
                      setLocationWithContext('/academy/course-creator', false);
                    }
                  }}
                  sx={{
                    textTransform: 'none',
                    color: 'rgba(237,240,247,0.76)',
                    border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.16)',
                  }}
                >
                  {tt('Lukk', 'Close')}
                </Button>
              </Stack>
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

export default withUniversalIntegration(QuizManager, {
  componentId: 'academy-quiz-manager',
  componentName: 'Quiz Manager',
  componentType: 'manager',
  componentCategory: 'academy',
  featureIds: ['quiz-builder', 'assessment', 'analytics-academy'],
});
