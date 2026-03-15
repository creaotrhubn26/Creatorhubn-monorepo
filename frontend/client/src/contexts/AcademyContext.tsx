/**
 * CreatorHub Academy Context
 * Manages course data, progress tracking, and learning analytics
 */

import React, { createContext, useContext, useReducer, useCallback, useEffect, useMemo, useRef } from 'react';
import { useEnhancedMasterIntegration } from '../integration/EnhancedMasterIntegrationProvider';
import { useDynamicProfessions } from '../components/universal/hooks/useDynamicProfessions';
import { useProfessionConfigs } from '@/hooks/useProfessionConfigs';
import { useProfessionAdapter } from '@/hooks/useProfessionAdapter';
import {
  buildUrlMediaFingerprint,
  normalizeMediaAssetId,
  normalizeMediaVersion,
} from '@/utils/academyMediaLinkUtils';
import getProfessionIcon from '@/utils/profession-icons';

// Types
export interface Course {
  id: string;
  title: string;
  description: string;
  instructor: {
    id: string;
    name: string;
    avatar: string;
    bio: string;
    profession: 'photographer' | 'videographer' | 'music_producer' | 'vendor' | 'enterprise';
};
  thumbnail: string;
  videoUrl: string;
  linkedVideoAssetId?: string;
  linkedVideoAssetVersion?: number;
  linkedVideoAssetName?: string;
  linkedVideoUpdatedAt?: string;
  linkedVideoFingerprint?: string;
  linkedVideoPosterUrl?: string;
  duration: number; // in seconds
  level: 'beginner' | 'intermediate' | 'advanced';
  category: 'photography' | 'videography' | 'music_production' | 'lighting' | 'wedding' | 'business' | 'techniques' | 'equipment';
  tags: string[];
  price: number;
  isFree: boolean;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
  rating: number;
  studentCount: number;
  competencyLeadInstructorId?: string;
  curriculumProjectTemplateId?: string;
  lessons: Lesson[];
  prerequisites: string[];
  learningOutcomes: string[];
  pedagogicalArchitecture?: PedagogicalArchitecture;
  resources: CourseResource[];
}

export interface AcademyInstructor {
  id: string;
  name: string;
  avatar: string;
  bio: string;
  profession: 'photographer' | 'videographer' | 'music_producer' | 'vendor' | 'enterprise';
  expertise: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PedagogicalArchitecture {
  purpose: string;
  audience: string;
  transformation: string;
  skillMap: PedagogicalSkillMapItem[];
  competencyMap?: PedagogicalCompetencyMapItem[];
  problemsSolved: string[];
  learningJourney: string;
  practiceDesign: string;
  proofOfLearning: string;
  competencies: string[];
  skills: string[];
  transformations: string[];
  studioSuggestions?: PedagogicalStudioSuggestions;
}

export interface PedagogicalSkillMapItem {
  id: string;
  title: string;
  focus: string;
}

export type PedagogicalCompetencyLevel = 'basic' | 'operational' | 'advanced';

export interface PedagogicalCompetencyMapItem {
  id: string;
  title: string;
  description: string;
  basic: string[];
  operational: string[];
  advanced: string[];
  locked?: boolean;
}

export interface PedagogicalSkillSuggestion {
  id: string;
  title: string;
  competency: string;
  level: PedagogicalCompetencyLevel;
  objective: string;
  recommendedDurationMinutes: number;
  locked?: boolean;
}

export type PedagogicalQuizSuggestionType =
  | 'single-choice'
  | 'multi-select'
  | 'true-false'
  | 'short-answer';

export interface PedagogicalQuizSuggestionOption {
  label: string;
  text: string;
  isCorrect: boolean;
  explanation?: string;
}

export interface PedagogicalQuizSuggestion {
  id: string;
  prompt: string;
  hint: string;
  competency: string;
  skillTitle?: string;
  level: PedagogicalCompetencyLevel;
  type: PedagogicalQuizSuggestionType;
  options: PedagogicalQuizSuggestionOption[];
  acceptedAnswers?: string[];
  explanation?: string;
  timestampRatio: number;
  duration: number;
  tags: string[];
  locked?: boolean;
}

export type PedagogicalAnnotationSuggestionType =
  | 'hotspot'
  | 'callout'
  | 'note'
  | 'quiz'
  | 'link'
  | 'image'
  | 'video';

export type PedagogicalAnnotationSuggestionActionType =
  | 'navigate'
  | 'showContent'
  | 'openLink'
  | 'playVideo'
  | 'showQuiz';

export interface PedagogicalAnnotationSuggestion {
  id: string;
  type: PedagogicalAnnotationSuggestionType;
  title: string;
  content: string;
  competency: string;
  skillTitle?: string;
  level: PedagogicalCompetencyLevel;
  startRatio: number;
  endRatio: number;
  actionType?: PedagogicalAnnotationSuggestionActionType;
  actionTarget?: string;
  locked?: boolean;
}

export interface PedagogicalStudioSuggestions {
  skills: PedagogicalSkillSuggestion[];
  quiz: PedagogicalQuizSuggestion[];
  annotations: PedagogicalAnnotationSuggestion[];
}

export interface Lesson {
  id: string;
  courseId: string;
  title: string;
  description: string;
  videoUrl: string;
  linkedVideoAssetId?: string;
  linkedVideoAssetVersion?: number;
  linkedVideoAssetName?: string;
  linkedVideoUpdatedAt?: string;
  linkedVideoFingerprint?: string;
  linkedVideoPosterUrl?: string;
  videoInstructorId?: string;
  thumbnail?: string;
  thumbnailZoom?: number;
  thumbnailFocalX?: number;
  thumbnailFocalY?: number;
  duration: number;
  order: number;
  isPreview: boolean;
  updatedAt?: string;
  resources: LessonResource[];
  quiz?: Quiz;
}

export interface CourseResource {
  id: string;
  type: 'pdf' | 'video' | 'audio' | 'image' | 'link' | 'code';
  title: string;
  url: string;
  description: string;
  size?: number;
  mediaAssetId?: string;
  mediaVersion?: number;
  mediaUpdatedAt?: string;
  mediaFingerprint?: string;
  mediaPosterUrl?: string;
}

export interface LessonResource {
  id: string;
  type: 'pdf' | 'video' | 'audio' | 'image' | 'link' | 'code';
  title: string;
  url: string;
  description: string;
  size?: number;
  mediaAssetId?: string;
  mediaVersion?: number;
  mediaUpdatedAt?: string;
  mediaFingerprint?: string;
  mediaPosterUrl?: string;
}

export interface Quiz {
  id: string;
  questions: QuizQuestion[];
  passingScore: number;
  timeLimit?: number;
}

export interface QuizQuestion {
  id: string;
  question: string;
  type: 'multiple-choice' | 'true-false' | 'text';
  options?: string[];
  correctAnswer: string | number;
  explanation?: string;
}

export interface StudentProgress {
  courseId: string;
  lessonId: string;
  progress: number; // 0-100
  completedAt?: string;
  lastWatchedAt: string;
  notes: string[];
  bookmarks: number[]; // timestamps in seconds
}

export interface Enrollment {
  id: string;
  courseId: string;
  studentId: string;
  enrolledAt: string;
  completedAt?: string;
  progress: StudentProgress[];
  certificateUrl?: string;
}

export interface AcademySettings {
  autoPlay: boolean;
  playbackSpeed: number;
  quality: '360p' | '720p' | '1080p' | '4k';
  subtitles: boolean;
  notesEnabled: boolean;
  bookmarksEnabled: boolean;
  downloadEnabled: boolean;
  offlineMode: boolean;
}

// State
interface AcademyState {
  courses: Course[];
  instructors: AcademyInstructor[];
  enrollments: Enrollment[];
  currentCourse: Course | null;
  currentLesson: Lesson | null;
  progress: StudentProgress[];
  settings: AcademySettings;
  isLoading: boolean;
  error: string | null;
  searchQuery: string;
  selectedCategory: string;
  sortBy: 'newest' | 'popular' | 'rating' | 'duration' | 'price';
  filterLevel: string;
  filterPrice: 'free' | 'paid' | 'all';
}

// Actions
type AcademyAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_COURSES'; payload: Course[] }
  | { type: 'SET_INSTRUCTORS'; payload: AcademyInstructor[] }
  | { type: 'ADD_INSTRUCTOR'; payload: AcademyInstructor }
  | { type: 'UPDATE_INSTRUCTOR'; payload: AcademyInstructor }
  | { type: 'DELETE_INSTRUCTOR'; payload: string }
  | { type: 'ADD_COURSE'; payload: Course }
  | { type: 'UPDATE_COURSE'; payload: Course }
  | { type: 'DELETE_COURSE'; payload: string }
  | { type: 'SET_CURRENT_COURSE'; payload: Course | null }
  | { type: 'SET_CURRENT_LESSON'; payload: Lesson | null }
  | { type: 'SET_PROGRESS'; payload: StudentProgress[] }
  | { type: 'UPDATE_PROGRESS'; payload: StudentProgress }
  | { type: 'SET_ENROLLMENTS'; payload: Enrollment[] }
  | { type: 'ADD_ENROLLMENT'; payload: Enrollment }
  | { type: 'SET_SETTINGS'; payload: AcademySettings }
  | { type: 'SET_SEARCH_QUERY'; payload: string }
  | { type: 'SET_SELECTED_CATEGORY'; payload: string }
  | { type: 'SET_SORT_BY'; payload: AcademyState['sortBy'] }
  | { type: 'SET_FILTER_LEVEL'; payload: string }
  | { type: 'SET_FILTER_PRICE'; payload: AcademyState['filterPrice'] };

// Initial state
const initialState: AcademyState = {
  courses: [],
  instructors: [],
  enrollments: [],
  currentCourse: null,
  currentLesson: null,
  progress: [],
  settings: {
    autoPlay: true,
    playbackSpeed: 1,
    quality: '1080p',
    subtitles: false,
    notesEnabled: true,
    bookmarksEnabled: true,
    downloadEnabled: false,
    offlineMode: false,
},
  isLoading: false,
  error: null,
  searchQuery: ', ',
  selectedCategory: 'all',
  sortBy: 'newest',
  filterLevel: 'all',
  filterPrice: 'all',
};

const ACADEMY_SETTINGS_STORAGE_KEY = 'academySettings';
const ACADEMY_COURSES_STORAGE_KEY = 'academyCourses';
const ACADEMY_INSTRUCTORS_STORAGE_KEY = 'academyInstructors';
const ACADEMY_CURRENT_COURSE_STORAGE_KEY = 'academyCurrentCourseId';
const ACADEMY_PROGRESS_STORAGE_KEY = 'academyProgress';
const ACADEMY_ENROLLMENTS_STORAGE_KEY = 'academyEnrollments';

const isAcademyPathname = (pathname: string): boolean => {
  if (!pathname) return false;
  return /^\/academy(?:$|[/-])/.test(pathname) || pathname === '/academy-dashboard';
};

const normalizeAcademyNavigationTarget = (
  target: string | URL | null | undefined,
  courseId: string,
): string | URL | null | undefined => {
  if (!target || !courseId || typeof window === 'undefined') return target;

  const raw = typeof target === 'string' ? target : String(target);
  if (!raw) return target;

  // Skip non-web protocols such as mailto:, tel:, data:, etc.
  const protocolMatch = raw.match(/^([a-zA-Z][a-zA-Z0-9+\-.]*):/);
  if (protocolMatch && !/^https?$/i.test(protocolMatch[1])) {
    return target;
  }

  try {
    const parsed = new URL(raw, window.location.origin);
    if (parsed.origin !== window.location.origin) return target;
    if (!isAcademyPathname(parsed.pathname)) return target;
    if (parsed.searchParams.has('courseId') || parsed.searchParams.has('course_id')) {
      return target;
    }

    parsed.searchParams.set('courseId', courseId);
    const normalized = `${parsed.pathname}${parsed.search}${parsed.hash}`;
    return normalized;
  } catch {
    return target;
  }
};

const getRouteCourseId = (): string | null => {
  if (typeof window === 'undefined') return null;
  try {
    const params = new URLSearchParams(window.location.search);
    const value = params.get('courseId') || params.get('course_id');
    if (!value) return null;
    const trimmed = String(value).trim();
    return trimmed.length > 0 ? trimmed : null;
  } catch (_error) {
    return null;
  }
};

const tryParseJson = <T,>(value: unknown): T | null => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as T;
    } catch {
      return null;
    }
  }
  return value as T;
};

const upsertProgressEntry = (list: StudentProgress[], entry: StudentProgress): StudentProgress[] => {
  const index = list.findIndex(
    (item) => String(item.courseId) === String(entry.courseId) && String(item.lessonId) === String(entry.lessonId),
  );
  if (index === -1) return [...list, entry];
  return list.map((item, itemIndex) => (itemIndex === index ? entry : item));
};

const ACADEMY_PROFESSIONS = [
  'photographer',
  'videographer',
  'music_producer',
  'vendor',
  'enterprise',
] as const;

const uniqueNonEmptyStrings = (values: unknown[]): string[] => {
  const normalized = values
    .map((value) => String(value || '').trim())
    .filter((value) => value.length > 0);
  return Array.from(new Set(normalized));
};

const normalizeInstructorProfession = (
  value: unknown,
): AcademyInstructor['profession'] => {
  const candidate = String(value || '').trim().toLowerCase();
  if ((ACADEMY_PROFESSIONS as readonly string[]).includes(candidate)) {
    return candidate as AcademyInstructor['profession'];
  }
  return 'videographer';
};

const normalizeCourseInstructor = (
  input: Course['instructor'] | null | undefined,
): Course['instructor'] => {
  const fallback: Course['instructor'] = {
    id: 'academy-instructor',
    name: 'Academy Instructor',
    avatar: '',
    bio: 'Academy instructor profile',
    profession: 'videographer',
  };
  const source = input && typeof input === 'object' ? input : fallback;
  const id = String(source.id || fallback.id).trim() || fallback.id;
  const name = String(source.name || fallback.name).trim() || fallback.name;
  const avatar = String(source.avatar || '').trim();
  const bio = String(source.bio || fallback.bio).trim() || fallback.bio;
  const profession = normalizeInstructorProfession(source.profession);
  return { id, name, avatar, bio, profession };
};

const normalizeInstructorProfile = (
  input: Partial<AcademyInstructor>,
  fallbackId?: string,
): AcademyInstructor => {
  const now = new Date().toISOString();
  const generatedId = `academy-instructor-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const id = String(input.id || fallbackId || generatedId).trim() || generatedId;
  const name = String(input.name || '').trim() || 'Academy Instructor';
  const avatar = String(input.avatar || '').trim();
  const bio = String(input.bio || '').trim() || 'Academy instructor profile';
  const expertise = uniqueNonEmptyStrings(
    Array.isArray(input.expertise) ? input.expertise : [],
  );
  const isActive = input.isActive !== false;
  const createdAt = String(input.createdAt || '').trim() || now;
  const updatedAt = String(input.updatedAt || '').trim() || now;

  return {
    id,
    name,
    avatar,
    bio,
    profession: normalizeInstructorProfession(input.profession),
    expertise,
    isActive,
    createdAt,
    updatedAt,
  };
};

const mergeInstructorProfiles = (
  current: AcademyInstructor,
  incoming: AcademyInstructor,
): AcademyInstructor => {
  const expertise = uniqueNonEmptyStrings([
    ...current.expertise,
    ...incoming.expertise,
  ]);
  const currentUpdatedAt = Date.parse(current.updatedAt);
  const incomingUpdatedAt = Date.parse(incoming.updatedAt);
  const updatedAt =
    Number.isFinite(incomingUpdatedAt) &&
    (!Number.isFinite(currentUpdatedAt) || incomingUpdatedAt >= currentUpdatedAt)
      ? incoming.updatedAt
      : current.updatedAt;

  return {
    ...current,
    name: incoming.name || current.name,
    avatar: incoming.avatar || current.avatar,
    bio: incoming.bio || current.bio,
    profession: incoming.profession || current.profession,
    expertise,
    // Preserve explicit admin state from the existing profile.
    isActive: current.isActive,
    updatedAt,
  };
};

const normalizeCourseResourceRecord = <T extends CourseResource | LessonResource>(
  resource: T,
): T => {
  const url = String(resource.url || '').trim();
  const mediaPosterUrl = String(resource.mediaPosterUrl || '').trim() || undefined;
  const mediaAssetId = normalizeMediaAssetId(resource.mediaAssetId);
  const mediaVersion = mediaAssetId
    ? normalizeMediaVersion(resource.mediaVersion, 1)
    : undefined;
  const mediaUpdatedAt = String(resource.mediaUpdatedAt || '').trim() || undefined;
  const mediaFingerprint =
    String(resource.mediaFingerprint || '').trim() ||
    (url ? buildUrlMediaFingerprint(url) : '') ||
    undefined;

  return {
    ...resource,
    url,
    title: String(resource.title || '').trim(),
    description: String(resource.description || '').trim(),
    size: Number.isFinite(Number(resource.size)) ? Number(resource.size) : undefined,
    mediaAssetId: mediaAssetId || undefined,
    mediaVersion,
    mediaUpdatedAt,
    mediaFingerprint,
    mediaPosterUrl,
  };
};

const inferLinkedVideoFromResources = (
  videoUrl: string,
  resources: Array<CourseResource | LessonResource>,
): {
  assetId?: string;
  version?: number;
  updatedAt?: string;
  fingerprint?: string;
  name?: string;
  posterUrl?: string;
} => {
  const normalizedUrl = String(videoUrl || '').trim();
  if (!normalizedUrl) return {};

  const match = resources.find((resource) => {
    const resourceUrl = String(resource.url || '').trim();
    const resourceAssetId = normalizeMediaAssetId(resource.mediaAssetId);
    return resourceAssetId.length > 0 && resourceUrl === normalizedUrl;
  });

  if (!match) return {};

  return {
    assetId: normalizeMediaAssetId(match.mediaAssetId) || undefined,
    version: normalizeMediaVersion(match.mediaVersion, 1),
    updatedAt: String(match.mediaUpdatedAt || '').trim() || undefined,
    fingerprint:
      String(match.mediaFingerprint || '').trim() ||
      buildUrlMediaFingerprint(match.url) ||
      undefined,
    name: String(match.title || '').trim() || undefined,
    posterUrl: String(match.mediaPosterUrl || '').trim() || undefined,
  };
};

const normalizeCourseRecord = (course: Course): Course => {
  const safeInstructor = normalizeCourseInstructor(course.instructor);
  const leadInstructorId =
    String(course.competencyLeadInstructorId || safeInstructor.id || '').trim() ||
    safeInstructor.id;
  const normalizedResources = Array.isArray(course.resources)
    ? course.resources.map((resource) => normalizeCourseResourceRecord(resource))
    : [];
  const normalizedLessons = Array.isArray(course.lessons)
    ? course.lessons.map((lesson) => {
        const normalizedLessonResources = Array.isArray(lesson.resources)
          ? lesson.resources.map((resource) => normalizeCourseResourceRecord(resource))
          : [];
        const lessonInstructorId = String(
          lesson.videoInstructorId || leadInstructorId,
        ).trim();
        const inferredLinkedVideo = inferLinkedVideoFromResources(
          String(lesson.videoUrl || ''),
          [...normalizedLessonResources, ...normalizedResources],
        );
        const linkedVideoAssetId =
          normalizeMediaAssetId(lesson.linkedVideoAssetId) ||
          inferredLinkedVideo.assetId ||
          '';
        const linkedVideoAssetVersion = linkedVideoAssetId
          ? normalizeMediaVersion(
              lesson.linkedVideoAssetVersion,
              inferredLinkedVideo.version || 1,
            )
          : undefined;
        const linkedVideoUpdatedAt =
          String(lesson.linkedVideoUpdatedAt || '').trim() ||
          inferredLinkedVideo.updatedAt ||
          undefined;
        const linkedVideoAssetName =
          String(lesson.linkedVideoAssetName || '').trim() ||
          inferredLinkedVideo.name ||
          undefined;
        const linkedVideoFingerprint =
          String(lesson.linkedVideoFingerprint || '').trim() ||
          inferredLinkedVideo.fingerprint ||
          (String(lesson.videoUrl || '').trim()
            ? buildUrlMediaFingerprint(String(lesson.videoUrl || '').trim())
            : '') ||
          undefined;
        const linkedVideoPosterUrl =
          String(lesson.linkedVideoPosterUrl || '').trim() ||
          inferredLinkedVideo.posterUrl ||
          undefined;
        return {
          ...lesson,
          courseId: String(lesson.courseId || course.id),
          resources: normalizedLessonResources,
          videoInstructorId: lessonInstructorId || undefined,
          linkedVideoAssetId: linkedVideoAssetId || undefined,
          linkedVideoAssetVersion,
          linkedVideoUpdatedAt,
          linkedVideoAssetName,
          linkedVideoFingerprint,
          linkedVideoPosterUrl,
        };
      })
    : [];

  const inferredCourseLinkedVideo = inferLinkedVideoFromResources(
    String(course.videoUrl || ''),
    normalizedResources,
  );
  const courseLinkedVideoAssetId =
    normalizeMediaAssetId(course.linkedVideoAssetId) ||
    inferredCourseLinkedVideo.assetId ||
    '';
  const courseLinkedVideoAssetVersion = courseLinkedVideoAssetId
    ? normalizeMediaVersion(
        course.linkedVideoAssetVersion,
        inferredCourseLinkedVideo.version || 1,
      )
    : undefined;
  const courseLinkedVideoUpdatedAt =
    String(course.linkedVideoUpdatedAt || '').trim() ||
    inferredCourseLinkedVideo.updatedAt ||
    undefined;
  const courseLinkedVideoAssetName =
    String(course.linkedVideoAssetName || '').trim() ||
    inferredCourseLinkedVideo.name ||
    undefined;
  const courseLinkedVideoFingerprint =
    String(course.linkedVideoFingerprint || '').trim() ||
    inferredCourseLinkedVideo.fingerprint ||
    (String(course.videoUrl || '').trim()
      ? buildUrlMediaFingerprint(String(course.videoUrl || '').trim())
      : '') ||
    undefined;
  const courseLinkedVideoPosterUrl =
    String(course.linkedVideoPosterUrl || '').trim() ||
    inferredCourseLinkedVideo.posterUrl ||
    undefined;

  return {
    ...course,
    instructor: safeInstructor,
    competencyLeadInstructorId: leadInstructorId || undefined,
    linkedVideoAssetId: courseLinkedVideoAssetId || undefined,
    linkedVideoAssetVersion: courseLinkedVideoAssetVersion,
    linkedVideoUpdatedAt: courseLinkedVideoUpdatedAt,
    linkedVideoAssetName: courseLinkedVideoAssetName,
    linkedVideoFingerprint: courseLinkedVideoFingerprint,
    linkedVideoPosterUrl: courseLinkedVideoPosterUrl,
    lessons: normalizedLessons,
    resources: normalizedResources,
  };
};

const buildInstructorRoster = (
  courses: Course[],
  storedInstructors: AcademyInstructor[],
): AcademyInstructor[] => {
  const map = new Map<string, AcademyInstructor>();

  const upsert = (candidate: Partial<AcademyInstructor>, fallbackId?: string) => {
    const normalized = normalizeInstructorProfile(candidate, fallbackId);
    const existing = map.get(normalized.id);
    map.set(
      normalized.id,
      existing ? mergeInstructorProfiles(existing, normalized) : normalized,
    );
  };

  storedInstructors.forEach((instructor, index) => {
    upsert(instructor, `academy-instructor-${index + 1}`);
  });

  courses.forEach((course) => {
    const courseInstructor = normalizeCourseInstructor(course.instructor);
    const leadInstructorId = String(
      course.competencyLeadInstructorId || courseInstructor.id,
    ).trim() || courseInstructor.id;

    upsert(
      {
        id: leadInstructorId,
        name: courseInstructor.name,
        avatar: courseInstructor.avatar,
        bio: courseInstructor.bio,
        profession: courseInstructor.profession,
        expertise: [course.title],
        isActive: true,
      },
      leadInstructorId,
    );

    if (courseInstructor.id !== leadInstructorId) {
      upsert(
        {
          id: courseInstructor.id,
          name: courseInstructor.name,
          avatar: courseInstructor.avatar,
          bio: courseInstructor.bio,
          profession: courseInstructor.profession,
          expertise: [course.title],
          isActive: true,
        },
        courseInstructor.id,
      );
    }

    course.lessons.forEach((lesson) => {
      const lessonInstructorId = String(lesson.videoInstructorId || '').trim();
      if (!lessonInstructorId) return;
      const existing = map.get(lessonInstructorId);
      upsert(
        {
          id: lessonInstructorId,
          name: existing?.name || '',
          avatar: existing?.avatar || '',
          bio: existing?.bio || '',
          profession: existing?.profession || courseInstructor.profession,
          expertise: [lesson.title],
          isActive: existing?.isActive ?? true,
        },
        lessonInstructorId,
      );
    });
  });

  return Array.from(map.values()).sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
  );
};

// Reducer
function academyReducer(state: AcademyState, action: AcademyAction): AcademyState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload };
    case 'SET_COURSES':
      return { ...state, courses: action.payload };
    case 'SET_INSTRUCTORS':
      return { ...state, instructors: action.payload };
    case 'ADD_INSTRUCTOR':
      return { ...state, instructors: [...state.instructors, action.payload] };
    case 'UPDATE_INSTRUCTOR':
      return {
        ...state,
        instructors: state.instructors.map((instructor) =>
          String(instructor.id) === String(action.payload.id)
            ? action.payload
            : instructor,
        ),
      };
    case 'DELETE_INSTRUCTOR':
      return {
        ...state,
        instructors: state.instructors.filter(
          (instructor) => String(instructor.id) !== String(action.payload),
        ),
      };
    case 'ADD_COURSE':
      return { ...state, courses: [...state.courses, action.payload] };
    case 'UPDATE_COURSE':
      {
        const nextCourses = state.courses.map(course =>
          course.id === action.payload.id ? action.payload : course
        );
        const shouldSyncCurrentCourse =
          state.currentCourse && String(state.currentCourse.id) === String(action.payload.id);
        const nextCurrentCourse = shouldSyncCurrentCourse ? action.payload : state.currentCourse;
        const nextCurrentLesson = (() => {
          if (!nextCurrentCourse) return null;
          if (!state.currentLesson) return nextCurrentCourse.lessons[0] || null;
          return (
            nextCurrentCourse.lessons.find(
              (lesson) => String(lesson.id) === String(state.currentLesson?.id),
            ) ||
            nextCurrentCourse.lessons[0] ||
            null
          );
        })();
        return {
          ...state,
          courses: nextCourses,
          currentCourse: nextCurrentCourse,
          currentLesson: nextCurrentLesson,
      };
    }
    case 'DELETE_COURSE':
      {
        const nextCourses = state.courses.filter(course => course.id !== action.payload);
        const currentCourseRemoved =
          state.currentCourse && String(state.currentCourse.id) === String(action.payload);
        const nextCurrentCourse = currentCourseRemoved ? nextCourses[0] || null : state.currentCourse;
        const nextCurrentLesson = (() => {
          if (!nextCurrentCourse) return null;
          if (!state.currentLesson) return nextCurrentCourse.lessons[0] || null;
          return (
            nextCurrentCourse.lessons.find(
              (lesson) => String(lesson.id) === String(state.currentLesson?.id),
            ) ||
            nextCurrentCourse.lessons[0] ||
            null
          );
        })();
        return {
          ...state,
          courses: nextCourses,
          currentCourse: nextCurrentCourse,
          currentLesson: nextCurrentLesson,
      };
    }
    case 'SET_CURRENT_COURSE':
      return { ...state, currentCourse: action.payload };
    case 'SET_CURRENT_LESSON':
      return { ...state, currentLesson: action.payload };
    case 'SET_PROGRESS':
      return { ...state, progress: action.payload };
    case 'UPDATE_PROGRESS':
      return {
        ...state,
        progress: upsertProgressEntry(state.progress, action.payload),
    };
    case 'SET_ENROLLMENTS':
      return { ...state, enrollments: action.payload };
    case 'ADD_ENROLLMENT':
      return { ...state, enrollments: [...state.enrollments, action.payload] };
    case 'SET_SETTINGS':
      return { ...state, settings: action.payload };
    case 'SET_SEARCH_QUERY':
      return { ...state, searchQuery: action.payload };
    case 'SET_SELECTED_CATEGORY':
      return { ...state, selectedCategory: action.payload };
    case 'SET_SORT_BY':
      return { ...state, sortBy: action.payload };
    case 'SET_FILTER_LEVEL':
      return { ...state, filterLevel: action.payload };
    case 'SET_FILTER_PRICE':
      return { ...state, filterPrice: action.payload as 'free' | 'paid' | 'all' };
    default: return state;
}
}

// Context
interface AcademyContextType {
  // State
  state: AcademyState;
  
  // Course management
  loadCourses: () => Promise<void>;
  createCourse: (course: Omit<Course, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Course>;
  updateCourse: (course: Course) => Promise<void>;
  deleteCourse: (courseId: string) => Promise<void>;
  getCourse: (courseId: string) => Course | null;

  // Instructor management
  createInstructor: (
    instructor: Omit<AcademyInstructor, 'id' | 'createdAt' | 'updatedAt'>,
  ) => Promise<AcademyInstructor>;
  updateInstructor: (instructor: AcademyInstructor) => Promise<void>;
  deleteInstructor: (instructorId: string) => Promise<void>;
  getInstructor: (instructorId: string) => AcademyInstructor | null;
  
  // Lesson management
  createLesson: (lesson: Omit<Lesson, 'id'>) => Promise<Lesson>;
  updateLesson: (lesson: Lesson) => Promise<void>;
  deleteLesson: (lessonId: string) => Promise<void>;
  
  // Enrollment management
  enrollInCourse: (courseId: string) => Promise<Enrollment>;
  unenrollFromCourse: (courseId: string) => Promise<void>;
  getEnrollment: (courseId: string) => Enrollment | null;
  
  // Progress tracking
  updateProgress: (courseId: string, lessonId: string, progress: number) => Promise<void>;
  markLessonComplete: (courseId: string, lessonId: string) => Promise<void>;
  addBookmark: (courseId: string, lessonId: string, timestamp: number) => Promise<void>;
  removeBookmark: (courseId: string, lessonId: string, timestamp: number) => Promise<void>;
  addNote: (courseId: string, lessonId: string, note: string) => Promise<void>;
  
  // Settings
  updateSettings: (settings: Partial<AcademySettings>) => Promise<void>;
  
  // Search and filters
  setSearchQuery: (query: string) => void;
  setSelectedCategory: (category: string) => void;
  setSortBy: (sortBy: AcademyState['sortBy']) => void;
  setFilterLevel: (level: string) => void;
  setFilterPrice: (price: AcademyState['filterPrice']) => void;
  
  // Computed values
  filteredCourses: Course[];
  enrolledCourses: Course[];
  completedCourses: Course[];
  inProgressCourses: Course[];
  
  // Current course/lesson
  setCurrentCourse: (course: Course | null) => void;
  setCurrentLesson: (lesson: Lesson | null) => void;
  nextLesson: () => void;
  previousLesson: () => void;
}

const AcademyContext = createContext<AcademyContextType | null>(null);

// Provider
export const AcademyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(academyReducer, initialState);
  const hasLoadedCoursesRef = useRef(false);
  const { analytics, lifecycle, performance, debugging, communication, dataFlow, auth } = useEnhancedMasterIntegration();
  const academyRouteSnapshot =
    typeof window !== 'undefined'
      ? `${window.location.pathname}${window.location.search}`
      : '';
  
  // Profession system hooks
  const { professionConfigs, getUserProfessionColor } = useDynamicProfessions();
  const { professionConfigs: apiProfessionConfigs } = useProfessionConfigs();
  const professionAdapter = useProfessionAdapter();
  const currentProfession = professionAdapter.profession || 'photographer';
  const professionIcon = getProfessionIcon(currentProfession);
  const professionConfig = professionConfigs?.[currentProfession];
  const enhancedProfessionConfig = apiProfessionConfigs?.[currentProfession] || professionConfig;
  const professionColor = getUserProfessionColor(currentProfession) || '#FF6B35';
  const professionMeta = useMemo(() => {
    const iconElementType = professionIcon?.type;
    const iconName =
      typeof iconElementType === 'string'
        ? iconElementType
        : (iconElementType as { displayName?: string; name?: string })?.displayName ||
          (iconElementType as { displayName?: string; name?: string })?.name ||
          'unknown-icon';

    const professionLabel =
      String(
        enhancedProfessionConfig?.displayName ||
          enhancedProfessionConfig?.name ||
          currentProfession,
      ).trim() || currentProfession;

    return {
      professionId: currentProfession,
      professionLabel,
      professionColor,
      professionIcon: iconName,
    };
  }, [currentProfession, enhancedProfessionConfig, professionColor, professionIcon]);

  const readAcademyKV = useCallback(async <T,>(key: string): Promise<T | null> => {
    try {
      const response = await fetch(`/api/user/kv/${encodeURIComponent(key)}`, {
        credentials: 'include',
      });
      if (!response.ok) return null;
      const payload = await response.json().catch(() => null);
      const value =
        payload && typeof payload === 'object'
          ? (payload.value ?? payload.data ?? null)
          : null;

      if (value === null || value === undefined) return null;
      const parsed = tryParseJson<T>(value);
      return (parsed ?? (value as T)) ?? null;
    } catch {
      return null;
    }
  }, []);

  const writeAcademyKV = useCallback(async (key: string, value: unknown): Promise<boolean> => {
    try {
      const response = await fetch('/api/user/kv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ key, value }),
      });
      if (!response.ok) {
        console.warn('Failed to persist academy KV key', { key, status: response.status });
        return false;
      }
      return true;
    } catch (error) {
      console.warn('Error persisting academy KV key', {
        key,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }, []);

  const syncCurrentCourseSelection = useCallback(
    (courses: Course[], persistedCourseId?: string | null) => {
      if (!Array.isArray(courses) || courses.length === 0) {
        dispatch({ type: 'SET_CURRENT_COURSE', payload: null });
        dispatch({ type: 'SET_CURRENT_LESSON', payload: null });
        void writeAcademyKV(ACADEMY_CURRENT_COURSE_STORAGE_KEY, null);
        return;
      }

      const routeCourseId = getRouteCourseId();
      const preferredIds = [
        routeCourseId,
        persistedCourseId,
        state.currentCourse?.id ? String(state.currentCourse.id) : null,
      ].filter(Boolean) as string[];

      const matchedCourse =
        preferredIds
          .map((id) => courses.find((course) => String(course.id) === String(id)))
          .find((course): course is Course => Boolean(course)) || courses[0];

      dispatch({ type: 'SET_CURRENT_COURSE', payload: matchedCourse });
      void writeAcademyKV(ACADEMY_CURRENT_COURSE_STORAGE_KEY, String(matchedCourse.id));

      const matchedLesson =
        (state.currentLesson
          ? matchedCourse.lessons.find(
              (lesson) => String(lesson.id) === String(state.currentLesson?.id),
            )
          : null) ||
        matchedCourse.lessons[0] ||
        null;
      dispatch({ type: 'SET_CURRENT_LESSON', payload: matchedLesson });
    },
    [state.currentCourse?.id, state.currentLesson, writeAcademyKV],
  );

  // Enforce course context in Academy route navigation so all tabs/tools stay synchronized.
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const routeCourseId = getRouteCourseId();
    const courseId = String(state.currentCourse?.id || routeCourseId || '').trim();
    if (!courseId) return;

    const originalPushState = window.history.pushState.bind(window.history);
    const originalReplaceState = window.history.replaceState.bind(window.history);

    const normalizeTarget = (
      url: string | URL | null | undefined,
    ): string | URL | null | undefined =>
      normalizeAcademyNavigationTarget(url, courseId);

    const patchedPushState: History['pushState'] = (data, unused, url) =>
      originalPushState(data, unused, normalizeTarget(url) as string | URL | null | undefined);

    const patchedReplaceState: History['replaceState'] = (data, unused, url) =>
      originalReplaceState(data, unused, normalizeTarget(url) as string | URL | null | undefined);

    (window.history as History).pushState = patchedPushState;
    (window.history as History).replaceState = patchedReplaceState;

    // Also normalize the current Academy URL once when course context becomes available.
    const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    const normalizedCurrent = normalizeTarget(currentUrl);
    if (typeof normalizedCurrent === 'string' && normalizedCurrent !== currentUrl) {
      originalReplaceState(window.history.state, document.title, normalizedCurrent);
    }

    return () => {
      (window.history as History).pushState = originalPushState;
      (window.history as History).replaceState = originalReplaceState;
    };
  }, [academyRouteSnapshot, state.currentCourse?.id]);

  // Component registration
  useEffect(() => {
    const endTiming = performance.startTiming('academy_context_render');
    
    // Register with communication system
    communication.registerComponent('academy-context', 'context', [
      'data:read', 'data:write', 'event:emit', 'event:listen',
    ]);

    // Register dataFlow nodes for bi-directional data flow
    dataFlow.registerNode({
      type: 'source',
      componentId: 'academy-context',
      dataKey: 'academy-courses',
    });

    dataFlow.registerNode({
      type: 'source',
      componentId: 'academy-context',
      dataKey: 'academy-progress',
    });

    dataFlow.registerNode({
      type: 'source',
      componentId: 'academy-context',
      dataKey: 'academy-current-course',
    });

    dataFlow.registerNode({
      type: 'source',
      componentId: 'academy-context',
      dataKey: 'academy-enrollments',
    });
    
    lifecycle.registerComponent({
      id: 'AcademyContext',
      type: 'context-provider',
      version: '1.0.0',
      capabilities: {
        data: ['course:read','course:write','progress:track','enrollment:manage'],
        events: ['course:created','course:updated','lesson:completed','progress:updated'],
        actions: ['course:create','course:update','progress:update','enrollment:create'],
        ui: ['course-list','video-player','progress-tracker'],
        system: ['analytics:track','performance:monitor','debug:log']
    },
      dependencies: ['EnhancedMasterIntegrationProvider'],
      lastActive: Date.now(),
      performance: {
        renderCount: 0,
        avgRenderTime: 0,
        memoryUsage: 0
    }
  });

    analytics.trackEvent('academy_context_mounted', {
      componentId: 'AcademyContext',
      ...professionMeta,
      timestamp: Date.now()
  });

    debugging.logIntegration('info','AcademyContext mounted', {
      componentId: 'AcademyContext',
      ...professionMeta,
      capabilities: ['course:read','course:write','progress:track']
  });

    return () => {
      endTiming();
      communication.unregisterComponent('academy-context');
      dataFlow.unregisterNode('academy-courses');
      dataFlow.unregisterNode('academy-progress');
      dataFlow.unregisterNode('academy-current-course');
      dataFlow.unregisterNode('academy-enrollments');
      lifecycle.unregisterComponent('AcademyContext');
      analytics.trackEvent('academy_context_unmounted', {
        componentId: 'AcademyContext',
        ...professionMeta,
        timestamp: Date.now()
    });
  };
}, [analytics, lifecycle, performance, debugging, communication, dataFlow, professionMeta]);

  // Load courses
  const loadCourses = useCallback(async () => {
    const endTiming = performance.startTiming('academy_load_courses');
    
    try {
      dispatch({ type: 'SET_LOADING', payload: true });

      const [dbCoursesRaw, dbCurrentCourseIdRaw, dbInstructorsRaw] = await Promise.all([
        readAcademyKV<unknown>(ACADEMY_COURSES_STORAGE_KEY),
        readAcademyKV<unknown>(ACADEMY_CURRENT_COURSE_STORAGE_KEY),
        readAcademyKV<unknown>(ACADEMY_INSTRUCTORS_STORAGE_KEY),
      ]);

      const dbCourses = Array.isArray(dbCoursesRaw) ? (dbCoursesRaw as Course[]) : null;
      const dbInstructors = Array.isArray(dbInstructorsRaw)
        ? (dbInstructorsRaw as AcademyInstructor[])
        : [];
      const dbCurrentCourseId =
        dbCurrentCourseIdRaw !== null && dbCurrentCourseIdRaw !== undefined
          ? String(dbCurrentCourseIdRaw)
          : null;

      if (dbCourses) {
        const normalizedCourses = dbCourses.map((course) => normalizeCourseRecord(course));
        const normalizedInstructors = buildInstructorRoster(
          normalizedCourses,
          dbInstructors,
        );

        dispatch({ type: 'SET_COURSES', payload: normalizedCourses });
        dispatch({ type: 'SET_INSTRUCTORS', payload: normalizedInstructors });
        syncCurrentCourseSelection(normalizedCourses, dbCurrentCourseId);
        await Promise.all([
          writeAcademyKV(ACADEMY_COURSES_STORAGE_KEY, normalizedCourses),
          writeAcademyKV(ACADEMY_INSTRUCTORS_STORAGE_KEY, normalizedInstructors),
        ]);

        analytics.trackEvent('academy_courses_loaded', {
          courseCount: normalizedCourses.length,
          instructorCount: normalizedInstructors.length,
          source: 'database',
          ...professionMeta,
          timestamp: Date.now(),
        });

        debugging.logIntegration('info', 'Courses loaded from database', {
          courseCount: normalizedCourses.length,
          instructorCount: normalizedInstructors.length,
        });
        return;
      }

      const emptyCourses: Course[] = [];
      const normalizedInstructors = dbInstructors.map((instructor, index) =>
        normalizeInstructorProfile(instructor, `academy-instructor-${index + 1}`),
      );
      dispatch({ type: 'SET_COURSES', payload: emptyCourses });
      dispatch({ type: 'SET_INSTRUCTORS', payload: normalizedInstructors });
      syncCurrentCourseSelection(emptyCourses, dbCurrentCourseId);
      await Promise.all([
        writeAcademyKV(ACADEMY_COURSES_STORAGE_KEY, emptyCourses),
        writeAcademyKV(ACADEMY_INSTRUCTORS_STORAGE_KEY, normalizedInstructors),
      ]);

      analytics.trackEvent('academy_courses_loaded', {
        courseCount: 0,
        instructorCount: normalizedInstructors.length,
        source: 'database_initialized',
        ...professionMeta,
        timestamp: Date.now(),
      });
      
      debugging.logIntegration('info','Academy courses initialized in database', {
        courseCount: 0,
        instructorCount: normalizedInstructors.length,
      });
      
  } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load courses';
      dispatch({ type: 'SET_ERROR', payload: errorMessage });
      
      analytics.trackEvent('academy_load_courses_failed', {
        error: errorMessage,
        ...professionMeta,
        timestamp: Date.now()
    });
      
      debugging.logIntegration('error','Failed to load courses', {
        error: errorMessage
    });
  } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
      endTiming();
  }
}, [
  analytics,
  performance,
  debugging,
  syncCurrentCourseSelection,
  professionMeta,
  readAcademyKV,
  writeAcademyKV,
]);

  // Create course
  const createCourse = useCallback(async (courseData: Omit<Course, 'id' | 'createdAt' | 'updatedAt'>): Promise<Course> => {
    const endTiming = performance.startTiming('academy_create_course');
    
    try {
      const newCourse: Course = normalizeCourseRecord({
        ...courseData,
        competencyLeadInstructorId: String(
          courseData.competencyLeadInstructorId || courseData.instructor?.id || '',
        ).trim() || undefined,
        id: `course-${Date.now()}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      
      const nextCourses = [...state.courses, newCourse];
      const nextInstructors = buildInstructorRoster(nextCourses, state.instructors);
      dispatch({ type: 'ADD_COURSE', payload: newCourse });
      dispatch({ type: 'SET_INSTRUCTORS', payload: nextInstructors });
      await Promise.all([
        writeAcademyKV(ACADEMY_COURSES_STORAGE_KEY, nextCourses),
        writeAcademyKV(ACADEMY_INSTRUCTORS_STORAGE_KEY, nextInstructors),
      ]);
      
      analytics.trackEvent('academy_course_created', {
        courseId: newCourse.id,
        courseTitle: newCourse.title,
        instructor: newCourse.instructor.name,
        category: newCourse.category,
        timestamp: Date.now()
 });
      
      debugging.logIntegration('info','Course created successfully', {
        courseId: newCourse.id,
        courseTitle: newCourse.title
 });
      
      endTiming();
      return newCourse;
  } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create course';
      dispatch({ type: 'SET_ERROR', payload: errorMessage });
      
      analytics.trackEvent('academy_create_course_failed', {
        error: errorMessage,
        timestamp: Date.now()
 });
      
      debugging.logIntegration('error','Failed to create course', {
        error: errorMessage
 });
      
      endTiming();
      throw error;
  }
}, [analytics, performance, debugging, state.courses, state.instructors, writeAcademyKV]);

  // Update course
  const updateCourse = useCallback(async (course: Course): Promise<void> => {
    const endTiming = performance.startTiming('academy_update_course');
    
    try {
      const updatedCourse = normalizeCourseRecord({
        ...course,
        updatedAt: new Date().toISOString(),
      });
      
      const nextCourses = state.courses.map((existingCourse) =>
        existingCourse.id === updatedCourse.id ? updatedCourse : existingCourse,
      );
      const nextInstructors = buildInstructorRoster(nextCourses, state.instructors);
      dispatch({ type: 'UPDATE_COURSE', payload: updatedCourse });
      dispatch({ type: 'SET_INSTRUCTORS', payload: nextInstructors });
      await Promise.all([
        writeAcademyKV(ACADEMY_COURSES_STORAGE_KEY, nextCourses),
        writeAcademyKV(ACADEMY_INSTRUCTORS_STORAGE_KEY, nextInstructors),
      ]);
      if (state.currentCourse && String(state.currentCourse.id) === String(updatedCourse.id)) {
        await writeAcademyKV(ACADEMY_CURRENT_COURSE_STORAGE_KEY, String(updatedCourse.id));
      }
      
      analytics.trackEvent('academy_course_updated', {
        courseId: course.id,
        courseTitle: course.title,
        timestamp: Date.now()
 });
      
      debugging.logIntegration('info','Course updated successfully', {
        courseId: course.id,
        courseTitle: course.title
 });
      
      endTiming();
  } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update course';
      dispatch({ type: 'SET_ERROR', payload: errorMessage });
      
      analytics.trackEvent('academy_update_course_failed', {
        courseId: course.id,
        error: errorMessage,
        timestamp: Date.now()
 });
      
      debugging.logIntegration('error','Failed to update course', {
        courseId: course.id,
        error: errorMessage
 });
      
      endTiming();
      throw error;
  }
}, [analytics, performance, debugging, state.courses, state.currentCourse, state.instructors, writeAcademyKV]);

  // Delete course
  const deleteCourse = useCallback(async (courseId: string): Promise<void> => {
    const endTiming = performance.startTiming('academy_delete_course');
    
    try {
      const nextCourses = state.courses.filter((course) => course.id !== courseId);
      const nextInstructors = buildInstructorRoster(nextCourses, state.instructors);
      dispatch({ type: 'DELETE_COURSE', payload: courseId });
      dispatch({ type: 'SET_INSTRUCTORS', payload: nextInstructors });
      await Promise.all([
        writeAcademyKV(ACADEMY_COURSES_STORAGE_KEY, nextCourses),
        writeAcademyKV(ACADEMY_INSTRUCTORS_STORAGE_KEY, nextInstructors),
      ]);
      if (state.currentCourse && String(state.currentCourse.id) === String(courseId)) {
        if (nextCourses[0]) {
          await writeAcademyKV(ACADEMY_CURRENT_COURSE_STORAGE_KEY, String(nextCourses[0].id));
        } else {
          await writeAcademyKV(ACADEMY_CURRENT_COURSE_STORAGE_KEY, null);
        }
      }
      
      analytics.trackEvent('academy_course_deleted', {
        courseId,
        timestamp: Date.now()
 });
      
      debugging.logIntegration('info','Course deleted successfully', {
        courseId
    });
      
      endTiming();
  } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete course';
      dispatch({ type: 'SET_ERROR', payload: errorMessage });
      
      analytics.trackEvent('academy_delete_course_failed', {
        courseId,
        error: errorMessage,
        timestamp: Date.now()
 });
      
      debugging.logIntegration('error','Failed to delete course', {
        courseId,
        error: errorMessage
 });
      
      endTiming();
      throw error;
  }
}, [analytics, performance, debugging, state.courses, state.currentCourse, state.instructors, writeAcademyKV]);

  // Get course
  const getCourse = useCallback((courseId: string): Course | null => {
    return state.courses.find(course => course.id === courseId) || null;
 }, [state.courses]);

  const getInstructor = useCallback((instructorId: string): AcademyInstructor | null => {
    return (
      state.instructors.find(
        (instructor) => String(instructor.id) === String(instructorId),
      ) || null
    );
  }, [state.instructors]);

  const createInstructor = useCallback(
    async (
      instructorData: Omit<AcademyInstructor, 'id' | 'createdAt' | 'updatedAt'>,
    ): Promise<AcademyInstructor> => {
      const now = new Date().toISOString();
      const newInstructor = normalizeInstructorProfile({
        ...instructorData,
        id: `academy-instructor-${Date.now()}`,
        createdAt: now,
        updatedAt: now,
      });
      const nextInstructors = [...state.instructors, newInstructor];
      dispatch({ type: 'ADD_INSTRUCTOR', payload: newInstructor });
      await writeAcademyKV(ACADEMY_INSTRUCTORS_STORAGE_KEY, nextInstructors);

      analytics.trackEvent('academy_instructor_created', {
        instructorId: newInstructor.id,
        instructorName: newInstructor.name,
        timestamp: Date.now(),
      });

      return newInstructor;
    },
    [analytics, state.instructors, writeAcademyKV],
  );

  const updateInstructor = useCallback(
    async (instructor: AcademyInstructor): Promise<void> => {
      const nextInstructor = normalizeInstructorProfile({
        ...instructor,
        updatedAt: new Date().toISOString(),
      }, instructor.id);
      const nextInstructors = state.instructors.map((entry) =>
        String(entry.id) === String(nextInstructor.id) ? nextInstructor : entry,
      );
      let hasCourseUpdates = false;
      const nextCourses = state.courses.map((course) => {
        const normalizedCourse = normalizeCourseRecord(course);
        const leadId = String(
          normalizedCourse.competencyLeadInstructorId ||
            normalizedCourse.instructor?.id ||
            '',
        ).trim();
        const courseInstructorId = String(normalizedCourse.instructor?.id || '').trim();
        const affectsCourse =
          leadId === String(nextInstructor.id) ||
          courseInstructorId === String(nextInstructor.id);
        if (!affectsCourse) return normalizedCourse;
        hasCourseUpdates = true;
        return {
          ...normalizedCourse,
          instructor: {
            id: nextInstructor.id,
            name: nextInstructor.name,
            avatar: nextInstructor.avatar,
            bio: nextInstructor.bio,
            profession: nextInstructor.profession,
          },
          competencyLeadInstructorId:
            leadId === String(nextInstructor.id)
              ? nextInstructor.id
              : normalizedCourse.competencyLeadInstructorId,
          updatedAt: new Date().toISOString(),
        };
      });

      dispatch({ type: 'UPDATE_INSTRUCTOR', payload: nextInstructor });
      if (hasCourseUpdates) {
        dispatch({ type: 'SET_COURSES', payload: nextCourses });
        syncCurrentCourseSelection(
          nextCourses,
          state.currentCourse?.id ? String(state.currentCourse.id) : null,
        );
      }
      await Promise.all([
        writeAcademyKV(ACADEMY_INSTRUCTORS_STORAGE_KEY, nextInstructors),
        hasCourseUpdates
          ? writeAcademyKV(ACADEMY_COURSES_STORAGE_KEY, nextCourses)
          : Promise.resolve(true),
      ]);

      analytics.trackEvent('academy_instructor_updated', {
        instructorId: nextInstructor.id,
        instructorName: nextInstructor.name,
        timestamp: Date.now(),
      });
    },
    [
      analytics,
      state.courses,
      state.currentCourse?.id,
      state.instructors,
      syncCurrentCourseSelection,
      writeAcademyKV,
    ],
  );

  const deleteInstructor = useCallback(
    async (instructorId: string): Promise<void> => {
      const targetId = String(instructorId || '').trim();
      if (!targetId) return;

      const nextInstructors = state.instructors.filter(
        (instructor) => String(instructor.id) !== targetId,
      );
      const fallbackInstructor = nextInstructors[0] || null;
      const fallbackInstructorId = fallbackInstructor?.id || '';

      const nextCourses = state.courses.map((course) => {
        const normalizedCourse = normalizeCourseRecord(course);
        const currentLeadId = String(
          normalizedCourse.competencyLeadInstructorId ||
            normalizedCourse.instructor?.id ||
            '',
        ).trim();
        const shouldReassignLead = currentLeadId === targetId;

        const nextCourseInstructor = shouldReassignLead && fallbackInstructor
          ? {
              id: fallbackInstructor.id,
              name: fallbackInstructor.name,
              avatar: fallbackInstructor.avatar,
              bio: fallbackInstructor.bio,
              profession: fallbackInstructor.profession,
            }
          : normalizedCourse.instructor;

        let lessonReassigned = false;
        const nextLessons = normalizedCourse.lessons.map((lesson) => {
          const lessonInstructorId = String(lesson.videoInstructorId || '').trim();
          if (lessonInstructorId !== targetId) return lesson;
          lessonReassigned = true;
          return {
            ...lesson,
            videoInstructorId: fallbackInstructorId || undefined,
          };
        });

        return {
          ...normalizedCourse,
          instructor: nextCourseInstructor,
          competencyLeadInstructorId: shouldReassignLead
            ? fallbackInstructorId || undefined
            : normalizedCourse.competencyLeadInstructorId,
          lessons: nextLessons,
          updatedAt:
            shouldReassignLead || lessonReassigned
              ? new Date().toISOString()
              : normalizedCourse.updatedAt,
        };
      });

      const normalizedInstructors = buildInstructorRoster(nextCourses, nextInstructors);
      dispatch({ type: 'SET_COURSES', payload: nextCourses });
      dispatch({ type: 'SET_INSTRUCTORS', payload: normalizedInstructors });
      syncCurrentCourseSelection(
        nextCourses,
        state.currentCourse?.id ? String(state.currentCourse.id) : null,
      );

      await Promise.all([
        writeAcademyKV(ACADEMY_COURSES_STORAGE_KEY, nextCourses),
        writeAcademyKV(ACADEMY_INSTRUCTORS_STORAGE_KEY, normalizedInstructors),
      ]);

      analytics.trackEvent('academy_instructor_deleted', {
        instructorId: targetId,
        reassignedTo: fallbackInstructorId || null,
        timestamp: Date.now(),
      });
    },
    [
      analytics,
      state.courses,
      state.currentCourse?.id,
      state.instructors,
      syncCurrentCourseSelection,
      writeAcademyKV,
    ],
  );

  // Create lesson
    const createLesson = useCallback(async (lessonData: Omit<Lesson, 'id'>): Promise<Lesson> => {
    const endTiming = performance.startTiming('academy_create_lesson');
    
    try {
      const course = getCourse(lessonData.courseId);
      const newLesson: Lesson = {
        ...lessonData,
        videoInstructorId:
          String(lessonData.videoInstructorId || course?.competencyLeadInstructorId || '').trim() || undefined,
        id: `lesson-${Date.now()}`,
    };
      
      // Update course with new lesson
      if (course) {
        const updatedCourse = normalizeCourseRecord({
          ...course,
          lessons: [...course.lessons, newLesson],
          updatedAt: new Date().toISOString(),
        });
        const nextCourses = state.courses.map((existingCourse) =>
          existingCourse.id === updatedCourse.id ? updatedCourse : existingCourse,
        );
        const nextInstructors = buildInstructorRoster(nextCourses, state.instructors);
        dispatch({ type: 'UPDATE_COURSE', payload: updatedCourse });
        dispatch({ type: 'SET_INSTRUCTORS', payload: nextInstructors });
        await Promise.all([
          writeAcademyKV(ACADEMY_COURSES_STORAGE_KEY, nextCourses),
          writeAcademyKV(ACADEMY_INSTRUCTORS_STORAGE_KEY, nextInstructors),
        ]);
    }
      
      analytics.trackEvent('academy_lesson_created', {
        lessonId: newLesson.id,
        courseId: lessonData.courseId,
        lessonTitle: newLesson.title,
        timestamp: Date.now()
 });
      
      debugging.logIntegration('info','Lesson created successfully', {
        lessonId: newLesson.id,
        courseId: lessonData.courseId
 });
      
      endTiming();
      return newLesson;
  } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create lesson';
      dispatch({ type: 'SET_ERROR', payload: errorMessage });
      
      analytics.trackEvent('academy_create_lesson_failed', {
        error: errorMessage,
        timestamp: Date.now()
 });
      
      debugging.logIntegration('error','Failed to create lesson', {
        error: errorMessage
 });
      
      endTiming();
      throw error;
  }
}, [analytics, debugging, getCourse, performance, state.courses, state.instructors, writeAcademyKV]);

  // Update lesson
  const updateLesson = useCallback(async (lesson: Lesson): Promise<void> => {
    const endTiming = performance.startTiming('academy_update_lesson');
    
    try {
      const course = getCourse(lesson.courseId);
      if (course) {
        const normalizedLesson = {
          ...lesson,
          videoInstructorId:
            String(lesson.videoInstructorId || course.competencyLeadInstructorId || '').trim() || undefined,
        };
        const updatedCourse = normalizeCourseRecord({
          ...course,
          lessons: course.lessons.map(l => l.id === lesson.id ? normalizedLesson : l),
          updatedAt: new Date().toISOString(),
        });
        const nextCourses = state.courses.map((existingCourse) =>
          existingCourse.id === updatedCourse.id ? updatedCourse : existingCourse,
        );
        const nextInstructors = buildInstructorRoster(nextCourses, state.instructors);
        dispatch({ type: 'UPDATE_COURSE', payload: updatedCourse });
        dispatch({ type: 'SET_INSTRUCTORS', payload: nextInstructors });
        await Promise.all([
          writeAcademyKV(ACADEMY_COURSES_STORAGE_KEY, nextCourses),
          writeAcademyKV(ACADEMY_INSTRUCTORS_STORAGE_KEY, nextInstructors),
        ]);
    }
      
      analytics.trackEvent('academy_lesson_updated', {
        lessonId: lesson.id,
        courseId: lesson.courseId,
        timestamp: Date.now()
 });
      
      debugging.logIntegration('info','Lesson updated successfully', {
        lessonId: lesson.id,
        courseId: lesson.courseId
 });
      
      endTiming();
  } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update lesson';
      dispatch({ type: 'SET_ERROR', payload: errorMessage });
      
      analytics.trackEvent('academy_update_lesson_failed', {
        error: errorMessage,
        timestamp: Date.now()
 });
      
      debugging.logIntegration('error','Failed to update lesson', {
        error: errorMessage
 });
      
      endTiming();
      throw error;
  }
}, [analytics, debugging, getCourse, performance, state.courses, state.instructors, writeAcademyKV]);

  // Delete lesson
  const deleteLesson = useCallback(async (lessonId: string): Promise<void> => {
    const endTiming = performance.startTiming('academy_delete_lesson');
    
    try {
      // Find course containing this lesson
      const course = state.courses.find(c => c.lessons.some(l => l.id === lessonId));
      if (course) {
        const updatedCourse = normalizeCourseRecord({
          ...course,
          lessons: course.lessons.filter(l => l.id !== lessonId),
          updatedAt: new Date().toISOString(),
        });
        const nextCourses = state.courses.map((existingCourse) =>
          existingCourse.id === updatedCourse.id ? updatedCourse : existingCourse,
        );
        const nextInstructors = buildInstructorRoster(nextCourses, state.instructors);
        dispatch({ type: 'UPDATE_COURSE', payload: updatedCourse });
        dispatch({ type: 'SET_INSTRUCTORS', payload: nextInstructors });
        await Promise.all([
          writeAcademyKV(ACADEMY_COURSES_STORAGE_KEY, nextCourses),
          writeAcademyKV(ACADEMY_INSTRUCTORS_STORAGE_KEY, nextInstructors),
        ]);
    }
      
      analytics.trackEvent('academy_lesson_deleted', {
        lessonId,
        timestamp: Date.now()
 });
      
      debugging.logIntegration('info','Lesson deleted successfully', {
        lessonId
    });
      
      endTiming();
  } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete lesson';
      dispatch({ type: 'SET_ERROR', payload: errorMessage });
      
      analytics.trackEvent('academy_delete_lesson_failed', {
        error: errorMessage,
        timestamp: Date.now()
 });
      
      debugging.logIntegration('error','Failed to delete lesson', {
        error: errorMessage
 });
      
      endTiming();
      throw error;
  }
}, [state.courses, state.instructors, analytics, performance, debugging, writeAcademyKV]);

  // Enroll in course
  const enrollInCourse = useCallback(async (courseId: string): Promise<Enrollment> => {
    const endTiming = performance.startTiming('academy_enroll_course');
    
    try {
      const user = auth.state.user;
      const resolvedStudentId =
        (user && typeof user === 'object' && 'id' in user && typeof user.id === 'string' && user.id.trim()) ||
        (user && typeof user === 'object' && 'sub' in user && typeof user.sub === 'string' && user.sub.trim()) ||
        (user && typeof user === 'object' && 'email' in user && typeof user.email === 'string' && user.email.trim()) ||
        'academy-anonymous';

      const enrollment: Enrollment = {
        id: `enrollment-${Date.now()}`,
        courseId,
        studentId: resolvedStudentId,
        enrolledAt: new Date().toISOString(),
        progress:  [],
    };
      
      const nextEnrollments = [...state.enrollments, enrollment];
      dispatch({ type: 'ADD_ENROLLMENT', payload: enrollment });
      await writeAcademyKV(ACADEMY_ENROLLMENTS_STORAGE_KEY, nextEnrollments);
      
      analytics.trackEvent('academy_course_enrolled', {
        courseId,
        enrollmentId: enrollment.id,
        timestamp: Date.now()
 });
      
      debugging.logIntegration('info','Course enrollment created', {
        courseId,
        enrollmentId: enrollment.id
 });
      
      endTiming();
      return enrollment;
  } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to enroll in course';
      dispatch({ type: 'SET_ERROR', payload: errorMessage });
      
      analytics.trackEvent('academy_enroll_course_failed', {
        courseId,
        error: errorMessage,
        timestamp: Date.now()
 });
      
      debugging.logIntegration('error','Failed to enroll in course', {
        courseId,
        error: errorMessage
 });
      
      endTiming();
      throw error;
  }
}, [analytics, performance, debugging, auth.state.user, state.enrollments, writeAcademyKV]);

  // Unenroll from course
  const unenrollFromCourse = useCallback(async (courseId: string): Promise<void> => {
    const endTiming = performance.startTiming('academy_unenroll_course');
    
    try {
      const updatedEnrollments = state.enrollments.filter(e => e.courseId !== courseId);
      dispatch({ type: 'SET_ENROLLMENTS', payload: updatedEnrollments });
      await writeAcademyKV(ACADEMY_ENROLLMENTS_STORAGE_KEY, updatedEnrollments);
      
      analytics.trackEvent('academy_course_unenrolled', {
        courseId,
        timestamp: Date.now()
 });
      
      debugging.logIntegration('info','Course unenrollment completed', {
        courseId
    });
      
      endTiming();
  } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to unenroll from course';
      dispatch({ type: 'SET_ERROR', payload: errorMessage });
      
      analytics.trackEvent('academy_unenroll_course_failed', {
        courseId,
        error: errorMessage,
        timestamp: Date.now()
 });
      
      debugging.logIntegration('error','Failed to unenroll from course', {
        courseId,
        error: errorMessage
 });
      
      endTiming();
      throw error;
  }
}, [state.enrollments, analytics, performance, debugging, writeAcademyKV]);

  // Get enrollment
  const getEnrollment = useCallback((courseId: string): Enrollment | null => {
    return state.enrollments.find(e => e.courseId === courseId) || null;
 }, [state.enrollments]);

  // Update progress
  const updateProgress = useCallback(async (courseId: string, lessonId: string, progress: number): Promise<void> => {
    const endTiming = performance.startTiming('academy_update_progress');
    
    try {
      const progressData: StudentProgress = {
        courseId,
        lessonId,
        progress,
        lastWatchedAt: new Date().toISOString(),
        notes:  [],
        bookmarks:  [],
    };
      
      const nextProgress = upsertProgressEntry(state.progress, progressData);
      dispatch({ type: 'UPDATE_PROGRESS', payload: progressData });
      await writeAcademyKV(ACADEMY_PROGRESS_STORAGE_KEY, nextProgress);
      
      analytics.trackEvent('academy_progress_updated', {
        courseId,
        lessonId,
        progress,
        timestamp: Date.now()
 });
      
      debugging.logIntegration('info','Progress updated', {
        courseId,
        lessonId,
        progress
    });
      
      endTiming();
  } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update progress';
      dispatch({ type: 'SET_ERROR', payload: errorMessage });
      
      analytics.trackEvent('academy_update_progress_failed', {
        courseId,
        lessonId,
        error: errorMessage,
        timestamp: Date.now()
 });
      
      debugging.logIntegration('error','Failed to update progress', {
        courseId,
        lessonId,
        error: errorMessage
 });
      
      endTiming();
      throw error;
  }
}, [analytics, performance, debugging, state.progress, writeAcademyKV]);

  // Mark lesson complete
  const markLessonComplete = useCallback(async (courseId: string, lessonId: string): Promise<void> => {
    const endTiming = performance.startTiming('academy_mark_lesson_complete');
    
    try {
      const progressData: StudentProgress = {
        courseId,
        lessonId,
        progress: 100,
        completedAt: new Date().toISOString(),
        lastWatchedAt: new Date().toISOString(),
        notes:  [],
        bookmarks:  [],
    };
      
      const nextProgress = upsertProgressEntry(state.progress, progressData);
      dispatch({ type: 'UPDATE_PROGRESS', payload: progressData });
      await writeAcademyKV(ACADEMY_PROGRESS_STORAGE_KEY, nextProgress);
      
      analytics.trackEvent('academy_lesson_completed', {
        courseId,
        lessonId,
        timestamp: Date.now()
 });
      
      debugging.logIntegration('info','Lesson marked as complete', {
        courseId,
        lessonId
    });
      
      endTiming();
  } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to mark lesson complete';
      dispatch({ type: 'SET_ERROR', payload: errorMessage });
      
      analytics.trackEvent('academy_mark_lesson_complete_failed', {
        courseId,
        lessonId,
        error: errorMessage,
        timestamp: Date.now()
 });
      
      debugging.logIntegration('error','Failed to mark lesson complete', {
        courseId,
        lessonId,
        error: errorMessage
 });
      
      endTiming();
      throw error;
  }
}, [analytics, performance, debugging, state.progress, writeAcademyKV]);

  // Add bookmark
  const addBookmark = useCallback(async (courseId: string, lessonId: string, timestamp: number): Promise<void> => {
    const endTiming = performance.startTiming('academy_add_bookmark');
    
    try {
      const existingProgress = state.progress.find(p => p.courseId === courseId && p.lessonId === lessonId);
      const updatedProgress: StudentProgress = {
        courseId,
        lessonId,
        progress: existingProgress?.progress || 0,
        completedAt: existingProgress?.completedAt,
        lastWatchedAt: new Date().toISOString(),
        notes: existingProgress?.notes || [],
        bookmarks: [...(existingProgress?.bookmarks || []), timestamp],
    };
      
      const nextProgress = upsertProgressEntry(state.progress, updatedProgress);
      dispatch({ type: 'UPDATE_PROGRESS', payload: updatedProgress });
      await writeAcademyKV(ACADEMY_PROGRESS_STORAGE_KEY, nextProgress);
      
      analytics.trackEvent('academy_bookmark_added', {
        courseId,
        lessonId,
        timestamp,
        eventTimestamp: Date.now()
 });
      
      debugging.logIntegration('info','Bookmark added', {
        courseId,
        lessonId,
        timestamp
    });
      
      endTiming();
  } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to add bookmark';
      dispatch({ type: 'SET_ERROR', payload: errorMessage });
      
      analytics.trackEvent('academy_add_bookmark_failed', {
        courseId,
        lessonId,
        error: errorMessage,
        timestamp: Date.now()
 });
      
      debugging.logIntegration('error','Failed to add bookmark', {
        courseId,
        lessonId,
        error: errorMessage
 });
      
      endTiming();
      throw error;
  }
}, [state.progress, analytics, performance, debugging, writeAcademyKV]);

  // Remove bookmark
  const removeBookmark = useCallback(async (courseId: string, lessonId: string, timestamp: number): Promise<void> => {
    const endTiming = performance.startTiming('academy_remove_bookmark');
    
    try {
      const existingProgress = state.progress.find(p => p.courseId === courseId && p.lessonId === lessonId);
      if (existingProgress) {
        const updatedProgress: StudentProgress = {
          ...existingProgress,
          bookmarks: existingProgress.bookmarks.filter(t => t !== timestamp),
      };
        
        dispatch({ type: 'UPDATE_PROGRESS', payload: updatedProgress });
        const nextProgress = upsertProgressEntry(state.progress, updatedProgress);
        await writeAcademyKV(ACADEMY_PROGRESS_STORAGE_KEY, nextProgress);
    }
      
      analytics.trackEvent('academy_bookmark_removed', {
        courseId,
        lessonId,
        timestamp,
        eventTimestamp: Date.now()
 });
      
      debugging.logIntegration('info','Bookmark removed', {
        courseId,
        lessonId,
        timestamp
    });
      
      endTiming();
  } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to remove bookmark';
      dispatch({ type: 'SET_ERROR', payload: errorMessage });
      
      analytics.trackEvent('academy_remove_bookmark_failed', {
        courseId,
        lessonId,
        error: errorMessage,
        timestamp: Date.now()
 });
      
      debugging.logIntegration('error','Failed to remove bookmark', {
        courseId,
        lessonId,
        error: errorMessage
 });
      
      endTiming();
      throw error;
  }
}, [state.progress, analytics, performance, debugging, writeAcademyKV]);

  // Add note
  const addNote = useCallback(async (courseId: string, lessonId: string, note: string): Promise<void> => {
    const endTiming = performance.startTiming('academy_add_note');
    
    try {
      const existingProgress = state.progress.find(p => p.courseId === courseId && p.lessonId === lessonId);
      const updatedProgress: StudentProgress = {
        courseId,
        lessonId,
        progress: existingProgress?.progress || 0,
        completedAt: existingProgress?.completedAt,
        lastWatchedAt: new Date().toISOString(),
        notes: [...(existingProgress?.notes || []), note],
        bookmarks: existingProgress?.bookmarks || [],
    };
      
      const nextProgress = upsertProgressEntry(state.progress, updatedProgress);
      dispatch({ type: 'UPDATE_PROGRESS', payload: updatedProgress });
      await writeAcademyKV(ACADEMY_PROGRESS_STORAGE_KEY, nextProgress);
      
      analytics.trackEvent('academy_note_added', {
        courseId,
        lessonId,
        noteLength: note.length,
        timestamp: Date.now()
 });
      
      debugging.logIntegration('info','Note added', {
        courseId,
        lessonId,
        noteLength: note.length
 });
      
      endTiming();
  } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to add note';
      dispatch({ type: 'SET_ERROR', payload: errorMessage });
      
      analytics.trackEvent('academy_add_note_failed', {
        courseId,
        lessonId,
        error: errorMessage,
        timestamp: Date.now()
 });
      
      debugging.logIntegration('error','Failed to add note', {
        courseId,
        lessonId,
        error: errorMessage
 });
      
      endTiming();
      throw error;
  }
}, [state.progress, analytics, performance, debugging, writeAcademyKV]);

  // Update settings
  const updateSettings = useCallback(async (settings: Partial<AcademySettings>): Promise<void> => {
    const endTiming = performance.startTiming('academy_update_settings');
    
    try {
      const updatedSettings = { ...state.settings, ...settings };
      dispatch({ type: 'SET_SETTINGS', payload: updatedSettings });
      
      await writeAcademyKV(ACADEMY_SETTINGS_STORAGE_KEY, updatedSettings);
      
      analytics.trackEvent('academy_settings_updated', {
        settings: Object.keys(settings),
        timestamp: Date.now()
 });
      
      debugging.logIntegration('info', 'Settings updated', {
        settings: Object.keys(settings)
 });
      
      endTiming();
  } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update settings';
      dispatch({ type: 'SET_ERROR', payload: errorMessage });
      
      analytics.trackEvent('academy_update_settings_failed', {
        error: errorMessage,
        timestamp: Date.now()
 });
      
      debugging.logIntegration('error', 'Failed to update settings', {
        error: errorMessage
 });
      
      endTiming();
      throw error;
  }
}, [state.settings, analytics, performance, debugging, writeAcademyKV]);

  // Search and filter functions
  const setSearchQuery = useCallback((query: string) => {
    dispatch({ type: 'SET_SEARCH_QUERY', payload: query });
}, []);

  const setSelectedCategory = useCallback((category: string) => {
    dispatch({ type: 'SET_SELECTED_CATEGORY', payload: category });
}, []);

  const setSortBy = useCallback((sortBy: AcademyState['sortBy']) => {
    dispatch({ type: 'SET_SORT_BY', payload: sortBy });
}, []);

  const setFilterLevel = useCallback((level: string) => {
    dispatch({ type: 'SET_FILTER_LEVEL', payload: level });
}, []);

  const setFilterPrice = useCallback((price: AcademyState['filterPrice']) => {
    dispatch({ type: 'SET_FILTER_PRICE', payload: price });
}, []);

  // Computed values
  const filteredCourses = useCallback(() => {
    let filtered = state.courses;

    // Search filter
    if (state.searchQuery) {
      const query = state.searchQuery.toLowerCase();
      filtered = filtered.filter(course =>
        course.title.toLowerCase().includes(query) ||
        course.description.toLowerCase().includes(query) ||
        course.instructor.name.toLowerCase().includes(query) ||
        course.tags.some(tag => tag.toLowerCase().includes(query))
      );
  }

    // Category filter
    if (state.selectedCategory !== 'all') {
      filtered = filtered.filter(course => course.category === state.selectedCategory);
  }

    // Level filter
    if (state.filterLevel !== 'all') {
      filtered = filtered.filter(course => course.level === state.filterLevel);
  }

    // Price filter
    if (state.filterPrice === 'free') {
      filtered = filtered.filter(course => course.isFree);
  } else if (state.filterPrice === 'paid') {
      filtered = filtered.filter(course => !course.isFree);
  }

    // Sort
    switch (state.sortBy) {
      case 'newest':
        filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        break;
      case 'popular':
        filtered.sort((a, b) => b.studentCount - a.studentCount);
        break;
      case 'rating':
        filtered.sort((a, b) => b.rating - a.rating);
        break;
      case 'duration':
        filtered.sort((a, b) => a.duration - b.duration);
        break;
      case 'price':
        filtered.sort((a, b) => a.price - b.price);
        break;
  }

    return filtered;
}, [state.courses, state.searchQuery, state.selectedCategory, state.filterLevel, state.filterPrice, state.sortBy]);

  const enrolledCourses = useCallback(() => {
    const enrolledCourseIds = state.enrollments.map(e => e.courseId);
    return state.courses.filter(course => enrolledCourseIds.includes(course.id));
}, [state.courses, state.enrollments]);

  const completedCourses = useCallback(() => {
    return enrolledCourses().filter(course => {
      const enrollment = getEnrollment(course.id);
      return enrollment?.completedAt;
  });
}, [enrolledCourses, getEnrollment]);

  const inProgressCourses = useCallback(() => {
    return enrolledCourses().filter(course => {
      const enrollment = getEnrollment(course.id);
      return enrollment && !enrollment.completedAt;
  });
}, [enrolledCourses, getEnrollment]);

  // Current course/lesson management
  const setCurrentCourse = useCallback((course: Course | null) => {
    dispatch({ type: 'SET_CURRENT_COURSE', payload: course });
    if (course?.id) {
      void writeAcademyKV(ACADEMY_CURRENT_COURSE_STORAGE_KEY, String(course.id));
      const matchedLesson =
        (state.currentLesson
          ? course.lessons.find((lesson) => String(lesson.id) === String(state.currentLesson?.id))
          : null) ||
        course.lessons[0] ||
        null;
      dispatch({ type: 'SET_CURRENT_LESSON', payload: matchedLesson });
      return;
    }
    void writeAcademyKV(ACADEMY_CURRENT_COURSE_STORAGE_KEY, null);
    dispatch({ type: 'SET_CURRENT_LESSON', payload: null });
}, [state.currentLesson, writeAcademyKV]);

  const setCurrentLesson = useCallback((lesson: Lesson | null) => {
    dispatch({ type: 'SET_CURRENT_LESSON', payload: lesson });
}, []);

  const nextLesson = useCallback(() => {
    if (state.currentCourse && state.currentLesson) {
      const currentIndex = state.currentCourse.lessons.findIndex(l => l.id === state.currentLesson?.id);
      if (currentIndex < state.currentCourse.lessons.length - 1) {
        const nextLesson = state.currentCourse.lessons[currentIndex + 1];
        setCurrentLesson(nextLesson);
    }
  }
}, [state.currentCourse, state.currentLesson, setCurrentLesson]);

  const previousLesson = useCallback(() => {
    if (state.currentCourse && state.currentLesson) {
      const currentIndex = state.currentCourse.lessons.findIndex(l => l.id === state.currentLesson?.id);
      if (currentIndex > 0) {
        const prevLesson = state.currentCourse.lessons[currentIndex - 1];
        setCurrentLesson(prevLesson);
    }
  }
}, [state.currentCourse, state.currentLesson, setCurrentLesson]);

  // Load persisted academy state from database on mount
  useEffect(() => {
    let isActive = true;

    const loadPersistedState = async () => {
      try {
        const [dbSettingsRaw, dbProgressRaw, dbEnrollmentsRaw] = await Promise.all([
          readAcademyKV<unknown>(ACADEMY_SETTINGS_STORAGE_KEY),
          readAcademyKV<unknown>(ACADEMY_PROGRESS_STORAGE_KEY),
          readAcademyKV<unknown>(ACADEMY_ENROLLMENTS_STORAGE_KEY),
        ]);

        if (!isActive) return;

        if (dbSettingsRaw && typeof dbSettingsRaw === 'object') {
          dispatch({ type: 'SET_SETTINGS', payload: dbSettingsRaw as AcademySettings });
        }

        if (Array.isArray(dbProgressRaw)) {
          dispatch({ type: 'SET_PROGRESS', payload: dbProgressRaw as StudentProgress[] });
        }

        if (Array.isArray(dbEnrollmentsRaw)) {
          dispatch({ type: 'SET_ENROLLMENTS', payload: dbEnrollmentsRaw as Enrollment[] });
        }
      } catch (error) {
        console.error('Failed to load academy persisted state:', error);
      }
    };

    void loadPersistedState();
    return () => {
      isActive = false;
    };
  }, [readAcademyKV]);

  // Load courses once on mount. `loadCourses` reference can change as context state updates.
  useEffect(() => {
    if (hasLoadedCoursesRef.current) return;
    hasLoadedCoursesRef.current = true;
    void loadCourses();
}, [loadCourses]);

  const contextValue: AcademyContextType = {
    state,
    loadCourses,
    createCourse,
    updateCourse,
    deleteCourse,
    getCourse,
    createInstructor,
    updateInstructor,
    deleteInstructor,
    getInstructor,
    createLesson,
    updateLesson,
    deleteLesson,
    enrollInCourse,
    unenrollFromCourse,
    getEnrollment,
    updateProgress,
    markLessonComplete,
    addBookmark,
    removeBookmark,
    addNote,
    updateSettings,
    setSearchQuery,
    setSelectedCategory,
    setSortBy,
    setFilterLevel,
    setFilterPrice,
    filteredCourses: filteredCourses(),
    enrolledCourses: enrolledCourses(),
    completedCourses: completedCourses(),
    inProgressCourses: inProgressCourses(),
    setCurrentCourse,
    setCurrentLesson,
    nextLesson,
    previousLesson
};

  return (
    <AcademyContext.Provider value={contextValue}>
      {children}
    </AcademyContext.Provider>
  );
};

// Default context value for when used outside provider
const defaultContextValue: AcademyContextType = {
  state: {
    courses: [],
    instructors: [],
    enrollments: [],
    currentCourse: null,
    currentLesson: null,
    progress: [],
    settings: {
      autoPlay: true,
      playbackSpeed: 1,
      quality: '1080p',
      subtitles: false,
      notesEnabled: true,
      bookmarksEnabled: true,
      downloadEnabled: false,
      offlineMode: false,
    },
    isLoading: false,
    error: null,
    searchQuery: '',
    selectedCategory: 'all',
    sortBy: 'newest',
    filterLevel: 'all',
    filterPrice: 'all',
  },
  loadCourses: async () => {},
  createCourse: async (course) => ({
    ...course,
    id: 'default-course-id',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }),
  updateCourse: async () => {},
  deleteCourse: async () => {},
  getCourse: () => null,
  createInstructor: async (instructor) => ({
    ...instructor,
    id: 'default-instructor-id',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }),
  updateInstructor: async () => {},
  deleteInstructor: async () => {},
  getInstructor: () => null,
  createLesson: async (lesson) => ({
    ...lesson,
    id: 'default-lesson-id',
  }),
  updateLesson: async () => {},
  deleteLesson: async () => {},
  enrollInCourse: async (courseId) => ({
    id: `default-enrollment-${courseId}`,
    courseId,
    studentId: 'academy-anonymous',
    enrolledAt: new Date().toISOString(),
    progress: [],
  }),
  unenrollFromCourse: async () => {},
  getEnrollment: () => null,
  updateProgress: async () => {},
  markLessonComplete: async () => {},
  addBookmark: async () => {},
  removeBookmark: async () => {},
  addNote: async () => {},
  updateSettings: async () => {},
  setSearchQuery: () => {},
  setSelectedCategory: () => {},
  setSortBy: () => {},
  setFilterLevel: () => {},
  setFilterPrice: () => {},
  filteredCourses: [],
  enrolledCourses: [],
  completedCourses: [],
  inProgressCourses: [],
  setCurrentCourse: () => {},
  setCurrentLesson: () => {},
  nextLesson: () => {},
  previousLesson: () => {},
};

// Hook - returns default values if used outside provider
export function useAcademy() {
  const context = useContext(AcademyContext);
  if (!context) {
    console.warn('useAcademy called outside AcademyProvider, using default values');
    return defaultContextValue;
  }
  return context;
}

export const useAcademyContext = useAcademy;
export default AcademyContext;
