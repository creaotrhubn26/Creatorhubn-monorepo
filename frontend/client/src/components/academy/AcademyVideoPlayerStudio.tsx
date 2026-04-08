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
  Typography,
} from '@mui/material';
import {
  Bookmark,
  Campaign,
  Check,
  FastForward,
  FastRewind,
  MailOutline,
  Mic,
  MonetizationOn,
  NotificationsNone,
  Pause,
  PlayArrow,
  Publish,
  Quiz,
  Search,
  Settings,
  SkipNext,
  SkipPrevious,
  Slideshow,
  Subtitles,
  Visibility,
  VisibilityOff,
  VolumeOff,
  VolumeUp,
  Save,
} from '@mui/icons-material';
import { useLocation } from 'wouter';
import { useAcademy, type CourseResource, type LessonResource } from '@/contexts/AcademyContext';
import { useEnhancedMasterIntegration } from '@/integration/EnhancedMasterIntegrationProvider';
import { withUniversalIntegration } from '@/integration/UniversalIntegrationHOC';
import { useAcademyLocale } from './academyLocale';
import AcademyLocaleSwitcher from './AcademyLocaleSwitcher';
import AcademyLeftSidebar from './AcademyLeftSidebar';
import AcademyPlayerStudio from './AcademyPlayerStudio';
import AcademyStudentSidebar from './AcademyStudentSidebar';
import { buildAcademyStudentNextAction } from './academyStudentExperience';
import { resolveAcademyVideoUrl } from './academyVideoSourceUtils';

interface ChapterItem {
  id: string;
  title: string;
  startTime: number;
  duration: number;
  icon: string;
}

interface TranscriptLine {
  id: string;
  speaker: string;
  timestamp: number;
  text: string;
}

interface QuizChoice {
  id: string;
  label: string;
  text: string;
  isCorrect: boolean;
}

interface PlayerQuiz {
  id: string;
  question: string;
  helper: string;
  timestamp: number;
  choices: QuizChoice[];
}

interface AcademyVideoPlayerStudioProps {
  courseId?: string;
  lessonId?: string;
  onSave?: (payload: Record<string, unknown>) => void;
  onCancel?: () => void;
  returnTo?: string;
}

type RightTab = 'chapters' | 'shownotes' | 'transcript';
type AssignmentPlacement = 'bottom-center' | 'bottom-right' | 'center' | 'top-right';
type AssignmentOverlayAnimationType = 'slide-up' | 'fade' | 'zoom';
type AssignmentOverlayAnimationEasing = 'ease-out' | 'ease-in-out' | 'ease-in' | 'linear';
type RuntimeOverlayScope = 'course' | 'skill';
type PresentationDisplayMode = 'picture-in-picture' | 'side-panel' | 'split-screen' | 'full-frame';
type PresentationPlacement = 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'center';

interface RuntimeCTAOverlay {
  id: string;
  scope: RuntimeOverlayScope;
  name: string;
  title: string;
  subtitle: string;
  primaryLabel: string;
  secondaryLabel: string;
  url: string;
  triggerAt: number;
  endAt: number;
}

interface RuntimeLowerThird {
  id: string;
  scope: RuntimeOverlayScope;
  name: string;
  title: string;
  subtitle: string;
  startTime: number;
  duration: number;
}

interface RuntimePresentationOverlay {
  id: string;
  scope: RuntimeOverlayScope;
  deckName: string;
  slideTitle: string;
  template: string;
  displayMode: PresentationDisplayMode;
  splitLayoutVariant: string;
  placement: PresentationPlacement;
  sourceName: string;
  sourceSlideNumber: number;
  slideImageUrl: string;
  startTime: number;
  endTime: number;
  order: number;
}

interface RuntimeAnnotationOverlay {
  id: string;
  scope: RuntimeOverlayScope;
  type: string;
  title: string;
  content: string;
  startTime: number;
  endTime: number;
  position: {
    x: number;
    y: number;
  };
  size: {
    width: number;
    height: number;
  };
  style: {
    backgroundColor: string;
    textColor: string;
    borderColor: string;
    borderWidth: number;
    borderRadius: number;
    opacity: number;
  };
  isVisible: boolean;
}

interface AssignmentOverlayItem {
  id: string;
  courseId: string;
  title: string;
  subtitle: string;
  status?: string;
  scope?: 'course' | 'skill';
  skillId?: string;
  placement?: AssignmentPlacement;
  triggerAt?: number;
  endAt?: number;
  overlayEnabled?: boolean;
  overlayBackground?: string;
  overlayTextColor?: string;
  overlayPrimaryButtonColor?: string;
  overlayPrimaryButtonTextColor?: string;
  overlayFontFamily?: string;
  overlayAnimationEnabled?: boolean;
  overlayAnimationType?: AssignmentOverlayAnimationType;
  overlayAnimationEasing?: AssignmentOverlayAnimationEasing;
  overlayAnimationDuration?: number;
  overlayAnimationDelay?: number;
  overlayRadius?: number;
  overlayOpacity?: number;
  overlayTitleSize?: number;
  dueDate?: string;
  points?: number;
}

type CourseWithAssignmentStudio = NonNullable<ReturnType<typeof useAcademy>['state']['currentCourse']> & {
  assignmentStudio?: {
    assignments?: AssignmentOverlayItem[];
  };
};

const VIDEO_PLACEHOLDER = '/assets/academy/intro-video.mp4';
const CTA_RESOURCE_COURSE_PREFIX = 'cta-resource-course-';
const CTA_RESOURCE_SKILL_PREFIX = 'cta-resource-skill-';
const LOWER_THIRD_RESOURCE_COURSE_PREFIX = 'lowerthird-resource-course-';
const LOWER_THIRD_RESOURCE_SKILL_PREFIX = 'lowerthird-resource-skill-';
const PRESENTATION_RESOURCE_COURSE_PREFIX = 'presentation-resource-course-';
const PRESENTATION_RESOURCE_SKILL_PREFIX = 'presentation-resource-skill-';
const ANNOTATION_RESOURCE_COURSE_PREFIX = 'annotation-resource-course-';
const ANNOTATION_RESOURCE_SKILL_PREFIX = 'annotation-resource-skill-';
const ANNOTATION_STORE_KEY = 'academyAnnotationStoreV1';
const ANNOTATION_META_MARKER = '::annotation-meta::';
const STUDENT_HIDDEN_RESOURCE_PREFIXES = [
  CTA_RESOURCE_COURSE_PREFIX,
  CTA_RESOURCE_SKILL_PREFIX,
  LOWER_THIRD_RESOURCE_COURSE_PREFIX,
  LOWER_THIRD_RESOURCE_SKILL_PREFIX,
  PRESENTATION_RESOURCE_COURSE_PREFIX,
  PRESENTATION_RESOURCE_SKILL_PREFIX,
  ANNOTATION_RESOURCE_COURSE_PREFIX,
  ANNOTATION_RESOURCE_SKILL_PREFIX,
];

const cinematicPanelSx = {
  borderRadius: 1.4,
  border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.08)',
  background: 'linear-gradient(145deg, rgba(20,24,36,0.88), rgba(11,14,22,0.96))',
};

const academyShellMaxWidth = 'min(100%, var(--academy-shell-max-width, 1920px))';

const toDisplayName = (value: string, fallback = 'Student'): string => {
  const normalized = String(value || '').trim();
  if (!normalized) return fallback;
  const base = normalized.includes('@') ? normalized.split('@')[0] : normalized;
  const parts = base
    .replace(/[._]+/g, '-')
    .split('-')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .slice(0, 2);

  if (parts.length === 0) return fallback;
  return parts.map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
};

const formatTime = (seconds: number): string => {
  const safe = Number.isFinite(seconds) && seconds >= 0 ? seconds : 0;
  const min = Math.floor(safe / 60);
  const sec = Math.floor(safe % 60);
  return `${min}:${sec.toString().padStart(2, '0')}`;
};

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

const parseTimecode = (value: string): number | null => {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const match = raw.match(/^(\d+):(\d{1,2})$/);
  if (!match) return null;
  const minutes = Number.parseInt(match[1], 10);
  const seconds = Number.parseInt(match[2], 10);
  if (!Number.isFinite(minutes) || !Number.isFinite(seconds)) return null;
  return Math.max(0, minutes * 60 + seconds);
};

const parseCtaResource = (
  resource: CourseResource | LessonResource,
  scope: RuntimeOverlayScope,
  maxDuration: number,
): RuntimeCTAOverlay | null => {
  const rawTitle = String(resource.title || '').trim();
  const rawDescription = String(resource.description || '').trim();
  const titleMatch = rawTitle.match(/^\[CTA\]\[(?:Course|Skill)\]\s*(.+)$/i);
  const descMatch = rawDescription.match(
    /^(.+?)\s*·\s*(\d+:\d{1,2})\s*-\s*(\d+:\d{1,2})(?:\s*·\s*.+)?$/,
  );
  if (!titleMatch || !descMatch) return null;

  const triggerAtRaw = parseTimecode(descMatch[2]);
  const endAtRaw = parseTimecode(descMatch[3]);
  if (triggerAtRaw === null || endAtRaw === null) return null;

  const safeDuration = Math.max(1, maxDuration);
  const safeTriggerAt = clamp(triggerAtRaw, 0, Math.max(0, safeDuration - 1));
  const safeEndAt = clamp(Math.max(safeTriggerAt + 1, endAtRaw), safeTriggerAt + 1, safeDuration);

  return {
    id: String(resource.id || `cta-${scope}-${titleMatch[1]}`),
    scope,
    name: String(descMatch[1] || '').trim() || titleMatch[1].trim(),
    title: titleMatch[1].trim(),
    subtitle: scope === 'skill' ? 'Skill CTA overlay' : 'Course CTA overlay',
    primaryLabel: 'Open',
    secondaryLabel: 'Dismiss',
    url: String(resource.url || '').trim(),
    triggerAt: safeTriggerAt,
    endAt: safeEndAt,
  };
};

const parseLowerThirdResource = (
  resource: CourseResource | LessonResource,
  scope: RuntimeOverlayScope,
  maxDuration: number,
): RuntimeLowerThird | null => {
  const rawTitle = String(resource.title || '').trim();
  const rawDescription = String(resource.description || '').trim();
  const titleMatch = rawTitle.match(/^\[LowerThird\]\[(?:Course|Skill)\]\s*(.+)$/i);
  const descMatch = rawDescription.match(
    /^(.+?)\s*·\s*(\d+:\d{1,2})\s*·\s*(\d+(?:\.\d+)?)s(?:\s*·\s*.+)?$/,
  );
  if (!titleMatch || !descMatch) return null;

  const startRaw = parseTimecode(descMatch[2]);
  const durationRaw = Number.parseFloat(descMatch[3]);
  if (startRaw === null || !Number.isFinite(durationRaw)) return null;

  const safeDuration = Math.max(1, maxDuration);
  const startTime = clamp(startRaw, 0, Math.max(0, safeDuration - 1));
  const duration = clamp(Math.max(0.6, durationRaw), 0.6, Math.max(1.2, safeDuration - startTime));

  return {
    id: String(resource.id || `lower-third-${scope}-${titleMatch[1]}`),
    scope,
    name: String(descMatch[1] || '').trim() || titleMatch[1].trim(),
    title: titleMatch[1].trim(),
    subtitle: scope === 'skill' ? 'Skill lower third' : 'Course lower third',
    startTime,
    duration,
  };
};

const toPresentationDisplayMode = (value: string): PresentationDisplayMode => {
  const candidate = String(value || '').trim().toLowerCase();
  if (
    candidate === 'picture-in-picture' ||
    candidate === 'side-panel' ||
    candidate === 'split-screen' ||
    candidate === 'full-frame'
  ) {
    return candidate;
  }
  return 'picture-in-picture';
};

const toPresentationPlacement = (value: string): PresentationPlacement => {
  const candidate = String(value || '').trim().toLowerCase();
  if (
    candidate === 'top-right' ||
    candidate === 'top-left' ||
    candidate === 'bottom-right' ||
    candidate === 'bottom-left' ||
    candidate === 'center'
  ) {
    return candidate;
  }
  return 'bottom-right';
};

const parsePresentationResource = (
  resource: CourseResource | LessonResource,
  scope: RuntimeOverlayScope,
  maxDuration: number,
): RuntimePresentationOverlay | null => {
  const rawTitle = String(resource.title || '').trim();
  const rawDescription = String(resource.description || '').trim();

  const titleMatch = rawTitle.match(
    /^\[Presentation\]\[(?:Course|Skill)\]\s*(.+?)(?:\s*::\s*(.+))?$/i,
  );
  const descMatch = rawDescription.match(
    /^(.+?)\s*·\s*(\d+:\d{1,2})-(\d+:\d{1,2})\s*·\s*order:(\d+)\s*·\s*template:([a-z0-9-]+)(?:\s*·\s*theme:([a-z0-9-]+))?\s*·\s*mode:([a-z-]+)(?:\s*·\s*variant:([a-z-]+))?\s*·\s*placement:([a-z-]+)(?:\s*·\s*layout:([a-z-]+))?(?:\s*·\s*deck:[a-z0-9_-]+)?(?:\s*·\s*slide:[a-z0-9_-]+)?(?:\s*·\s*slideNo:(\d+))?(?:\s*·\s*nav:[a-z0-9-]+)?(?:\s*·\s*source:(.+))?$/i,
  );

  if (!titleMatch || !descMatch) return null;

  const startRaw = parseTimecode(descMatch[2]);
  const endRaw = parseTimecode(descMatch[3]);
  const orderRaw = Number.parseInt(descMatch[4], 10);
  if (startRaw === null || endRaw === null || !Number.isFinite(orderRaw)) return null;

  const safeDuration = Math.max(1, maxDuration);
  const startTime = clamp(startRaw, 0, Math.max(0, safeDuration - 1));
  const endTime = clamp(Math.max(startTime + 1, endRaw), startTime + 1, safeDuration);
  const deckDisplayMode = toPresentationDisplayMode(descMatch[7]);
  const slideDisplayMode = toPresentationDisplayMode(descMatch[10] || descMatch[7]);
  const effectiveDisplayMode: PresentationDisplayMode =
    deckDisplayMode === 'split-screen' || slideDisplayMode === 'split-screen'
      ? 'split-screen'
      : slideDisplayMode;

  return {
    id: String(resource.id || `presentation-${scope}-${titleMatch[1]}`),
    scope,
    deckName: String(titleMatch[1] || '').trim() || String(descMatch[1] || '').trim() || 'Presentation',
    slideTitle: String(titleMatch[2] || '').trim() || `Slide ${Math.max(1, orderRaw)}`,
    template: String(descMatch[5] || '').trim() || 'product-overview',
    displayMode: effectiveDisplayMode,
    splitLayoutVariant: String(descMatch[8] || '').trim() || 'balanced',
    placement: toPresentationPlacement(descMatch[9]),
    sourceName: String(descMatch[12] || '').trim(),
    sourceSlideNumber: Math.max(1, Number.parseInt(String(descMatch[11] || ''), 10) || orderRaw),
    slideImageUrl: String(resource.url || '').trim(),
    startTime,
    endTime,
    order: Math.max(1, orderRaw),
  };
};

const stripAnnotationMetaFromDescription = (description: string): string => {
  const source = String(description || '');
  const markerIndex = source.indexOf(ANNOTATION_META_MARKER);
  if (markerIndex === -1) return source;
  return source.slice(0, markerIndex).trim();
};

const parseAnnotationMetaFromDescription = (
  description: string,
): Partial<RuntimeAnnotationOverlay> | null => {
  const source = String(description || '');
  const markerIndex = source.indexOf(ANNOTATION_META_MARKER);
  if (markerIndex === -1) return null;

  const encoded = source.slice(markerIndex + ANNOTATION_META_MARKER.length).trim();
  if (!encoded) return null;

  try {
    const parsed: unknown = JSON.parse(decodeURIComponent(encoded));
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed as Partial<RuntimeAnnotationOverlay>;
  } catch {
    return null;
  }
};

const parseAnnotationResource = (
  resource: CourseResource | LessonResource,
  scope: RuntimeOverlayScope,
  maxDuration: number,
): RuntimeAnnotationOverlay | null => {
  const rawTitle = String(resource.title || '').trim();
  const rawDescription = String(resource.description || '').trim();

  const titleMatch = rawTitle.match(/^\[Annotation\]\[(?:Course|Skill)\]\s*(.+)$/i);
  if (!titleMatch) return null;

  const withoutMeta = stripAnnotationMetaFromDescription(rawDescription);
  const rangeMatch = withoutMeta.match(/^(.+?)\s*·\s*(\d+:\d{1,2})-(\d+:\d{1,2})\s*·\s*(.+)$/i);
  if (!rangeMatch) return null;

  const startRaw = parseTimecode(rangeMatch[2]);
  const endRaw = parseTimecode(rangeMatch[3]);
  if (startRaw === null || endRaw === null) return null;

  const safeDuration = Math.max(1, maxDuration);
  const startTime = clamp(startRaw, 0, Math.max(0, safeDuration - 1));
  const endTime = clamp(Math.max(startTime + 1, endRaw), startTime + 1, safeDuration);

  const parsedMeta = parseAnnotationMetaFromDescription(rawDescription);
  const contentFromMeta = String(parsedMeta?.content || '').trim();
  const contentFromDescription = String(rangeMatch[4] || '').trim();

  return {
    id: String(resource.id || `annotation-${scope}-${titleMatch[1]}`),
    scope,
    type: String(parsedMeta?.type || rangeMatch[1] || 'callout').toLowerCase(),
    title: String(parsedMeta?.title || titleMatch[1] || 'Annotation').trim() || 'Annotation',
    content: contentFromMeta || contentFromDescription || 'Annotation',
    startTime,
    endTime,
    position: {
      x: clamp(Number(parsedMeta?.position?.x ?? 12), 0, 100),
      y: clamp(Number(parsedMeta?.position?.y ?? 12), 0, 100),
    },
    size: {
      width: clamp(Number(parsedMeta?.size?.width ?? 26), 1, 100),
      height: clamp(Number(parsedMeta?.size?.height ?? 13), 1, 100),
    },
    style: {
      backgroundColor: String(parsedMeta?.style?.backgroundColor || 'rgba(248,179,33,0.22)'),
      textColor: String(parsedMeta?.style?.textColor || '#f7f8fb'),
      borderColor: String(parsedMeta?.style?.borderColor || '#f8b321'),
      borderWidth: clamp(Number(parsedMeta?.style?.borderWidth ?? 2), 1, 8),
      borderRadius: clamp(Number(parsedMeta?.style?.borderRadius ?? 10), 0, 30),
      opacity: clamp(Number(parsedMeta?.style?.opacity ?? 0.95), 0.1, 1),
    },
    isVisible: parsedMeta?.isVisible !== false,
  };
};

type RuntimeAnnotationStoreEntry = {
  items?: Array<Partial<RuntimeAnnotationOverlay>>;
  duration?: number;
  updatedAt?: string;
};

type RuntimeAnnotationStoreMap = Record<string, RuntimeAnnotationStoreEntry>;

const readAnnotationStore = (): RuntimeAnnotationStoreMap => {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(ANNOTATION_STORE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as RuntimeAnnotationStoreMap;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

const buildDefaultChapters = (duration: number): ChapterItem[] => {
  const safeDuration = Math.max(duration, 240);
  return [
    { id: 'chapter-1', title: 'Introduction', startTime: 0, duration: Math.round(safeDuration * 0.23), icon: 'T' },
    { id: 'chapter-2', title: 'Lighting Basics', startTime: Math.round(safeDuration * 0.23), duration: Math.round(safeDuration * 0.22), icon: '⚡' },
    { id: 'chapter-3', title: 'Practical Setup', startTime: Math.round(safeDuration * 0.45), duration: Math.round(safeDuration * 0.27), icon: '◼' },
    { id: 'chapter-4', title: 'Scene Review', startTime: Math.round(safeDuration * 0.72), duration: Math.round(safeDuration * 0.28), icon: 'B' },
  ];
};

const buildDefaultTranscript = (): TranscriptLine[] => [
  {
    id: 'line-1',
    speaker: 'Norwedfilm',
    timestamp: 2,
    text: 'Welcome, I\'m excited to kick off our masterclass and share filmmaking insights.',
  },
  {
    id: 'line-2',
    speaker: 'Alex Jensen',
    timestamp: 24,
    text: 'Let\'s start with the importance of key lighting in directing.',
  },
  {
    id: 'line-3',
    speaker: 'Alex Jensen',
    timestamp: 62,
    text: 'Always begin with proper setup. A shot is only as strong as its foundation.',
  },
  {
    id: 'line-4',
    speaker: 'Norwedfilm',
    timestamp: 118,
    text: 'For this scene we use three-point lighting. I\'ll show you how to position each light.',
  },
];

const buildDefaultQuiz = (): PlayerQuiz => ({
  id: 'quiz-keylight-1',
  question: 'What is the primary function of a key light in film lighting?',
  helper: 'Watch the scene and choose the correct answer to proceed.',
  timestamp: 373,
  choices: [
    { id: 'qa', label: 'A', text: 'Introduction', isCorrect: false },
    { id: 'qb', label: 'B', text: 'Lighting Basics', isCorrect: false },
    { id: 'qc', label: 'C', text: 'Practical Setup', isCorrect: false },
    { id: 'qd', label: 'D', text: 'Scene Review', isCorrect: true },
  ],
});

function AcademyVideoPlayerStudio({
  courseId,
  lessonId,
  onSave,
  onCancel,
  returnTo,
}: AcademyVideoPlayerStudioProps) {
  const [location, setLocation] = useLocation();
  const {
    state,
    updateProgress,
    updateSettings,
    addBookmark,
    addNote,
    getCourse,
    setCurrentCourse,
    setCurrentLesson,
  } = useAcademy();
  const { analytics, debugging, auth } = useEnhancedMasterIntegration();
  
  const { navLabel, tt } = useAcademyLocale();

  const videoRef = useRef<HTMLVideoElement>(null);
  const progressRef = useRef(0);

  const activeCourse = useMemo(() => {
    if (courseId) {
      return getCourse(courseId) || state.currentCourse || state.courses[0] || null;
    }
    return state.currentCourse || state.courses[0] || null;
  }, [courseId, getCourse, state.courses, state.currentCourse]);

  useEffect(() => {
    if (!activeCourse?.id) return;
    const inState = state.courses.some((course) => String(course.id) === String(activeCourse.id));
    if (!inState) return;
    if (String(state.currentCourse?.id || '') === String(activeCourse.id)) return;
    setCurrentCourse(activeCourse);
  }, [activeCourse, setCurrentCourse, state.courses, state.currentCourse?.id]);

  const activeLesson = useMemo(() => {
    const lessons = Array.isArray(activeCourse?.lessons) ? activeCourse.lessons : [];
    if (lessonId) {
      return lessons.find((lesson) => String(lesson.id) === String(lessonId)) || state.currentLesson || lessons[0] || null;
    }
    return state.currentLesson || lessons[0] || null;
  }, [activeCourse, lessonId, state.currentLesson]);

  useEffect(() => {
    if (!activeLesson?.id) return;
    if (String(state.currentLesson?.id || '') === String(activeLesson.id)) return;
    setCurrentLesson(activeLesson);
  }, [activeLesson, setCurrentLesson, state.currentLesson?.id]);

  const routeContext = useMemo(() => {
    if (typeof window === 'undefined') {
      return { audience: '', returnTo: String(returnTo || '').trim() };
    }
    const params = new URLSearchParams(window.location.search);
    const audience = String(params.get('audience') || '').trim().toLowerCase();
    const returnToRaw = String(params.get('returnTo') || returnTo || '').trim();
    const safeReturnTo = /^\/academy(\/|$)/.test(returnToRaw) ? returnToRaw : '';
    return {
      audience,
      returnTo: safeReturnTo,
    };
  }, [location, returnTo]);

  const isStudentMode = useMemo(() => {
    if (routeContext.audience === 'student') return true;
    return (
      /\/academy\/student-dashboard(?:\?|$)/.test(routeContext.returnTo) ||
      /\/academy\/dashboard\/student(?:\?|$)/.test(routeContext.returnTo) ||
      /audience=student/.test(routeContext.returnTo)
    );
  }, [routeContext.audience, routeContext.returnTo]);

  const studentBaseReturnTo = routeContext.returnTo || '/academy/student-dashboard';
  const buildStudentRoute = useCallback(
    (
      path: string,
      extra?: Record<string, string | number | null | undefined>,
      overrideReturnTo = studentBaseReturnTo,
    ) => {
      const params = new URLSearchParams();
      const safeCourseId = String(activeCourse?.id || '').trim();
      const safeLessonId = String(activeLesson?.id || '').trim();

      if (safeCourseId) params.set('courseId', safeCourseId);
      if (safeLessonId) params.set('lessonId', safeLessonId);
      params.set('audience', 'student');

      const safeReturnTo = String(overrideReturnTo || '').trim();
      if (safeReturnTo) {
        params.set('returnTo', safeReturnTo);
      }

      Object.entries(extra || {}).forEach(([key, value]) => {
        if (value === undefined || value === null || value === '') return;
        params.set(key, String(value));
      });

      const query = params.toString();
      return query ? `${path}?${query}` : path;
    },
    [activeCourse?.id, activeLesson?.id, studentBaseReturnTo],
  );

  const currentStudentPlayerRoute = useMemo(
    () => buildStudentRoute('/academy/player-studio'),
    [buildStudentRoute],
  );

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
      String(user?.name || user?.firstName || user?.email || user?.id || ''),
      tt('Student', 'Student'),
    );
  }, [auth.state.user, tt]);

  const studentProgressRows = useMemo(() => {
    if (!activeCourse?.id || !Array.isArray(state.progress)) return [];
    return state.progress.filter(
      (row) => String(row.courseId || '') === String(activeCourse.id),
    );
  }, [activeCourse?.id, state.progress]);

  const studentProgressStats = useMemo(() => {
    const lessons = Array.isArray(activeCourse?.lessons) ? activeCourse.lessons : [];
    const progressByLesson = new Map(
      studentProgressRows.map((row) => [String(row.lessonId || ''), Number(row.progress || 0)]),
    );

    const completedLessons = lessons.filter((lesson) => {
      const progressValue = progressByLesson.get(String(lesson.id)) || 0;
      return progressValue >= 100;
    }).length;

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
      progressPercent: clamp(progressPercent, 0, 100),
    };
  }, [activeCourse?.lessons, studentProgressRows]);
  const currentLessonProgress = useMemo(
    () =>
      studentProgressRows.find(
        (row) => String(row.lessonId || '') === String(activeLesson?.id || ''),
      ) || null,
    [activeLesson?.id, studentProgressRows],
  );
  const lessonNotesCount = useMemo(
    () => (Array.isArray(currentLessonProgress?.notes) ? currentLessonProgress.notes.length : 0),
    [currentLessonProgress?.notes],
  );
  const lessonBookmarkCount = useMemo(
    () => (Array.isArray(currentLessonProgress?.bookmarks) ? currentLessonProgress.bookmarks.length : 0),
    [currentLessonProgress?.bookmarks],
  );
  const lessonPathMeta = useMemo(() => {
    const lessons = Array.isArray(activeCourse?.lessons)
      ? [...activeCourse.lessons].sort(
          (left, right) => Number(left.order || 0) - Number(right.order || 0),
        )
      : [];
    const currentIndex = lessons.findIndex(
      (lesson) => String(lesson.id) === String(activeLesson?.id || ''),
    );
    return {
      index: currentIndex >= 0 ? currentIndex + 1 : lessons.length > 0 ? 1 : 0,
      total: lessons.length,
      nextLesson:
        currentIndex >= 0 && currentIndex + 1 < lessons.length
          ? lessons[currentIndex + 1]
          : null,
    };
  }, [activeCourse?.lessons, activeLesson?.id]);
  const activeCourseWithAssignments = activeCourse as CourseWithAssignmentStudio | null;
  const effectiveVideoUrl = useMemo(
    () =>
      resolveAcademyVideoUrl({
        course: activeCourse,
        preferredLessonId: activeLesson?.id || null,
        fallbackUrl: VIDEO_PLACEHOLDER,
      }),
    [activeCourse, activeLesson?.id],
  );

  const [rightTab, setRightTab] = useState<RightTab>('chapters');
  const [transcriptSearch, setTranscriptSearch] = useState('');
  const [speed, setSpeed] = useState(state.settings.playbackSpeed || 1);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(Number(activeLesson?.duration || activeCourse?.duration || 336));
  const [selectedChapterId, setSelectedChapterId] = useState('');
  const [noteDraft, setNoteDraft] = useState('');
  const [saveMessage, setSaveMessage] = useState('');
  const [quizAnswer, setQuizAnswer] = useState('');
  const [quizSubmitted, setQuizSubmitted] = useState(false);

  const [chapters, setChapters] = useState<ChapterItem[]>(() => buildDefaultChapters(Number(activeLesson?.duration || 336)));
  const [transcriptLines, setTranscriptLines] = useState<TranscriptLine[]>(buildDefaultTranscript);
  const [activeQuiz] = useState<PlayerQuiz>(buildDefaultQuiz);
  const [dismissedAssignmentIds, setDismissedAssignmentIds] = useState<string[]>([]);
  const assignmentOverlayVisibilityRef = useRef<string | null>(null);
  const ctaOverlayVisibilityRef = useRef<string | null>(null);
  const lowerThirdVisibilityRef = useRef<string | null>(null);
  const presentationOverlayVisibilityRef = useRef<string | null>(null);
  const annotationOverlayVisibilityRef = useRef<string | null>(null);

  useEffect(() => {
    setDuration(Number(activeLesson?.duration || activeCourse?.duration || 336));
    setChapters(buildDefaultChapters(Number(activeLesson?.duration || activeCourse?.duration || 336)));
  }, [activeCourse?.duration, activeLesson?.duration]);

  useEffect(() => {
    if (!selectedChapterId && chapters.length > 0) {
      setSelectedChapterId(chapters[0].id);
    }
  }, [chapters, selectedChapterId]);

  useEffect(() => {
    setDismissedAssignmentIds([]);
  }, [activeCourse?.id, activeLesson?.id]);

  const runtimeOverlayResources = useMemo(() => {
    const courseResources = Array.isArray(activeCourse?.resources) ? activeCourse.resources : [];
    const lessonResources = Array.isArray(activeLesson?.resources) ? activeLesson.resources : [];
    return { courseResources, lessonResources };
  }, [activeCourse?.resources, activeLesson?.resources]);
  const studentLearningResources = useMemo(() => {
    return [...runtimeOverlayResources.lessonResources, ...runtimeOverlayResources.courseResources].filter(
      (resource) =>
        !STUDENT_HIDDEN_RESOURCE_PREFIXES.some((prefix) =>
          String(resource.id || '').startsWith(prefix),
        ),
    );
  }, [runtimeOverlayResources.courseResources, runtimeOverlayResources.lessonResources]);
  const recommendedLearningResource = studentLearningResources[0] || null;

  const runtimeCtaOverlays = useMemo<RuntimeCTAOverlay[]>(() => {
    const safeDuration = Math.max(
      1,
      Number(duration || activeLesson?.duration || activeCourse?.duration || 1),
    );
    const byId = new Map<string, RuntimeCTAOverlay>();
    runtimeOverlayResources.courseResources
      .filter((resource) => String(resource.id || '').startsWith(CTA_RESOURCE_COURSE_PREFIX))
      .forEach((resource) => {
        const parsed = parseCtaResource(resource, 'course', safeDuration);
        if (parsed) byId.set(parsed.id, parsed);
      });
    runtimeOverlayResources.lessonResources
      .filter((resource) => String(resource.id || '').startsWith(CTA_RESOURCE_SKILL_PREFIX))
      .forEach((resource) => {
        const parsed = parseCtaResource(resource, 'skill', safeDuration);
        if (parsed) byId.set(parsed.id, parsed);
      });
    return Array.from(byId.values()).sort(
      (left, right) => Number(left.triggerAt || 0) - Number(right.triggerAt || 0),
    );
  }, [
    activeCourse?.duration,
    activeLesson?.duration,
    duration,
    runtimeOverlayResources.courseResources,
    runtimeOverlayResources.lessonResources,
  ]);

  const activeCtaOverlay = useMemo<RuntimeCTAOverlay | null>(() => {
    return (
      runtimeCtaOverlays.find(
        (overlay) =>
          currentTime >= Number(overlay.triggerAt || 0) &&
          currentTime <= Number(overlay.endAt || Number(overlay.triggerAt || 0)),
      ) || null
    );
  }, [currentTime, runtimeCtaOverlays]);

  const runtimeLowerThirds = useMemo<RuntimeLowerThird[]>(() => {
    const safeDuration = Math.max(
      1,
      Number(duration || activeLesson?.duration || activeCourse?.duration || 1),
    );
    const byId = new Map<string, RuntimeLowerThird>();
    runtimeOverlayResources.courseResources
      .filter((resource) => String(resource.id || '').startsWith(LOWER_THIRD_RESOURCE_COURSE_PREFIX))
      .forEach((resource) => {
        const parsed = parseLowerThirdResource(resource, 'course', safeDuration);
        if (parsed) byId.set(parsed.id, parsed);
      });
    runtimeOverlayResources.lessonResources
      .filter((resource) => String(resource.id || '').startsWith(LOWER_THIRD_RESOURCE_SKILL_PREFIX))
      .forEach((resource) => {
        const parsed = parseLowerThirdResource(resource, 'skill', safeDuration);
        if (parsed) byId.set(parsed.id, parsed);
      });
    return Array.from(byId.values()).sort(
      (left, right) => Number(left.startTime || 0) - Number(right.startTime || 0),
    );
  }, [
    activeCourse?.duration,
    activeLesson?.duration,
    duration,
    runtimeOverlayResources.courseResources,
    runtimeOverlayResources.lessonResources,
  ]);

  const activeLowerThird = useMemo<RuntimeLowerThird | null>(() => {
    return (
      runtimeLowerThirds.find((lowerThird) => {
        const start = Number(lowerThird.startTime || 0);
        const end = start + Number(lowerThird.duration || 0);
        return currentTime >= start && currentTime <= end;
      }) || null
    );
  }, [currentTime, runtimeLowerThirds]);

  const runtimePresentationOverlays = useMemo<RuntimePresentationOverlay[]>(() => {
    const safeDuration = Math.max(
      1,
      Number(duration || activeLesson?.duration || activeCourse?.duration || 1),
    );
    const byId = new Map<string, RuntimePresentationOverlay>();
    runtimeOverlayResources.courseResources
      .filter((resource) => String(resource.id || '').startsWith(PRESENTATION_RESOURCE_COURSE_PREFIX))
      .forEach((resource) => {
        const parsed = parsePresentationResource(resource, 'course', safeDuration);
        if (parsed) byId.set(parsed.id, parsed);
      });
    runtimeOverlayResources.lessonResources
      .filter((resource) => String(resource.id || '').startsWith(PRESENTATION_RESOURCE_SKILL_PREFIX))
      .forEach((resource) => {
        const parsed = parsePresentationResource(resource, 'skill', safeDuration);
        if (parsed) byId.set(parsed.id, parsed);
      });
    return Array.from(byId.values()).sort((left, right) => {
      if (Number(left.startTime || 0) !== Number(right.startTime || 0)) {
        return Number(left.startTime || 0) - Number(right.startTime || 0);
      }
      return Number(left.order || 0) - Number(right.order || 0);
    });
  }, [
    activeCourse?.duration,
    activeLesson?.duration,
    duration,
    runtimeOverlayResources.courseResources,
    runtimeOverlayResources.lessonResources,
  ]);

  const activePresentationOverlay = useMemo<RuntimePresentationOverlay | null>(() => {
    return (
      runtimePresentationOverlays.find((overlay) => {
        const start = Number(overlay.startTime || 0);
        const end = Number(overlay.endTime || start);
        return currentTime >= start && currentTime <= end;
      }) || null
    );
  }, [currentTime, runtimePresentationOverlays]);

  const runtimeAnnotationOverlays = useMemo<RuntimeAnnotationOverlay[]>(() => {
    const safeDuration = Math.max(
      1,
      Number(duration || activeLesson?.duration || activeCourse?.duration || 1),
    );
    const activeLessonId = String(activeLesson?.id || '').trim();
    const byId = new Map<string, RuntimeAnnotationOverlay>();

    const toCanonicalId = (id: string, scope: RuntimeOverlayScope): string => {
      const rawId = String(id || '').trim();
      if (!rawId) return rawId;
      if (scope === 'course' && rawId.startsWith(ANNOTATION_RESOURCE_COURSE_PREFIX)) {
        return rawId.slice(ANNOTATION_RESOURCE_COURSE_PREFIX.length);
      }
      if (
        scope === 'skill' &&
        activeLessonId &&
        rawId.startsWith(`${ANNOTATION_RESOURCE_SKILL_PREFIX}${activeLessonId}-`)
      ) {
        return rawId.slice(`${ANNOTATION_RESOURCE_SKILL_PREFIX}${activeLessonId}-`.length);
      }
      return rawId;
    };

    const upsert = (overlay: RuntimeAnnotationOverlay) => {
      const canonicalId = toCanonicalId(overlay.id, overlay.scope) || overlay.id;
      const key = `${overlay.scope}:${canonicalId}`;
      byId.set(key, { ...overlay, id: canonicalId });
    };

    runtimeOverlayResources.courseResources
      .filter((resource) => String(resource.id || '').startsWith(ANNOTATION_RESOURCE_COURSE_PREFIX))
      .forEach((resource) => {
        const parsed = parseAnnotationResource(resource, 'course', safeDuration);
        if (parsed) upsert(parsed);
      });
    runtimeOverlayResources.lessonResources
      .filter((resource) => String(resource.id || '').startsWith(ANNOTATION_RESOURCE_SKILL_PREFIX))
      .forEach((resource) => {
        const parsed = parseAnnotationResource(resource, 'skill', safeDuration);
        if (parsed) upsert(parsed);
      });

    const localStore = readAnnotationStore();
    const courseIdValue = String(activeCourse?.id || '').trim();
    if (courseIdValue) {
      const courseEntry = localStore[`${courseIdValue}::course`];
      const skillEntry =
        activeLessonId.length > 0
          ? localStore[`${courseIdValue}::skill::${activeLessonId}`]
          : undefined;

      const pushEntryItems = (
        entry: RuntimeAnnotationStoreEntry | undefined,
        scope: RuntimeOverlayScope,
      ) => {
        if (!entry || !Array.isArray(entry.items)) return;
        entry.items.forEach((item, index) => {
          const startRaw = Number(item?.startTime ?? 0);
          const endRaw = Number(item?.endTime ?? startRaw + 6);
          const startTime = clamp(
            Number.isFinite(startRaw) ? startRaw : 0,
            0,
            Math.max(0, safeDuration - 1),
          );
          const endTime = clamp(
            Math.max(startTime + 1, Number.isFinite(endRaw) ? endRaw : startTime + 6),
            startTime + 1,
            safeDuration,
          );
          const nextOverlay: RuntimeAnnotationOverlay = {
            id: String(item?.id || `local-annotation-${scope}-${index}`),
            scope,
            type: String(item?.type || 'callout').toLowerCase(),
            title: String(item?.title || 'Annotation').trim() || 'Annotation',
            content: String(item?.content || '').trim() || 'Annotation',
            startTime,
            endTime,
            position: {
              x: clamp(Number(item?.position?.x ?? 12), 0, 100),
              y: clamp(Number(item?.position?.y ?? 12), 0, 100),
            },
            size: {
              width: clamp(Number(item?.size?.width ?? 26), 1, 100),
              height: clamp(Number(item?.size?.height ?? 13), 1, 100),
            },
            style: {
              backgroundColor: String(item?.style?.backgroundColor || 'rgba(248,179,33,0.22)'),
              textColor: String(item?.style?.textColor || '#f7f8fb'),
              borderColor: String(item?.style?.borderColor || '#f8b321'),
              borderWidth: clamp(Number(item?.style?.borderWidth ?? 2), 1, 8),
              borderRadius: clamp(Number(item?.style?.borderRadius ?? 10), 0, 30),
              opacity: clamp(Number(item?.style?.opacity ?? 0.95), 0.1, 1),
            },
            isVisible: item?.isVisible !== false,
          };
          upsert(nextOverlay);
        });
      };

      pushEntryItems(courseEntry, 'course');
      pushEntryItems(skillEntry, 'skill');
    }

    return Array.from(byId.values()).sort((left, right) => {
      if (Number(left.startTime || 0) !== Number(right.startTime || 0)) {
        return Number(left.startTime || 0) - Number(right.startTime || 0);
      }
      return String(left.id || '').localeCompare(String(right.id || ''));
    });
  }, [
    activeCourse?.duration,
    activeCourse?.id,
    activeLesson?.duration,
    activeLesson?.id,
    duration,
    runtimeOverlayResources.courseResources,
    runtimeOverlayResources.lessonResources,
  ]);

  const activeAnnotationOverlays = useMemo<RuntimeAnnotationOverlay[]>(() => {
    return runtimeAnnotationOverlays.filter((overlay) => {
      if (!overlay.isVisible) return false;
      const start = Number(overlay.startTime || 0);
      const end = Number(overlay.endTime || start);
      return currentTime >= start && currentTime <= end;
    });
  }, [currentTime, runtimeAnnotationOverlays]);

  const assignmentOverlays = useMemo<AssignmentOverlayItem[]>(() => {
    const rawAssignments = Array.isArray(activeCourseWithAssignments?.assignmentStudio?.assignments)
      ? activeCourseWithAssignments.assignmentStudio.assignments
      : [];
    const maxDuration = Math.max(30, Number(activeLesson?.duration || activeCourse?.duration || 300));
    const activeLessonId = String(activeLesson?.id || '');

    return rawAssignments
      .map((assignment, index) => {
        const triggerAt =
          Number.isFinite(Number(assignment.triggerAt))
            ? Math.max(0, Number(assignment.triggerAt))
            : Math.max(8, 18 + index * 12);
        const endAt =
          Number.isFinite(Number(assignment.endAt))
            ? Math.max(triggerAt, Number(assignment.endAt))
            : Math.min(maxDuration, triggerAt + 22);
        const placement: AssignmentPlacement =
          assignment.placement === 'bottom-center' ||
          assignment.placement === 'bottom-right' ||
          assignment.placement === 'center' ||
          assignment.placement === 'top-right'
            ? assignment.placement
            : 'bottom-right';
        const animationTypeRaw = String(assignment.overlayAnimationType || '').toLowerCase();
        const animationType: AssignmentOverlayAnimationType =
          animationTypeRaw === 'slide-up' || animationTypeRaw === 'fade' || animationTypeRaw === 'zoom'
            ? (animationTypeRaw as AssignmentOverlayAnimationType)
            : 'slide-up';
        const animationEasingRaw = String(assignment.overlayAnimationEasing || '').toLowerCase();
        const animationEasing: AssignmentOverlayAnimationEasing =
          animationEasingRaw === 'ease-out' ||
          animationEasingRaw === 'ease-in-out' ||
          animationEasingRaw === 'ease-in' ||
          animationEasingRaw === 'linear'
            ? (animationEasingRaw as AssignmentOverlayAnimationEasing)
            : 'ease-out';
        const scope: 'course' | 'skill' = assignment.scope === 'skill' ? 'skill' : 'course';
        return {
          ...assignment,
          scope,
          triggerAt: Math.min(maxDuration, triggerAt),
          endAt: Math.min(maxDuration, endAt),
          placement,
          overlayEnabled: assignment.overlayEnabled !== false,
          overlayBackground: String(assignment.overlayBackground || 'rgba(10,15,25,0.84)'),
          overlayTextColor: String(assignment.overlayTextColor || '#f5f1e7'),
          overlayPrimaryButtonColor: String(assignment.overlayPrimaryButtonColor || '#d99622'),
          overlayPrimaryButtonTextColor: String(assignment.overlayPrimaryButtonTextColor || '#1a1306'),
          overlayFontFamily: String(assignment.overlayFontFamily || 'Barlow Condensed, "Manrope", sans-serif'),
          overlayAnimationEnabled: assignment.overlayAnimationEnabled !== false,
          overlayAnimationType: animationType,
          overlayAnimationEasing: animationEasing,
          overlayAnimationDuration: Number.isFinite(Number(assignment.overlayAnimationDuration))
            ? Math.max(0, Math.min(8, Number(assignment.overlayAnimationDuration)))
            : 0.45,
          overlayAnimationDelay: Number.isFinite(Number(assignment.overlayAnimationDelay))
            ? Math.max(0, Math.min(8, Number(assignment.overlayAnimationDelay)))
            : 0,
          overlayRadius: Number.isFinite(Number(assignment.overlayRadius))
            ? Math.max(0, Math.min(48, Number(assignment.overlayRadius)))
            : 16,
          overlayOpacity: Number.isFinite(Number(assignment.overlayOpacity))
            ? Math.max(0.2, Math.min(1, Number(assignment.overlayOpacity)))
            : 1,
          overlayTitleSize: Number.isFinite(Number(assignment.overlayTitleSize))
            ? Math.max(14, Math.min(72, Number(assignment.overlayTitleSize)))
            : 32,
          points: Number.isFinite(Number(assignment.points)) ? Number(assignment.points) : 100,
          skillId: String(assignment.skillId || ''),
        };
      })
      .filter((assignment) => {
        if (!assignment.overlayEnabled) return false;
        if (assignment.scope === 'skill') {
          return activeLessonId.length > 0 && String(assignment.skillId || '') === activeLessonId;
        }
        return true;
      })
      .sort((a, b) => Number(a.triggerAt || 0) - Number(b.triggerAt || 0));
  }, [activeCourse?.duration, activeCourseWithAssignments?.assignmentStudio?.assignments, activeLesson?.duration, activeLesson?.id]);
  const assignmentsNeedingAttention = useMemo(() => {
    const now = Date.now();
    const nextWeek = now + 7 * 86400000;
    return assignmentOverlays.filter((assignment) => {
      const dueAt = new Date(String(assignment.dueDate || '')).getTime();
      return assignment.status === 'overdue' || (Number.isFinite(dueAt) && dueAt >= now && dueAt <= nextWeek);
    }).length;
  }, [assignmentOverlays]);
  const studentNextAction = useMemo(
    () =>
      buildAcademyStudentNextAction({
        tt,
        courseTitle: activeCourse?.title,
        lessonTitle: activeLesson?.title,
        pendingAssignments: assignmentOverlays.length,
        dueSoonAssignments: assignmentsNeedingAttention,
        notesToReview: lessonNotesCount + lessonBookmarkCount,
        resourceCount: studentLearningResources.length,
        progressPercent: studentProgressStats.progressPercent,
        isNewStudent: studentProgressStats.progressPercent <= 0,
      }),
    [
      activeCourse?.title,
      activeLesson?.title,
      assignmentOverlays.length,
      assignmentsNeedingAttention,
      lessonBookmarkCount,
      lessonNotesCount,
      studentLearningResources.length,
      studentProgressStats.progressPercent,
      tt,
    ],
  );
  const studentSidebarNextActionRoute =
    studentNextAction.id === 'assignment'
      ? studentAssignmentsRoute
      : studentNextAction.id === 'resources'
        ? studentResourcesRoute
        : studentNextAction.id === 'feedback'
          ? '/academy/settings?tab=messages'
          : currentStudentPlayerRoute;
  const studentSidebarNextActionLabel =
    studentNextAction.id === 'assignment'
      ? tt('Åpne oppgaver', 'Open assignments')
      : studentNextAction.id === 'resources'
        ? tt('Åpne ressurser', 'Open resources')
        : studentNextAction.id === 'feedback'
          ? tt('Åpne dialog', 'Open messages')
          : tt('Fortsett læring', 'Continue learning');

  const activeAssignmentOverlay = useMemo(() => {
    return (
      assignmentOverlays.find((assignment) => {
        const id = String(assignment.id || '');
        if (!id || dismissedAssignmentIds.includes(id)) return false;
        return (
          currentTime >= Number(assignment.triggerAt || 0) &&
          currentTime <= Number(assignment.endAt || Number(assignment.triggerAt || 0))
        );
      }) || null
    );
  }, [assignmentOverlays, currentTime, dismissedAssignmentIds]);

  const activeAssignmentOverlayAnimationSx = useMemo(() => {
    if (!activeAssignmentOverlay || !activeAssignmentOverlay.overlayAnimationEnabled) {
      return {};
    }
    const duration = Math.max(0, Number(activeAssignmentOverlay.overlayAnimationDuration || 0));
    const delay = Math.max(0, Number(activeAssignmentOverlay.overlayAnimationDelay || 0));
    if (duration <= 0) return {};
    if (activeAssignmentOverlay.overlayAnimationType === 'fade') {
      return {
        animation: `academyPlayerAssignmentFade ${duration}s ${activeAssignmentOverlay.overlayAnimationEasing} ${delay}s both`,
        '@keyframes academyPlayerAssignmentFade': {
          '0%': { opacity: 0 },
          '100%': { opacity: 1 },
        },
      };
    }
    if (activeAssignmentOverlay.overlayAnimationType === 'zoom') {
      return {
        animation: `academyPlayerAssignmentZoom ${duration}s ${activeAssignmentOverlay.overlayAnimationEasing} ${delay}s both`,
        '@keyframes academyPlayerAssignmentZoom': {
          '0%': { opacity: 0, transform: 'translate(var(--assignment-overlay-x, 0), var(--assignment-overlay-y, 0)) scale(0.92)' },
          '100%': { opacity: 1, transform: 'translate(var(--assignment-overlay-x, 0), var(--assignment-overlay-y, 0)) scale(1)' },
        },
      };
    }
    return {
      animation: `academyPlayerAssignmentSlideUp ${duration}s ${activeAssignmentOverlay.overlayAnimationEasing} ${delay}s both`,
      '@keyframes academyPlayerAssignmentSlideUp': {
        '0%': { opacity: 0, transform: 'translate(var(--assignment-overlay-x, 0), calc(var(--assignment-overlay-y, 0) + 18px))' },
        '100%': { opacity: 1, transform: 'translate(var(--assignment-overlay-x, 0), var(--assignment-overlay-y, 0))' },
      },
    };
  }, [activeAssignmentOverlay]);

  const activePresentationOverlaySx = useMemo(() => {
    const overlay = activePresentationOverlay;
    if (!overlay) return {};

    const base = {
      position: 'absolute',
      zIndex: 3,
      borderRadius: 1.2,
      border: 'var(--academy-hairline-width, 1px) solid rgba(248,179,33,0.52)',
      background: 'rgba(11,16,25,0.9)',
      boxShadow: '0 12px 28px rgba(0,0,0,0.35)',
      overflow: 'hidden',
    } as const;

    if (overlay.displayMode === 'full-frame') {
      return {
        ...base,
        inset: 24,
        borderRadius: 1.4,
      };
    }

    if (overlay.displayMode === 'split-screen') {
      return {
        ...base,
        top: 20,
        right: 20,
        bottom: 116,
        width: 'min(45%, 520px)',
      };
    }

    if (overlay.displayMode === 'side-panel') {
      return {
        ...base,
        top: 20,
        right: 20,
        bottom: 116,
        width: 'min(34%, 420px)',
      };
    }

    if (overlay.placement === 'top-left') {
      return { ...base, top: 20, left: 20, width: 'min(34%, 410px)' };
    }
    if (overlay.placement === 'top-right') {
      return { ...base, top: 20, right: 20, width: 'min(34%, 410px)' };
    }
    if (overlay.placement === 'bottom-left') {
      return { ...base, left: 20, bottom: 116, width: 'min(34%, 410px)' };
    }
    if (overlay.placement === 'center') {
      return {
        ...base,
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 'min(60%, 640px)',
      };
    }
    return { ...base, right: 20, bottom: 116, width: 'min(34%, 410px)' };
  }, [activePresentationOverlay]);

  const isSplitScreenPresentationActive = activePresentationOverlay?.displayMode === 'split-screen';

  const splitScreenPlayerColumns = useMemo(() => {
    if (!isSplitScreenPresentationActive) return '1fr';
    const variant = String(activePresentationOverlay?.splitLayoutVariant || 'balanced');
    if (variant === 'presenter-focus') {
      return 'minmax(360px, 1.2fr) minmax(320px, 1fr)';
    }
    if (variant === 'slide-focus') {
      return 'minmax(300px, 0.92fr) minmax(420px, 1.08fr)';
    }
    return 'minmax(340px, 1fr) minmax(360px, 1fr)';
  }, [activePresentationOverlay?.splitLayoutVariant, isSplitScreenPresentationActive]);

  const filteredTranscript = useMemo(() => {
    const query = transcriptSearch.trim().toLowerCase();
    if (!query) return transcriptLines;
    return transcriptLines.filter((line) => {
      return line.speaker.toLowerCase().includes(query) || line.text.toLowerCase().includes(query);
    });
  }, [transcriptLines, transcriptSearch]);

  useEffect(() => {
    analytics.trackEvent('academy_video_player_studio_opened', {
      courseId: activeCourse?.id,
      lessonId: activeLesson?.id,
      timestamp: Date.now(),
    });

    debugging.logIntegration('info', 'AcademyVideoPlayerStudio opened', {
      courseId: activeCourse?.id,
      lessonId: activeLesson?.id,
    });
  }, [activeCourse?.id, activeLesson?.id, analytics, debugging]);

  useEffect(() => {
    const visibleId = activeAssignmentOverlay?.id ? String(activeAssignmentOverlay.id) : null;
    if (!visibleId) {
      assignmentOverlayVisibilityRef.current = null;
      return;
    }
    if (assignmentOverlayVisibilityRef.current === visibleId) return;
    assignmentOverlayVisibilityRef.current = visibleId;
    analytics.trackEvent('academy_assignment_overlay_shown', {
      courseId: activeCourse?.id || null,
      lessonId: activeLesson?.id || null,
      assignmentId: visibleId,
      triggerAt: activeAssignmentOverlay?.triggerAt || 0,
      endAt: activeAssignmentOverlay?.endAt || 0,
      timestamp: Date.now(),
    });
  }, [activeAssignmentOverlay, activeCourse?.id, activeLesson?.id, analytics]);

  useEffect(() => {
    const visibleId = activeCtaOverlay?.id ? String(activeCtaOverlay.id) : null;
    if (!visibleId) {
      ctaOverlayVisibilityRef.current = null;
      return;
    }
    if (ctaOverlayVisibilityRef.current === visibleId) return;
    ctaOverlayVisibilityRef.current = visibleId;
    analytics.trackEvent('academy_cta_overlay_shown', {
      courseId: activeCourse?.id || null,
      lessonId: activeLesson?.id || null,
      overlayId: visibleId,
      scope: activeCtaOverlay?.scope || 'course',
      triggerAt: activeCtaOverlay?.triggerAt || 0,
      endAt: activeCtaOverlay?.endAt || 0,
      timestamp: Date.now(),
    });
  }, [activeCourse?.id, activeCtaOverlay, activeLesson?.id, analytics]);

  useEffect(() => {
    const visibleId = activeLowerThird?.id ? String(activeLowerThird.id) : null;
    if (!visibleId) {
      lowerThirdVisibilityRef.current = null;
      return;
    }
    if (lowerThirdVisibilityRef.current === visibleId) return;
    lowerThirdVisibilityRef.current = visibleId;
    analytics.trackEvent('academy_lower_third_shown', {
      courseId: activeCourse?.id || null,
      lessonId: activeLesson?.id || null,
      lowerThirdId: visibleId,
      scope: activeLowerThird?.scope || 'course',
      startTime: activeLowerThird?.startTime || 0,
      duration: activeLowerThird?.duration || 0,
      timestamp: Date.now(),
    });
  }, [activeCourse?.id, activeLesson?.id, activeLowerThird, analytics]);

  useEffect(() => {
    const visibleId = activePresentationOverlay?.id ? String(activePresentationOverlay.id) : null;
    if (!visibleId) {
      presentationOverlayVisibilityRef.current = null;
      return;
    }
    if (presentationOverlayVisibilityRef.current === visibleId) return;
    presentationOverlayVisibilityRef.current = visibleId;
    analytics.trackEvent('academy_presentation_overlay_shown', {
      courseId: activeCourse?.id || null,
      lessonId: activeLesson?.id || null,
      overlayId: visibleId,
      scope: activePresentationOverlay?.scope || 'course',
      template: activePresentationOverlay?.template || null,
      displayMode: activePresentationOverlay?.displayMode || 'picture-in-picture',
      splitLayoutVariant: activePresentationOverlay?.splitLayoutVariant || 'balanced',
      placement: activePresentationOverlay?.placement || 'bottom-right',
      sourceSlideNumber: activePresentationOverlay?.sourceSlideNumber || 1,
      startTime: activePresentationOverlay?.startTime || 0,
      endTime: activePresentationOverlay?.endTime || 0,
      timestamp: Date.now(),
    });
  }, [activeCourse?.id, activeLesson?.id, activePresentationOverlay, analytics]);

  useEffect(() => {
    const visibleIds = activeAnnotationOverlays
      .map((overlay) => `${overlay.scope}:${String(overlay.id || '')}`)
      .filter(Boolean)
      .sort();
    const visibilityKey = visibleIds.join('|');

    if (!visibilityKey) {
      annotationOverlayVisibilityRef.current = null;
      return;
    }
    if (annotationOverlayVisibilityRef.current === visibilityKey) return;
    annotationOverlayVisibilityRef.current = visibilityKey;

    analytics.trackEvent('academy_annotation_overlay_shown', {
      courseId: activeCourse?.id || null,
      lessonId: activeLesson?.id || null,
      overlayIds: visibleIds,
      count: visibleIds.length,
      timestamp: Date.now(),
    });
  }, [activeAnnotationOverlays, activeCourse?.id, activeLesson?.id, analytics]);

  const syncVideoSettings = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.playbackRate = speed;
    video.volume = muted ? 0 : volume;
    video.muted = muted;
  }, [muted, speed, volume]);

  useEffect(() => {
    syncVideoSettings();
  }, [syncVideoSettings]);

  const handleLoadedMetadata = useCallback(() => {
    const measured = videoRef.current?.duration;
    if (measured && Number.isFinite(measured) && measured > 0) {
      setDuration(measured);
    }
  }, []);

  const handleTimeUpdate = useCallback(() => {
    const nextTime = videoRef.current?.currentTime;
    if (typeof nextTime !== 'number' || !Number.isFinite(nextTime)) return;
    setCurrentTime(nextTime);

    const nextProgress = duration > 0 ? clamp((nextTime / duration) * 100, 0, 100) : 0;
    const rounded = Math.floor(nextProgress);
    if (Math.abs(rounded - progressRef.current) >= 5) {
      progressRef.current = rounded;
      void updateProgress(String(activeCourse?.id), String(activeLesson?.id), rounded);
    }

    const chapterAtTime =
      [...chapters]
        .reverse()
        .find((chapter) => nextTime >= chapter.startTime) || chapters[0];
    if (chapterAtTime && chapterAtTime.id !== selectedChapterId) {
      setSelectedChapterId(chapterAtTime.id);
    }
  }, [activeCourse?.id, activeLesson?.id, chapters, duration, selectedChapterId, updateProgress]);

  const handleSeek = useCallback((_: Event, newValue: number | number[]) => {
    const value = Array.isArray(newValue) ? newValue[0] : newValue;
    if (videoRef.current) {
      videoRef.current.currentTime = value;
    }
    setCurrentTime(value);
  }, []);

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
    togglePlayback();
  }, [togglePlayback]);

  const skipBy = useCallback((delta: number) => {
    const target = clamp(currentTime + delta, 0, duration || 1);
    if (videoRef.current) {
      videoRef.current.currentTime = target;
    }
    setCurrentTime(target);
  }, [currentTime, duration]);

  const goToChapter = useCallback((chapter: ChapterItem) => {
    setSelectedChapterId(chapter.id);
    if (videoRef.current) {
      videoRef.current.currentTime = chapter.startTime;
    }
    setCurrentTime(chapter.startTime);

    analytics.trackEvent('academy_video_player_chapter_selected', {
      courseId: activeCourse?.id,
      lessonId: activeLesson?.id,
      chapterId: chapter.id,
      chapterTitle: chapter.title,
      timestamp: Date.now(),
    });
  }, [activeCourse?.id, activeLesson?.id, analytics]);

  const saveSettings = useCallback((next: { speed?: number; subtitles?: boolean }) => {
    void updateSettings({
      playbackSpeed: next.speed ?? speed,
      subtitles: next.subtitles ?? state.settings.subtitles,
    });
  }, [speed, state.settings.subtitles, updateSettings]);

  const toggleSubtitles = useCallback(() => {
    const nextValue = !state.settings.subtitles;
    saveSettings({ subtitles: nextValue });
  }, [saveSettings, state.settings.subtitles]);

  const handleSpeedChange = useCallback((nextSpeed: number) => {
    setSpeed(nextSpeed);
    saveSettings({ speed: nextSpeed });
  }, [saveSettings]);

  const handleBookmark = useCallback(() => {
    void addBookmark(String(activeCourse?.id), String(activeLesson?.id), Math.floor(currentTime));
    setSaveMessage(tt(`Bokmerke lagt til ved ${formatTime(currentTime)}.`, `Bookmark added at ${formatTime(currentTime)}.`));
  }, [activeCourse?.id, activeLesson?.id, addBookmark, currentTime, tt]);

  const handleAddNote = useCallback(() => {
    const note = noteDraft.trim();
    if (!note) return;
    void addNote(String(activeCourse?.id), String(activeLesson?.id), note);

    setTranscriptLines((prev) => [
      ...prev,
      {
        id: `note-${Date.now()}`,
        speaker: tt('Deg', 'You'),
        timestamp: Math.floor(currentTime),
        text: note,
      },
    ]);

    setNoteDraft('');
    setSaveMessage(tt('Notat lagt til i transkripsjonen.', 'Note added to transcript.'));
  }, [activeCourse?.id, activeLesson?.id, addNote, currentTime, noteDraft, tt]);

  const handleQuizSubmit = useCallback(() => {
    if (!quizAnswer) return;
    setQuizSubmitted(true);

    analytics.trackEvent('academy_video_quiz_submitted', {
      courseId: activeCourse?.id,
      lessonId: activeLesson?.id,
      quizId: activeQuiz.id,
      answerId: quizAnswer,
      isCorrect: activeQuiz.choices.find((choice) => choice.id === quizAnswer)?.isCorrect || false,
      timestamp: Date.now(),
    });
  }, [activeCourse?.id, activeLesson?.id, activeQuiz, analytics, quizAnswer]);

  const handleSave = useCallback((publish: boolean) => {
    const payload = {
      id: `video-player-config-${activeCourse?.id || 'preview'}`,
      courseId: activeCourse?.id,
      lessonId: activeLesson?.id,
      chapters,
      transcriptLines,
      speed,
      subtitles: state.settings.subtitles,
      publish,
      updatedAt: new Date().toISOString(),
    };

    onSave?.(payload);
    setSaveMessage(tt(
      publish ? 'Spilleroppsett publisert.' : 'Spilleroppsett lagret.',
      publish ? 'Player setup published.' : 'Player setup saved.',
    ));
  }, [activeCourse?.id, activeLesson?.id, chapters, onSave, speed, state.settings.subtitles, transcriptLines, tt]);

  const speedOptions = [0.5, 1, 1.25, 1.5, 2, 6];
  const studentResourcesRoute = useMemo(
    () => buildStudentRoute('/academy/media'),
    [buildStudentRoute],
  );
  const studentAssignmentsRoute = useMemo(
    () => buildStudentRoute('/academy/assignments'),
    [buildStudentRoute],
  );
  const studentSelectedAssignmentRoute = useCallback(
    (assignmentId: string) => buildStudentRoute('/academy/assignments', { assignmentId }),
    [buildStudentRoute],
  );
  const studentDashboardRoute = studentBaseReturnTo || '/academy/student-dashboard';

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

      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', lg: 'row' },
          minHeight: '100vh',
          position: 'relative',
          zIndex: 1,
          width: academyShellMaxWidth,
          mx: 'auto',
        }}
      >
        {isStudentMode ? (
          <AcademyStudentSidebar
            activeNav="courses"
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
            continueRoute={currentStudentPlayerRoute}
            nextActionTitle={studentNextAction.title}
            nextActionDetail={studentNextAction.detail}
            nextActionRoute={studentSidebarNextActionRoute}
            nextActionLabel={studentSidebarNextActionLabel}
          />
        ) : (
          <AcademyLeftSidebar
            activeNav="tools"
            onNavigate={(_, route) => setLocation(route)}
            onCreateCourse={() => setLocation('/academy/curriculum?createCompetency=1')}
            tt={tt}
            navLabel={navLabel}
            bottomAction={{
              label: tt('Legg til bokmerke', 'Add Bookmark'),
              onClick: handleBookmark,
              icon: <Bookmark />,
            }}
          />
        )}

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
                {isStudentMode ? tt('STUDENT PLAYER', 'STUDENT PLAYER') : 'CREATOR STUDIO'}
              </Typography>
              <Chip
                label={
                  isStudentMode
                    ? tt(
                        `${studentProgressStats.completedLessons}/${Math.max(1, studentProgressStats.totalLessons)} fullført`,
                        `${studentProgressStats.completedLessons}/${Math.max(1, studentProgressStats.totalLessons)} completed`,
                      )
                    : tt('Utkast', 'Draft')
                }
                size="small"
                sx={{ bgcolor: 'rgba(255,255,255,0.08)', color: '#edf0f7', fontWeight: 600 }}
              />
            </Stack>

            <Stack direction="row" spacing={1.2} alignItems="center">
              <AcademyLocaleSwitcher />
              <IconButton
                size="small"
                onClick={() => setLocation('/academy/settings?tab=notifications')}
                aria-label={tt('Varsler', 'Notifications')}
                sx={{ color: 'rgba(237,240,247,0.75)' }}
              >
                <NotificationsNone fontSize="small" />
              </IconButton>
              <IconButton
                size="small"
                onClick={() => setLocation('/academy/settings?tab=messages')}
                aria-label={tt('Meldinger', 'Messages')}
                sx={{ color: 'rgba(237,240,247,0.75)' }}
              >
                <MailOutline fontSize="small" />
              </IconButton>
              <IconButton
                size="small"
                onClick={() => setLocation('/academy/settings?tab=profile')}
                aria-label={tt('Profil', 'Profile')}
                sx={{ p: 0 }}
              >
                <Avatar sx={{ width: 34, height: 34, bgcolor: '#f8b321', color: '#111' }}>N</Avatar>
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
                  <Typography sx={{ fontSize: 'clamp(1.35rem, 1rem + 0.9vw, 1.9rem)', fontWeight: 600, letterSpacing: '0.02em' }}>
                    {activeCourse?.title || 'Directing Masterclass'}
                  </Typography>
                  {isStudentMode && activeLesson?.title ? (
                    <Chip
                      label={activeLesson.title}
                      size="small"
                      sx={{
                        bgcolor: 'rgba(248,179,33,0.14)',
                        color: '#f8d56f',
                        border: 'var(--academy-hairline-width, 1px) solid rgba(248,179,33,0.24)',
                      }}
                    />
                  ) : null}
                </Stack>

                <Stack
                  direction="row"
                  spacing={1}
                  flexWrap="nowrap"
                  useFlexGap
                  sx={{
                    minWidth: 0,
                    justifyContent: { xs: 'flex-start', lg: 'flex-end' },
                    overflowX: 'auto',
                    pb: 0.2,
                    '& > *': { flexShrink: 0 },
                    '&::-webkit-scrollbar': { height: 6 },
                    '&::-webkit-scrollbar-thumb': {
                      backgroundColor: 'rgba(255,255,255,0.18)',
                      borderRadius: 999,
                    },
                  }}
                >
                  {isStudentMode ? (
                    <>
                      <Button
                        variant="outlined"
                        startIcon={isPlaying ? <Visibility /> : <VisibilityOff />}
                        onClick={toggleStudentPreview}
                        sx={{
                          textTransform: 'none',
                          borderColor: isPlaying ? 'rgba(248,179,33,0.45)' : 'rgba(255,255,255,0.2)',
                          color: isPlaying ? '#f8d675' : '#edf0f7',
                          bgcolor: isPlaying ? 'rgba(248,179,33,0.12)' : 'transparent',
                          borderRadius: 1,
                        }}
                      >
                        {isPlaying ? tt('Spiller av', 'Playing') : tt('Start avspilling', 'Start playback')}
                      </Button>
                      <Button
                        variant="outlined"
                        startIcon={<Bookmark />}
                        onClick={handleBookmark}
                        sx={{
                          textTransform: 'none',
                          borderColor: 'rgba(255,255,255,0.2)',
                          color: '#edf0f7',
                          borderRadius: 1,
                        }}
                      >
                        {tt('Bokmerke', 'Bookmark')}
                      </Button>
                      <Button
                        variant="outlined"
                        startIcon={<Search />}
                        onClick={() => setLocation(studentResourcesRoute)}
                        sx={{
                          textTransform: 'none',
                          borderColor: 'rgba(255,255,255,0.2)',
                          color: '#edf0f7',
                          borderRadius: 1,
                        }}
                      >
                        {tt('Ressurser', 'Resources')}
                      </Button>
                      <Button
                        variant="contained"
                        startIcon={<Quiz />}
                        onClick={() => setLocation(studentAssignmentsRoute)}
                        sx={{
                          textTransform: 'none',
                          borderRadius: 1,
                          color: '#0f0f0f',
                          background: 'linear-gradient(180deg, #ffd44e, #f2a616)',
                          boxShadow: '0 10px 24px rgba(248,179,33,0.25)',
                        }}
                      >
                        {tt('Oppgaver', 'Assignments')}
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        variant="outlined"
                        startIcon={isPlaying ? <Visibility /> : <VisibilityOff />}
                        onClick={toggleStudentPreview}
                        sx={{
                          textTransform: 'none',
                          borderColor: isPlaying ? 'rgba(248,179,33,0.45)' : 'rgba(255,255,255,0.2)',
                          color: isPlaying ? '#f8d675' : '#edf0f7',
                          bgcolor: isPlaying ? 'rgba(248,179,33,0.12)' : 'transparent',
                          borderRadius: 1,
                        }}
                      >
                        {isPlaying
                          ? tt('Forhåndsvisning på', 'Preview on')
                          : tt('Forhåndsvis (student)', 'Preview (learner)')}
                      </Button>
                      <Button
                        variant="outlined"
                        startIcon={<Save />}
                        onClick={() => handleSave(false)}
                        sx={{
                          textTransform: 'none',
                          borderColor: 'rgba(255,255,255,0.2)',
                          color: '#edf0f7',
                          borderRadius: 1,
                        }}
                      >
                        {tt('Lagre', 'Save')}
                      </Button>
                      <Button
                        variant="outlined"
                        startIcon={<MonetizationOn />}
                        onClick={() => setLocation('/academy/monetization')}
                        sx={{
                          textTransform: 'none',
                          borderColor: 'rgba(255,255,255,0.2)',
                          color: '#edf0f7',
                          borderRadius: 1,
                        }}
                      >
                        {tt('Monetisering', 'Monetization')}
                      </Button>
                      <Button
                        variant="outlined"
                        startIcon={<Campaign />}
                        onClick={() => {
                          const query = new URLSearchParams();
                          if (activeCourse?.id) query.set('courseId', String(activeCourse.id));
                          if (activeLesson?.id) query.set('lessonId', String(activeLesson.id));
                          const suffix = query.toString();
                          setLocation(suffix ? `/academy/cta-overlay?${suffix}` : '/academy/cta-overlay');
                        }}
                        sx={{
                          textTransform: 'none',
                          borderColor: 'rgba(255,255,255,0.2)',
                          color: '#edf0f7',
                          borderRadius: 1,
                        }}
                      >{tt('CTA-Studio', 'CTA Studio')}</Button>
                      <Button
                        variant="outlined"
                        startIcon={<Subtitles />}
                        onClick={() => {
                          const query = new URLSearchParams();
                          if (activeCourse?.id) query.set('courseId', String(activeCourse.id));
                          if (activeLesson?.id) query.set('lessonId', String(activeLesson.id));
                          const suffix = query.toString();
                          setLocation(suffix ? `/academy/lower-thirds?${suffix}` : '/academy/lower-thirds');
                        }}
                        sx={{
                          textTransform: 'none',
                          borderColor: 'rgba(255,255,255,0.2)',
                          color: '#edf0f7',
                          borderRadius: 1,
                        }}
                      >
                        {tt('Lower thirds-studio', 'Lower Thirds Studio')}
                      </Button>
                      <Button
                        variant="outlined"
                        startIcon={<Slideshow />}
                        onClick={() => {
                          const query = new URLSearchParams();
                          if (activeCourse?.id) query.set('courseId', String(activeCourse.id));
                          if (activeLesson?.id) query.set('lessonId', String(activeLesson.id));
                          const suffix = query.toString();
                          setLocation(suffix ? `/academy/presentation-overlay?${suffix}` : '/academy/presentation-overlay');
                        }}
                        sx={{
                          textTransform: 'none',
                          borderColor: 'rgba(255,255,255,0.2)',
                          color: '#edf0f7',
                          borderRadius: 1,
                        }}
                      >
                        {tt('Presentasjon', 'Presentation')}
                      </Button>
                      <Button
                        variant="contained"
                        startIcon={<Publish />}
                        onClick={() => handleSave(true)}
                        sx={{
                          textTransform: 'none',
                          borderRadius: 1,
                          color: '#0f0f0f',
                          background: 'linear-gradient(180deg, #ffd44e, #f2a616)',
                          boxShadow: '0 10px 24px rgba(248,179,33,0.25)',
                        }}
                      >
                        {tt('Publiser', 'Publish')}
                      </Button>
                    </>
                  )}
                </Stack>
              </Stack>

              {isStudentMode ? (
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', xl: 'repeat(3, minmax(0, 1fr))' },
                    gap: 1,
                  }}
                >
                  <Box sx={{ ...cinematicPanelSx, p: 1 }}>
                    <Typography sx={{ fontSize: 12, color: 'rgba(248,213,111,0.94)', fontWeight: 700 }}>
                      {tt('Du er her', 'You are here')}
                    </Typography>
                    <Typography sx={{ mt: 0.45, fontWeight: 700 }}>
                      {activeLesson?.title || tt('Aktiv leksjon', 'Active lesson')}
                    </Typography>
                    <Typography sx={{ mt: 0.3, color: 'rgba(237,240,247,0.7)', fontSize: 13 }}>
                      {tt(
                        `Leksjon ${lessonPathMeta.index}/${Math.max(lessonPathMeta.total, 1)} i ${activeCourse?.title || tt('kurset ditt', 'your course')}.`,
                        `Lesson ${lessonPathMeta.index}/${Math.max(lessonPathMeta.total, 1)} in ${activeCourse?.title || 'your course'}.`,
                      )}
                    </Typography>
                    <Typography sx={{ mt: 0.45, color: '#f8d56f', fontWeight: 700, fontSize: 13 }}>
                      {tt(
                        `${Number(currentLessonProgress?.progress || 0)}% fullført i denne leksjonen`,
                        `${Number(currentLessonProgress?.progress || 0)}% completed in this lesson`,
                      )}
                    </Typography>
                  </Box>

                  <Box sx={{ ...cinematicPanelSx, p: 1 }}>
                    <Typography sx={{ fontSize: 12, color: 'rgba(248,213,111,0.94)', fontWeight: 700 }}>
                      {tt('Neste anbefaling', 'Next recommendation')}
                    </Typography>
                    <Typography sx={{ mt: 0.45, fontWeight: 700 }}>
                      {recommendedLearningResource?.title ||
                        lessonPathMeta.nextLesson?.title ||
                        studentNextAction.title}
                    </Typography>
                    <Typography sx={{ mt: 0.3, color: 'rgba(237,240,247,0.7)', fontSize: 13 }}>
                      {recommendedLearningResource
                        ? tt(
                            'Åpne denne ressursen mens innholdet fortsatt er ferskt fra videoen.',
                            'Open this resource while the video content is still fresh.',
                          )
                        : lessonPathMeta.nextLesson
                          ? tt(
                              'Neste leksjon ligger klar så snart du er ferdig med denne delen.',
                              'The next lesson is ready as soon as you finish this section.',
                            )
                          : studentNextAction.detail}
                    </Typography>
                    <Button
                      size="small"
                      onClick={() =>
                        setLocation(
                          recommendedLearningResource
                            ? studentResourcesRoute
                            : studentSidebarNextActionRoute,
                        )
                      }
                      sx={{
                        mt: 0.8,
                        textTransform: 'none',
                        color: '#f8d56f',
                        border: 'var(--academy-hairline-width, 1px) solid rgba(248,179,33,0.22)',
                      }}
                    >
                      {recommendedLearningResource
                        ? tt('Åpne ressurs', 'Open resource')
                        : studentSidebarNextActionLabel}
                    </Button>
                  </Box>

                  <Box sx={{ ...cinematicPanelSx, p: 1 }}>
                    <Typography sx={{ fontSize: 12, color: 'rgba(248,213,111,0.94)', fontWeight: 700 }}>
                      {tt('Læringsspor', 'Learning trail')}
                    </Typography>
                    <Typography sx={{ mt: 0.45, fontWeight: 700 }}>
                      {tt(
                        `${lessonNotesCount} notater · ${lessonBookmarkCount} bokmerker`,
                        `${lessonNotesCount} notes · ${lessonBookmarkCount} bookmarks`,
                      )}
                    </Typography>
                    <Typography sx={{ mt: 0.3, color: 'rgba(237,240,247,0.7)', fontSize: 13 }}>
                      {tt(
                        `Nye notater lagres på tidskoden ${formatTime(currentTime)} så du finner igjen riktig øyeblikk senere.`,
                        `New notes are saved at ${formatTime(currentTime)} so you can revisit the right moment later.`,
                      )}
                    </Typography>
                  </Box>
                </Box>
              ) : null}

              <Box sx={{ ...cinematicPanelSx, p: 1, position: 'relative' }}>
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: {
                      xs: '1fr',
                      lg: isSplitScreenPresentationActive ? splitScreenPlayerColumns : '1fr',
                    },
                    gap: isSplitScreenPresentationActive ? 1 : 0,
                    alignItems: 'stretch',
                  }}
                >
                <AcademyPlayerStudio
                  src={effectiveVideoUrl}
                  poster={activeLesson?.thumbnail || activeCourse?.thumbnail || undefined}
                  posterZoom={
                    typeof activeLesson?.thumbnailZoom === 'number' && Number.isFinite(activeLesson.thumbnailZoom)
                      ? Math.max(100, Math.min(220, activeLesson.thumbnailZoom))
                      : 100
                  }
                  objectPosition={`${activeLesson?.thumbnailFocalX ?? 50}% ${activeLesson?.thumbnailFocalY ?? 50}%`}
                  videoRef={videoRef}
                  onLoadedMetadata={handleLoadedMetadata}
                  onTimeUpdate={handleTimeUpdate}
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  objectFit={isSplitScreenPresentationActive ? 'contain' : 'cover'}
                  containerSx={
                    isSplitScreenPresentationActive
                      ? {
                          minHeight: { xs: 220, md: 360 },
                          height: '100%',
                          aspectRatio: 'auto',
                          bgcolor: '#000',
                        }
                      : undefined
                  }
                  videoStyle={isSplitScreenPresentationActive ? { backgroundColor: '#000' } : undefined}
                >
                  {activeAnnotationOverlays.map((annotation) => {
                    const left = clamp(Number(annotation.position?.x ?? 12), 0, 100);
                    const top = clamp(Number(annotation.position?.y ?? 12), 0, 100);
                    const maxWidth = Math.max(8, 100 - left);
                    const maxHeight = Math.max(8, 100 - top);
                    const width = clamp(Number(annotation.size?.width ?? 26), 8, maxWidth);
                    const height = clamp(Number(annotation.size?.height ?? 13), 8, maxHeight);
                    const backgroundColor = String(annotation.style?.backgroundColor || 'rgba(248,179,33,0.22)');
                    const textColor = String(annotation.style?.textColor || '#f7f8fb');
                    const borderColor = String(annotation.style?.borderColor || '#f8b321');
                    const borderWidth = clamp(Number(annotation.style?.borderWidth ?? 2), 1, 8);
                    const borderRadius = clamp(Number(annotation.style?.borderRadius ?? 10), 0, 30);
                    const opacity = clamp(Number(annotation.style?.opacity ?? 0.95), 0.1, 1);

                    return (
                      <Box
                        key={`${annotation.scope}:${annotation.id}`}
                        sx={{
                          position: 'absolute',
                          left: `${left}%`,
                          top: `${top}%`,
                          width: `${width}%`,
                          minHeight: `${height}%`,
                          borderRadius: `${borderRadius}px`,
                          border: `${borderWidth}px solid ${borderColor}`,
                          background: backgroundColor,
                          color: textColor,
                          opacity,
                          p: 1,
                          zIndex: 3,
                          boxShadow: '0 12px 28px rgba(0,0,0,0.3)',
                          overflow: 'hidden',
                        }}
                      >
                        <Stack spacing={0.4}>
                          <Typography sx={{ fontWeight: 700, lineHeight: 1.15, fontSize: 'clamp(0.78rem, 0.66rem + 0.28vw, 1rem)' }}>
                            {annotation.title}
                          </Typography>
                          <Typography sx={{ color: alpha(textColor, 0.92), lineHeight: 1.25, fontSize: 'clamp(0.7rem, 0.6rem + 0.24vw, 0.9rem)' }}>
                            {annotation.content}
                          </Typography>
                        </Stack>
                      </Box>
                    );
                  })}

                  {activeAssignmentOverlay && (
                    <Box
                      sx={{
                        position: 'absolute',
                        ...(activeAssignmentOverlay.placement === 'top-right'
                          ? { top: 22, right: 22, '--assignment-overlay-x': '0', '--assignment-overlay-y': '0' }
                          : activeAssignmentOverlay.placement === 'center'
                            ? {
                                top: '50%',
                                left: '50%',
                                '--assignment-overlay-x': '-50%',
                                '--assignment-overlay-y': '-50%',
                                transform: 'translate(var(--assignment-overlay-x), var(--assignment-overlay-y))',
                              }
                            : activeAssignmentOverlay.placement === 'bottom-center'
                              ? {
                                  left: '50%',
                                  bottom: 142,
                                  '--assignment-overlay-x': '-50%',
                                  '--assignment-overlay-y': '0',
                                  transform: 'translate(var(--assignment-overlay-x), var(--assignment-overlay-y))',
                                }
                              : { right: 22, bottom: 142, '--assignment-overlay-x': '0', '--assignment-overlay-y': '0' }),
                        width:
                          activeAssignmentOverlay.placement === 'center' ||
                          activeAssignmentOverlay.placement === 'bottom-center'
                            ? 'min(86%, 520px)'
                            : 'min(76%, 420px)',
                        borderRadius: `${activeAssignmentOverlay.overlayRadius || 16}px`,
                        border: 'var(--academy-hairline-width, 1px) solid rgba(248,179,33,0.56)',
                        background: activeAssignmentOverlay.overlayBackground || 'rgba(10,15,25,0.84)',
                        p: 1.2,
                        zIndex: 4,
                        opacity: activeAssignmentOverlay.overlayOpacity || 1,
                        fontFamily: activeAssignmentOverlay.overlayFontFamily || 'Barlow Condensed, "Manrope", sans-serif',
                        boxShadow: '0 14px 34px rgba(0,0,0,0.42)',
                        ...activeAssignmentOverlayAnimationSx,
                      }}
                    >
                      <Stack spacing={0.7}>
                        <Stack direction="row" spacing={0.7} alignItems="center" flexWrap="wrap" useFlexGap>
                          <Chip
                            label={tt('Oppgave', 'Assignment')}
                            size="small"
                            sx={{ bgcolor: 'rgba(248,179,33,0.2)', color: activeAssignmentOverlay.overlayTextColor || '#f5f1e7' }}
                          />
                          <Chip
                            label={`${formatTime(Number(activeAssignmentOverlay.triggerAt || 0))}-${formatTime(Number(activeAssignmentOverlay.endAt || 0))}`}
                            size="small"
                            sx={{ bgcolor: 'rgba(255,255,255,0.12)', color: activeAssignmentOverlay.overlayTextColor || '#f5f1e7' }}
                          />
                        </Stack>
                        <Typography
                          sx={{
                            fontSize: `clamp(0.98rem, 0.72rem + 0.6vw, ${Math.max(18, Number(activeAssignmentOverlay.overlayTitleSize || 32))}px)`,
                            color: activeAssignmentOverlay.overlayTextColor || '#f5f1e7',
                            fontWeight: 700,
                            lineHeight: 1.12,
                          }}
                        >
                          {activeAssignmentOverlay.title || tt('Ny oppgave', 'New assignment')}
                        </Typography>
                        <Typography sx={{ color: activeAssignmentOverlay.overlayTextColor || '#f5f1e7', opacity: 0.86, fontSize: 13 }}>
                          {activeAssignmentOverlay.subtitle || tt('Vises til studenten som in-video oppgave.', 'Shown to learner as an in-video assignment.')}
                        </Typography>
                        <Stack direction="row" spacing={0.8} justifyContent="flex-end">
                          <Button
                            size="small"
                            onClick={() => {
                              setDismissedAssignmentIds((prev) =>
                                prev.includes(String(activeAssignmentOverlay.id))
                                  ? prev
                                  : [...prev, String(activeAssignmentOverlay.id)],
                              );
                            }}
                            sx={{
                              textTransform: 'none',
                              color: activeAssignmentOverlay.overlayTextColor || '#f5f1e7',
                              border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.2)',
                            }}
                          >
                            {tt('Senere', 'Later')}
                          </Button>
                          <Button
                            size="small"
                            onClick={() => {
                              if (isStudentMode) {
                                setLocation(
                                  studentSelectedAssignmentRoute(String(activeAssignmentOverlay.id)),
                                );
                                return;
                              }
                              const query = new URLSearchParams();
                              if (activeCourse?.id) query.set('courseId', String(activeCourse.id));
                              query.set('assignmentId', String(activeAssignmentOverlay.id));
                              if (activeLesson?.id) query.set('lessonId', String(activeLesson.id));
                              setLocation(`/academy/assignments?${query.toString()}`);
                            }}
                            sx={{
                              textTransform: 'none',
                              color: activeAssignmentOverlay.overlayPrimaryButtonTextColor || '#1a1306',
                              background: activeAssignmentOverlay.overlayPrimaryButtonColor || '#d99622',
                              fontWeight: 700,
                              '&:hover': { filter: 'brightness(1.08)' },
                            }}
                          >
                            {tt('Se oppgave', 'Open assignment')}
                          </Button>
                        </Stack>
                      </Stack>
                    </Box>
                  )}

                  {!isSplitScreenPresentationActive && activePresentationOverlay && (
                    <Box sx={activePresentationOverlaySx}>
                      <Stack spacing={0.8} sx={{ p: 1.1, height: '100%' }}>
                        <Stack direction="row" spacing={0.7} alignItems="center" flexWrap="wrap" useFlexGap>
                          <Chip
                            size="small"
                            label={tt('Presentasjon', 'Presentation')}
                            sx={{ bgcolor: 'rgba(248,179,33,0.2)', color: '#f5f1e7' }}
                          />
                          <Chip
                            size="small"
                            label={`${formatTime(Number(activePresentationOverlay.startTime || 0))}-${formatTime(Number(activePresentationOverlay.endTime || 0))}`}
                            sx={{ bgcolor: 'rgba(255,255,255,0.12)', color: '#f5f1e7' }}
                          />
                          <Chip
                            size="small"
                            label={activePresentationOverlay.scope === 'skill' ? tt('Ferdighet', 'Skill') : tt('Kurs', 'Course')}
                            sx={{ bgcolor: 'rgba(79,195,247,0.18)', color: '#d7f3ff' }}
                          />
                        </Stack>

                        <Box
                          sx={{
                            flex: 1,
                            minHeight: 0,
                            borderRadius: 1,
                            border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.16)',
                            background:
                              'linear-gradient(145deg, rgba(22,29,42,0.95), rgba(9,13,20,0.98)), radial-gradient(circle at 82% 16%, rgba(248,179,33,0.18), rgba(0,0,0,0))',
                            p: 1,
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between',
                          }}
                        >
                          {activePresentationOverlay.slideImageUrl && (
                            <Box
                              sx={{
                                borderRadius: 0.7,
                                overflow: 'hidden',
                                border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.18)',
                                mb: 0.8,
                              }}
                            >
                              <Box
                                component="img"
                                src={activePresentationOverlay.slideImageUrl}
                                alt={activePresentationOverlay.slideTitle}
                                sx={{ width: '100%', height: 152, objectFit: 'cover', display: 'block' }}
                              />
                            </Box>
                          )}
                          <Stack direction="row" spacing={0.8} alignItems="center">
                            <Slideshow sx={{ color: '#f8d56f' }} />
                            <Typography sx={{ fontWeight: 700, color: '#f5f1e7' }}>
                              {activePresentationOverlay.slideTitle}
                            </Typography>
                          </Stack>

                          <Typography sx={{ color: alpha('#f5f1e7', 0.9), fontSize: 13 }}>
                            {activePresentationOverlay.deckName} · #{activePresentationOverlay.sourceSlideNumber}
                          </Typography>

                          <Typography sx={{ color: alpha('#f5f1e7', 0.76), fontSize: 12 }}>
                            {activePresentationOverlay.sourceName || activePresentationOverlay.template}
                          </Typography>
                        </Box>
                      </Stack>
                    </Box>
                  )}

                  {activeCtaOverlay && (
                    <Box
                      sx={{
                        position: 'absolute',
                        top: 22,
                        right: 22,
                        width: 'min(74%, 430px)',
                        borderRadius: 1.2,
                        border: 'var(--academy-hairline-width, 1px) solid rgba(248,179,33,0.56)',
                        background: 'linear-gradient(180deg, rgba(13,16,24,0.92), rgba(8,11,18,0.95))',
                        boxShadow: '0 14px 34px rgba(0,0,0,0.42)',
                        p: 1.2,
                        zIndex: 3,
                      }}
                    >
                      <Stack spacing={0.7}>
                        <Stack direction="row" spacing={0.7} alignItems="center" flexWrap="wrap" useFlexGap>
                          <Chip
                            size="small"
                            label={tt('CTA', 'CTA')}
                            sx={{ bgcolor: 'rgba(248,179,33,0.2)', color: '#f5f1e7' }}
                          />
                          <Chip
                            size="small"
                            label={`${formatTime(activeCtaOverlay.triggerAt)}-${formatTime(activeCtaOverlay.endAt)}`}
                            sx={{ bgcolor: 'rgba(255,255,255,0.12)', color: '#f5f1e7' }}
                          />
                          <Chip
                            size="small"
                            label={activeCtaOverlay.scope === 'skill' ? tt('Ferdighet', 'Skill') : tt('Kurs', 'Course')}
                            sx={{ bgcolor: 'rgba(79,195,247,0.18)', color: '#d7f3ff' }}
                          />
                        </Stack>
                        <Typography
                          sx={{
                            fontSize: 'clamp(1rem, 0.74rem + 0.64vw, 1.7rem)',
                            color: '#f5f1e7',
                            fontWeight: 700,
                            lineHeight: 1.1,
                          }}
                        >
                          {activeCtaOverlay.title}
                        </Typography>
                        <Typography sx={{ color: alpha('#f5f1e7', 0.9), fontSize: 13 }}>
                          {activeCtaOverlay.subtitle || activeCtaOverlay.name}
                        </Typography>
                        <Stack direction="row" spacing={0.8} justifyContent="flex-end">
                          <Button
                            size="small"
                            onClick={() => {
                              if (
                                activeCtaOverlay.url &&
                                activeCtaOverlay.url !== '#' &&
                                typeof window !== 'undefined'
                              ) {
                                window.open(activeCtaOverlay.url, '_blank', 'noopener,noreferrer');
                              }
                              analytics.trackEvent('academy_cta_overlay_clicked', {
                                courseId: activeCourse?.id || null,
                                lessonId: activeLesson?.id || null,
                                overlayId: activeCtaOverlay.id,
                                scope: activeCtaOverlay.scope,
                                timestamp: Date.now(),
                              });
                            }}
                            sx={{
                              textTransform: 'none',
                              color: '#1a1306',
                              background: '#d99622',
                              fontWeight: 700,
                              '&:hover': { filter: 'brightness(1.08)' },
                            }}
                          >
                            {activeCtaOverlay.primaryLabel || tt('Åpne', 'Open')}
                          </Button>
                        </Stack>
                      </Stack>
                    </Box>
                  )}

                  {activeLowerThird && (
                    <Box
                      sx={{
                        position: 'absolute',
                        left: 24,
                        bottom: 142,
                        width: 'min(68%, 560px)',
                        zIndex: 2,
                        pointerEvents: 'none',
                      }}
                    >
                      <Box
                        sx={{
                          borderRadius: 1.1,
                          border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.22)',
                          background: 'linear-gradient(180deg, rgba(10,14,22,0.94), rgba(8,11,18,0.96))',
                          p: 1.2,
                          pl: 1.6,
                          boxShadow: '0 14px 30px rgba(0,0,0,0.4)',
                          position: 'relative',
                        }}
                      >
                        <Box
                          sx={{
                            position: 'absolute',
                            left: 8,
                            top: 8,
                            bottom: 8,
                            width: 4,
                            borderRadius: 1,
                            bgcolor: '#f8b321',
                          }}
                        />
                        <Typography
                          sx={{
                            color: '#f5f1e7',
                            fontWeight: 700,
                            fontSize: 'clamp(1rem, 0.72rem + 0.8vw, 1.55rem)',
                            lineHeight: 1.08,
                          }}
                        >
                          {activeLowerThird.title}
                        </Typography>
                        <Typography
                          sx={{
                            color: alpha('#f5f1e7', 0.9),
                            fontSize: 13,
                            mt: 0.2,
                          }}
                        >
                          {activeLowerThird.subtitle || activeLowerThird.name}
                        </Typography>
                      </Box>
                    </Box>
                  )}

                  <Box
                    sx={{
                      position: 'absolute',
                      left: '50%',
                      bottom: 24,
                      transform: 'translateX(-50%)',
                      width: 'min(84%, 900px)',
                      borderRadius: 1,
                      border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.12)',
                      background: 'linear-gradient(180deg, rgba(13,16,24,0.9), rgba(8,11,18,0.95))',
                      p: 1.6,
                    }}
                  >
                    <Typography sx={{ fontSize: 'clamp(1rem, 0.82rem + 0.9vw, 1.38rem)', fontWeight: 600, mb: 1, textAlign: 'left' }}>
                      {activeQuiz.question}
                    </Typography>

                    <Stack spacing={0.8}>
                      {activeQuiz.choices.map((choice) => {
                        const selected = quizAnswer === choice.id;
                        const showCorrect = quizSubmitted && choice.isCorrect;
                        const showWrong = quizSubmitted && selected && !choice.isCorrect;
                        return (
                          <Button
                            key={choice.id}
                            onClick={() => {
                              if (quizSubmitted) return;
                              setQuizAnswer(choice.id);
                            }}
                            sx={{
                              justifyContent: 'flex-start',
                              textTransform: 'none',
                              color: '#edf0f7',
                              borderRadius: 0.8,
                              border: `var(--academy-hairline-width, 1px) solid ${
                                showCorrect
                                  ? 'rgba(248,179,33,0.85)'
                                  : showWrong
                                    ? 'rgba(255,108,108,0.7)'
                                    : selected
                                      ? 'rgba(248,179,33,0.5)'
                                      : 'rgba(255,255,255,0.18)'
                              }`,
                              background:
                                showCorrect
                                  ? 'linear-gradient(90deg, rgba(248,179,33,0.22), rgba(248,179,33,0.08))'
                                  : selected
                                    ? 'linear-gradient(90deg, rgba(248,179,33,0.16), rgba(255,255,255,0.03))'
                                    : 'rgba(0,0,0,0.2)',
                            }}
                          >
                            <Stack direction="row" spacing={1} alignItems="center" sx={{ width: '100%' }}>
                              <Chip
                                label={choice.label}
                                size="small"
                                sx={{ bgcolor: 'rgba(255,255,255,0.08)', color: '#edf0f7' }}
                              />
                              <Typography sx={{ textAlign: 'left' }}>{choice.text}</Typography>
                              <Box sx={{ ml: 'auto' }}>{showCorrect && <Check sx={{ color: '#f8d56f' }} />}</Box>
                            </Stack>
                          </Button>
                        );
                      })}
                    </Stack>

                    <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: 1.1 }}>
                      <Chip label={formatTime(activeQuiz.timestamp)} size="small" sx={{ bgcolor: 'rgba(248,179,33,0.2)', color: '#f8d56f' }} />
                      <Typography sx={{ color: 'rgba(237,240,247,0.72)', fontSize: 13 }}>{activeQuiz.helper}</Typography>
                      <Button
                        onClick={handleQuizSubmit}
                        disabled={!quizAnswer || quizSubmitted}
                        sx={{
                          ml: 'auto',
                          textTransform: 'none',
                          color: '#0f0f0f',
                          background: 'linear-gradient(180deg, #ffd44e, #f2a616)',
                          '&.Mui-disabled': {
                            color: 'rgba(255,255,255,0.55)',
                            background: 'rgba(255,255,255,0.12)',
                          },
                        }}
                      >
                        {quizSubmitted ? tt('Sendt inn', 'Submitted') : tt('Send inn', 'Submit')}
                      </Button>
                    </Stack>
                  </Box>
                </AcademyPlayerStudio>

                {isSplitScreenPresentationActive && activePresentationOverlay && (
                  <Box
                    sx={{
                      borderRadius: 1,
                      border: 'var(--academy-hairline-width, 1px) solid rgba(248,179,33,0.48)',
                      background:
                        'linear-gradient(160deg, rgba(16,22,33,0.96), rgba(8,12,19,0.98)), radial-gradient(circle at 84% 14%, rgba(248,179,33,0.2), rgba(0,0,0,0))',
                      minHeight: { xs: 220, md: 360 },
                      maxHeight: { lg: 'calc(100vh - 360px)' },
                      overflow: 'hidden',
                      display: 'flex',
                      flexDirection: 'column',
                    }}
                  >
                    <Stack spacing={0.9} sx={{ p: 1.1, height: '100%', minHeight: 0 }}>
                      <Stack direction="row" spacing={0.7} alignItems="center" flexWrap="wrap" useFlexGap>
                        <Chip
                          size="small"
                          label={tt('Presentasjon', 'Presentation')}
                          sx={{ bgcolor: 'rgba(248,179,33,0.2)', color: '#f5f1e7' }}
                        />
                        <Chip
                          size="small"
                          label={tt('Split-skjerm', 'Split screen')}
                          sx={{ bgcolor: 'rgba(120,187,255,0.2)', color: '#d8ecff' }}
                        />
                        <Chip
                          size="small"
                          label={`${formatTime(Number(activePresentationOverlay.startTime || 0))}-${formatTime(Number(activePresentationOverlay.endTime || 0))}`}
                          sx={{ bgcolor: 'rgba(255,255,255,0.12)', color: '#f5f1e7' }}
                        />
                      </Stack>

                      <Box
                        sx={{
                          borderRadius: 0.9,
                          overflow: 'hidden',
                          border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.16)',
                          bgcolor: '#ffffff',
                          minHeight: 160,
                        }}
                      >
                        {activePresentationOverlay.slideImageUrl ? (
                          <Box
                            component="img"
                            src={activePresentationOverlay.slideImageUrl}
                            alt={activePresentationOverlay.slideTitle}
                            sx={{
                              width: '100%',
                              height: '100%',
                              minHeight: { xs: 160, md: 240 },
                              maxHeight: { lg: 420 },
                              objectFit: 'contain',
                              objectPosition: 'center center',
                              display: 'block',
                              bgcolor: '#ffffff',
                            }}
                          />
                        ) : (
                          <Box
                            sx={{
                              display: 'grid',
                              placeItems: 'center',
                              minHeight: { xs: 160, md: 240 },
                              color: alpha('#f5f1e7', 0.74),
                              fontSize: 13,
                            }}
                          >
                            {tt('Ingen slide-preview tilgjengelig', 'No slide preview available')}
                          </Box>
                        )}
                      </Box>

                      <Stack spacing={0.45}>
                        <Stack direction="row" spacing={0.8} alignItems="center">
                          <Slideshow sx={{ color: '#f8d56f' }} />
                          <Typography sx={{ fontWeight: 700, color: '#f5f1e7' }}>
                            {activePresentationOverlay.slideTitle}
                          </Typography>
                        </Stack>
                        <Typography sx={{ color: alpha('#f5f1e7', 0.9), fontSize: 13 }}>
                          {activePresentationOverlay.deckName} · #{activePresentationOverlay.sourceSlideNumber}
                        </Typography>
                        <Typography sx={{ color: alpha('#f5f1e7', 0.75), fontSize: 12 }}>
                          {activePresentationOverlay.sourceName || activePresentationOverlay.template}
                        </Typography>
                      </Stack>
                    </Stack>
                  </Box>
                )}
                </Box>

                <Box sx={{ mt: 1.1, ...cinematicPanelSx, p: 0.9 }}>
                  <Stack direction="row" spacing={0.8} alignItems="center">
                    <IconButton size="small" onClick={() => skipBy(-10)} sx={{ color: '#edf0f7' }}>
                      <FastRewind fontSize="small" />
                    </IconButton>
                    <IconButton size="small" onClick={togglePlayback} sx={{ color: '#edf0f7' }}>
                      {isPlaying ? <Pause fontSize="small" /> : <PlayArrow fontSize="small" />}
                    </IconButton>
                    <IconButton size="small" onClick={() => skipBy(10)} sx={{ color: '#edf0f7' }}>
                      <FastForward fontSize="small" />
                    </IconButton>
                    <Divider orientation="vertical" flexItem sx={{ borderColor: 'rgba(255,255,255,0.12)' }} />
                    <IconButton size="small" onClick={() => goToChapter(chapters[0])} sx={{ color: '#edf0f7' }}>
                      <SkipPrevious fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => {
                        const index = chapters.findIndex((chapter) => chapter.id === selectedChapterId);
                        const next = chapters[Math.min(index + 1, chapters.length - 1)];
                        if (next) goToChapter(next);
                      }}
                      sx={{ color: '#edf0f7' }}
                    >
                      <SkipNext fontSize="small" />
                    </IconButton>

                    <Slider
                      value={currentTime}
                      onChange={handleSeek}
                      min={0}
                      max={duration || 1}
                      sx={{
                        mx: 1,
                        color: '#f8b321',
                        '& .MuiSlider-thumb': {
                          width: 12,
                          height: 12,
                        },
                      }}
                    />

                    <Typography sx={{ minWidth: 92, fontSize: 13, color: 'rgba(237,240,247,0.78)' }}>
                      {formatTime(currentTime)} / {formatTime(duration)}
                    </Typography>

                    <IconButton size="small" onClick={() => setMuted((prev) => !prev)} sx={{ color: '#edf0f7' }}>
                      {muted ? <VolumeOff fontSize="small" /> : <VolumeUp fontSize="small" />}
                    </IconButton>
                    <Slider
                      value={muted ? 0 : volume * 100}
                      onChange={(_, value) => {
                        const next = Array.isArray(value) ? value[0] : value;
                        setVolume(next / 100);
                        if (next > 0 && muted) {
                          setMuted(false);
                        }
                      }}
                      min={0}
                      max={100}
                      sx={{ width: 90, color: '#f8b321' }}
                    />

                    <Select
                      size="small"
                      value={speed}
                      onChange={(event) => handleSpeedChange(Number(event.target.value))}
                      sx={{
                        minWidth: 74,
                        color: '#edf0f7',
                        '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.16)' },
                      }}
                    >
                      {speedOptions.map((option) => (
                        <MenuItem key={`speed-${option}`} value={option}>{option}x</MenuItem>
                      ))}
                    </Select>

                    <IconButton size="small" onClick={toggleSubtitles} sx={{ color: state.settings.subtitles ? '#f8d56f' : '#edf0f7' }}>
                      <Subtitles fontSize="small" />
                    </IconButton>

                    <IconButton size="small" onClick={handleBookmark} sx={{ color: '#edf0f7' }}>
                      <Bookmark fontSize="small" />
                    </IconButton>
                  </Stack>
                </Box>

                <Box sx={{ mt: 1, ...cinematicPanelSx, p: 0.9 }}>
                  <Stack direction="row" spacing={0.8} alignItems="center">
                    <TextField
                      size="small"
                      placeholder={tt('Legg til notat med tidskode og læringspoeng...', 'Add a timestamped learning note...')}
                      value={noteDraft}
                      onChange={(event) => setNoteDraft(event.target.value)}
                      sx={{
                        flex: 1,
                        '& .MuiInputBase-root': {
                          color: '#edf0f7',
                          bgcolor: 'rgba(10,13,20,0.68)',
                        },
                      }}
                    />
                    <Button
                      onClick={handleAddNote}
                      startIcon={<Mic />}
                      sx={{
                        textTransform: 'none',
                        color: '#edf0f7',
                        border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.18)',
                      }}
                      >
                        {tt('Legg til notat', 'Add Note')}
                      </Button>
                    {isStudentMode ? (
                      <Button
                        onClick={() => setLocation(studentResourcesRoute)}
                        startIcon={<Search />}
                        sx={{
                          textTransform: 'none',
                          color: '#edf0f7',
                          border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.18)',
                        }}
                      >
                        {tt('Ressurser', 'Resources')}
                      </Button>
                    ) : (
                      <Button
                        onClick={() => setLocation('/academy/quiz-manager')}
                        startIcon={<Quiz />}
                        sx={{
                          textTransform: 'none',
                          color: '#edf0f7',
                          border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.18)',
                        }}
                      >
                        Quiz Studio
                      </Button>
                    )}
                  </Stack>
                  {isStudentMode ? (
                    <Typography sx={{ mt: 0.6, fontSize: 12, color: 'rgba(237,240,247,0.58)' }}>
                      {tt(
                        `Notatet lagres på ${formatTime(currentTime)} og brukes senere i gjennomgang av ukeplanen din.`,
                        `This note is saved at ${formatTime(currentTime)} and reused later in your weekly review.`,
                      )}
                    </Typography>
                  ) : null}
                </Box>
              </Box>

              {!!saveMessage && (
                <Typography sx={{ fontSize: 12, color: '#a8f7c4', px: 0.4 }}>
                  {saveMessage}
                </Typography>
              )}
            </Box>

            <Box sx={{ ...cinematicPanelSx, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
              {isStudentMode ? (
                <Box
                  sx={{
                    p: 1.1,
                    borderBottom: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.08)',
                    background: 'linear-gradient(180deg, rgba(15,18,27,0.96), rgba(10,13,20,0.94))',
                  }}
                >
                  <Typography sx={{ fontSize: 12, color: 'rgba(248,213,111,0.94)', fontWeight: 700 }}>
                    {tt('Neste steg', 'Next step')}
                  </Typography>
                  <Typography sx={{ mt: 0.45, fontWeight: 700 }}>
                    {studentNextAction.title}
                  </Typography>
                  <Typography sx={{ mt: 0.35, color: 'rgba(237,240,247,0.7)', fontSize: 13 }}>
                    {studentNextAction.detail}
                  </Typography>
                  <Stack direction="row" spacing={0.8} sx={{ mt: 0.85 }}>
                    <Button
                      size="small"
                      onClick={() => setLocation(studentSidebarNextActionRoute)}
                      sx={{
                        textTransform: 'none',
                        color: '#0f0f0f',
                        background: 'linear-gradient(180deg, #ffd44e, #f2a616)',
                        fontWeight: 700,
                      }}
                    >
                      {studentSidebarNextActionLabel}
                    </Button>
                    <Button
                      size="small"
                      onClick={() => setLocation(studentDashboardRoute)}
                      sx={{
                        textTransform: 'none',
                        color: '#edf0f7',
                        border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.16)',
                      }}
                    >
                      {tt('Til oversikt', 'Back to overview')}
                    </Button>
                  </Stack>
                </Box>
              ) : null}
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
                <Tab label={tt('Kapitler', 'Chapters')} value="chapters" />
                <Tab label={tt('Vis notater', 'Show Notes')} value="shownotes" />
                <Tab label={tt('Transkripsjon', 'Transcript')} value="transcript" />
              </Tabs>

              {rightTab === 'chapters' && (
                <Box sx={{ p: 1.2, display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ color: 'rgba(237,240,247,0.72)' }}>
                    <Typography sx={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      {tt('Kapitler', 'Chapters')}
                    </Typography>
                    <Typography sx={{ ml: 'auto', fontSize: 12 }}>
                      {activeLesson?.title || tt('Leksjon', 'Lesson')}
                    </Typography>
                  </Stack>

                  <Stack spacing={0.7}>
                    {chapters.map((chapter) => {
                      const active = chapter.id === selectedChapterId;
                      return (
                        <Button
                          key={chapter.id}
                          onClick={() => goToChapter(chapter)}
                          sx={{
                            justifyContent: 'flex-start',
                            textTransform: 'none',
                            color: '#edf0f7',
                            borderRadius: 1,
                            border: active ? 'var(--academy-hairline-width, 1px) solid rgba(248,179,33,0.62)' : 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.12)',
                            background: active
                              ? 'linear-gradient(90deg, rgba(248,179,33,0.18), rgba(248,179,33,0.03))'
                              : 'rgba(255,255,255,0.01)',
                          }}
                        >
                          <Stack direction="row" spacing={1} alignItems="center" sx={{ width: '100%' }}>
                            <Chip
                              label={chapter.icon}
                              size="small"
                              sx={{
                                bgcolor: active ? 'rgba(248,179,33,0.25)' : 'rgba(255,255,255,0.1)',
                                color: '#edf0f7',
                              }}
                            />
                            <Typography sx={{ textAlign: 'left' }}>{chapter.title}</Typography>
                            <Typography sx={{ ml: 'auto', color: 'rgba(237,240,247,0.67)', fontSize: 13 }}>
                              {formatTime(chapter.startTime)}
                            </Typography>
                          </Stack>
                        </Button>
                      );
                    })}
                  </Stack>

                  <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)' }} />

                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography sx={{ color: 'rgba(237,240,247,0.68)' }}>{tt('Undertekster', 'Subtitles')}</Typography>
                    <Button
                      onClick={toggleSubtitles}
                      size="small"
                      sx={{
                        ml: 'auto',
                        textTransform: 'none',
                        color: state.settings.subtitles ? '#f8d56f' : '#edf0f7',
                        border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.16)',
                      }}
                    >
                      {state.settings.subtitles ? tt('På', 'On') : tt('Av', 'Off')}
                    </Button>
                  </Stack>

                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography sx={{ color: 'rgba(237,240,247,0.68)' }}>{tt('Hastighet', 'Speed')}</Typography>
                    <Select
                      size="small"
                      value={speed}
                      onChange={(event) => handleSpeedChange(Number(event.target.value))}
                      sx={{
                        ml: 'auto',
                        minWidth: 82,
                        color: '#edf0f7',
                        '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.16)' },
                      }}
                    >
                      {speedOptions.map((option) => (
                        <MenuItem key={`right-speed-${option}`} value={option}>{option}x</MenuItem>
                      ))}
                    </Select>
                  </Stack>
                </Box>
              )}

              {rightTab === 'shownotes' && (
                <Box sx={{ p: 1.2, display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <Typography sx={{ fontWeight: 600 }}>{tt('Scenenotater', 'Scene Notes')}</Typography>
                  <Typography sx={{ color: 'rgba(237,240,247,0.75)', fontSize: 14 }}>
                    Focus on key-light direction and subject separation. Keep the subject well defined while preserving ambient highlights in the background.
                  </Typography>

                  <LinearProgress
                    variant="determinate"
                    value={duration > 0 ? clamp((currentTime / duration) * 100, 0, 100) : 0}
                    sx={{
                      height: 7,
                      borderRadius: 4,
                      bgcolor: 'rgba(255,255,255,0.1)',
                      '& .MuiLinearProgress-bar': {
                        background: 'linear-gradient(90deg, #f8b321, #f7d782)',
                      },
                    }}
                  />

                  <Stack spacing={0.9}>
                    {[
                      'Key light angle: 45° to camera left',
                      'Add subtle fill at 20% intensity',
                      'Keep practicals warm for depth',
                      'Push actor 1 meter from background',
                    ].map((note) => (
                      <Box
                        key={note}
                        sx={{
                          border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.1)',
                          borderRadius: 1,
                          px: 1,
                          py: 0.8,
                          bgcolor: 'rgba(11,14,22,0.7)',
                        }}
                      >
                        <Typography sx={{ fontSize: 13 }}>{note}</Typography>
                      </Box>
                    ))}
                  </Stack>
                </Box>
              )}

              {rightTab === 'transcript' && (
                <Box sx={{ p: 1.2, display: 'flex', flexDirection: 'column', gap: 1, minHeight: 0 }}>
                  <TextField
                    value={transcriptSearch}
                    onChange={(event) => setTranscriptSearch(event.target.value)}
                    placeholder={tt('Søk i transkripsjon...', 'Search transcript...')}
                    size="small"
                    InputProps={{
                      startAdornment: <Search fontSize="small" sx={{ mr: 0.7, color: 'rgba(237,240,247,0.58)' }} />,
                    }}
                    sx={{ '& .MuiInputBase-root': { bgcolor: 'rgba(10,13,20,0.78)', color: '#edf0f7' } }}
                  />

                  <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', pr: 0.3 }}>
                    <Stack spacing={0.8}>
                      {filteredTranscript.map((line) => (
                        <Box
                          key={line.id}
                          onClick={() => {
                            if (videoRef.current) {
                              videoRef.current.currentTime = line.timestamp;
                            }
                            setCurrentTime(line.timestamp);
                          }}
                          sx={{
                            border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.08)',
                            borderRadius: 1,
                            p: 1,
                            background: 'rgba(10,13,20,0.72)',
                            cursor: 'pointer',
                          }}
                        >
                          <Stack direction="row" alignItems="center" spacing={0.8}>
                            <Typography sx={{ fontWeight: 600 }}>{line.speaker}</Typography>
                            <Typography sx={{ color: 'rgba(237,240,247,0.62)', fontSize: 12 }}>
                              {formatTime(line.timestamp)}
                            </Typography>
                          </Stack>
                          <Typography sx={{ color: 'rgba(237,240,247,0.78)', fontSize: 14, mt: 0.3 }}>
                            {line.text}
                          </Typography>
                        </Box>
                      ))}

                      {filteredTranscript.length === 0 && (
                        <Typography sx={{ color: 'rgba(237,240,247,0.62)', fontSize: 13, py: 2, textAlign: 'center' }}>
                          {tt('Ingen transkripsjonslinjer funnet.', 'No transcript lines found.')}
                        </Typography>
                      )}
                    </Stack>
                  </Box>
                </Box>
              )}

              <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)' }} />

              <Stack direction="row" spacing={1} sx={{ p: 1.1 }}>
                <Button
                  startIcon={<Settings />}
                  onClick={() => setRightTab('chapters')}
                  sx={{
                    flex: 1,
                    textTransform: 'none',
                    color: '#edf0f7',
                    border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.18)',
                  }}
                >
                  {isStudentMode ? tt('Kapitler', 'Chapters') : tt('Spiller', 'Player')}
                </Button>
                {isStudentMode ? (
                  <Button
                    startIcon={<Search />}
                    onClick={() => setLocation(studentResourcesRoute)}
                    sx={{
                      flex: 1,
                      textTransform: 'none',
                      color: '#edf0f7',
                      border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.18)',
                    }}
                  >
                    {tt('Ressurser', 'Resources')}
                  </Button>
                ) : (
                  <Button
                    startIcon={<Quiz />}
                    onClick={() => setLocation('/academy/quiz-manager')}
                    sx={{
                      flex: 1,
                      textTransform: 'none',
                      color: '#edf0f7',
                      border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.18)',
                    }}
                  >
                    Quiz Studio
                  </Button>
                )}
                <Button
                  onClick={() => {
                    if (onCancel) {
                      onCancel();
                    } else if (isStudentMode) {
                      setLocation(studentDashboardRoute);
                    } else {
                      setLocation('/academy/course-creator');
                    }
                  }}
                  sx={{
                    textTransform: 'none',
                    color: 'rgba(237,240,247,0.76)',
                    border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.16)',
                  }}
                >
                  {isStudentMode ? tt('Til oversikt', 'Back to overview') : 'Close'}
                </Button>
              </Stack>
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

export default withUniversalIntegration(AcademyVideoPlayerStudio, {
  componentId: 'academy-video-player-studio',
  componentName: 'Academy Video Player Studio',
  componentType: 'player',
  componentCategory: 'academy',
  featureIds: ['video-player-academy', 'chapter-manager', 'annotation-editor', 'assessment'],
});
