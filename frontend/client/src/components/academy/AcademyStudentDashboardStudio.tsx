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
  CheckCircleOutline,
  MailOutline,
  MoreHoriz,
  NotificationsNone,
  PlayArrow,
  Search,
  Stars,
} from '@mui/icons-material';
import { useLocation } from 'wouter';
import { useAcademy, type Enrollment, type Lesson } from '@/contexts/AcademyContext';
import { useEnhancedMasterIntegration } from '@/integration/EnhancedMasterIntegrationProvider';
import { withUniversalIntegration } from '@/integration/UniversalIntegrationHOC';
import { useAcademyLocale } from './academyLocale';
import AcademyLocaleSwitcher from './AcademyLocaleSwitcher';
import AcademyLeftSidebar from './AcademyLeftSidebar';

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
  const [location, setLocation] = useLocation();
  const { state, getCourse, setCurrentCourse, setCurrentLesson } = useAcademy();
  const { analytics } = useEnhancedMasterIntegration();
  
  const { navLabel, tt } = useAcademyLocale();

  const [mainTab, setMainTab] = useState<'explore' | 'courses' | 'library' | 'community' | 'achievements'>('courses');
  const [leftNav, setLeftNav] = useState('overview');

  const courses = useMemo(() => {
    if (Array.isArray(state?.courses) && state.courses.length > 0) {
      return state.courses;
    }
    return [];
  }, [state?.courses]);

  const enrollments = useMemo(() => (Array.isArray(state?.enrollments) ? state.enrollments : []), [state?.enrollments]);

  const activeCourse = useMemo(() => {
    const fromParam = courseId ? getCourse(courseId) : null;
    if (fromParam) return fromParam;
    return state.currentCourse || courses[0] || null;
  }, [courseId, courses, getCourse, state.currentCourse]);

  const learningPathCards = useMemo(() => {
    return courses.slice(0, 3).map((course, index) => {
      const enrollmentForCourse = enrollments.find((entry) => String(entry.courseId) === String(course.id));
      const progress = enrollmentForCourse ? getProgressFromEnrollment(enrollmentForCourse) : 0;
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
    return Number.isFinite(fromCard) ? Number(fromCard) : 0;
  }, [activeCourse?.id, enrollments, learningPathCards]);

  const studentRows = useMemo(() => {
    if (enrollments.length === 0) return [] as StudentSummaryRow[];

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
    if (!activeCourse) return [];
    const lessons = Array.isArray(activeCourse.lessons) ? activeCourse.lessons : [];
    if (lessons.length === 0) return [];

    return lessons.slice(0, 2).map((lesson, index) => ({
      id: `todo-${lesson.id || index}`,
      title: String(lesson.title || `Lesson ${index + 1}`),
      durationLabel: `${Math.max(1, Math.round(Number(lesson.duration || 0) / 60))} m`,
      completion: Math.max(12, 72 - index * 14),
      buttonLabel: index === 0 ? 'Resume' : 'Continue',
    }));
  }, [activeCourse]);

  const nextUpLesson = useMemo(() => {
    if (!activeCourse || !Array.isArray(activeCourse.lessons)) return null;
    return activeCourse.lessons[0] || null;
  }, [activeCourse]);

  const discussionActivity = useMemo(() => {
    if (studentRows.length === 0) return [] as ActivityItem[];
    return studentRows.slice(0, 3).map((row, index) => ({
      id: `activity-${row.id}`,
      author: row.name,
      message: `${row.role} · ${row.actions} replies`,
      timestamp: `${(index + 1) * 5} h ago`,
    }));
  }, [studentRows]);

  const pointsBoard = useMemo(() => {
    if (studentRows.length === 0) return [] as PointItem[];
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
        courseId: String(targetCourse.id),
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
      setLocation('/academy/player-studio');
    },
    [activeCourse, courses, setCurrentCourse, setCurrentLesson, setLocation],
  );

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

      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', lg: 'row' }, minHeight: '100vh', position: 'relative', zIndex: 1, width: 'min(100%, var(--academy-shell-max-width, 1920px))', mx: 'auto' }}>
        <AcademyLeftSidebar
          activeNav={leftNav}
          onNavigate={(navId, route) => {
            setLeftNav(navId);
            setLocation(route);
          }}
          onCreateCourse={() => {
            setLeftNav('curriculum');
            setLocation('/academy/curriculum?createCompetency=1');
          }}
          tt={tt}
          navLabel={navLabel}
          bottomAction={{
            label: tt('Ny kompetanse', 'New Competency'),
            onClick: () => setLocation('/academy/curriculum'),
          }}
          footerContent={
            <>
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
            </>
          }
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
                      if (key === 'library') {
                        const query = new URLSearchParams();
                        if (activeCourse?.id) query.set('courseId', String(activeCourse.id));
                        query.set('returnTo', location || '/academy/student-dashboard');
                        const suffix = query.toString();
                        setLocation(suffix ? `/academy/media?${suffix}` : '/academy/media');
                      }
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
              <IconButton size="small" sx={{ color: 'rgba(237,240,247,0.75)' }}>
                <Badge color="warning" badgeContent={1}>
                  <Search fontSize="small" />
                </Badge>
              </IconButton>
              <IconButton
                size="small"
                onClick={() => setLocation('/academy/settings?tab=profile')}
                aria-label={tt('Profil', 'Profile')}
                sx={{ p: 0 }}
              >
                <Avatar sx={{ width: 34, height: 34, bgcolor: '#f8b321', color: '#111', border: '2px solid rgba(248,179,33,0.55)' }}>
                  {String(activeCourse?.instructor?.name || 'S').charAt(0).toUpperCase()}
                </Avatar>
              </IconButton>
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
                      {nextUpLesson?.title || tt('Ingen ferdighet valgt', 'No skill selected')}
                    </Typography>
                    <Typography sx={{ color: 'rgba(237,240,247,0.72)' }}>
                      {nextUpLesson?.description || tt('Velg en ferdighet for å starte læringsreisen.', 'Select a skill to start your learning journey.')}
                    </Typography>
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
