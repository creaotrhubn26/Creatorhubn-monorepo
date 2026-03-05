import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Avatar,
  Badge,
  Box,
  Button,
  Chip,
  IconButton,
  LinearProgress,
  Stack,
  Typography,
} from '@mui/material';
import {
  Add,
  CheckCircleOutline,
  MailOutline,
  MoreHoriz,
  NotificationsNone,
  PlayArrow,
  Search,
  Stars,
} from '@mui/icons-material';
import { useLocation } from 'wouter';
import { useAcademy, type Course, type Enrollment, type Lesson } from '@/contexts/AcademyContext';
import { useEnhancedMasterIntegration } from '@/integration/EnhancedMasterIntegrationProvider';
import { withUniversalIntegration } from '@/integration/UniversalIntegrationHOC';
import { useAcademyLocale } from './academyLocale';
import AcademyBrandMark from './AcademyBrandMark';

interface AcademyStudentDashboardStudioProps {
  courseId?: string;
}

interface StudentSummaryRow {
  id: string;
  name: string;
  role: string;
  primaryCohort: string;
  completionRate: number;
  enrolledCourses: number;
  actions: number;
  avatarTheme: number;
}

interface TodoTask {
  id: string;
  title: string;
  durationLabel: string;
  completion: number;
  buttonLabel: string;
}

interface ActivityItem {
  id: string;
  author: string;
  message: string;
  timestamp: string;
}

interface PointItem {
  id: string;
  name: string;
  subtitle: string;
  points: number;
  avatarTheme: number;
}

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

const fallbackCourses: Course[] = [
  {
    id: 'student-course-1',
    title: 'Cinematic Filmmaking',
    description: 'Master cinematic storytelling with practical scene work.',
    instructor: {
      id: 'student-instructor-1',
      name: 'Sarah Johnson',
      avatar: '',
      bio: 'Filmmaker and educator',
      profession: 'videographer',
    },
    thumbnail: '',
    videoUrl: '/assets/academy/intro-video.mp4',
    duration: 360,
    level: 'advanced',
    category: 'videography',
    tags: ['filmmaking', 'cinematic'],
    price: 36984,
    isFree: false,
    isPublished: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    rating: 4.8,
    studentCount: 510,
    lessons: [],
    prerequisites: [],
    learningOutcomes: [],
    resources: [],
  },
  {
    id: 'student-course-2',
    title: 'Vocal Production Pros',
    description: 'Production workflows for voice-centric content creators.',
    instructor: {
      id: 'student-instructor-2',
      name: 'Adrian Berglund',
      avatar: '',
      bio: 'Audio engineer',
      profession: 'music_producer',
    },
    thumbnail: '',
    videoUrl: '/assets/academy/intro-video.mp4',
    duration: 320,
    level: 'advanced',
    category: 'music_production',
    tags: ['audio', 'vocals'],
    price: 29900,
    isFree: false,
    isPublished: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    rating: 4.7,
    studentCount: 430,
    lessons: [],
    prerequisites: [],
    learningOutcomes: [],
    resources: [],
  },
  {
    id: 'student-course-3',
    title: 'Digital Photography',
    description: 'Light, composition, and photo storytelling from scratch.',
    instructor: {
      id: 'student-instructor-3',
      name: 'Lisa Holden',
      avatar: '',
      bio: 'Photographer',
      profession: 'photographer',
    },
    thumbnail: '',
    videoUrl: '/assets/academy/intro-video.mp4',
    duration: 280,
    level: 'intermediate',
    category: 'photography',
    tags: ['photography'],
    price: 25900,
    isFree: false,
    isPublished: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    rating: 4.6,
    studentCount: 370,
    lessons: [],
    prerequisites: [],
    learningOutcomes: [],
    resources: [],
  },
];

const defaultRows = (): StudentSummaryRow[] => [
  {
    id: 'summary-1',
    name: 'Sarah Johnson',
    role: 'Vocal Production Pros',
    primaryCohort: 'Early Access · 3 Courses',
    completionRate: 35,
    enrolledCourses: 3,
    actions: 3,
    avatarTheme: 0,
  },
  {
    id: 'summary-2',
    name: 'Adrian Berglund',
    role: 'Cinematic Filmmaking',
    primaryCohort: '6 Courses',
    completionRate: 84,
    enrolledCourses: 5,
    actions: 5,
    avatarTheme: 1,
  },
  {
    id: 'summary-3',
    name: 'Lisa Holden',
    role: 'Drone Pilot',
    primaryCohort: '2 Courses',
    completionRate: 82,
    enrolledCourses: 2,
    actions: 2,
    avatarTheme: 2,
  },
  {
    id: 'summary-4',
    name: 'Jonas Ek',
    role: 'Video Editor',
    primaryCohort: '4 Courses',
    completionRate: 79,
    enrolledCourses: 4,
    actions: 4,
    avatarTheme: 3,
  },
];

const defaultActivity = (): ActivityItem[] => [
  { id: 'a1', author: 'Jonas Ek', message: 'Posted in Cinematic Photography', timestamp: '20 h ago' },
  { id: 'a2', author: 'Lars Eriksen', message: 'Shared Lighting Examples', timestamp: '10 h ago' },
  { id: 'a3', author: 'Sarah Johnson', message: 'Completed module discussion', timestamp: '4 h ago' },
];

const defaultPoints = (): PointItem[] => [
  { id: 'p1', name: 'Sarah Johnson', subtitle: 'Berg // comments', points: 2310, avatarTheme: 0 },
  { id: 'p2', name: 'Lars Eriksen', subtitle: 'Vocal Photography // replies', points: 2120, avatarTheme: 1 },
  { id: 'p3', name: 'Jonas Ek', subtitle: 'Luden // responses', points: 1960, avatarTheme: 2 },
];

const getProgressFromEnrollment = (enrollment: Enrollment): number => {
  const progressRows = Array.isArray(enrollment?.progress) ? enrollment.progress : [];
  if (progressRows.length === 0) return 0;
  const total = progressRows.reduce((sum, row) => sum + Number(row?.progress || 0), 0);
  return Math.round(total / progressRows.length);
};

const toDisplayName = (value: string, index: number): string => {
  const normalized = String(value || '').trim();
  if (!normalized) return `Student ${index + 1}`;
  const base = normalized.includes('@') ? normalized.split('@')[0] : normalized;
  const parts = base
    .replace(/[._]+/g, '-')
    .split('-')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .slice(0, 2);

  if (parts.length === 0) return `Student ${index + 1}`;
  return parts.map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
};

function AcademyStudentDashboardStudio({ courseId }: AcademyStudentDashboardStudioProps) {
  const [, setLocation] = useLocation();
  const { state, getCourse, setCurrentCourse, setCurrentLesson } = useAcademy();
  const { analytics } = useEnhancedMasterIntegration();
  
  const { navLabel } = useAcademyLocale();

  const [mainTab, setMainTab] = useState<'explore' | 'courses' | 'library' | 'community' | 'achievements'>('courses');
  const [leftNav, setLeftNav] = useState('overview');

  const courses = useMemo(() => {
    if (Array.isArray(state?.courses) && state.courses.length > 0) {
      return state.courses;
    }
    return fallbackCourses;
  }, [state?.courses]);

  const enrollments = useMemo(() => (Array.isArray(state?.enrollments) ? state.enrollments : []), [state?.enrollments]);

  const activeCourse = useMemo(() => {
    const fromParam = courseId ? getCourse(courseId) : null;
    if (fromParam) return fromParam;
    return state.currentCourse || courses[0] || fallbackCourses[0];
  }, [courseId, courses, getCourse, state.currentCourse]);

  const learningPathCards = useMemo(() => {
    const fallbackProgress = [24, 68, 52, 79];
    return courses.slice(0, 3).map((course, index) => {
      const enrollmentForCourse = enrollments.find((entry) => String(entry.courseId) === String(course.id));
      const progress = enrollmentForCourse ? getProgressFromEnrollment(enrollmentForCourse) : fallbackProgress[index % fallbackProgress.length];
      return {
        id: String(course.id),
        title: course.title,
        subtitle: course.description || course.category,
        progress,
        imageTheme: index % placeholderBackgrounds.length,
        students: Number(course.studentCount || 0),
      };
    });
  }, [courses, enrollments]);

  const heroProgress = useMemo(() => {
    const enrollmentForCourse = enrollments.find((entry) => String(entry.courseId) === String(activeCourse?.id || ''));
    if (enrollmentForCourse) return getProgressFromEnrollment(enrollmentForCourse);
    const fromCard = learningPathCards[0]?.progress;
    return Number.isFinite(fromCard) ? Number(fromCard) : 24;
  }, [activeCourse?.id, enrollments, learningPathCards]);

  const studentRows = useMemo(() => {
    if (enrollments.length === 0) return defaultRows();

    const grouped = new Map<string, { completion: number[]; courses: Set<string> }>();
    enrollments.forEach((enrollment) => {
      const key = String(enrollment.studentId || 'guest');
      const bucket = grouped.get(key) || { completion: [], courses: new Set<string>() };
      bucket.completion.push(getProgressFromEnrollment(enrollment));
      bucket.courses.add(String(enrollment.courseId || '')); 
      grouped.set(key, bucket);
    });

    return Array.from(grouped.entries()).slice(0, 4).map(([studentId, info], index) => {
      const completionRate = info.completion.length === 0 ? 0 : Math.round(info.completion.reduce((sum, value) => sum + value, 0) / info.completion.length);
      const primaryCourseId = Array.from(info.courses)[0] || String(courses[0]?.id || '');
      const primaryCourse = courses.find((course) => String(course.id) === primaryCourseId);

      return {
        id: `row-${studentId}`,
        name: toDisplayName(studentId, index),
        role: primaryCourse?.title || 'Academy Learner',
        primaryCohort: `${info.courses.size} Courses`,
        completionRate,
        enrolledCourses: info.courses.size,
        actions: Math.max(1, Math.round(completionRate / 20)),
        avatarTheme: index % placeholderBackgrounds.length,
      };
    });
  }, [courses, enrollments]);

  const todoTasks = useMemo<TodoTask[]>(() => {
    const fallback: TodoTask[] = [
      { id: 'todo-1', title: 'Lighting Basics', durationLabel: '40 m', completion: 55, buttonLabel: 'Resume' },
      { id: 'todo-2', title: 'Vocal Arrangement Breakdown', durationLabel: '62 m', completion: 48, buttonLabel: 'Continue' },
    ];

    if (!activeCourse) return fallback;
    const lessons = Array.isArray(activeCourse.lessons) ? activeCourse.lessons : [];
    if (lessons.length === 0) return fallback;

    return lessons.slice(0, 2).map((lesson, index) => ({
      id: `todo-${lesson.id || index}`,
      title: String(lesson.title || `Lesson ${index + 1}`),
      durationLabel: `${Math.max(1, Math.round(Number(lesson.duration || 0) / 60))} m`,
      completion: Math.max(12, 72 - index * 14),
      buttonLabel: index === 0 ? 'Resume' : 'Continue',
    }));
  }, [activeCourse]);

  const discussionActivity = useMemo(() => {
    if (studentRows.length === 0) return defaultActivity();
    return studentRows.slice(0, 3).map((row, index) => ({
      id: `activity-${row.id}`,
      author: row.name,
      message: `${row.role} · ${row.actions} replies`,
      timestamp: `${(index + 1) * 5} h ago`,
    }));
  }, [studentRows]);

  const pointsBoard = useMemo(() => {
    if (studentRows.length === 0) return defaultPoints();
    return studentRows
      .map((row, index) => ({
        id: `points-${row.id}`,
        name: row.name,
        subtitle: row.role,
        points: row.completionRate * 24 + row.enrolledCourses * 90,
        avatarTheme: index % placeholderBackgrounds.length,
      }))
      .sort((a, b) => b.points - a.points)
      .slice(0, 3);
  }, [studentRows]);

  const pointsTotal = useMemo(() => {
    return pointsBoard.reduce((sum, row) => sum + row.points, 0);
  }, [pointsBoard]);

  const achievements = useMemo(() => {
    const rows = [
      { id: 'ach-1', label: 'Level', value: Math.max(1, Math.round(heroProgress / 12)) },
      { id: 'ach-2', label: 'Streak', value: Math.max(2, Math.round(pointsTotal / 900)) },
      { id: 'ach-3', label: 'Points', value: Math.max(120, Math.round(pointsTotal / 3)) },
      { id: 'ach-4', label: 'Rank', value: Math.max(3, 12 - pointsBoard.length) },
    ];
    return rows;
  }, [heroProgress, pointsBoard.length, pointsTotal]);

  useEffect(() => {
    analytics.trackEvent('academy_student_dashboard_opened', {
      courseId: activeCourse?.id || null,
      learningPathCount: learningPathCards.length,
      enrollments: enrollments.length,
      timestamp: Date.now(),
    });
  }, [activeCourse?.id, analytics, enrollments.length, learningPathCards.length]);

  const openCourse = useCallback(
    (courseIdValue: string) => {
      const targetCourse = courses.find((course) => String(course.id) === String(courseIdValue)) || activeCourse;
      if (!targetCourse) return;

      const lessons = Array.isArray(targetCourse.lessons) ? targetCourse.lessons : [];
      const firstLesson = lessons[0] || {
        id: `${targetCourse.id}-intro`,
        title: `${targetCourse.title} Intro`,
        description: targetCourse.description || 'Course introduction',
        videoUrl: targetCourse.videoUrl || '/assets/academy/intro-video.mp4',
        duration: 600,
        order: 1,
        isPreview: true,
        resources: [],
      } satisfies Lesson;

      setCurrentCourse({ ...targetCourse, lessons: lessons.length > 0 ? lessons : [firstLesson] });
      setCurrentLesson(firstLesson);
      setLocation('/academy/video-player');
    },
    [activeCourse, courses, setCurrentCourse, setCurrentLesson, setLocation],
  );

  const leftNavItems = [
    { id: 'overview', label: navLabel('Overview'), route: '/academy/student-dashboard' },
    { id: 'curriculum', label: navLabel('Curriculum'), route: '/academy/curriculum' },
    { id: 'lessons', label: navLabel('Lessons'), route: '/academy/lesson-editor' },
    { id: 'media', label: navLabel('Media'), route: '/academy/media' },
    { id: 'assignments', label: navLabel('Assignments'), route: '/academy/assignments' },
    { id: 'cohort', label: navLabel('Cohort Settings'), route: '/academy/cohort-settings' },
    { id: 'analytics', label: navLabel('Analytics'), route: '/academy/analytics' },
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
            'radial-gradient(circle at 78% 12%, rgba(248,179,33,0.24), rgba(5,8,13,0) 44%), radial-gradient(circle at 16% 78%, rgba(82,121,204,0.12), rgba(6,8,14,0) 44%), linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0) 30%)',
        }}
      />

      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', lg: 'row' }, minHeight: '100vh', position: 'relative', zIndex: 1, width: 'min(100%, var(--academy-shell-max-width, 1920px))', mx: 'auto' }}>
        <Box
          component="aside"
          sx={{
            width: { xs: '100%', lg: 252 },
            borderRight: { xs: 'none', lg: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.08)' },
            borderBottom: { xs: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.08)', lg: 'none' },
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
              Create New Course
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
                    border: active ? 'var(--academy-hairline-width, 1px) solid rgba(248,179,33,0.35)' : 'var(--academy-hairline-width, 1px) solid transparent',
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

          <Box sx={{ mt: 'auto', px: 1.8, pb: 1.2 }}>
            <Button
              variant="text"
              startIcon={<Add />}
              onClick={() => setLocation('/academy/module-manager')}
              sx={{
                width: '100%',
                justifyContent: 'flex-start',
                color: '#edf0f7',
                textTransform: 'none',
                border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.14)',
                borderRadius: 1,
              }}
            >
              New Module
            </Button>
          </Box>

          <Box sx={{ mt: 'auto', px: 1.8, pb: 2 }}>
            <Typography sx={{ mb: 0.8, color: 'rgba(237,240,247,0.74)', fontWeight: 600 }}>Achievements</Typography>
            <Box
              sx={{
                ...panelSx,
                p: 0.8,
                borderColor: 'rgba(248,179,33,0.2)',
              }}
            >
              <Stack direction="row" spacing={0.8} flexWrap="wrap" useFlexGap>
                {achievements.map((item, index) => (
                  <Box
                    key={item.id}
                    sx={{
                      width: 48,
                      height: 48,
                      borderRadius: '50%',
                      border: 'var(--academy-hairline-width, 1px) solid rgba(248,179,33,0.35)',
                      background: placeholderBackgrounds[index % placeholderBackgrounds.length],
                      display: 'grid',
                      placeItems: 'center',
                    }}
                  >
                    <Typography sx={{ fontSize: 12, fontWeight: 700 }}>{item.value}</Typography>
                  </Box>
                ))}
              </Stack>
            </Box>
          </Box>
        </Box>

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
              {([
                ['explore', 'Explore'],
                ['courses', 'My Courses'],
                ['library', 'Library'],
                ['community', 'Community'],
                ['achievements', 'Achievements'],
              ] as const).map(([key, label]) => {
                const active = mainTab === key;
                return (
                  <Button
                    key={key}
                    onClick={() => {
                      setMainTab(key);
                      if (key === 'explore') setLocation('/academy');
                      if (key === 'library') setLocation('/academy/media');
                      if (key === 'community') setLocation('/community');
                    }}
                    sx={{
                      textTransform: 'none',
                      color: active ? '#fce3a1' : 'rgba(237,240,247,0.72)',
                      borderBottom: active ? '2px solid rgba(248,179,33,0.8)' : '2px solid transparent',
                      borderRadius: 0,
                      px: { xs: 0.8, md: 1.4 },
                      minWidth: 0,
                    }}
                  >
                    {label}
                  </Button>
                );
              })}
            </Stack>

            <Stack direction="row" spacing={1} alignItems="center">
              <IconButton size="small" sx={{ color: 'rgba(237,240,247,0.75)' }}>
                <NotificationsNone fontSize="small" />
              </IconButton>
              <IconButton size="small" sx={{ color: 'rgba(237,240,247,0.75)' }}>
                <MailOutline fontSize="small" />
              </IconButton>
              <IconButton size="small" sx={{ color: 'rgba(237,240,247,0.75)' }}>
                <Badge color="warning" badgeContent={1}>
                  <Search fontSize="small" />
                </Badge>
              </IconButton>
              <Avatar sx={{ width: 34, height: 34, bgcolor: '#f8b321', color: '#111', border: '2px solid rgba(248,179,33,0.55)' }}>
                {String(activeCourse?.instructor?.name || 'S').charAt(0).toUpperCase()}
              </Avatar>
            </Stack>
          </Box>

          <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', px: 2, py: 2, gap: 1.4 }}>
            <Box
              sx={{
                ...panelSx,
                p: 1.4,
                background:
                  'radial-gradient(circle at 76% 22%, rgba(248,179,33,0.2), rgba(0,0,0,0) 38%), linear-gradient(145deg, rgba(20,24,36,0.9), rgba(10,13,20,0.97))',
              }}
            >
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1.1fr 1fr' }, gap: 1.4, alignItems: 'center' }}>
                <Box>
                  <Typography sx={{ fontSize: { xs: 34, md: 54 }, fontWeight: 600, lineHeight: 1 }}>
                    Welcome back, Sarah
                  </Typography>
                  <Typography sx={{ mt: 0.8, color: 'rgba(237,240,247,0.78)' }}>Current Module Progress</Typography>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.8 }}>
                    <LinearProgress
                      variant="determinate"
                      value={heroProgress}
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
                    <Typography sx={{ minWidth: 44, fontWeight: 700 }}>{heroProgress}%</Typography>
                  </Stack>
                  <Button
                    variant="contained"
                    startIcon={<PlayArrow />}
                    onClick={() => openCourse(String(activeCourse?.id || learningPathCards[0]?.id || ''))}
                    sx={{
                      mt: 1.1,
                      textTransform: 'none',
                      borderRadius: 1,
                      color: '#0f0f0f',
                      background: 'linear-gradient(180deg, #ffd44e, #f2a616)',
                      boxShadow: '0 8px 20px rgba(248,179,33,0.25)',
                      fontWeight: 700,
                    }}
                  >
                    Continue Course
                  </Button>
                </Box>

                <Box
                  sx={{
                    height: { xs: 180, md: 220 },
                    borderRadius: 1,
                    border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.12)',
                    background: placeholderBackgrounds[0],
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                >
                  <Box sx={{ position: 'absolute', left: 14, bottom: 14 }}>
                    <Typography sx={{ color: 'rgba(237,240,247,0.72)' }}>Next up:</Typography>
                    <Typography sx={{ fontSize: { xs: 30, sm: 40, md: 48 }, fontWeight: 600, lineHeight: 1 }}>
                      Lighting Basics
                    </Typography>
                    <Typography sx={{ color: 'rgba(237,240,247,0.72)' }}>Create cinematic lighting</Typography>
                  </Box>
                </Box>
              </Box>
            </Box>

            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', xl: 'minmax(0, 1fr) 370px' }, gap: 1.3, minHeight: 0 }}>
              <Box sx={{ minHeight: 0, display: 'flex', flexDirection: 'column', gap: 1.2 }}>
                <Box>
                  <Typography sx={{ fontSize: { xs: 32, md: 48 }, fontWeight: 600, mb: 0.8 }}>My Learning Path</Typography>
                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' },
                      gap: 1,
                    }}
                  >
                    {learningPathCards.map((card, index) => (
                      <Box
                        key={card.id}
                        onClick={() => openCourse(card.id)}
                        sx={{
                          ...panelSx,
                          p: 0.8,
                          cursor: 'pointer',
                          '&:hover': { borderColor: 'rgba(248,179,33,0.32)' },
                        }}
                      >
                        <Box
                          sx={{
                            height: 120,
                            borderRadius: 1,
                            border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.1)',
                            background: placeholderBackgrounds[(card.imageTheme + index) % placeholderBackgrounds.length],
                            mb: 0.8,
                          }}
                        />
                        <Typography sx={{ fontSize: { xs: 24, md: 41 }, lineHeight: 1, fontWeight: 600 }} noWrap>
                          {card.title}
                        </Typography>
                        <Typography sx={{ color: 'rgba(237,240,247,0.64)' }} noWrap>
                          {card.subtitle}
                        </Typography>
                        <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.8 }}>
                          <LinearProgress
                            variant="determinate"
                            value={card.progress}
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
                          <Typography sx={{ color: '#f8d56f', fontWeight: 700 }}>{card.progress}%</Typography>
                        </Stack>
                        <Chip
                          label={card.progress >= 60 ? 'IN PROGRESS' : 'START LEARNING'}
                          size="small"
                          sx={{
                            mt: 0.8,
                            color: '#edf0f7',
                            bgcolor: 'rgba(248,179,33,0.15)',
                            border: 'var(--academy-hairline-width, 1px) solid rgba(248,179,33,0.35)',
                          }}
                        />
                      </Box>
                    ))}
                  </Box>
                </Box>

                <Box>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.8 }}>
                    <Typography sx={{ fontSize: { xs: 32, md: 48 }, fontWeight: 600 }}>Our Newest Courses</Typography>
                    <Button
                      size="small"
                      sx={{ textTransform: 'none', color: '#edf0f7', border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.16)' }}
                    >
                      See All
                    </Button>
                  </Stack>

                  <Box
                    sx={{
                      ...panelSx,
                      overflowX: 'auto',
                      overflowY: 'hidden',
                    }}
                  >
                    <Box
                      sx={{
                        display: 'grid',
                        gridTemplateColumns: 'minmax(220px, 1.6fr) 1fr 0.8fr 0.6fr 0.5fr',
                        minWidth: 920,
                        px: 1,
                        py: 0.8,
                        borderBottom: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.1)',
                        background: 'rgba(255,255,255,0.03)',
                      }}
                    >
                      <Typography sx={{ color: 'rgba(237,240,247,0.68)', fontSize: 13 }}>Name</Typography>
                      <Typography sx={{ color: 'rgba(237,240,247,0.68)', fontSize: 13 }}>Primary Cohort</Typography>
                      <Typography sx={{ color: 'rgba(237,240,247,0.68)', fontSize: 13 }}>Completion</Typography>
                      <Typography sx={{ color: 'rgba(237,240,247,0.68)', fontSize: 13 }}>Enrolled</Typography>
                      <Typography sx={{ color: 'rgba(237,240,247,0.68)', fontSize: 13, textAlign: 'right' }}>Actions</Typography>
                    </Box>

                    <Stack spacing={0}>
                      {studentRows.map((row) => (
                        <Box
                          key={row.id}
                          sx={{
                            display: 'grid',
                            gridTemplateColumns: 'minmax(220px, 1.6fr) 1fr 0.8fr 0.6fr 0.5fr',
                            minWidth: 920,
                            px: 1,
                            py: 1,
                            gap: 1,
                            borderBottom: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.08)',
                            '&:hover': {
                              background: 'linear-gradient(90deg, rgba(248,179,33,0.08), rgba(255,255,255,0.01))',
                            },
                          }}
                        >
                          <Stack direction="row" spacing={0.8} alignItems="center" minWidth={0}>
                            <Avatar
                              sx={{
                                width: 34,
                                height: 34,
                                border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.14)',
                                background: placeholderBackgrounds[row.avatarTheme % placeholderBackgrounds.length],
                              }}
                            >
                              {row.name.charAt(0).toUpperCase()}
                            </Avatar>
                            <Box minWidth={0}>
                              <Typography sx={{ fontWeight: 600 }} noWrap>{row.name}</Typography>
                              <Typography sx={{ color: 'rgba(237,240,247,0.66)', fontSize: 12 }} noWrap>
                                {row.role}
                              </Typography>
                            </Box>
                          </Stack>

                          <Typography sx={{ color: 'rgba(237,240,247,0.74)' }} noWrap>
                            {row.primaryCohort}
                          </Typography>

                          <Stack direction="row" spacing={0.8} alignItems="center">
                            <Typography sx={{ color: '#9acd6f', fontWeight: 700 }}>{row.completionRate}%</Typography>
                            <LinearProgress
                              variant="determinate"
                              value={row.completionRate}
                              sx={{
                                flex: 1,
                                height: 5,
                                borderRadius: 999,
                                bgcolor: 'rgba(255,255,255,0.14)',
                                '& .MuiLinearProgress-bar': {
                                  borderRadius: 999,
                                  background: 'linear-gradient(90deg, #8ecf76 0%, #f8b321 100%)',
                                },
                              }}
                            />
                          </Stack>

                          <Typography>{row.enrolledCourses}</Typography>

                          <Stack direction="row" spacing={0.2} justifyContent="flex-end">
                            <IconButton size="small" sx={{ color: 'rgba(237,240,247,0.68)' }}>
                              <MailOutline fontSize="small" />
                            </IconButton>
                            <IconButton size="small" sx={{ color: 'rgba(237,240,247,0.68)' }}>
                              <MoreHoriz fontSize="small" />
                            </IconButton>
                          </Stack>
                        </Box>
                      ))}
                    </Stack>

                    <Typography sx={{ px: 1, py: 0.8, color: 'rgba(237,240,247,0.64)' }}>
                      1,249 Students · Page 1 of 23
                    </Typography>
                  </Box>
                </Box>
              </Box>

              <Box sx={{ minHeight: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Box sx={{ ...panelSx, p: 1 }}>
                  <Typography sx={{ fontSize: 44, lineHeight: 1, fontWeight: 600 }}>Student Insights</Typography>
                  <Typography sx={{ mt: 0.8, fontSize: 39, lineHeight: 1, fontWeight: 600 }}>Complete Foundations Module</Typography>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.8 }}>
                    <CheckCircleOutline sx={{ color: '#f8d56f' }} />
                    <Typography sx={{ color: 'rgba(237,240,247,0.74)' }}>9 / 25 lessons completed</Typography>
                  </Stack>
                  <LinearProgress
                    variant="determinate"
                    value={36}
                    sx={{
                      mt: 0.8,
                      height: 8,
                      borderRadius: 999,
                      bgcolor: 'rgba(255,255,255,0.14)',
                      '& .MuiLinearProgress-bar': {
                        borderRadius: 999,
                        background: 'linear-gradient(90deg, #f8b321 0%, #ffcf57 100%)',
                      },
                    }}
                  />
                </Box>

                <Box sx={{ ...panelSx, p: 1 }}>
                  <Typography sx={{ fontSize: 44, lineHeight: 1, fontWeight: 600, mb: 0.8 }}>To-Do</Typography>
                  <Stack spacing={0.8}>
                    {todoTasks.map((task) => (
                      <Box
                        key={task.id}
                        sx={{
                          px: 0.8,
                          py: 0.8,
                          borderRadius: 1,
                          border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.1)',
                          bgcolor: 'rgba(10,14,22,0.72)',
                        }}
                      >
                        <Stack direction="row" justifyContent="space-between" alignItems="center">
                          <Typography sx={{ fontWeight: 600 }}>{task.title}</Typography>
                          <Button
                            size="small"
                            sx={{
                              textTransform: 'none',
                              color: '#0f0f0f',
                              background: 'linear-gradient(180deg, #ffd44e, #f2a616)',
                              fontWeight: 700,
                            }}
                          >
                            {task.buttonLabel}
                          </Button>
                        </Stack>
                        <Typography sx={{ fontSize: 12, color: 'rgba(237,240,247,0.66)', mt: 0.2 }}>{task.durationLabel}</Typography>
                        <LinearProgress
                          variant="determinate"
                          value={task.completion}
                          sx={{
                            mt: 0.7,
                            height: 6,
                            borderRadius: 999,
                            bgcolor: 'rgba(255,255,255,0.14)',
                            '& .MuiLinearProgress-bar': {
                              borderRadius: 999,
                              background: 'linear-gradient(90deg, #f8b321 0%, #ffcf57 100%)',
                            },
                          }}
                        />
                      </Box>
                    ))}
                  </Stack>
                </Box>

                <Box sx={{ ...panelSx, p: 1 }}>
                  <Typography sx={{ fontSize: 44, lineHeight: 1, fontWeight: 600, mb: 0.8 }}>Discussion Activity</Typography>
                  <Stack spacing={0.8}>
                    {discussionActivity.map((item, index) => (
                      <Stack
                        key={item.id}
                        direction="row"
                        spacing={0.8}
                        alignItems="flex-start"
                        sx={{
                          px: 0.8,
                          py: 0.8,
                          borderRadius: 1,
                          border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.1)',
                          bgcolor: index === 0 ? 'rgba(248,179,33,0.08)' : 'rgba(10,14,22,0.7)',
                        }}
                      >
                        <Avatar sx={{ width: 30, height: 30, bgcolor: 'rgba(248,179,33,0.78)', color: '#111' }}>
                          {item.author.charAt(0).toUpperCase()}
                        </Avatar>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography sx={{ fontWeight: 700 }} noWrap>{item.author}</Typography>
                          <Typography sx={{ color: 'rgba(237,240,247,0.72)' }} noWrap>{item.message}</Typography>
                          <Typography sx={{ fontSize: 12, color: 'rgba(237,240,247,0.58)' }}>{item.timestamp}</Typography>
                        </Box>
                      </Stack>
                    ))}
                  </Stack>
                </Box>

                <Box sx={{ ...panelSx, p: 1 }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.8 }}>
                    <Typography sx={{ fontSize: 44, lineHeight: 1, fontWeight: 600 }}>Points</Typography>
                    <Button
                      size="small"
                      sx={{ textTransform: 'none', color: '#edf0f7', border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.16)' }}
                    >
                      See All
                    </Button>
                  </Stack>

                  <Stack spacing={0.8}>
                    {pointsBoard.map((row) => (
                      <Stack
                        key={row.id}
                        direction="row"
                        spacing={0.8}
                        alignItems="center"
                        sx={{
                          px: 0.8,
                          py: 0.8,
                          borderRadius: 1,
                          border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.1)',
                          bgcolor: 'rgba(10,14,22,0.7)',
                        }}
                      >
                        <Avatar
                          sx={{
                            width: 32,
                            height: 32,
                            background: placeholderBackgrounds[row.avatarTheme % placeholderBackgrounds.length],
                            border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.14)',
                          }}
                        >
                          {row.name.charAt(0).toUpperCase()}
                        </Avatar>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography sx={{ fontWeight: 600 }} noWrap>{row.name}</Typography>
                          <Typography sx={{ fontSize: 12, color: 'rgba(237,240,247,0.62)' }} noWrap>{row.subtitle}</Typography>
                        </Box>
                        <Stack direction="row" spacing={0.3} alignItems="center">
                          <Stars sx={{ color: '#f8d56f', fontSize: 16 }} />
                          <Typography sx={{ color: '#f8d56f', fontWeight: 700 }}>{row.points.toLocaleString('en-US')} XP</Typography>
                        </Stack>
                      </Stack>
                    ))}
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
