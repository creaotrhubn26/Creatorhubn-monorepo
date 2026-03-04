import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import {
  Add,
  Assessment,
  Campaign,
  Download,
  Edit,
  MailOutline,
  MonetizationOn,
  MoreHoriz,
  NotificationsNone,
  PeopleAlt,
  Publish,
  Save,
  Search,
  Subtitles,
  TrendingUp,
} from '@mui/icons-material';
import { useLocation } from 'wouter';
import { useAcademy, type Course, type Enrollment } from '@/contexts/AcademyContext';
import { withUniversalIntegration } from '@/integration/UniversalIntegrationHOC';
import { useAcademyLocale } from './academyLocale';
import AcademyBrandMark from './AcademyBrandMark';

interface AcademyEnrollmentStudioProps {
  courseId?: string;
  onSave?: (payload: Record<string, unknown>) => void;
  onCancel?: () => void;
}

type RangeFilter = '7d' | '30d' | '90d';
type CompletionFilter = 'all' | 'high' | 'mid' | 'low';

interface StudentEnrollmentItem {
  id: string;
  name: string;
  role: string;
  primaryCohort: string;
  primaryCourseId: string;
  courseIds: string[];
  sourceCount: number;
  completionRate: number;
  enrolledScore: number;
  tags: string[];
  avatarTheme: number;
  enrolledAt: string;
  isManual?: boolean;
}

interface ActivityItem {
  id: string;
  author: string;
  course: string;
  action: string;
  timestamp: string;
}

interface TopCohortItem {
  id: string;
  name: string;
  students: number;
  avgCompletion: number;
  imageTheme: number;
}

const panelSx = {
  borderRadius: 1.4,
  border: '1px solid rgba(255,255,255,0.08)',
  background: 'linear-gradient(145deg, rgba(20,24,36,0.88), rgba(11,14,22,0.96))',
};

const placeholderBackgrounds = [
  'linear-gradient(145deg, rgba(24,30,42,0.92), rgba(12,16,24,0.98)), radial-gradient(circle at 85% 16%, rgba(245,166,35,0.34), rgba(0,0,0,0))',
  'linear-gradient(145deg, rgba(18,23,34,0.95), rgba(10,14,21,0.98)), radial-gradient(circle at 12% 82%, rgba(245,166,35,0.24), rgba(0,0,0,0))',
  'linear-gradient(145deg, rgba(17,21,31,0.94), rgba(8,12,18,0.98)), radial-gradient(circle at 72% 10%, rgba(114,158,225,0.2), rgba(0,0,0,0))',
  'linear-gradient(145deg, rgba(19,24,36,0.93), rgba(11,14,22,0.98)), radial-gradient(circle at 70% 22%, rgba(248,179,33,0.22), rgba(0,0,0,0))',
];

const fallbackCourses: Course[] = [
  {
    id: 'enrollment-course-1',
    title: 'Directing Masterclass',
    description: 'Premium directing education with mentor check-ins.',
    instructor: {
      id: 'enrollment-instructor-1',
      name: 'Norwedfilm',
      avatar: '',
      bio: 'Film director',
      profession: 'videographer',
    },
    thumbnail: '',
    videoUrl: '/assets/academy/intro-video.mp4',
    duration: 336,
    level: 'advanced',
    category: 'videography',
    tags: ['directing', 'enrollment'],
    price: 36984,
    isFree: false,
    isPublished: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    rating: 4.8,
    studentCount: 232,
    lessons: [],
    prerequisites: [],
    learningOutcomes: [],
    resources: [],
  },
  {
    id: 'enrollment-course-2',
    title: 'Advanced Cinematography',
    description: 'Cinematic workflows from prep to final grade.',
    instructor: {
      id: 'enrollment-instructor-2',
      name: 'CreatorHub Academy',
      avatar: '',
      bio: 'Academy editorial team',
      profession: 'videographer',
    },
    thumbnail: '',
    videoUrl: '/assets/academy/intro-video.mp4',
    duration: 480,
    level: 'advanced',
    category: 'videography',
    tags: ['cinematography', 'enrollment'],
    price: 28740,
    isFree: false,
    isPublished: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    rating: 4.7,
    studentCount: 145,
    lessons: [],
    prerequisites: [],
    learningOutcomes: [],
    resources: [],
  },
  {
    id: 'enrollment-course-3',
    title: 'Drone Cinematography Bootcamp',
    description: 'Flight-safe cinematic framing and pacing.',
    instructor: {
      id: 'enrollment-instructor-3',
      name: 'CreatorHub Academy',
      avatar: '',
      bio: 'Drone production team',
      profession: 'videographer',
    },
    thumbnail: '',
    videoUrl: '/assets/academy/intro-video.mp4',
    duration: 420,
    level: 'intermediate',
    category: 'videography',
    tags: ['drone', 'enrollment'],
    price: 24990,
    isFree: false,
    isPublished: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    rating: 4.6,
    studentCount: 88,
    lessons: [],
    prerequisites: [],
    learningOutcomes: [],
    resources: [],
  },
];

const defaultStudents = (): StudentEnrollmentItem[] => [
  {
    id: 'student-1',
    name: 'Sarah Johnson',
    role: 'Vocal Producer',
    primaryCohort: 'Vocal Production Pros',
    primaryCourseId: 'enrollment-course-1',
    courseIds: ['enrollment-course-1', 'enrollment-course-2'],
    sourceCount: 9,
    completionRate: 95,
    enrolledScore: 950,
    tags: ['Core', 'Mentor'],
    avatarTheme: 0,
    enrolledAt: '2026-03-02T09:00:00.000Z',
  },
  {
    id: 'student-2',
    name: 'Adrian Berglund',
    role: 'Cinematographer',
    primaryCohort: 'Cinematic Filmmaking 2',
    primaryCourseId: 'enrollment-course-2',
    courseIds: ['enrollment-course-2'],
    sourceCount: 6,
    completionRate: 84,
    enrolledScore: 548,
    tags: ['Invite Only'],
    avatarTheme: 1,
    enrolledAt: '2026-02-28T12:30:00.000Z',
  },
  {
    id: 'student-3',
    name: 'Lisa Holden',
    role: 'Drone Pilot',
    primaryCohort: 'Drone Cinematography',
    primaryCourseId: 'enrollment-course-3',
    courseIds: ['enrollment-course-3', 'enrollment-course-1'],
    sourceCount: 8,
    completionRate: 82,
    enrolledScore: 823,
    tags: ['Early Access'],
    avatarTheme: 2,
    enrolledAt: '2026-02-20T08:00:00.000Z',
  },
  {
    id: 'student-4',
    name: 'Jonas Ek',
    role: 'Video Editor',
    primaryCohort: 'Color Grading Workshop',
    primaryCourseId: 'enrollment-course-2',
    courseIds: ['enrollment-course-2', 'enrollment-course-1', 'enrollment-course-3'],
    sourceCount: 8,
    completionRate: 79,
    enrolledScore: 630,
    tags: ['Fast Track'],
    avatarTheme: 3,
    enrolledAt: '2026-02-18T16:45:00.000Z',
  },
  {
    id: 'student-5',
    name: 'Nadia Antonsen',
    role: 'Street Photographer',
    primaryCohort: 'Photography Mastery',
    primaryCourseId: 'enrollment-course-1',
    courseIds: ['enrollment-course-1'],
    sourceCount: 8,
    completionRate: 76,
    enrolledScore: 369,
    tags: ['Core'],
    avatarTheme: 0,
    enrolledAt: '2026-02-12T10:15:00.000Z',
  },
  {
    id: 'student-6',
    name: 'Even Midtskogen',
    role: 'Film Director',
    primaryCohort: 'Directing Masterclass 1',
    primaryCourseId: 'enrollment-course-1',
    courseIds: ['enrollment-course-1', 'enrollment-course-2'],
    sourceCount: 6,
    completionRate: 74,
    enrolledScore: 746,
    tags: ['Closed'],
    avatarTheme: 1,
    enrolledAt: '2026-02-04T13:25:00.000Z',
  },
];

const defaultActivities = (): ActivityItem[] => [
  {
    id: 'activity-1',
    author: 'Jonas Ek',
    course: 'Directing Masterclass',
    action: 'completed Chapter 3',
    timestamp: '32m ago',
  },
  {
    id: 'activity-2',
    author: 'Erika Holmstad',
    course: 'Photography Mastery',
    action: 'joined Students room',
    timestamp: '5h ago',
  },
  {
    id: 'activity-3',
    author: 'Lars Eriksen',
    course: 'Cinematic Filmmaking 2',
    action: 'submitted assignment',
    timestamp: '5h ago',
  },
];

const toNok = (value: number): string =>
  new Intl.NumberFormat('nb-NO', {
    style: 'currency',
    currency: 'NOK',
    maximumFractionDigits: 0,
  }).format(Math.max(0, value));

const toCompactNumber = (value: number): string =>
  new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(Math.max(0, value));

const displayNameFromStudentId = (studentId: string, index: number): string => {
  const normalized = String(studentId || '').trim();
  if (!normalized) return `Student ${index + 1}`;
  const beforeAt = normalized.includes('@') ? normalized.split('@')[0] : normalized;
  const parts = beforeAt
    .replace(/[_.]+/g, '-')
    .split('-')
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length === 0) return `Student ${index + 1}`;
  return parts
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
};

const progressFromEnrollment = (enrollment: Enrollment): number => {
  if (!Array.isArray(enrollment.progress) || enrollment.progress.length === 0) return 0;
  const total = enrollment.progress.reduce((sum, item) => sum + Number(item?.progress || 0), 0);
  return Math.round(total / enrollment.progress.length);
};

const buildStudentsFromEnrollments = (enrollments: Enrollment[], courses: Course[]): StudentEnrollmentItem[] => {
  const grouped = new Map<
    string,
    {
      courseIds: string[];
      cohortNames: string[];
      progressValues: number[];
      enrolledAt: string;
    }
  >();

  enrollments.forEach((enrollment, index) => {
    const studentId = String(enrollment?.studentId || `student-${index}`);
    const entry = grouped.get(studentId) || {
      courseIds: [],
      cohortNames: [],
      progressValues: [],
      enrolledAt: enrollment?.enrolledAt || new Date().toISOString(),
    };

    const courseId = String(enrollment?.courseId || '');
    if (courseId && !entry.courseIds.includes(courseId)) {
      entry.courseIds.push(courseId);
      const matchingCourse = courses.find((course) => String(course.id) === courseId);
      if (matchingCourse?.title) {
        entry.cohortNames.push(matchingCourse.title);
      }
    }

    entry.progressValues.push(progressFromEnrollment(enrollment));

    if (new Date(enrollment?.enrolledAt || 0).getTime() > new Date(entry.enrolledAt).getTime()) {
      entry.enrolledAt = enrollment.enrolledAt;
    }

    grouped.set(studentId, entry);
  });

  return Array.from(grouped.entries()).map(([studentId, entry], index) => {
    const completionRate =
      entry.progressValues.length === 0
        ? 0
        : Math.round(entry.progressValues.reduce((sum, value) => sum + value, 0) / entry.progressValues.length);

    const primaryCourseId = entry.courseIds[0] || String(courses[0]?.id || `course-${index}`);
    const primaryCourse = courses.find((course) => String(course.id) === String(primaryCourseId));

    return {
      id: `academy-enrollment-${studentId}`,
      name: displayNameFromStudentId(studentId, index),
      role: primaryCourse?.level ? `${primaryCourse.level.charAt(0).toUpperCase()}${primaryCourse.level.slice(1)} Learner` : 'Learner',
      primaryCohort: primaryCourse?.title || entry.cohortNames[0] || 'Academy Cohort',
      primaryCourseId: String(primaryCourseId),
      courseIds: entry.courseIds,
      sourceCount: Math.max(1, entry.courseIds.length * 2),
      completionRate,
      enrolledScore: Math.max(80, completionRate * Math.max(1, entry.courseIds.length)),
      tags: completionRate >= 85 ? ['Top Performer'] : completionRate >= 65 ? ['Active'] : ['Needs Follow-up'],
      avatarTheme: index % placeholderBackgrounds.length,
      enrolledAt: entry.enrolledAt,
    };
  });
};

function AcademyEnrollmentStudio({ courseId, onSave, onCancel }: AcademyEnrollmentStudioProps) {
  const [, setLocation] = useLocation();
  const { state, getCourse, updateCourse } = useAcademy();
  
  const { navLabel, tt } = useAcademyLocale();

  const [leftNav, setLeftNav] = useState('enrollment');
  const [selectedCourseId, setSelectedCourseId] = useState(courseId || 'all');
  const [rangeFilter, setRangeFilter] = useState<RangeFilter>('30d');
  const [completionFilter, setCompletionFilter] = useState<CompletionFilter>('all');
  const [searchValue, setSearchValue] = useState('');
  const [saveMessage, setSaveMessage] = useState('');

  const [fallbackStudentItems] = useState<StudentEnrollmentItem[]>(defaultStudents);
  const [manualStudents, setManualStudents] = useState<StudentEnrollmentItem[]>([]);
  const [activityFeed, setActivityFeed] = useState<ActivityItem[]>(defaultActivities);
  const [featureFlags, setFeatureFlags] = useState({
    earlyAccess: true,
    invitationOnly: true,
    closed: false,
    dripRelease: false,
  });

  const courseItems = useMemo(() => {
    if (Array.isArray(state?.courses) && state.courses.length > 0) {
      return state.courses;
    }
    return fallbackCourses;
  }, [state?.courses]);

  const academyEnrollments = useMemo(
    () => (Array.isArray(state?.enrollments) ? state.enrollments : []),
    [state?.enrollments],
  );

  const activeCourse = useMemo(() => {
    const fromParam = courseId ? getCourse(courseId) : null;
    if (fromParam) return fromParam;

    if (selectedCourseId !== 'all') {
      const fromSelected = courseItems.find((course) => String(course.id) === String(selectedCourseId));
      if (fromSelected) return fromSelected;
    }

    return state.currentCourse || courseItems[0] || fallbackCourses[0];
  }, [courseId, courseItems, getCourse, selectedCourseId, state.currentCourse]);

  const enrollmentStudents = useMemo(
    () => buildStudentsFromEnrollments(academyEnrollments, courseItems),
    [academyEnrollments, courseItems],
  );

  const baseStudents = useMemo(() => {
    const source = enrollmentStudents.length > 0 ? enrollmentStudents : fallbackStudentItems;
    return [...source, ...manualStudents];
  }, [enrollmentStudents, fallbackStudentItems, manualStudents]);

  useEffect(() => {
    analytics.trackEvent('academy_enrollment_studio_opened', {
      courseId: activeCourse?.id || null,
      studentCount: baseStudents.length,
      enrollmentCount: academyEnrollments.length,
      timestamp: Date.now(),
    });

    debugging.logIntegration('info', 'AcademyEnrollmentStudio opened', {
      courseId: activeCourse?.id || null,
      studentCount: baseStudents.length,
      enrollmentCount: academyEnrollments.length,
    });
  }, [academyEnrollments.length, activeCourse?.id, analytics, baseStudents.length, debugging]);

  const visibleStudents = useMemo(() => {
    const now = Date.now();
    const rangeDays = rangeFilter === '7d' ? 7 : rangeFilter === '30d' ? 30 : 90;
    const since = now - rangeDays * 24 * 60 * 60 * 1000;
    const query = searchValue.trim().toLowerCase();

    return baseStudents.filter((student) => {
      const enrolledAtTime = new Date(student.enrolledAt).getTime();
      const inRange = Number.isNaN(enrolledAtTime) ? true : enrolledAtTime >= since;
      if (!inRange) return false;

      const matchesCourse =
        selectedCourseId === 'all'
          ? true
          : student.courseIds.some((id) => String(id) === String(selectedCourseId));
      if (!matchesCourse) return false;

      const matchesCompletion =
        completionFilter === 'all'
          ? true
          : completionFilter === 'high'
            ? student.completionRate >= 85
            : completionFilter === 'mid'
              ? student.completionRate >= 65 && student.completionRate < 85
              : student.completionRate < 65;
      if (!matchesCompletion) return false;

      if (!query) return true;
      return (
        student.name.toLowerCase().includes(query) ||
        student.role.toLowerCase().includes(query) ||
        student.primaryCohort.toLowerCase().includes(query) ||
        student.tags.some((tag) => tag.toLowerCase().includes(query))
      );
    });
  }, [baseStudents, completionFilter, rangeFilter, searchValue, selectedCourseId]);

  const totals = useMemo(() => {
    const totalStudents = baseStudents.length;
    const avgCompletion =
      totalStudents === 0
        ? 0
        : Math.round(baseStudents.reduce((sum, student) => sum + student.completionRate, 0) / totalStudents);
    const enrolledTotal = baseStudents.reduce((sum, student) => sum + student.enrolledScore, 0);
    const avgEnrollScore = totalStudents === 0 ? 0 : Math.round(enrolledTotal / totalStudents);
    const activeCount = baseStudents.filter((student) => student.completionRate >= 75).length;

    return {
      totalStudents,
      avgCompletion,
      avgEnrollScore,
      activeCount,
    };
  }, [baseStudents]);

  const distribution = useMemo(() => {
    const excellent = baseStudents.filter((student) => student.completionRate >= 90).length;
    const healthy = baseStudents.filter(
      (student) => student.completionRate >= 75 && student.completionRate < 90,
    ).length;
    const improving = baseStudents.filter(
      (student) => student.completionRate >= 60 && student.completionRate < 75,
    ).length;
    const atRisk = baseStudents.filter((student) => student.completionRate < 60).length;

    const total = Math.max(1, excellent + healthy + improving + atRisk);

    return {
      excellent,
      healthy,
      improving,
      atRisk,
      excellentPct: Math.round((excellent / total) * 100),
      healthyPct: Math.round((healthy / total) * 100),
      improvingPct: Math.round((improving / total) * 100),
      atRiskPct: Math.round((atRisk / total) * 100),
    };
  }, [baseStudents]);

  const donutStyle = useMemo(() => {
    const excellentDeg = distribution.excellentPct * 3.6;
    const healthyDeg = distribution.healthyPct * 3.6;
    const improvingDeg = distribution.improvingPct * 3.6;
    const atRiskDeg = distribution.atRiskPct * 3.6;

    return `conic-gradient(#f8b321 0deg ${excellentDeg}deg, #8ea6d6 ${excellentDeg}deg ${excellentDeg + healthyDeg}deg, #9acd6f ${excellentDeg + healthyDeg}deg ${excellentDeg + healthyDeg + improvingDeg}deg, #c56f58 ${excellentDeg + healthyDeg + improvingDeg}deg ${excellentDeg + healthyDeg + improvingDeg + atRiskDeg}deg, rgba(255,255,255,0.1) ${excellentDeg + healthyDeg + improvingDeg + atRiskDeg}deg 360deg)`;
  }, [distribution.excellentPct, distribution.healthyPct, distribution.improvingPct, distribution.atRiskPct]);

  const topCohorts = useMemo(() => {
    const grouped = new Map<string, { students: number; completionTotal: number }>();

    baseStudents.forEach((student) => {
      const entry = grouped.get(student.primaryCohort) || { students: 0, completionTotal: 0 };
      entry.students += 1;
      entry.completionTotal += student.completionRate;
      grouped.set(student.primaryCohort, entry);
    });

    const items: TopCohortItem[] = Array.from(grouped.entries()).map(([name, values], index) => ({
      id: `cohort-insight-${index}`,
      name,
      students: values.students,
      avgCompletion: Math.round(values.completionTotal / Math.max(values.students, 1)),
      imageTheme: index % placeholderBackgrounds.length,
    }));

    return items.sort((a, b) => b.students - a.students).slice(0, 3);
  }, [baseStudents]);

  const enrollmentCards = useMemo(() => {
    return courseItems.slice(0, 2).map((course, index) => {
      const forCourse = baseStudents.filter((student) =>
        student.courseIds.some((id) => String(id) === String(course.id)),
      );
      const avgCompletion =
        forCourse.length === 0
          ? 0
          : Math.round(forCourse.reduce((sum, student) => sum + student.completionRate, 0) / forCourse.length);

      return {
        id: String(course.id),
        title: course.title,
        cohortCount: forCourse.length,
        avgCompletion,
        imageTheme: index % placeholderBackgrounds.length,
        sources: Math.max(0, forCourse.reduce((sum, student) => sum + student.sourceCount, 0)),
      };
    });
  }, [baseStudents, courseItems]);

  const addStudent = useCallback(() => {
    const index = baseStudents.length + 1;
    const now = new Date().toISOString();
    const targetCourseId =
      selectedCourseId !== 'all' ? selectedCourseId : String(activeCourse?.id || courseItems[0]?.id || 'enrollment-course-1');

    const targetCourse = courseItems.find((course) => String(course.id) === String(targetCourseId));

    const newStudent: StudentEnrollmentItem = {
      id: `manual-student-${Date.now()}`,
      name: `Guest Student ${index}`,
      role: 'Academy Guest',
      primaryCohort: targetCourse?.title || 'Academy Cohort',
      primaryCourseId: targetCourseId,
      courseIds: [targetCourseId],
      sourceCount: 1,
      completionRate: 0,
      enrolledScore: 0,
      tags: ['New'],
      avatarTheme: index % placeholderBackgrounds.length,
      enrolledAt: now,
      isManual: true,
    };

    setManualStudents((prev) => [newStudent, ...prev]);
    setActivityFeed((prev) => [
      {
        id: `activity-${Date.now()}`,
        author: newStudent.name,
        course: newStudent.primaryCohort,
        action: 'added to enrollment',
        timestamp: 'now',
      },
      ...prev,
    ]);
  }, [activeCourse?.id, baseStudents.length, courseItems, selectedCourseId]);

  const toggleFeatureFlag = useCallback((key: keyof typeof featureFlags) => {
    setFeatureFlags((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  }, []);

  const saveEnrollmentSettings = useCallback(
    async (publish: boolean) => {
      const payload = {
        courseId: activeCourse?.id || null,
        selectedCourseId,
        rangeFilter,
        completionFilter,
        flags: featureFlags,
        students: baseStudents,
        analytics: {
          totalStudents: totals.totalStudents,
          avgCompletion: totals.avgCompletion,
          avgEnrollScore: totals.avgEnrollScore,
        },
        publish,
        updatedAt: new Date().toISOString(),
      };

      try {
        if (activeCourse?.id && Array.isArray(state?.courses) && state.courses.some((course) => String(course.id) === String(activeCourse.id))) {
          const nextTags = Array.from(new Set([...(activeCourse.tags || []), 'enrollment']));
          await updateCourse({
            ...activeCourse,
            tags: nextTags,
            isPublished: publish ? true : activeCourse.isPublished,
            updatedAt: new Date().toISOString(),
          });
        }

        setSaveMessage(
          publish
            ? tt('Påmeldingsoppdateringer publisert.', 'Enrollment updates published.')
            : tt('Påmeldingsoppdateringer lagret.', 'Enrollment updates saved.'),
        );
        onSave?.(payload);

        analytics.trackEvent(publish ? 'academy_enrollment_publish' : 'academy_enrollment_save', {
          courseId: activeCourse?.id || null,
          studentCount: totals.totalStudents,
          publish,
          timestamp: Date.now(),
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : tt('Kunne ikke lagre påmeldingsinnstillinger.', 'Failed to save enrollment settings.');
        setSaveMessage(message);
        debugging.logIntegration('error', 'Academy enrollment save failed', {
          courseId: activeCourse?.id || null,
          message,
        });
      }
    },
    [
      activeCourse,
      analytics,
      baseStudents,
      completionFilter,
      debugging,
      featureFlags,
      onSave,
      rangeFilter,
      selectedCourseId,
      state?.courses,
      tt,
      totals.avgCompletion,
      totals.avgEnrollScore,
      totals.totalStudents,
      updateCourse,
    ],
  );

  const leftNavItems = [
    { id: 'overview', label: navLabel('Overview'), route: '/academy-dashboard' },
    { id: 'curriculum', label: navLabel('Curriculum'), route: '/academy/curriculum' },
    { id: 'lessons', label: navLabel('Lessons'), route: '/academy/lesson-editor' },
    { id: 'media', label: navLabel('Media'), route: '/academy/media' },
    { id: 'assignments', label: navLabel('Assignments'), route: '/academy/assignments' },
    { id: 'enrollment', label: navLabel('Enrollment'), route: '/academy/enrollment' },
    { id: 'cohort', label: navLabel('Cohort Settings'), route: '/academy/cohort-settings' },
    { id: 'analytics', label: navLabel('Analytics'), route: '/academy/analytics' },
    { id: 'monetization', label: navLabel('Monetization'), route: '/academy/monetization' },
    { id: 'settings', label: navLabel('Settings'), route: '/academy/course-creator' },
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
            'radial-gradient(circle at 76% 14%, rgba(248,179,33,0.24), rgba(5,8,13,0) 42%), radial-gradient(circle at 14% 80%, rgba(82,121,204,0.14), rgba(6,8,14,0) 44%), linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0) 30%)',
        }}
      />

      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', lg: 'row' }, minHeight: '100vh', position: 'relative', zIndex: 1 }}>
        <Box
          component="aside"
          sx={{
            width: { xs: '100%', lg: 252 },
            borderRight: { xs: 'none', lg: '1px solid rgba(255,255,255,0.08)' },
            borderBottom: { xs: '1px solid rgba(255,255,255,0.08)', lg: 'none' },
            background: 'linear-gradient(180deg, rgba(10,13,22,0.95), rgba(8,10,16,0.96))',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <Stack spacing={2} sx={{ px: 2.5, py: 2.4 }}>
            <AcademyBrandMark />
            <Button
              variant="outlined"
              startIcon={<Add />}
              onClick={() => setLocation('/academy/course-creator')}
              sx={{
                justifyContent: 'flex-start',
                borderColor: 'rgba(248,179,33,0.55)',
                color: '#f8d56f',
                borderRadius: 1,
                textTransform: 'none',
                fontWeight: 600,
              }}
            >
              {tt('Opprett nytt kurs', 'Create New Course')}
            </Button>
          </Stack>

          <Stack spacing={0.5} sx={{ px: 1.5 }}>
            {leftNavItems.map((item) => {
              const active = item.id === leftNav;
              return (
                <Button
                  key={item.id}
                  onClick={() => {
                    setLeftNav(item.id);
                    setLocation(item.route);
                  }}
                  sx={{
                    justifyContent: 'flex-start',
                    color: active ? '#fce3a1' : 'rgba(237,240,247,0.82)',
                    borderRadius: 1,
                    textTransform: 'none',
                    px: 2,
                    py: 1.15,
                    border: active ? '1px solid rgba(248,179,33,0.35)' : '1px solid transparent',
                    background: active
                      ? 'linear-gradient(90deg, rgba(248,179,33,0.22), rgba(248,179,33,0.04))'
                      : 'transparent',
                  }}
                >
                  {item.label}
                </Button>
              );
            })}
          </Stack>

          <Box sx={{ mt: 'auto', p: 2 }}>
            <Button
              variant="text"
              startIcon={<Add />}
              onClick={addStudent}
              sx={{
                width: '100%',
                justifyContent: 'flex-start',
                color: '#edf0f7',
                textTransform: 'none',
                border: '1px solid rgba(255,255,255,0.14)',
                borderRadius: 1,
              }}
            >
              {tt('Legg til student', 'Add Student')}
            </Button>
          </Box>
        </Box>

        <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <Box
            sx={{
              height: 74,
              px: 3,
              borderBottom: '1px solid rgba(255,255,255,0.08)',
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
              <Chip
                label={activeCourse?.isPublished ? tt('Publisert', 'Published') : tt('Utkast', 'Draft')}
                size="small"
                sx={{ bgcolor: 'rgba(255,255,255,0.08)', color: '#edf0f7', fontWeight: 600 }}
              />
            </Stack>

            <Stack direction="row" spacing={1.2} alignItems="center">
              <IconButton size="small" sx={{ color: 'rgba(237,240,247,0.75)' }}>
                <NotificationsNone fontSize="small" />
              </IconButton>
              <IconButton size="small" sx={{ color: 'rgba(237,240,247,0.75)' }}>
                <MailOutline fontSize="small" />
              </IconButton>
              <Avatar sx={{ width: 34, height: 34, bgcolor: '#f8b321', color: '#111' }}>
                {String(activeCourse?.instructor?.name || 'N').charAt(0).toUpperCase()}
              </Avatar>
            </Stack>
          </Box>

          <Box
            sx={{
              flex: 1,
              minHeight: 0,
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', xl: 'minmax(0, 1fr) 390px' },
              gap: 2,
              px: 2,
              py: 2,
            }}
          >
            <Box sx={{ minHeight: 0, display: 'flex', flexDirection: 'column', gap: 1.4 }}>
              <Stack
                direction={{ xs: 'column', lg: 'row' }}
                spacing={1.2}
                justifyContent="space-between"
                alignItems={{ xs: 'stretch', lg: 'center' }}
              >
                <Typography sx={{ fontSize: 38, fontWeight: 600, letterSpacing: '0.02em' }}>
                  {tt('Studentpåmelding', 'Student Enrollment')}
                </Typography>

                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  <Button
                    variant="outlined"
                    startIcon={<Download />}
                    sx={{
                      textTransform: 'none',
                      borderColor: 'rgba(255,255,255,0.2)',
                      color: '#edf0f7',
                      borderRadius: 1,
                    }}
                  >
                    {tt('Eksporter', 'Export')}
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={<Assessment />}
                    sx={{
                      textTransform: 'none',
                      borderColor: 'rgba(255,255,255,0.2)',
                      color: '#edf0f7',
                      borderRadius: 1,
                    }}
                  >
                    {tt('Rapporter', 'Reports')}
                  </Button>
                  <Button
                    variant="contained"
                    startIcon={<Add />}
                    onClick={addStudent}
                    sx={{
                      textTransform: 'none',
                      borderRadius: 1,
                      color: '#0f0f0f',
                      background: 'linear-gradient(180deg, #ffd44e, #f2a616)',
                      boxShadow: '0 10px 24px rgba(248,179,33,0.25)',
                    }}
                  >
                    {tt('Legg til student', 'Add Student')}
                  </Button>
                </Stack>
              </Stack>

              {!!saveMessage && (
                <Typography
                  sx={{
                    px: 1.2,
                    py: 0.85,
                    borderRadius: 1,
                    border: '1px solid rgba(248,179,33,0.34)',
                    color: '#f8d56f',
                    bgcolor: 'rgba(248,179,33,0.08)',
                  }}
                >
                  {saveMessage}
                </Typography>
              )}

              <Box sx={{ ...panelSx, p: 1.2 }}>
                <Stack
                  direction={{ xs: 'column', md: 'row' }}
                  spacing={1}
                  justifyContent="space-between"
                  alignItems={{ xs: 'stretch', md: 'center' }}
                  sx={{ mb: 1 }}
                >
                  <Stack direction="row" spacing={1}>
                    <Select
                      size="small"
                      value={selectedCourseId}
                      onChange={(event) => setSelectedCourseId(String(event.target.value))}
                      sx={{
                        minWidth: 180,
                        color: '#edf0f7',
                        bgcolor: 'rgba(255,255,255,0.05)',
                        '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.16)' },
                      }}
                    >
                      <MenuItem value="all">{tt('Alle kurs', 'All Courses')}</MenuItem>
                      {courseItems.map((course) => (
                        <MenuItem key={course.id} value={course.id}>
                          {course.title}
                        </MenuItem>
                      ))}
                    </Select>

                    <Select
                      size="small"
                      value={rangeFilter}
                      onChange={(event) => setRangeFilter(event.target.value as RangeFilter)}
                      sx={{
                        minWidth: 140,
                        color: '#edf0f7',
                        bgcolor: 'rgba(255,255,255,0.05)',
                        '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.16)' },
                      }}
                    >
                      <MenuItem value="7d">{tt('Siste 7 dager', 'Last 7 days')}</MenuItem>
                      <MenuItem value="30d">{tt('Siste 30 dager', 'Last 30 days')}</MenuItem>
                      <MenuItem value="90d">{tt('Siste 90 dager', 'Last 90 days')}</MenuItem>
                    </Select>

                    <Select
                      size="small"
                      value={completionFilter}
                      onChange={(event) => setCompletionFilter(event.target.value as CompletionFilter)}
                      sx={{
                        minWidth: 150,
                        color: '#edf0f7',
                        bgcolor: 'rgba(255,255,255,0.05)',
                        '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.16)' },
                      }}
                    >
                      <MenuItem value="all">{tt('All fullføring', 'All Completion')}</MenuItem>
                      <MenuItem value="high">{tt('Høy (85%+)', 'High (85%+)')}</MenuItem>
                      <MenuItem value="mid">{tt('Middels (65-84%)', 'Mid (65-84%)')}</MenuItem>
                      <MenuItem value="low">{tt('Lav (<65%)', 'Low (<65%)')}</MenuItem>
                    </Select>
                  </Stack>

                  <Button
                    startIcon={<Add />}
                    onClick={addStudent}
                    sx={{
                      textTransform: 'none',
                      color: '#0f0f0f',
                      background: 'linear-gradient(180deg, #ffd44e, #f2a616)',
                      fontWeight: 700,
                    }}
                  >
                    {tt('Legg til student', 'Add Student')}
                  </Button>
                </Stack>

                <TextField
                  value={searchValue}
                  onChange={(event) => setSearchValue(event.target.value)}
                  placeholder={tt('Søk studenter...', 'Search students...')}
                  size="small"
                  InputProps={{
                    startAdornment: <Search fontSize="small" sx={{ mr: 0.7, color: 'rgba(237,240,247,0.6)' }} />,
                  }}
                  sx={{
                    width: '100%',
                    '& .MuiInputBase-root': {
                      bgcolor: 'rgba(11,14,22,0.8)',
                      color: '#edf0f7',
                    },
                  }}
                />

                <Box
                  sx={{
                    mt: 1.1,
                    display: 'grid',
                    gridTemplateColumns: {
                      xs: '1fr',
                      sm: 'repeat(2, minmax(0, 1fr))',
                      lg: 'repeat(4, minmax(0, 1fr))',
                    },
                    gap: 1,
                  }}
                >
                  <Box sx={{ ...panelSx, p: 1, borderColor: 'rgba(255,255,255,0.1)' }}>
                    <Typography sx={{ fontSize: 42, fontWeight: 700, lineHeight: 1 }}>
                      {toCompactNumber(totals.totalStudents)}
                    </Typography>
                    <Typography sx={{ color: 'rgba(237,240,247,0.8)' }}>{tt('Studenter', 'Students')}</Typography>
                    <Typography sx={{ fontSize: 12, color: 'rgba(237,240,247,0.64)' }}>
                      {tt('Side 1 av', 'Page 1 of')} {Math.max(1, Math.ceil(Math.max(totals.totalStudents, 1) / 50))}
                    </Typography>
                  </Box>

                  <Box sx={{ ...panelSx, p: 1, borderColor: 'rgba(255,255,255,0.1)' }}>
                    <Typography sx={{ fontSize: 42, fontWeight: 700, lineHeight: 1 }}>
                      {totals.activeCount}
                    </Typography>
                    <Typography sx={{ color: 'rgba(237,240,247,0.8)' }}>{tt('Aktive deltakere', 'Active Learners')}</Typography>
                    <Typography sx={{ fontSize: 12, color: '#95d57e' }}>{tt('Fullføring ≥ 75%', 'Completion ≥ 75%')}</Typography>
                  </Box>

                  <Box sx={{ ...panelSx, p: 1, borderColor: 'rgba(255,255,255,0.1)' }}>
                    <Typography sx={{ fontSize: 42, fontWeight: 700, lineHeight: 1 }}>
                      {totals.avgCompletion}%
                    </Typography>
                    <Typography sx={{ color: 'rgba(237,240,247,0.8)' }}>{tt('Gj.sn. fullføring', 'Avg Completion')}</Typography>
                    <Typography sx={{ fontSize: 12, color: 'rgba(237,240,247,0.64)' }}>{tt('Alle kohorter', 'All cohorts')}</Typography>
                  </Box>

                  <Box sx={{ ...panelSx, p: 1, borderColor: 'rgba(255,255,255,0.1)' }}>
                    <Typography sx={{ fontSize: 42, fontWeight: 700, lineHeight: 1 }}>
                      {totals.avgEnrollScore}
                    </Typography>
                    <Typography sx={{ color: 'rgba(237,240,247,0.8)' }}>Enrolled Index</Typography>
                    <Typography sx={{ fontSize: 12, color: '#95d57e' }}>Operational health</Typography>
                  </Box>
                </Box>

                <Box
                  sx={{
                    mt: 1.1,
                    borderRadius: 1,
                    overflowX: 'auto',
                    overflowY: 'hidden',
                    border: '1px solid rgba(255,255,255,0.09)',
                  }}
                >
                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: 'minmax(260px, 1.5fr) minmax(220px, 1fr) 0.7fr 0.55fr 0.45fr',
                      minWidth: 980,
                      px: 1,
                      py: 0.8,
                      background: 'rgba(255,255,255,0.04)',
                      borderBottom: '1px solid rgba(255,255,255,0.1)',
                    }}
                  >
                    <Typography sx={{ fontSize: 13, color: 'rgba(237,240,247,0.7)' }}>Name</Typography>
                    <Typography sx={{ fontSize: 13, color: 'rgba(237,240,247,0.7)' }}>Primary Cohort</Typography>
                    <Typography sx={{ fontSize: 13, color: 'rgba(237,240,247,0.7)' }}>{tt('Fullføring', 'Completion')}</Typography>
                    <Typography sx={{ fontSize: 13, color: 'rgba(237,240,247,0.7)' }}>Enrolled</Typography>
                    <Typography sx={{ fontSize: 13, color: 'rgba(237,240,247,0.7)', textAlign: 'right' }}>Actions</Typography>
                  </Box>

                  <Stack spacing={0}>
                    {visibleStudents.map((student) => (
                      <Box
                        key={student.id}
                        sx={{
                          display: 'grid',
                          gridTemplateColumns: 'minmax(260px, 1.5fr) minmax(220px, 1fr) 0.7fr 0.55fr 0.45fr',
                          minWidth: 980,
                          px: 1,
                          py: 1,
                          gap: 1,
                          background: 'rgba(8,11,18,0.6)',
                          borderBottom: '1px solid rgba(255,255,255,0.08)',
                          '&:hover': {
                            background: 'linear-gradient(90deg, rgba(248,179,33,0.12), rgba(255,255,255,0.02))',
                          },
                        }}
                      >
                        <Stack direction="row" spacing={1} alignItems="center" minWidth={0}>
                          <Avatar
                            sx={{
                              width: 42,
                              height: 42,
                              border: '1px solid rgba(255,255,255,0.14)',
                              bgcolor: 'rgba(248,179,33,0.32)',
                              backgroundImage: placeholderBackgrounds[student.avatarTheme % placeholderBackgrounds.length],
                            }}
                          >
                            {student.name.charAt(0).toUpperCase()}
                          </Avatar>
                          <Box minWidth={0}>
                            <Typography sx={{ fontWeight: 600 }} noWrap>
                              {student.name}
                            </Typography>
                            <Typography sx={{ fontSize: 12, color: 'rgba(237,240,247,0.66)' }} noWrap>
                              {student.role} · {student.courseIds.length}{' '}
                              {tt('kurs', student.courseIds.length === 1 ? 'course' : 'courses')}
                            </Typography>
                            <Stack direction="row" spacing={0.6} sx={{ mt: 0.4 }} flexWrap="wrap" useFlexGap>
                              {student.tags.slice(0, 2).map((tag) => (
                                <Chip
                                  key={`${student.id}-${tag}`}
                                  label={navLabel(tag)}
                                  size="small"
                                  sx={{
                                    height: 20,
                                    color: '#edf0f7',
                                    bgcolor: 'rgba(255,255,255,0.1)',
                                    fontSize: 11,
                                  }}
                                />
                              ))}
                            </Stack>
                          </Box>
                        </Stack>

                        <Box>
                          <Typography sx={{ fontWeight: 600 }} noWrap>
                            {student.primaryCohort}
                          </Typography>
                          <Typography sx={{ fontSize: 12, color: 'rgba(237,240,247,0.64)' }}>
                            {student.sourceCount} sources
                          </Typography>
                        </Box>

                        <Box>
                          <Typography sx={{ color: '#95d57e', fontWeight: 700 }}>
                            {student.completionRate}%
                          </Typography>
                          <LinearProgress
                            variant="determinate"
                            value={Math.min(100, Math.max(0, student.completionRate))}
                            sx={{
                              mt: 0.4,
                              height: 5,
                              borderRadius: 999,
                              bgcolor: 'rgba(255,255,255,0.14)',
                              '& .MuiLinearProgress-bar': {
                                borderRadius: 999,
                                background: 'linear-gradient(90deg, #8ecf76 0%, #f8b321 100%)',
                              },
                            }}
                          />
                        </Box>

                        <Typography sx={{ color: '#f8d56f', fontWeight: 700 }}>
                          {student.enrolledScore}
                        </Typography>

                        <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                          <IconButton size="small" sx={{ color: 'rgba(237,240,247,0.68)' }}>
                            <MailOutline fontSize="small" />
                          </IconButton>
                          <IconButton size="small" sx={{ color: 'rgba(237,240,247,0.68)' }}>
                            <Edit fontSize="small" />
                          </IconButton>
                          <IconButton size="small" sx={{ color: 'rgba(237,240,247,0.68)' }}>
                            <MoreHoriz fontSize="small" />
                          </IconButton>
                        </Stack>
                      </Box>
                    ))}

                    {visibleStudents.length === 0 && (
                      <Box sx={{ px: 1.2, py: 2.5, bgcolor: 'rgba(8,11,18,0.6)' }}>
                        <Typography sx={{ color: 'rgba(237,240,247,0.66)' }}>
                          No students match current filters.
                        </Typography>
                      </Box>
                    )}
                  </Stack>
                </Box>

                <Typography sx={{ mt: 1.3, fontSize: 32, fontWeight: 600 }}>{tt('Studentpåmelding', 'Student Enrollment')}</Typography>

                <Box
                  sx={{
                    mt: 1,
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
                    gap: 1,
                  }}
                >
                  {enrollmentCards.map((card, index) => (
                    <Box
                      key={card.id}
                      sx={{
                        ...panelSx,
                        p: 1,
                        borderColor: 'rgba(255,255,255,0.1)',
                      }}
                    >
                      <Stack direction="row" spacing={1}>
                        <Box
                          sx={{
                            width: 120,
                            height: 72,
                            borderRadius: 1,
                            border: '1px solid rgba(255,255,255,0.1)',
                            background: placeholderBackgrounds[(card.imageTheme + index) % placeholderBackgrounds.length],
                            flexShrink: 0,
                          }}
                        />
                        <Box sx={{ minWidth: 0, flex: 1 }}>
                          <Typography sx={{ fontWeight: 600 }} noWrap>
                            {card.title}
                          </Typography>
                          <Typography sx={{ fontSize: 12, color: 'rgba(237,240,247,0.64)' }} noWrap>
                            {card.cohortCount} students · {card.sources} sources
                          </Typography>
                          <Typography sx={{ fontSize: 12, color: 'rgba(237,240,247,0.64)', mt: 0.4 }}>
                            {tt('Gj.sn. fullføring', 'Avg completion')} {card.avgCompletion}%
                          </Typography>
                          <Stack direction="row" spacing={0.8} sx={{ mt: 0.8 }}>
                            <Button
                              size="small"
                              sx={{ textTransform: 'none', color: '#edf0f7', border: '1px solid rgba(255,255,255,0.16)' }}
                            >
                              {tt('Administrer', 'Manage')}
                            </Button>
                            <Button
                              size="small"
                              sx={{ textTransform: 'none', color: '#edf0f7', border: '1px solid rgba(255,255,255,0.16)' }}
                            >
                              Masterclass
                            </Button>
                          </Stack>
                        </Box>
                      </Stack>
                    </Box>
                  ))}
                </Box>

                <Typography sx={{ mt: 1, color: 'rgba(237,240,247,0.66)' }}>
                  {toCompactNumber(totals.totalStudents)} {tt('studenter', 'students')} · {tt('gj.sn. score', 'avg score')} {totals.avgEnrollScore}
                </Typography>
              </Box>
            </Box>

            <Box sx={{ ...panelSx, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
              <Box sx={{ p: 1.2, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                <Typography sx={{ fontSize: 34, fontWeight: 600 }}>{tt('Studentinnsikt', 'Student Insights')}</Typography>

                <Stack direction="row" spacing={0.8} sx={{ mt: 1 }} flexWrap="wrap" useFlexGap>
                  <Chip
                    label={tt('Tidlig tilgang', 'Early Access')}
                    onClick={() => toggleFeatureFlag('earlyAccess')}
                    color={featureFlags.earlyAccess ? 'warning' : 'default'}
                    sx={{ color: '#edf0f7' }}
                  />
                  <Chip
                    label={tt('Kun invitasjon', 'Invitation Only')}
                    onClick={() => toggleFeatureFlag('invitationOnly')}
                    color={featureFlags.invitationOnly ? 'warning' : 'default'}
                    sx={{ color: '#edf0f7' }}
                  />
                  <Chip
                    label={tt('Lukket', 'Closed')}
                    onClick={() => toggleFeatureFlag('closed')}
                    color={featureFlags.closed ? 'warning' : 'default'}
                    sx={{ color: '#edf0f7' }}
                  />
                  <Chip
                    label={tt('Dryppslipp', 'Drip Release')}
                    onClick={() => toggleFeatureFlag('dripRelease')}
                    color={featureFlags.dripRelease ? 'warning' : 'default'}
                    sx={{ color: '#edf0f7' }}
                  />
                </Stack>
              </Box>

              <Box sx={{ p: 1.2, display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Box sx={{ ...panelSx, p: 1 }}>
                  <Typography sx={{ fontSize: 28, fontWeight: 600, mb: 0.8 }}>Submissions Overview</Typography>

                  <Stack direction="row" spacing={1.2} alignItems="center">
                    <Box
                      sx={{
                        width: 122,
                        height: 122,
                        borderRadius: '50%',
                        background: donutStyle,
                        display: 'grid',
                        placeItems: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <Box
                        sx={{
                          width: 84,
                          height: 84,
                          borderRadius: '50%',
                          bgcolor: '#0f1420',
                          display: 'grid',
                          placeItems: 'center',
                          textAlign: 'center',
                        }}
                      >
                        <Typography sx={{ fontSize: 24, fontWeight: 700 }}>{totals.totalStudents}</Typography>
                        <Typography sx={{ fontSize: 11, color: 'rgba(237,240,247,0.62)' }}>{tt('Studenter', 'Students')}</Typography>
                      </Box>
                    </Box>

                    <Stack spacing={0.5} sx={{ flex: 1 }}>
                      <Stack direction="row" justifyContent="space-between">
                        <Typography sx={{ color: 'rgba(237,240,247,0.72)' }}>Excellent</Typography>
                        <Typography>{distribution.excellentPct}%</Typography>
                      </Stack>
                      <LinearProgress
                        variant="determinate"
                        value={distribution.excellentPct}
                        sx={{
                          height: 6,
                          borderRadius: 999,
                          bgcolor: 'rgba(255,255,255,0.1)',
                          '& .MuiLinearProgress-bar': { background: '#f8b321' },
                        }}
                      />

                      <Stack direction="row" justifyContent="space-between">
                        <Typography sx={{ color: 'rgba(237,240,247,0.72)' }}>Healthy</Typography>
                        <Typography>{distribution.healthyPct}%</Typography>
                      </Stack>
                      <LinearProgress
                        variant="determinate"
                        value={distribution.healthyPct}
                        sx={{
                          height: 6,
                          borderRadius: 999,
                          bgcolor: 'rgba(255,255,255,0.1)',
                          '& .MuiLinearProgress-bar': { background: '#8ea6d6' },
                        }}
                      />

                      <Stack direction="row" justifyContent="space-between">
                        <Typography sx={{ color: 'rgba(237,240,247,0.72)' }}>Improving</Typography>
                        <Typography>{distribution.improvingPct}%</Typography>
                      </Stack>
                      <LinearProgress
                        variant="determinate"
                        value={distribution.improvingPct}
                        sx={{
                          height: 6,
                          borderRadius: 999,
                          bgcolor: 'rgba(255,255,255,0.1)',
                          '& .MuiLinearProgress-bar': { background: '#9acd6f' },
                        }}
                      />

                      <Stack direction="row" justifyContent="space-between">
                        <Typography sx={{ color: 'rgba(237,240,247,0.72)' }}>At Risk</Typography>
                        <Typography>{distribution.atRiskPct}%</Typography>
                      </Stack>
                      <LinearProgress
                        variant="determinate"
                        value={distribution.atRiskPct}
                        sx={{
                          height: 6,
                          borderRadius: 999,
                          bgcolor: 'rgba(255,255,255,0.1)',
                          '& .MuiLinearProgress-bar': { background: '#c56f58' },
                        }}
                      />
                    </Stack>
                  </Stack>
                </Box>

                <Box sx={{ ...panelSx, p: 1 }}>
                  <Typography sx={{ fontSize: 30, fontWeight: 600, mb: 0.8 }}>{tt('Toppkohorter', 'Top Cohorts')}</Typography>
                  <Stack spacing={0.8}>
                    {topCohorts.map((cohort) => (
                      <Stack
                        key={cohort.id}
                        direction="row"
                        spacing={0.8}
                        alignItems="center"
                        sx={{
                          px: 0.8,
                          py: 0.8,
                          borderRadius: 1,
                          border: '1px solid rgba(255,255,255,0.1)',
                          bgcolor: 'rgba(10,14,22,0.7)',
                        }}
                      >
                        <Box
                          sx={{
                            width: 44,
                            height: 44,
                            borderRadius: 1,
                            border: '1px solid rgba(255,255,255,0.1)',
                            background: placeholderBackgrounds[cohort.imageTheme % placeholderBackgrounds.length],
                            flexShrink: 0,
                          }}
                        />
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography noWrap sx={{ fontWeight: 600 }}>
                            {cohort.name}
                          </Typography>
                          <Typography sx={{ fontSize: 12, color: 'rgba(237,240,247,0.64)' }} noWrap>
                            {cohort.students} students
                          </Typography>
                        </Box>
                        <Typography sx={{ color: '#f8d56f', fontWeight: 700 }}>
                          {cohort.avgCompletion}%
                        </Typography>
                      </Stack>
                    ))}
                  </Stack>
                </Box>

                <Box sx={{ ...panelSx, p: 1 }}>
                  <Typography sx={{ fontSize: 30, fontWeight: 600, mb: 0.8 }}>{tt('Aktivitetsfeed', 'Activity Feed')}</Typography>
                  <Stack spacing={0.8}>
                    {activityFeed.map((item, index) => (
                      <Stack
                        key={item.id}
                        direction="row"
                        spacing={0.8}
                        alignItems="flex-start"
                        sx={{
                          px: 0.8,
                          py: 0.8,
                          borderRadius: 1,
                          border: '1px solid rgba(255,255,255,0.1)',
                          bgcolor: index === 0 ? 'rgba(248,179,33,0.08)' : 'rgba(10,14,22,0.7)',
                        }}
                      >
                        <Avatar sx={{ width: 30, height: 30, bgcolor: 'rgba(248,179,33,0.78)', color: '#111' }}>
                          {item.author.charAt(0).toUpperCase()}
                        </Avatar>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography sx={{ fontWeight: 700 }} noWrap>
                            {item.author}
                          </Typography>
                          <Typography sx={{ color: 'rgba(237,240,247,0.72)' }}>
                            {navLabel(item.action)} · {item.course}
                          </Typography>
                          <Typography sx={{ fontSize: 12, color: 'rgba(237,240,247,0.58)' }}>{item.timestamp}</Typography>
                        </Box>
                      </Stack>
                    ))}
                  </Stack>
                </Box>
              </Box>

              <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)' }} />

              <Stack direction="row" spacing={1} sx={{ p: 1.1 }}>
                <Button
                  startIcon={<Campaign />}
                  onClick={() => setLocation('/academy/cta-overlay')}
                  sx={{
                    flex: 1,
                    textTransform: 'none',
                    color: '#edf0f7',
                    border: '1px solid rgba(255,255,255,0.18)',
                  }}
                >
                  CTA
                </Button>
                <Button
                  startIcon={<Subtitles />}
                  onClick={() => setLocation('/academy/lower-thirds')}
                  sx={{
                    flex: 1,
                    textTransform: 'none',
                    color: '#edf0f7',
                    border: '1px solid rgba(255,255,255,0.18)',
                  }}
                >
                  LowerThirds
                </Button>
              </Stack>

              <Stack direction="row" spacing={1} sx={{ p: 1.1, pt: 0 }}>
                <Button
                  startIcon={<PeopleAlt />}
                  onClick={addStudent}
                  sx={{
                    flex: 1,
                    textTransform: 'none',
                    color: '#edf0f7',
                    border: '1px solid rgba(255,255,255,0.16)',
                  }}
                >
                  {tt('Legg til student', 'Add Student')}
                </Button>
                <Button
                  startIcon={<MonetizationOn />}
                  onClick={() => setLocation('/academy/monetization')}
                  sx={{
                    flex: 1,
                    textTransform: 'none',
                    color: '#edf0f7',
                    border: '1px solid rgba(255,255,255,0.16)',
                  }}
                >
                  {tt('Monetisering', 'Monetization')}
                </Button>
              </Stack>

              <Stack direction="row" spacing={1} sx={{ p: 1.1, pt: 0 }}>
                <Button
                  startIcon={<Save />}
                  onClick={() => void saveEnrollmentSettings(false)}
                  sx={{
                    flex: 1,
                    textTransform: 'none',
                    color: '#edf0f7',
                    border: '1px solid rgba(255,255,255,0.16)',
                  }}
                >
                  {tt('Lagre', 'Save')}
                </Button>
                <Button
                  startIcon={<Publish />}
                  onClick={() => void saveEnrollmentSettings(true)}
                  sx={{
                    minWidth: 118,
                    textTransform: 'none',
                    color: '#0f0f0f',
                    background: 'linear-gradient(180deg, #ffd44e, #f2a616)',
                    fontWeight: 700,
                  }}
                >
                  {tt('Publiser', 'Publish')}
                </Button>
                <Button
                  onClick={() => {
                    if (onCancel) {
                      onCancel();
                    } else {
                      setLocation('/academy/course-creator');
                    }
                  }}
                  sx={{
                    textTransform: 'none',
                    color: 'rgba(237,240,247,0.78)',
                    border: '1px solid rgba(255,255,255,0.16)',
                  }}
                >
                  {tt('Lukk', 'Close')}
                </Button>
              </Stack>

              <Stack direction="row" spacing={1} sx={{ p: 1.1, pt: 0 }}>
                <Button
                  startIcon={<TrendingUp />}
                  onClick={() => setLocation('/academy/analytics')}
                  sx={{
                    flex: 1,
                    textTransform: 'none',
                    color: '#edf0f7',
                    border: '1px solid rgba(255,255,255,0.16)',
                  }}
                >
                  Analytics
                </Button>
                <Button
                  onClick={() => setLocation('/academy/cohort-settings')}
                  sx={{
                    flex: 1,
                    textTransform: 'none',
                    color: '#edf0f7',
                    border: '1px solid rgba(255,255,255,0.16)',
                  }}
                >
                  {tt('Kohorter', 'Cohorts')}
                </Button>
              </Stack>

              <Stack direction="row" spacing={1} sx={{ p: 1.1, pt: 0 }} alignItems="center">
                <Typography sx={{ color: 'rgba(237,240,247,0.62)', fontSize: 12 }}>
                  {tt('Inntektsprognose', 'Revenue projection')}: {toNok(totals.avgEnrollScore * totals.totalStudents)}
                </Typography>
                <Box sx={{ ml: 'auto' }}>
                  <Switch
                    checked={featureFlags.dripRelease}
                    onChange={() => toggleFeatureFlag('dripRelease')}
                    size="small"
                  />
                </Box>
              </Stack>
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

export default withUniversalIntegration(AcademyEnrollmentStudio, {
  componentId: 'academy-enrollment-studio',
  componentName: 'Academy Enrollment Studio',
  componentType: 'manager',
  componentCategory: 'academy',
  featureIds: ['enrollment', 'student-management', 'enrollment-analytics', 'academy-cohorts'],
});
