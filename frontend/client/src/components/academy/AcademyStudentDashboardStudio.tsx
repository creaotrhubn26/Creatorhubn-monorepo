import React, { useCallback, useEffect, useMemo } from 'react';
import {
  ArrowForward,
  BookmarkBorder,
  CheckCircleOutline,
  ForumOutlined,
  LocalFireDepartment,
  MailOutline,
  NotificationsNone,
  OpenInNew,
  PlayArrow,
  Search,
  Stars,
  TipsAndUpdates,
} from '@mui/icons-material';
import { Avatar, Box, Button, Chip, IconButton, LinearProgress, Stack, Typography } from '@mui/material';
import { useLocation } from 'wouter';
import { type Course, type Enrollment, type Lesson, type StudentProgress, useAcademy } from '@/contexts/AcademyContext';
import { useEnhancedMasterIntegration } from '@/integration/EnhancedMasterIntegrationProvider';
import { withUniversalIntegration } from '@/integration/UniversalIntegrationHOC';
import { useAcademyLocale } from './academyLocale';
import AcademyLocaleSwitcher from './AcademyLocaleSwitcher';
import AcademyStudentSidebar from './AcademyStudentSidebar';
import {
  buildAcademyStudentNextAction,
  buildAcademyStudentWeekPlan,
  useAcademyStudentAccessSummary,
} from './academyStudentExperience';

interface AcademyStudentDashboardStudioProps {
  courseId?: string;
  view?: string;
}

interface CourseCardData {
  course: Course;
  progressPercent: number;
  completedLessons: number;
  totalLessons: number;
  nextLesson: Lesson | null;
  noteCount: number;
  bookmarkCount: number;
  resourceCount: number;
  lastActiveAt?: string;
  estimatedMinutesRemaining: number;
  isCompleted: boolean;
}

interface ActivityRow {
  id: string;
  title: string;
  detail: string;
  timestampLabel: string;
  timestampValue: number;
}

interface NoteRow {
  id: string;
  text: string;
  context: string;
}

type StudentExperienceCourse = Course & {
  assignmentStudio?: {
    assignments?: Array<{
      id?: string;
      status?: string;
      dueDate?: string;
    }>;
    feedback?: Array<unknown>;
  };
};

const panelSx = {
  borderRadius: 1.4,
  border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.08)',
  background: 'linear-gradient(145deg, rgba(20,24,36,0.88), rgba(11,14,22,0.96))',
};

const placeholderBackgrounds = [
  'linear-gradient(145deg, rgba(24,30,42,0.92), rgba(12,16,24,0.98)), radial-gradient(circle at 85% 16%, rgba(245,166,35,0.34), rgba(0,0,0,0))',
  'linear-gradient(145deg, rgba(18,23,34,0.95), rgba(10,14,21,0.98)), radial-gradient(circle at 12% 82%, rgba(245,166,35,0.24), rgba(0,0,0,0))',
  'linear-gradient(145deg, rgba(17,21,31,0.94), rgba(8,12,18,0.98)), radial-gradient(circle at 72% 10%, rgba(114,158,225,0.2), rgba(0,0,0,0))',
  'linear-gradient(145deg, rgba(19,24,36,0.93), rgba(11,14,22,0.98)), radial-gradient(circle at 70% 22%, rgba(248,179,33,0.22), rgba(0,0,0,0))',
];

const clampPercent = (value: number): number => {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
};

const formatTimecode = (seconds: number): string => {
  const safeSeconds = Math.max(0, Math.round(Number(seconds || 0)));
  const hrs = Math.floor(safeSeconds / 3600);
  const mins = Math.floor((safeSeconds % 3600) / 60);
  const secs = safeSeconds % 60;

  if (hrs > 0) {
    return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  return `${mins}:${String(secs).padStart(2, '0')}`;
};

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

const toRelativeLabel = (value: string | undefined, tt: (no: string, en: string) => string): string => {
  if (!value) return tt('Nettopp', 'Just now');
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return tt('Nettopp', 'Just now');

  const diffMs = Math.max(0, Date.now() - timestamp);
  const diffMinutes = Math.round(diffMs / 60000);
  if (diffMinutes < 60) {
    const minutes = Math.max(1, diffMinutes);
    return tt(`${minutes} min siden`, `${minutes}m ago`);
  }

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) {
    return tt(`${diffHours} t siden`, `${diffHours}h ago`);
  }

  const diffDays = Math.round(diffHours / 24);
  return tt(`${diffDays} d siden`, `${diffDays}d ago`);
};

const computeStreakDays = (rows: StudentProgress[]): number => {
  const uniqueDayKeys = Array.from(
    new Set(
      rows
        .map((row) => String(row.lastWatchedAt || '').trim())
        .filter(Boolean)
        .map((value) => value.slice(0, 10)),
    ),
  )
    .filter(Boolean)
    .sort((a, b) => b.localeCompare(a));

  if (uniqueDayKeys.length === 0) return 0;

  let streak = 1;
  for (let index = 1; index < uniqueDayKeys.length; index += 1) {
    const previous = new Date(`${uniqueDayKeys[index - 1]}T00:00:00Z`).getTime();
    const current = new Date(`${uniqueDayKeys[index]}T00:00:00Z`).getTime();
    const diffDays = Math.round((previous - current) / 86400000);

    if (diffDays === 1) {
      streak += 1;
    } else {
      break;
    }
  }

  return streak;
};

const createFallbackLesson = (course: Course): Lesson => ({
  id: `${course.id}-intro`,
  courseId: String(course.id),
  title: `${course.title} Intro`,
  description: course.description || 'Course introduction',
  videoUrl: course.videoUrl || '/assets/academy/intro-video.mp4',
  duration: course.duration || 600,
  order: 1,
  isPreview: true,
  resources: [],
});

const buildCourseCardData = (course: Course, progressRows: StudentProgress[]): CourseCardData => {
  const orderedLessons = Array.isArray(course.lessons)
    ? [...course.lessons].sort((a, b) => Number(a.order || 0) - Number(b.order || 0))
    : [];

  const lessonProgress = new Map(progressRows.map((row) => [String(row.lessonId), row]));

  const completedLessons = orderedLessons.filter((lesson) => {
    const row = lessonProgress.get(String(lesson.id));
    return Boolean(row?.completedAt) || Number(row?.progress || 0) >= 100;
  }).length;

  const progressPercent =
    orderedLessons.length > 0
      ? clampPercent(
          orderedLessons.reduce((sum, lesson) => {
            const lessonRow = lessonProgress.get(String(lesson.id));
            return sum + Number(lessonRow?.progress || 0);
          }, 0) / orderedLessons.length,
        )
      : clampPercent(
          progressRows.length > 0
            ? progressRows.reduce((sum, row) => sum + Number(row.progress || 0), 0) / progressRows.length
            : 0,
        );

  const nextLesson =
    orderedLessons.find((lesson) => {
      const row = lessonProgress.get(String(lesson.id));
      return Number(row?.progress || 0) < 100;
    }) ||
    orderedLessons[0] ||
    null;

  const estimatedMinutesRemaining = Math.max(
    0,
    Math.round(
      orderedLessons.reduce((sum, lesson) => {
        const lessonRow = lessonProgress.get(String(lesson.id));
        const ratio = Math.max(0, 1 - Number(lessonRow?.progress || 0) / 100);
        return sum + Number(lesson.duration || 0) * ratio;
      }, 0) / 60,
    ),
  );

  return {
    course,
    progressPercent,
    completedLessons,
    totalLessons: Math.max(orderedLessons.length, 0),
    nextLesson,
    noteCount: progressRows.reduce((sum, row) => sum + (Array.isArray(row.notes) ? row.notes.length : 0), 0),
    bookmarkCount: progressRows.reduce(
      (sum, row) => sum + (Array.isArray(row.bookmarks) ? row.bookmarks.length : 0),
      0,
    ),
    resourceCount:
      (Array.isArray(course.resources) ? course.resources.length : 0) +
      orderedLessons.reduce(
        (sum, lesson) => sum + (Array.isArray(lesson.resources) ? lesson.resources.length : 0),
        0,
      ),
    lastActiveAt: progressRows
      .map((row) => row.lastWatchedAt)
      .filter(Boolean)
      .sort((left, right) => new Date(right).getTime() - new Date(left).getTime())[0],
    estimatedMinutesRemaining,
    isCompleted: orderedLessons.length > 0 ? completedLessons >= orderedLessons.length : progressPercent >= 100,
  };
};

function AcademyStudentDashboardStudio({ courseId, view }: AcademyStudentDashboardStudioProps) {
  const [location, setLocation] = useLocation();
  const { state, getCourse, setCurrentCourse, setCurrentLesson } = useAcademy();
  const { analytics, auth } = useEnhancedMasterIntegration();
  const { tt } = useAcademyLocale();

  const courses = useMemo(() => (Array.isArray(state?.courses) ? state.courses : []), [state?.courses]);
  const progressRows = useMemo(() => (Array.isArray(state?.progress) ? state.progress : []), [state?.progress]);
  const enrollments = useMemo(
    () => (Array.isArray(state?.enrollments) ? state.enrollments : []),
    [state?.enrollments],
  );

  const activeView = view === 'courses' || view === 'achievements' ? view : 'overview';
  const activeNav = activeView === 'overview' ? 'overview' : activeView;

  const identityHints = useMemo(() => {
    const user = auth.state.user as
      | {
          id?: string;
          sub?: string;
          email?: string;
        }
      | undefined;

    return [user?.id, user?.sub, user?.email]
      .map((value) => String(value || '').trim().toLowerCase())
      .filter(Boolean);
  }, [auth.state.user]);

  const studentEnrollments = useMemo(() => {
    const matchedByIdentity = identityHints.length
      ? enrollments.filter((enrollment) =>
          identityHints.includes(String(enrollment.studentId || '').trim().toLowerCase()),
        )
      : [];

    if (matchedByIdentity.length > 0) return matchedByIdentity;

    const progressCourseIds = new Set(progressRows.map((row) => String(row.courseId || '').trim()).filter(Boolean));
    if (progressCourseIds.size > 0) {
      const matchedByCourse = enrollments.filter((enrollment) =>
        progressCourseIds.has(String(enrollment.courseId || '').trim()),
      );
      if (matchedByCourse.length > 0) return matchedByCourse;
    }

    return [] as Enrollment[];
  }, [enrollments, identityHints, progressRows]);

  const displayName = useMemo(() => {
    const user = auth.state.user as
      | {
          name?: string;
          firstName?: string;
          email?: string;
        }
      | undefined;

    if (typeof user?.name === 'string' && user.name.trim()) {
      return user.name.trim().split(' ')[0];
    }

    if (typeof user?.firstName === 'string' && user.firstName.trim()) {
      return user.firstName.trim();
    }

    if (typeof user?.email === 'string' && user.email.trim()) {
      return toDisplayName(user.email, 'Student');
    }

    const enrollmentStudentId = String(studentEnrollments[0]?.studentId || '').trim();
    if (enrollmentStudentId) {
      return toDisplayName(enrollmentStudentId, 'Student');
    }

    return 'Student';
  }, [auth.state.user, studentEnrollments]);

  const enrolledCourseIds = useMemo(() => {
    const ids = new Set<string>();

    studentEnrollments.forEach((enrollment) => {
      const value = String(enrollment.courseId || '').trim();
      if (value) ids.add(value);
    });

    progressRows.forEach((row) => {
      const value = String(row.courseId || '').trim();
      if (value) ids.add(value);
    });

    const currentCourseValue = String(state.currentCourse?.id || '').trim();
    if (currentCourseValue) ids.add(currentCourseValue);

    const routeCourseValue = String(courseId || '').trim();
    if (routeCourseValue) ids.add(routeCourseValue);

    return ids;
  }, [courseId, progressRows, state.currentCourse?.id, studentEnrollments]);

  const studentCourses = useMemo(() => {
    const fromContext = courses.filter((course) => enrolledCourseIds.has(String(course.id)));
    if (fromContext.length > 0) return fromContext;

    const fromParam = courseId ? getCourse(courseId) : null;
    if (fromParam) return [fromParam];

    return courses.slice(0, Math.min(3, courses.length));
  }, [courseId, courses, enrolledCourseIds, getCourse]);

  const courseCards = useMemo(() => {
    return studentCourses
      .map((course) =>
        buildCourseCardData(
          course,
          progressRows.filter((row) => String(row.courseId || '') === String(course.id)),
        ),
      )
      .sort((left, right) => {
        const leftMatchesCurrent = String(left.course.id) === String(state.currentCourse?.id || '');
        const rightMatchesCurrent = String(right.course.id) === String(state.currentCourse?.id || '');

        if (leftMatchesCurrent !== rightMatchesCurrent) return leftMatchesCurrent ? -1 : 1;
        if (left.isCompleted !== right.isCompleted) return left.isCompleted ? 1 : -1;
        if (left.progressPercent !== right.progressPercent) return right.progressPercent - left.progressPercent;

        return new Date(right.lastActiveAt || 0).getTime() - new Date(left.lastActiveAt || 0).getTime();
      });
  }, [progressRows, state.currentCourse?.id, studentCourses]);

  const focusCourse = useMemo(() => {
    const fromRoute = courseId ? courseCards.find((card) => String(card.course.id) === String(courseId)) : null;
    if (fromRoute) return fromRoute;

    const fromContext = courseCards.find((card) => String(card.course.id) === String(state.currentCourse?.id || ''));
    if (fromContext) return fromContext;

    return courseCards.find((card) => !card.isCompleted) || courseCards[0] || null;
  }, [courseCards, courseId, state.currentCourse?.id]);

  const completedCoursesCount = useMemo(() => {
    const completedEnrollmentIds = new Set(
      studentEnrollments
        .filter((enrollment) => enrollment.completedAt || enrollment.certificateUrl)
        .map((enrollment) => String(enrollment.courseId || ''))
        .filter(Boolean),
    );

    return courseCards.filter(
      (card) => card.isCompleted || completedEnrollmentIds.has(String(card.course.id)),
    ).length;
  }, [courseCards, studentEnrollments]);

  const completedLessonsTotal = useMemo(
    () => courseCards.reduce((sum, card) => sum + card.completedLessons, 0),
    [courseCards],
  );

  const notesTotal = useMemo(
    () => progressRows.reduce((sum, row) => sum + (Array.isArray(row.notes) ? row.notes.length : 0), 0),
    [progressRows],
  );

  const bookmarksTotal = useMemo(
    () => progressRows.reduce((sum, row) => sum + (Array.isArray(row.bookmarks) ? row.bookmarks.length : 0), 0),
    [progressRows],
  );

  const certificateCount = useMemo(
    () => studentEnrollments.filter((enrollment) => enrollment.certificateUrl || enrollment.completedAt).length,
    [studentEnrollments],
  );

  const streakDays = useMemo(() => computeStreakDays(progressRows), [progressRows]);
  const learningPoints = useMemo(
    () => completedLessonsTotal * 120 + notesTotal * 20 + bookmarksTotal * 12 + completedCoursesCount * 240,
    [bookmarksTotal, completedCoursesCount, completedLessonsTotal, notesTotal],
  );

  const recentActivity = useMemo<ActivityRow[]>(() => {
    return progressRows
      .map((row, index) => {
        const course = courses.find((entry) => String(entry.id) === String(row.courseId || ''));
        const lesson = course?.lessons.find((entry) => String(entry.id) === String(row.lessonId || ''));

        return {
          id: `activity-${row.courseId}-${row.lessonId}-${index}`,
          title: lesson?.title || tt('Ferdighet oppdatert', 'Skill updated'),
          detail: `${course?.title || tt('Ukjent kurs', 'Unknown course')} · ${clampPercent(row.progress)}%`,
          timestampLabel: toRelativeLabel(row.lastWatchedAt, tt),
          timestampValue: new Date(row.lastWatchedAt || 0).getTime(),
        };
      })
      .sort((left, right) => right.timestampValue - left.timestampValue)
      .slice(0, 4);
  }, [courses, progressRows, tt]);

  const recentNotes = useMemo<NoteRow[]>(() => {
    return progressRows
      .flatMap((row, rowIndex) => {
        const course = courses.find((entry) => String(entry.id) === String(row.courseId || ''));
        const lesson = course?.lessons.find((entry) => String(entry.id) === String(row.lessonId || ''));

        return (Array.isArray(row.notes) ? row.notes : []).map((note, noteIndex) => ({
          id: `note-${rowIndex}-${noteIndex}`,
          text: note,
          context: `${course?.title || tt('Kurs', 'Course')} · ${lesson?.title || tt('Ferdighet', 'Skill')}`,
        }));
      })
      .slice(-4)
      .reverse();
  }, [courses, progressRows, tt]);

  const recentBookmarks = useMemo<NoteRow[]>(() => {
    return progressRows
      .flatMap((row, rowIndex) => {
        const course = courses.find((entry) => String(entry.id) === String(row.courseId || ''));
        const lesson = course?.lessons.find((entry) => String(entry.id) === String(row.lessonId || ''));

        return (Array.isArray(row.bookmarks) ? row.bookmarks : []).map((bookmark, bookmarkIndex) => ({
          id: `bookmark-${rowIndex}-${bookmarkIndex}`,
          text: `${tt('Bokmerke', 'Bookmark')} ${formatTimecode(bookmark)}`,
          context: `${course?.title || tt('Kurs', 'Course')} · ${lesson?.title || tt('Ferdighet', 'Skill')}`,
        }));
      })
      .slice(-4)
      .reverse();
  }, [courses, progressRows, tt]);

  const achievementRows = useMemo(
    () => [
      {
        id: 'achievement-streak',
        label: tt('Læringsstreak', 'Learning streak'),
        value: `${Math.max(streakDays, progressRows.length > 0 ? 1 : 0)}`,
        suffix: tt('dager', 'days'),
      },
      {
        id: 'achievement-courses',
        label: tt('Fullførte kurs', 'Completed courses'),
        value: `${completedCoursesCount}`,
        suffix: tt('kurs', 'courses'),
      },
      {
        id: 'achievement-notes',
        label: tt('Lagrede notater', 'Saved notes'),
        value: `${notesTotal}`,
        suffix: tt('notater', 'notes'),
      },
      {
        id: 'achievement-bookmarks',
        label: tt('Bokmerker', 'Bookmarks'),
        value: `${bookmarksTotal}`,
        suffix: tt('punkter', 'saved'),
      },
    ],
    [bookmarksTotal, completedCoursesCount, notesTotal, progressRows.length, streakDays, tt],
  );

  const recommendedCourses = useMemo(() => {
    return courses
      .filter((course) => !enrolledCourseIds.has(String(course.id)))
      .slice(0, 3)
      .map((course, index) => ({
        course,
        imageTheme: index % placeholderBackgrounds.length,
      }));
  }, [courses, enrolledCourseIds]);

  const { data: accessSummary } = useAcademyStudentAccessSummary(
    focusCourse?.course?.id ? String(focusCourse.course.id) : undefined,
  );

  const focusCourseStudio = (focusCourse?.course as StudentExperienceCourse | undefined)?.assignmentStudio;
  const focusAssignments = useMemo(() => {
    const assignments = Array.isArray(focusCourseStudio?.assignments)
      ? focusCourseStudio.assignments
      : [];
    return assignments.filter((assignment) => String(assignment?.status || '').toLowerCase() !== 'draft');
  }, [focusCourseStudio?.assignments]);

  const focusAssignmentsDueSoon = useMemo(() => {
    const now = Date.now();
    const nextWeek = now + 7 * 86400000;
    return focusAssignments.filter((assignment) => {
      const dueAt = new Date(String(assignment.dueDate || '')).getTime();
      return Number.isFinite(dueAt) && dueAt >= now && dueAt <= nextWeek;
    }).length;
  }, [focusAssignments]);

  const focusFeedbackCount = useMemo(
    () => (Array.isArray(focusCourseStudio?.feedback) ? focusCourseStudio.feedback.length : 0),
    [focusCourseStudio?.feedback],
  );

  const isNewStudent = useMemo(
    () => progressRows.length === 0 || Number(focusCourse?.progressPercent || 0) <= 0,
    [focusCourse?.progressPercent, progressRows.length],
  );

  const buildStudentRoute = useCallback(
    (path: string, extra?: Record<string, string | null | undefined>) => {
      const params = new URLSearchParams();
      const safeCourseId = String(focusCourse?.course.id || '').trim();
      const safeLessonId = String(focusCourse?.nextLesson?.id || '').trim();
      if (safeCourseId) params.set('courseId', safeCourseId);
      if (safeLessonId) params.set('lessonId', safeLessonId);
      params.set('audience', 'student');
      params.set('returnTo', '/academy/student-dashboard');
      Object.entries(extra || {}).forEach(([key, value]) => {
        if (!value) return;
        params.set(key, value);
      });
      return `${path}?${params.toString()}`;
    },
    [focusCourse?.course.id, focusCourse?.nextLesson?.id],
  );

  const continueCourseRoute = useMemo(() => buildStudentRoute('/academy/player-studio'), [buildStudentRoute]);
  const resourcesRoute = useMemo(() => buildStudentRoute('/academy/media'), [buildStudentRoute]);
  const assignmentsRoute = useMemo(() => buildStudentRoute('/academy/assignments'), [buildStudentRoute]);

  const studentNextAction = useMemo(
    () =>
      buildAcademyStudentNextAction({
        tt,
        courseTitle: focusCourse?.course.title,
        lessonTitle: focusCourse?.nextLesson?.title,
        pendingAssignments: focusAssignments.length,
        dueSoonAssignments: focusAssignmentsDueSoon,
        feedbackCount: focusFeedbackCount,
        notesToReview: notesTotal + bookmarksTotal,
        resourceCount: focusCourse?.resourceCount || 0,
        progressPercent: focusCourse?.progressPercent || 0,
        isNewStudent,
      }),
    [
      bookmarksTotal,
      focusAssignments.length,
      focusAssignmentsDueSoon,
      focusCourse?.course.title,
      focusCourse?.nextLesson?.title,
      focusCourse?.progressPercent,
      focusCourse?.resourceCount,
      focusFeedbackCount,
      isNewStudent,
      notesTotal,
      tt,
    ],
  );

  const weekPlan = useMemo(
    () =>
      buildAcademyStudentWeekPlan({
        tt,
        courseTitle: focusCourse?.course.title,
        lessonTitle: focusCourse?.nextLesson?.title,
        pendingAssignments: focusAssignments.length,
        dueSoonAssignments: focusAssignmentsDueSoon,
        feedbackCount: focusFeedbackCount,
        notesToReview: notesTotal + bookmarksTotal,
        resourceCount: focusCourse?.resourceCount || 0,
        progressPercent: focusCourse?.progressPercent || 0,
        isNewStudent,
        approvedBy: accessSummary?.access?.approvedBy || null,
      }),
    [
      accessSummary?.access?.approvedBy,
      bookmarksTotal,
      focusAssignments.length,
      focusAssignmentsDueSoon,
      focusCourse?.course.title,
      focusCourse?.nextLesson?.title,
      focusCourse?.progressPercent,
      focusCourse?.resourceCount,
      focusFeedbackCount,
      isNewStudent,
      notesTotal,
      tt,
    ],
  );

  const nextActionRoute = useMemo(() => {
    if (studentNextAction.id === 'assignment') return assignmentsRoute;
    if (studentNextAction.id === 'resources') return resourcesRoute;
    if (studentNextAction.id === 'feedback') return '/academy/settings?tab=messages';
    return continueCourseRoute;
  }, [assignmentsRoute, continueCourseRoute, resourcesRoute, studentNextAction.id]);

  const openCourse = useCallback(
    (card: CourseCardData | null) => {
      if (!card) {
        setLocation('/academy');
        return;
      }

      const resolvedLesson = card.nextLesson || createFallbackLesson(card.course);
      const resolvedLessons =
        Array.isArray(card.course.lessons) && card.course.lessons.length > 0
          ? card.course.lessons
          : [resolvedLesson];

      setCurrentCourse({ ...card.course, lessons: resolvedLessons });
      setCurrentLesson(resolvedLesson);

      const query = new URLSearchParams();
      query.set('courseId', String(card.course.id));
      query.set('lessonId', String(resolvedLesson.id));
      query.set('audience', 'student');
      query.set('returnTo', '/academy/student-dashboard');

      analytics.trackEvent('academy_student_continue_learning', {
        courseId: card.course.id,
        lessonId: resolvedLesson.id,
        view: activeView,
        source: 'academy-student-dashboard',
      });

      setLocation(`/academy/player-studio?${query.toString()}`);
    },
    [activeView, analytics, setCurrentCourse, setCurrentLesson, setLocation],
  );

  const openResources = useCallback(
    (card?: CourseCardData | null) => {
      const query = new URLSearchParams();
      const targetCourse = String(card?.course.id || focusCourse?.course.id || '').trim();
      if (targetCourse) query.set('courseId', targetCourse);
      query.set('audience', 'student');
      query.set('returnTo', location || '/academy/student-dashboard');
      setLocation(`/academy/media?${query.toString()}`);
    },
    [focusCourse?.course.id, location, setLocation],
  );

  const openStudentTab = useCallback(
    (nextView: 'overview' | 'courses' | 'achievements') => {
      const query = new URLSearchParams();
      if (courseId) query.set('courseId', String(courseId));
      if (nextView !== 'overview') query.set('view', nextView);
      const nextRoute = query.toString() ? `/academy/student-dashboard?${query.toString()}` : '/academy/student-dashboard';
      setLocation(nextRoute);
    },
    [courseId, setLocation],
  );

  const handleNextAction = useCallback(() => {
    if (studentNextAction.id === 'assignment') {
      setLocation(assignmentsRoute);
      return;
    }
    if (studentNextAction.id === 'resources') {
      setLocation(resourcesRoute);
      return;
    }
    if (studentNextAction.id === 'feedback') {
      setLocation('/academy/settings?tab=messages');
      return;
    }
    openCourse(focusCourse);
  }, [assignmentsRoute, focusCourse, openCourse, resourcesRoute, setLocation, studentNextAction.id]);

  const handleSidebarNavigate = useCallback(
    (navId: string, route: string) => {
      analytics.trackEvent('academy_student_sidebar_navigation', {
        navId,
        route,
        source: 'academy-student-dashboard',
      });
      setLocation(route);
    },
    [analytics, setLocation],
  );

  useEffect(() => {
    analytics.trackEvent('academy_student_dashboard_opened', {
      courseId: focusCourse?.course.id || null,
      activeView,
      enrolledCourses: courseCards.length,
      completedCourses: completedCoursesCount,
      timestamp: Date.now(),
    });
  }, [activeView, analytics, completedCoursesCount, courseCards.length, focusCourse?.course.id]);

  const topTabs = [
    { id: 'overview', label: tt('Oversikt', 'Overview'), onClick: () => openStudentTab('overview') },
    { id: 'courses', label: tt('Mine kurs', 'My Courses'), onClick: () => openStudentTab('courses') },
    { id: 'resources', label: tt('Ressurser', 'Resources'), onClick: () => openResources(focusCourse) },
    { id: 'community', label: tt('Community', 'Community'), onClick: () => setLocation('/community') },
    { id: 'achievements', label: tt('Prestasjoner', 'Achievements'), onClick: () => openStudentTab('achievements') },
  ] as const;

  const quickStats = [
    {
      id: 'stats-courses',
      label: tt('Aktive kurs', 'Active courses'),
      value: `${courseCards.length}`,
      accent: '#f8d56f',
    },
    {
      id: 'stats-lessons',
      label: tt('Ferdigheter fullført', 'Skills completed'),
      value: `${completedLessonsTotal}`,
      accent: '#9ad27b',
    },
    {
      id: 'stats-streak',
      label: tt('Streak', 'Streak'),
      value: `${Math.max(streakDays, progressRows.length > 0 ? 1 : 0)} ${tt('d', 'd')}`,
      accent: '#ff9b4a',
    },
    {
      id: 'stats-certificates',
      label: tt('Sertifikater', 'Certificates'),
      value: `${certificateCount}`,
      accent: '#8ab8ff',
    },
  ];

  return (
    <Box
      sx={{
        minHeight: '100vh',
        color: '#edf0f7',
        bgcolor: '#06080d',
        fontFamily: '"Manrope", "Barlow", "Segoe UI", sans-serif',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          background:
            'radial-gradient(circle at 74% 12%, rgba(248,179,33,0.24), rgba(5,8,13,0) 42%), radial-gradient(circle at 16% 74%, rgba(82,121,204,0.14), rgba(6,8,14,0) 44%), linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0) 32%)',
        }}
      />

      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', lg: 'row' },
          minHeight: '100vh',
          position: 'relative',
          zIndex: 1,
          width: 'min(100%, var(--academy-shell-max-width, 1920px))',
          mx: 'auto',
        }}
      >
        <AcademyStudentSidebar
          activeNav={activeNav}
          onNavigate={handleSidebarNavigate}
          tt={tt}
          studentName={displayName}
          activeCourseId={focusCourse?.course.id || null}
          activeCourseTitle={focusCourse?.course.title}
          instructorName={focusCourse?.course.instructor?.name || undefined}
          progressPercent={focusCourse?.progressPercent || 0}
          completedLessons={focusCourse?.completedLessons || 0}
          totalLessons={focusCourse?.totalLessons || 0}
          streakDays={streakDays}
          returnTo="/academy/student-dashboard"
          continueRoute={continueCourseRoute}
          nextActionTitle={studentNextAction.title}
          nextActionDetail={studentNextAction.detail}
          nextActionRoute={nextActionRoute}
          nextActionLabel={studentNextAction.ctaLabel}
        />

        <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <Box
            sx={{
              height: 74,
              px: 2,
              borderBottom: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'linear-gradient(180deg, rgba(13,16,25,0.95), rgba(10,13,20,0.9))',
            }}
          >
            <Stack direction="row" spacing={0.8} alignItems="center" sx={{ minWidth: 0 }}>
              {topTabs.map((tab) => {
                const active = activeNav === tab.id;
                return (
                  <Button
                    key={tab.id}
                    onClick={tab.onClick}
                    sx={{
                      textTransform: 'none',
                      color: active ? '#fce3a1' : 'rgba(237,240,247,0.72)',
                      borderBottom: active ? '2px solid rgba(248,179,33,0.8)' : '2px solid transparent',
                      borderRadius: 0,
                      px: { xs: 0.8, md: 1.4 },
                      minWidth: 0,
                    }}
                  >
                    {tab.label}
                  </Button>
                );
              })}
            </Stack>

            <Stack direction="row" spacing={1} alignItems="center">
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
                onClick={() => setLocation('/academy')}
                aria-label={tt('Søk', 'Search')}
                sx={{ color: 'rgba(237,240,247,0.75)' }}
              >
                <Search fontSize="small" />
              </IconButton>
              <IconButton
                size="small"
                onClick={() => setLocation('/academy/settings?tab=profile')}
                aria-label={tt('Profil', 'Profile')}
                sx={{ p: 0 }}
              >
                <Avatar
                  sx={{
                    width: 34,
                    height: 34,
                    bgcolor: '#f8b321',
                    color: '#111',
                    border: '2px solid rgba(248,179,33,0.55)',
                  }}
                >
                  {String(displayName || 'S').charAt(0).toUpperCase()}
                </Avatar>
              </IconButton>
            </Stack>
          </Box>

          <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', px: 2, py: 2, gap: 1.4 }}>
            <Box
              sx={{
                ...panelSx,
                p: 1.5,
                background:
                  'radial-gradient(circle at 76% 22%, rgba(248,179,33,0.2), rgba(0,0,0,0) 38%), linear-gradient(145deg, rgba(20,24,36,0.9), rgba(10,13,20,0.97))',
              }}
            >
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1.06fr 0.94fr' }, gap: 1.4, alignItems: 'center' }}>
                <Box>
                  <Typography sx={{ color: 'rgba(248,213,111,0.92)', fontSize: 12, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                    {tt('Studentside', 'Student interface')}
                  </Typography>
                  <Typography sx={{ fontSize: { xs: 34, md: 54 }, fontWeight: 600, lineHeight: 1, mt: 0.4 }}>
                    {tt(`Hei ${displayName}`, `Hi ${displayName}`)}
                  </Typography>
                  <Typography sx={{ mt: 0.8, color: 'rgba(237,240,247,0.78)', maxWidth: 720 }}>
                    {activeView === 'achievements'
                      ? tt(
                          'Dette er studentflaten for academy: fullførte kurs, sertifikater, streak og læringspunkter samlet på ett sted.',
                          'This is the learner interface: completed courses, certificates, streak, and learning points gathered in one place.',
                        )
                      : isNewStudent
                        ? tt(
                            'Du er nå inne i studentflyten. Start første leksjon, bruk ukeplanen som guide og hold fokus på ett tydelig neste steg.',
                            'You are now inside the learner flow. Start the first lesson, use the weekly plan as your guide, and stay focused on one clear next step.',
                          )
                      : tt(
                          'Dette er studentflaten for academy: fortsett der du slapp, se mine kurs, åpne ressurser og følg egen progresjon uten instruktørverktøyene.',
                          'This is the learner interface: continue where you left off, see your courses, open resources, and track your progress without the instructor tools.',
                        )}
                  </Typography>

                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1.1 }}>
                    <LinearProgress
                      variant="determinate"
                      value={focusCourse?.progressPercent || 0}
                      sx={{
                        flex: 1,
                        height: 10,
                        borderRadius: 999,
                        bgcolor: 'rgba(255,255,255,0.14)',
                        '& .MuiLinearProgress-bar': {
                          borderRadius: 999,
                          background: 'linear-gradient(90deg, #f8b321 0%, #ffcf57 100%)',
                        },
                      }}
                    />
                    <Typography sx={{ minWidth: 44, fontWeight: 700 }}>
                      {focusCourse?.progressPercent || 0}%
                    </Typography>
                  </Stack>

                  <Stack direction="row" spacing={0.8} flexWrap="wrap" useFlexGap sx={{ mt: 1 }}>
                    <Chip
                      label={tt(`${courseCards.length} kurs aktive`, `${courseCards.length} active courses`)}
                      sx={{
                        color: '#edf0f7',
                        bgcolor: 'rgba(248,179,33,0.15)',
                        border: 'var(--academy-hairline-width, 1px) solid rgba(248,179,33,0.35)',
                      }}
                    />
                    <Chip
                      label={tt(`${Math.max(streakDays, progressRows.length > 0 ? 1 : 0)} dagers streak`, `${Math.max(streakDays, progressRows.length > 0 ? 1 : 0)} day streak`)}
                      sx={{
                        color: '#edf0f7',
                        bgcolor: 'rgba(255,255,255,0.08)',
                        border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.12)',
                      }}
                    />
                    <Chip
                      label={tt(`${learningPoints.toLocaleString('nb-NO')} poeng`, `${learningPoints.toLocaleString('en-US')} points`)}
                      sx={{
                        color: '#edf0f7',
                        bgcolor: 'rgba(108,151,235,0.12)',
                        border: 'var(--academy-hairline-width, 1px) solid rgba(108,151,235,0.24)',
                      }}
                    />
                    {accessSummary?.access?.approvedBy ? (
                      <Chip
                        label={tt(
                          `Godkjent av ${accessSummary.access.approvedBy}`,
                          `Approved by ${accessSummary.access.approvedBy}`,
                        )}
                        sx={{
                          color: '#edf0f7',
                          bgcolor: 'rgba(154,210,123,0.12)',
                          border: 'var(--academy-hairline-width, 1px) solid rgba(154,210,123,0.26)',
                        }}
                      />
                    ) : null}
                  </Stack>

                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={0.9} sx={{ mt: 1.2 }}>
                    <Button
                      variant="contained"
                      startIcon={<PlayArrow />}
                      onClick={handleNextAction}
                      sx={{
                        textTransform: 'none',
                        borderRadius: 1,
                        color: '#0f0f0f',
                        background: 'linear-gradient(180deg, #ffd44e, #f2a616)',
                        boxShadow: '0 8px 20px rgba(248,179,33,0.25)',
                        fontWeight: 700,
                      }}
                    >
                      {studentNextAction.ctaLabel}
                    </Button>
                    <Button
                      variant="outlined"
                      startIcon={studentNextAction.id === 'assignment' ? <PlayArrow /> : <BookmarkBorder />}
                      onClick={() => openCourse(focusCourse)}
                      sx={{
                        textTransform: 'none',
                        borderRadius: 1,
                        color: '#edf0f7',
                        borderColor: 'rgba(255,255,255,0.18)',
                        fontWeight: 600,
                      }}
                    >
                      {tt('Fortsett kurs', 'Continue course')}
                    </Button>
                  </Stack>
                </Box>

                <Box
                  sx={{
                    height: { xs: 'auto', md: 220 },
                    minHeight: 200,
                    borderRadius: 1.2,
                    border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.12)',
                    background: focusCourse ? placeholderBackgrounds[0] : placeholderBackgrounds[2],
                    position: 'relative',
                    overflow: 'hidden',
                    p: 1.2,
                  }}
                >
                  <Typography sx={{ color: 'rgba(237,240,247,0.72)' }}>
                    {tt('Neste opp', 'Next up')}
                  </Typography>
                  <Typography sx={{ fontSize: { xs: 28, sm: 40, md: 46 }, fontWeight: 600, lineHeight: 1, mt: 0.45 }}>
                    {focusCourse?.nextLesson?.title || tt('Velg et kurs', 'Choose a course')}
                  </Typography>
                  <Typography sx={{ mt: 0.55, color: 'rgba(237,240,247,0.74)', maxWidth: 420 }}>
                    {focusAssignmentsDueSoon > 0
                      ? tt(
                          `${focusAssignmentsDueSoon} oppgaver bør følges opp denne uken før du går videre.`,
                          `${focusAssignmentsDueSoon} assignments should be handled this week before you move on.`,
                        )
                      : focusCourse?.nextLesson?.description ||
                      tt(
                        'Her får studenten kun det som trengs for læring: neste ferdighet, ressurser og egen progresjon.',
                        'The learner only gets what is needed for learning: the next skill, resources, and personal progress.',
                      )}
                  </Typography>

                  <Stack spacing={0.6} sx={{ mt: 1.2 }}>
                    <Stack direction="row" justifyContent="space-between">
                      <Typography sx={{ color: 'rgba(237,240,247,0.68)' }}>
                        {tt('Kurs', 'Course')}
                      </Typography>
                      <Typography sx={{ fontWeight: 700 }} noWrap>
                        {focusCourse?.course.title || tt('Ingen kurs valgt', 'No course selected')}
                      </Typography>
                    </Stack>
                    <Stack direction="row" justifyContent="space-between">
                      <Typography sx={{ color: 'rgba(237,240,247,0.68)' }}>
                        {tt('Instruktør', 'Instructor')}
                      </Typography>
                      <Typography sx={{ fontWeight: 700 }} noWrap>
                        {focusCourse?.course.instructor?.name || 'CreatorHub Team'}
                      </Typography>
                    </Stack>
                    <Stack direction="row" justifyContent="space-between">
                      <Typography sx={{ color: 'rgba(237,240,247,0.68)' }}>
                        {tt('Gjenstår', 'Remaining')}
                      </Typography>
                      <Typography sx={{ fontWeight: 700 }}>
                        {focusCourse ? `${focusCourse.estimatedMinutesRemaining} min` : '0 min'}
                      </Typography>
                    </Stack>
                  </Stack>
                </Box>
              </Box>
            </Box>

            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', xl: 'repeat(4, minmax(0, 1fr))' },
                gap: 1,
              }}
            >
              {quickStats.map((item) => (
                <Box key={item.id} sx={{ ...panelSx, p: 1 }}>
                  <Typography sx={{ color: 'rgba(237,240,247,0.64)', fontSize: 12 }}>{item.label}</Typography>
                  <Typography sx={{ fontSize: { xs: 24, md: 34 }, fontWeight: 700, lineHeight: 1.05, color: item.accent, mt: 0.35 }}>
                    {item.value}
                  </Typography>
                </Box>
              ))}
            </Box>

            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', xl: 'minmax(0, 1fr) 360px' }, gap: 1.2, minHeight: 0 }}>
              <Box sx={{ minHeight: 0, display: 'flex', flexDirection: 'column', gap: 1.1 }}>
                {activeView === 'achievements' ? (
                  <>
                    <Box sx={{ ...panelSx, p: 1.1 }}>
                      <Typography sx={{ fontSize: { xs: 28, md: 42 }, fontWeight: 600, lineHeight: 1 }}>
                        {tt('Prestasjoner', 'Achievements')}
                      </Typography>
                      <Box
                        sx={{
                          mt: 1,
                          display: 'grid',
                          gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, minmax(0, 1fr))' },
                          gap: 0.8,
                        }}
                      >
                        {achievementRows.map((row, index) => (
                          <Box
                            key={row.id}
                            sx={{
                              p: 0.95,
                              borderRadius: 1,
                              border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.1)',
                              background: placeholderBackgrounds[index % placeholderBackgrounds.length],
                            }}
                          >
                            <Typography sx={{ fontSize: 12, color: 'rgba(237,240,247,0.68)' }}>{row.label}</Typography>
                            <Typography sx={{ mt: 0.55, fontSize: 32, fontWeight: 700, lineHeight: 1 }}>
                              {row.value}
                            </Typography>
                            <Typography sx={{ mt: 0.25, color: 'rgba(237,240,247,0.72)' }}>{row.suffix}</Typography>
                          </Box>
                        ))}
                      </Box>
                    </Box>

                    <Box sx={{ ...panelSx, p: 1.1 }}>
                      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.9 }}>
                        <Typography sx={{ fontSize: { xs: 28, md: 42 }, fontWeight: 600, lineHeight: 1 }}>
                          {tt('Sertifikater og milepæler', 'Certificates and milestones')}
                        </Typography>
                        <Chip
                          label={tt(`${certificateCount} sertifikater`, `${certificateCount} certificates`)}
                          sx={{
                            color: '#edf0f7',
                            bgcolor: 'rgba(248,179,33,0.12)',
                            border: 'var(--academy-hairline-width, 1px) solid rgba(248,179,33,0.24)',
                          }}
                        />
                      </Stack>
                      <Stack spacing={0.8}>
                        {(courseCards.length > 0 ? courseCards : [focusCourse].filter(Boolean)).map((card, index) => {
                          if (!card) return null;

                          return (
                            <Box
                              key={`milestone-${card.course.id}`}
                              sx={{
                                p: 0.95,
                                borderRadius: 1,
                                border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.1)',
                                background: index === 0 ? 'rgba(248,179,33,0.08)' : 'rgba(10,14,22,0.7)',
                              }}
                            >
                              <Stack direction="row" justifyContent="space-between" spacing={1}>
                                <Box minWidth={0}>
                                  <Typography sx={{ fontWeight: 700 }} noWrap>
                                    {card.course.title}
                                  </Typography>
                                  <Typography sx={{ color: 'rgba(237,240,247,0.7)' }}>
                                    {tt(
                                      `${card.completedLessons}/${Math.max(card.totalLessons, 1)} ferdigheter fullført`,
                                      `${card.completedLessons}/${Math.max(card.totalLessons, 1)} skills completed`,
                                    )}
                                  </Typography>
                                </Box>
                                <Chip
                                  icon={card.isCompleted ? <CheckCircleOutline sx={{ fontSize: 16 }} /> : <LocalFireDepartment sx={{ fontSize: 16 }} />}
                                  label={
                                    card.isCompleted
                                      ? tt('Klar for sertifikat', 'Certificate ready')
                                      : tt(`${card.progressPercent}% fullført`, `${card.progressPercent}% complete`)
                                  }
                                  sx={{
                                    color: '#edf0f7',
                                    bgcolor: card.isCompleted ? 'rgba(154,210,123,0.12)' : 'rgba(248,179,33,0.12)',
                                    border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.12)',
                                  }}
                                />
                              </Stack>
                            </Box>
                          );
                        })}
                      </Stack>
                    </Box>
                  </>
                ) : (
                  <>
                    <Box>
                      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.85 }}>
                        <Typography sx={{ fontSize: { xs: 30, md: 44 }, fontWeight: 600, lineHeight: 1 }}>
                          {tt('Mine kurs', 'My courses')}
                        </Typography>
                        <Button
                          size="small"
                          onClick={() => openStudentTab('courses')}
                          endIcon={<ArrowForward />}
                          sx={{
                            textTransform: 'none',
                            color: '#edf0f7',
                            border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.16)',
                          }}
                        >
                          {tt('Se alt', 'See all')}
                        </Button>
                      </Stack>

                      <Box
                        sx={{
                          display: 'grid',
                          gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
                          gap: 1,
                        }}
                      >
                        {courseCards.map((card, index) => (
                          <Box
                            key={card.course.id}
                            sx={{
                              ...panelSx,
                              p: 0.9,
                              borderColor:
                                focusCourse?.course.id === card.course.id
                                  ? 'rgba(248,179,33,0.28)'
                                  : 'rgba(255,255,255,0.08)',
                            }}
                          >
                            <Box
                              sx={{
                                height: 132,
                                borderRadius: 1,
                                border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.1)',
                                background: placeholderBackgrounds[index % placeholderBackgrounds.length],
                                mb: 0.8,
                              }}
                            />
                            <Stack direction="row" justifyContent="space-between" spacing={0.8}>
                              <Box minWidth={0}>
                                <Typography sx={{ fontSize: { xs: 22, md: 30 }, lineHeight: 1, fontWeight: 600 }} noWrap>
                                  {card.course.title}
                                </Typography>
                                <Typography sx={{ color: 'rgba(237,240,247,0.64)' }} noWrap>
                                  {card.course.instructor?.name || 'CreatorHub Team'}
                                </Typography>
                              </Box>
                              <Chip
                                size="small"
                                label={
                                  card.isCompleted
                                    ? tt('Fullført', 'Completed')
                                    : tt(`${card.progressPercent}%`, `${card.progressPercent}%`)
                                }
                                sx={{
                                  color: '#edf0f7',
                                  bgcolor: 'rgba(248,179,33,0.12)',
                                  border: 'var(--academy-hairline-width, 1px) solid rgba(248,179,33,0.22)',
                                }}
                              />
                            </Stack>

                            <Typography sx={{ mt: 0.7, color: 'rgba(237,240,247,0.72)' }}>
                              {card.nextLesson?.title || tt('Klar til neste ferdighet', 'Ready for the next skill')}
                            </Typography>

                            <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.8 }}>
                              <LinearProgress
                                variant="determinate"
                                value={card.progressPercent}
                                sx={{
                                  flex: 1,
                                  height: 6,
                                  borderRadius: 999,
                                  bgcolor: 'rgba(255,255,255,0.14)',
                                  '& .MuiLinearProgress-bar': {
                                    borderRadius: 999,
                                    background: 'linear-gradient(90deg, #f8b321 0%, #ffcf57 100%)',
                                  },
                                }}
                              />
                              <Typography sx={{ color: '#f8d56f', fontWeight: 700 }}>{card.progressPercent}%</Typography>
                            </Stack>

                            <Stack direction="row" spacing={1.2} flexWrap="wrap" useFlexGap sx={{ mt: 0.8 }}>
                              <Typography sx={{ fontSize: 12, color: 'rgba(237,240,247,0.64)' }}>
                                {tt(
                                  `${card.completedLessons}/${Math.max(card.totalLessons, 1)} ferdigheter`,
                                  `${card.completedLessons}/${Math.max(card.totalLessons, 1)} skills`,
                                )}
                              </Typography>
                              <Typography sx={{ fontSize: 12, color: 'rgba(237,240,247,0.64)' }}>
                                {tt(`${card.noteCount} notater`, `${card.noteCount} notes`)}
                              </Typography>
                              <Typography sx={{ fontSize: 12, color: 'rgba(237,240,247,0.64)' }}>
                                {tt(`${card.bookmarkCount} bokmerker`, `${card.bookmarkCount} bookmarks`)}
                              </Typography>
                            </Stack>

                            <Stack direction="row" spacing={0.8} sx={{ mt: 1 }}>
                              <Button
                                fullWidth
                                startIcon={<PlayArrow />}
                                onClick={() => openCourse(card)}
                                sx={{
                                  textTransform: 'none',
                                  color: '#0f0f0f',
                                  background: 'linear-gradient(180deg, #ffd44e, #f2a616)',
                                  fontWeight: 700,
                                }}
                              >
                                {tt('Fortsett', 'Continue')}
                              </Button>
                              <Button
                                fullWidth
                                variant="outlined"
                                startIcon={<BookmarkBorder />}
                                onClick={() => openResources(card)}
                                sx={{
                                  textTransform: 'none',
                                  color: '#edf0f7',
                                  borderColor: 'rgba(255,255,255,0.14)',
                                }}
                              >
                                {tt('Ressurser', 'Resources')}
                              </Button>
                            </Stack>
                          </Box>
                        ))}
                      </Box>
                    </Box>

                    <Box sx={{ ...panelSx, p: 1 }}>
                      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.8 }}>
                        <Typography sx={{ fontSize: { xs: 28, md: 42 }, fontWeight: 600, lineHeight: 1 }}>
                          {tt('Siste aktivitet', 'Recent activity')}
                        </Typography>
                        <Chip
                          label={tt(`${recentActivity.length} oppdateringer`, `${recentActivity.length} updates`)}
                          sx={{
                            color: '#edf0f7',
                            bgcolor: 'rgba(255,255,255,0.06)',
                            border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.12)',
                          }}
                        />
                      </Stack>
                      <Stack spacing={0.8}>
                        {recentActivity.length > 0 ? (
                          recentActivity.map((item, index) => (
                            <Stack
                              key={item.id}
                              direction="row"
                              spacing={0.8}
                              alignItems="flex-start"
                              sx={{
                                px: 0.9,
                                py: 0.85,
                                borderRadius: 1,
                                border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.1)',
                                bgcolor: index === 0 ? 'rgba(248,179,33,0.08)' : 'rgba(10,14,22,0.7)',
                              }}
                            >
                              <Avatar sx={{ width: 30, height: 30, bgcolor: 'rgba(248,179,33,0.78)', color: '#111' }}>
                                {item.title.charAt(0).toUpperCase()}
                              </Avatar>
                              <Box sx={{ flex: 1, minWidth: 0 }}>
                                <Typography sx={{ fontWeight: 700 }} noWrap>
                                  {item.title}
                                </Typography>
                                <Typography sx={{ color: 'rgba(237,240,247,0.72)' }} noWrap>
                                  {item.detail}
                                </Typography>
                              </Box>
                              <Typography sx={{ fontSize: 12, color: 'rgba(237,240,247,0.58)' }}>
                                {item.timestampLabel}
                              </Typography>
                            </Stack>
                          ))
                        ) : (
                          <Typography sx={{ color: 'rgba(237,240,247,0.64)' }}>
                            {tt('Ingen aktivitet registrert ennå.', 'No activity recorded yet.')}
                          </Typography>
                        )}
                      </Stack>
                    </Box>
                  </>
                )}
              </Box>

              <Box sx={{ minHeight: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Box sx={{ ...panelSx, p: 1 }}>
                  <Typography sx={{ fontSize: 36, lineHeight: 1, fontWeight: 600 }}>
                    {activeView === 'achievements' ? tt('Læringspoeng', 'Learning points') : tt('Denne uken', 'This week')}
                  </Typography>
                  {activeView === 'achievements' ? (
                    <>
                      <Typography sx={{ mt: 0.7, fontSize: 42, lineHeight: 1, fontWeight: 700, color: '#f8d56f' }}>
                        {learningPoints.toLocaleString('en-US')}
                      </Typography>
                      <Typography sx={{ mt: 0.45, color: 'rgba(237,240,247,0.74)' }}>
                        {tt(
                          'Poeng bygges av fullførte ferdigheter, notater, bokmerker og gjennomførte kurs.',
                          'Points grow through completed skills, notes, bookmarks, and finished courses.',
                        )}
                      </Typography>
                    </>
                  ) : (
                    <>
                      <Stack spacing={0.8} sx={{ mt: 0.9 }}>
                        {weekPlan.map((item) => (
                          <Box
                            key={item.id}
                            sx={{
                              px: 0.8,
                              py: 0.8,
                              borderRadius: 1,
                              border:
                                item.tone === 'attention'
                                  ? 'var(--academy-hairline-width, 1px) solid rgba(226,117,74,0.24)'
                                  : item.tone === 'celebrate'
                                    ? 'var(--academy-hairline-width, 1px) solid rgba(154,210,123,0.24)'
                                    : item.tone === 'primary'
                                      ? 'var(--academy-hairline-width, 1px) solid rgba(248,179,33,0.24)'
                                      : 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.1)',
                              bgcolor:
                                item.tone === 'attention'
                                  ? 'rgba(72,28,21,0.72)'
                                  : item.tone === 'celebrate'
                                    ? 'rgba(17,31,22,0.72)'
                                    : item.tone === 'primary'
                                      ? 'rgba(248,179,33,0.08)'
                                      : 'rgba(10,14,22,0.72)',
                            }}
                          >
                            <Typography sx={{ fontWeight: 700 }}>{item.title}</Typography>
                            <Typography sx={{ fontSize: 12, color: 'rgba(237,240,247,0.66)', mt: 0.2 }}>
                              {item.detail}
                            </Typography>
                          </Box>
                        ))}
                      </Stack>
                    </>
                  )}
                </Box>

                <Box sx={{ ...panelSx, p: 1 }}>
                  <Typography sx={{ fontSize: 34, lineHeight: 1, fontWeight: 600, mb: 0.8 }}>
                    {tt('Notater og bokmerker', 'Notes and bookmarks')}
                  </Typography>
                  <Stack spacing={0.8}>
                    {recentNotes.length > 0 ? (
                      recentNotes.map((note) => (
                        <Box
                          key={note.id}
                          sx={{
                            px: 0.8,
                            py: 0.8,
                            borderRadius: 1,
                            border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.1)',
                            bgcolor: 'rgba(10,14,22,0.72)',
                          }}
                        >
                          <Typography sx={{ fontWeight: 600 }}>{note.text}</Typography>
                          <Typography sx={{ fontSize: 12, color: 'rgba(237,240,247,0.62)', mt: 0.25 }}>
                            {note.context}
                          </Typography>
                        </Box>
                      ))
                    ) : recentBookmarks.length > 0 ? (
                      recentBookmarks.map((bookmark) => (
                        <Box
                          key={bookmark.id}
                          sx={{
                            px: 0.8,
                            py: 0.8,
                            borderRadius: 1,
                            border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.1)',
                            bgcolor: 'rgba(10,14,22,0.72)',
                          }}
                        >
                          <Typography sx={{ fontWeight: 600 }}>{bookmark.text}</Typography>
                          <Typography sx={{ fontSize: 12, color: 'rgba(237,240,247,0.62)', mt: 0.25 }}>
                            {bookmark.context}
                          </Typography>
                        </Box>
                      ))
                    ) : (
                      <Typography sx={{ color: 'rgba(237,240,247,0.64)' }}>
                        {tt(
                          'Studenten får notater og bokmerker her når de lagres fra videospilleren.',
                          'Notes and bookmarks will show up here once they are saved in the video player.',
                        )}
                      </Typography>
                    )}
                  </Stack>
                </Box>

                <Box sx={{ ...panelSx, p: 1 }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.8 }}>
                    <Typography sx={{ fontSize: 34, lineHeight: 1, fontWeight: 600 }}>
                      {activeView === 'achievements' ? tt('Neste steg', 'Next steps') : tt('Utforsk mer', 'Explore more')}
                    </Typography>
                    <Button
                      size="small"
                      onClick={() => setLocation('/academy')}
                      endIcon={<OpenInNew />}
                      sx={{
                        textTransform: 'none',
                        color: '#edf0f7',
                        border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.16)',
                      }}
                    >
                      {tt('Åpne academy', 'Open Academy')}
                    </Button>
                  </Stack>

                  <Stack spacing={0.8}>
                    {recommendedCourses.length > 0 ? (
                      recommendedCourses.map((entry, index) => (
                        <Box
                          key={entry.course.id}
                          sx={{
                            px: 0.8,
                            py: 0.85,
                            borderRadius: 1,
                            border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.1)',
                            background: placeholderBackgrounds[(index + 1) % placeholderBackgrounds.length],
                          }}
                        >
                          <Typography sx={{ fontWeight: 700 }} noWrap>
                            {entry.course.title}
                          </Typography>
                          <Typography sx={{ fontSize: 12, color: 'rgba(237,240,247,0.7)', mt: 0.2 }}>
                            {entry.course.instructor?.name || 'CreatorHub Team'}
                          </Typography>
                          <Stack direction="row" spacing={0.8} sx={{ mt: 0.65 }}>
                            <Button
                              size="small"
                              onClick={() => {
                                const syntheticCard = buildCourseCardData(entry.course, []);
                                openCourse(syntheticCard);
                              }}
                              sx={{
                                textTransform: 'none',
                                color: '#0f0f0f',
                                background: 'linear-gradient(180deg, #ffd44e, #f2a616)',
                                fontWeight: 700,
                              }}
                            >
                              {tt('Start kurs', 'Start course')}
                            </Button>
                            <Button
                              size="small"
                              variant="outlined"
                              onClick={() => setLocation('/community')}
                              startIcon={activeView === 'achievements' ? <Stars fontSize="small" /> : <ForumOutlined fontSize="small" />}
                              sx={{
                                textTransform: 'none',
                                color: '#edf0f7',
                                borderColor: 'rgba(255,255,255,0.14)',
                              }}
                            >
                              {activeView === 'achievements' ? tt('Del resultat', 'Share progress') : tt('Community', 'Community')}
                            </Button>
                          </Stack>
                        </Box>
                      ))
                    ) : (
                      <Box
                        sx={{
                          px: 0.8,
                          py: 0.85,
                          borderRadius: 1,
                          border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.1)',
                          bgcolor: 'rgba(10,14,22,0.72)',
                        }}
                      >
                        <Typography sx={{ fontWeight: 700 }}>
                          {tt('Bygg videre på læringen', 'Build on your learning')}
                        </Typography>
                        <Typography sx={{ fontSize: 12, color: 'rgba(237,240,247,0.66)', mt: 0.2 }}>
                          {tt(
                            'Når flere kurs er tilgjengelige, vises anbefalinger her for studenten.',
                            'When more courses are available, learner recommendations will show up here.',
                          )}
                        </Typography>
                      </Box>
                    )}

                    <Box
                      sx={{
                        px: 0.8,
                        py: 0.85,
                        borderRadius: 1,
                        border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.1)',
                        bgcolor: 'rgba(10,14,22,0.72)',
                      }}
                    >
                      <Stack direction="row" spacing={0.8} alignItems="center">
                        <TipsAndUpdates sx={{ color: '#f8d56f' }} />
                        <Box>
                          <Typography sx={{ fontWeight: 700 }}>
                            {tt('Studentsiden er nå separat', 'Student view is now separate')}
                          </Typography>
                          <Typography sx={{ fontSize: 12, color: 'rgba(237,240,247,0.66)', mt: 0.2 }}>
                            {tt(
                              'Instruktørverktøy som curriculum, monetization og enrollment er flyttet ut av denne flaten.',
                              'Instructor tools like curriculum, monetization, and enrollment are intentionally kept out of this learner interface.',
                            )}
                          </Typography>
                        </Box>
                      </Stack>
                    </Box>
                  </Stack>
                </Box>
              </Box>
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

export default withUniversalIntegration(AcademyStudentDashboardStudio, {
  componentId: 'academy-student-dashboard-studio',
  componentName: 'Academy Student Dashboard Studio',
  componentType: 'dashboard',
  componentCategory: 'academy',
  featureIds: ['student-dashboard', 'learning-path', 'student-insights', 'academy-engagement'],
});
