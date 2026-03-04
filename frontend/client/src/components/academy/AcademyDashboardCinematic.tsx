import React, { useCallback, useMemo, useState } from 'react';
import {
  alpha,
  Avatar,
  Badge,
  Box,
  Button,
  Chip,
  IconButton,
  InputAdornment,
  LinearProgress,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import {
  ChevronRight,
  MailOutline,
  NotificationsNone,
  NotificationsActive,
  PlayArrow,
  Search,
} from '@mui/icons-material';
import { useAcademyContext } from '@/contexts/AcademyContext';
import { useEnhancedMasterIntegration } from '@/integration/EnhancedMasterIntegrationProvider';
import { withUniversalIntegration } from '@/integration/UniversalIntegrationHOC';
import { useAcademyLocale } from './academyLocale';
import AcademyVideoPlayer from './AcademyVideoPlayer';
import { useLocation } from 'wouter';

interface CourseLike {
  id: string;
  title: string;
  description?: string;
  category?: string;
  level?: string;
  duration?: number | string;
  thumbnail?: string;
  progress?: number;
  instructor?: {
    name?: string;
  } | string;
  lessons?: any[];
}

interface SessionLike {
  dateLabel: string;
  title: string;
  host: string;
  type: 'live' | 'masterclass' | 'qa';
}

const DEMO_SESSIONS: SessionLike[] = [
  { dateLabel: 'Apr 22', title: 'Virtual Production Tips', host: 'Sarah Lunde', type: 'masterclass' },
  { dateLabel: 'Apr 24', title: 'Sound Design Secrets', host: 'Misket Thorsen', type: 'live' },
  { dateLabel: 'Apr 26', title: 'Live Q&A: Filmmaking', host: 'Lars Erinsen', type: 'qa' },
  { dateLabel: 'Apr 28', title: 'Advanced Color Grading', host: 'Julie Nilsen', type: 'masterclass' },
];

const DEMO_COURSES: CourseLike[] = [
  {
    id: 'demo-directing-masterclass',
    title: 'Directing Masterclass',
    description: 'Build visual language, set direction, and direct scenes with confidence.',
    category: 'videography',
    level: 'MASTERCLASS',
    duration: 68,
    progress: 75,
    instructor: 'Nora Eidem',
    lessons: [
      {
        id: 'demo-directing-lesson-1',
        title: 'Finding Your Visual Tone',
        description: 'How to shape tone and pacing before filming starts.',
        videoUrl: '/assets/academy/intro-video.mp4',
        duration: 1140,
        order: 1,
        isPreview: true,
        resources: [],
      },
    ],
  },
  {
    id: 'demo-lighting-techniques',
    title: 'Lighting Techniques',
    description: 'Lighting setups for dramatic scenes and interviews.',
    category: 'lighting',
    level: 'ADVANCED',
    duration: 19,
    progress: 61,
    instructor: 'Aleks Jensen',
    lessons: [
      {
        id: 'demo-lighting-lesson-1',
        title: 'Key + Fill Ratios',
        videoUrl: '/assets/academy/intro-video.mp4',
        duration: 920,
        order: 1,
        isPreview: false,
        resources: [],
      },
    ],
  },
  {
    id: 'demo-editing-essentials',
    title: 'Editing Essentials',
    description: 'Cut cleaner timelines faster with pro editing workflows.',
    category: 'videography',
    level: 'INTERMEDIATE',
    duration: 10,
    progress: 48,
    instructor: 'Emma Berg',
    lessons: [
      {
        id: 'demo-editing-lesson-1',
        title: 'Rhythm and Sequence Flow',
        videoUrl: '/assets/academy/intro-video.mp4',
        duration: 760,
        order: 1,
        isPreview: false,
        resources: [],
      },
    ],
  },
  {
    id: 'demo-screenwriting-101',
    title: 'Screenwriting 101',
    description: 'Story architecture, scene transitions, and tension arcs.',
    category: 'techniques',
    level: 'BEGINNER',
    duration: 10,
    progress: 42,
    instructor: 'David Skar',
    lessons: [
      {
        id: 'demo-writing-lesson-1',
        title: 'Story Beats That Land',
        videoUrl: '/assets/academy/intro-video.mp4',
        duration: 690,
        order: 1,
        isPreview: false,
        resources: [],
      },
    ],
  },
  {
    id: 'demo-cinematic-drone-shots',
    title: 'Cinematic Drone Shots',
    description: 'Movement, depth, and safety for cinematic drone footage.',
    category: 'videography',
    level: 'ADVANCED',
    duration: 22,
    progress: 34,
    instructor: 'Lina Hoist',
    lessons: [
      {
        id: 'demo-drone-lesson-1',
        title: 'Parallax Motion Moves',
        videoUrl: '/assets/academy/intro-video.mp4',
        duration: 880,
        order: 1,
        isPreview: false,
        resources: [],
      },
    ],
  },
];

const CARD_BACKDROPS = [
  'linear-gradient(145deg, rgba(24,28,38,0.88), rgba(14,17,24,0.95)), radial-gradient(circle at 80% 20%, rgba(245,165,35,0.35), rgba(0,0,0,0))',
  'linear-gradient(145deg, rgba(20,24,33,0.9), rgba(12,15,21,0.96)), radial-gradient(circle at 20% 80%, rgba(245,165,35,0.28), rgba(0,0,0,0))',
  'linear-gradient(145deg, rgba(18,22,31,0.9), rgba(10,14,20,0.96)), radial-gradient(circle at 85% 10%, rgba(105,145,255,0.22), rgba(0,0,0,0))',
  'linear-gradient(145deg, rgba(24,21,17,0.88), rgba(14,13,12,0.96)), radial-gradient(circle at 80% 20%, rgba(245,165,35,0.28), rgba(0,0,0,0))',
];

const formatMinutes = (value: number | string | undefined): string => {
  if (typeof value === 'number') return `${value} min`;
  if (typeof value === 'string' && value.trim()) return value.includes('min') ? value : `${value} min`;
  return '12 min';
};

const getInstructorName = (instructor: CourseLike['instructor']): string => {
  if (typeof instructor === 'string') return instructor;
  return instructor?.name || 'CreatorHub Team';
};

const normalizeLessons = (course: CourseLike): any[] => {
  if (Array.isArray(course.lessons) && course.lessons.length > 0) return course.lessons;
  return [
    {
      id: `${course.id}-lesson-1`,
      title: `${course.title} - Intro`,
      description: 'Start learning with this module.',
      videoUrl: '/assets/academy/intro-video.mp4',
      duration: 840,
      order: 1,
      isPreview: true,
      resources: [],
    },
  ];
};

function AcademyDashboardCinematic() {
  const [, setLocation] = useLocation();
  const {
    state,
    filteredCourses: filteredCoursesFromContext,
    enrolledCourses: enrolledCoursesFromContext,
    inProgressCourses: inProgressCoursesFromContext,
    completedCourses: completedCoursesFromContext,
    setSearchQuery,
    setCurrentCourse,
    setCurrentLesson,
  } = useAcademyContext();
  const { analytics, auth } = useEnhancedMasterIntegration();
  const { tt } = useAcademyLocale();

  const [search, setSearch] = useState('');
  const [selectedCourse, setSelectedCourse] = useState<any | null>(null);
  const [selectedLesson, setSelectedLesson] = useState<any | null>(null);

  const filteredCourses = Array.isArray(filteredCoursesFromContext) ? filteredCoursesFromContext : [];
  const inProgressCourses = Array.isArray(inProgressCoursesFromContext) ? inProgressCoursesFromContext : [];
  const completedCourses = Array.isArray(completedCoursesFromContext) ? completedCoursesFromContext : [];
  const enrolledCourses = Array.isArray(enrolledCoursesFromContext) ? enrolledCoursesFromContext : [];

  const baseCoursesRaw = useMemo(() => {
    if (filteredCourses.length > 0) return filteredCourses;
    if (Array.isArray(state?.courses) && state.courses.length > 0) return state.courses;
    return DEMO_COURSES;
  }, [filteredCourses, state?.courses]);

  const courseProgress = useCallback(
    (courseId: string, fallback: number) => {
      const enrollments = Array.isArray(state?.enrollments) ? state.enrollments : [];
      const enrollment = enrollments.find((item: any) => item?.courseId === courseId);
      if (enrollment?.progress && Array.isArray(enrollment.progress) && enrollment.progress.length > 0) {
        const total = enrollment.progress.reduce((sum: number, step: any) => sum + Number(step?.progress || 0), 0);
        return Math.round(total / enrollment.progress.length);
      }

      const progressRows = Array.isArray(state?.progress) ? state.progress.filter((row: any) => row?.courseId === courseId) : [];
      if (progressRows.length > 0) {
        const total = progressRows.reduce((sum: number, row: any) => sum + Number(row?.progress || 0), 0);
        return Math.round(total / progressRows.length);
      }

      return fallback;
    },
    [state?.enrollments, state?.progress],
  );

  const normalizedCourses = useMemo(() => {
    return baseCoursesRaw.map((raw: any, index: number) => {
      const fallbackProgress = typeof raw?.progress === 'number' ? raw.progress : Math.max(20, 72 - index * 8);
      return {
        id: String(raw?.id || `course-${index}`),
        title: String(raw?.title || 'Untitled Course'),
        description: String(raw?.description || 'Course description coming soon.'),
        category: String(raw?.category || 'academy'),
        level: String(raw?.level || 'MASTERCLASS'),
        duration: raw?.duration,
        thumbnail: typeof raw?.thumbnail === 'string' ? raw.thumbnail : '',
        progress: courseProgress(String(raw?.id || `course-${index}`), fallbackProgress),
        instructor: getInstructorName(raw?.instructor),
        lessons: normalizeLessons(raw),
      };
    });
  }, [baseCoursesRaw, courseProgress]);

  const visibleCourses = useMemo(() => {
    if (!search.trim()) return normalizedCourses;
    const query = search.trim().toLowerCase();
    return normalizedCourses.filter((course) => {
      return (
        course.title.toLowerCase().includes(query) ||
        course.description.toLowerCase().includes(query) ||
        course.instructor.toLowerCase().includes(query)
      );
    });
  }, [normalizedCourses, search]);

  const continueCourses = useMemo(() => visibleCourses.slice(0, 4), [visibleCourses]);
  const heroCourse = continueCourses[0] || normalizedCourses[0];

  const myTracks = useMemo(() => {
    if (enrolledCourses.length > 0) {
      return enrolledCourses.slice(0, 4).map((raw: any, index: number) => {
        const id = String(raw?.id || `track-${index}`);
        return {
          id,
          title: String(raw?.title || 'Untitled Track'),
          level: String(raw?.level || 'TRACK'),
          progress: courseProgress(id, 58 - index * 6),
          instructor: getInstructorName(raw?.instructor),
          lessons: normalizeLessons(raw),
          duration: raw?.duration,
        };
      });
    }
    return normalizedCourses.slice(0, 4);
  }, [courseProgress, enrolledCourses, normalizedCourses]);

  const completionRate = useMemo(() => {
    if (normalizedCourses.length === 0) return 0;
    const total = normalizedCourses.reduce((sum, course) => sum + (course.progress || 0), 0);
    return Math.round(total / normalizedCourses.length);
  }, [normalizedCourses]);

  const analyticsBars = useMemo(() => [18, 12, 29, 41, 24, 35, 52, 48, 61, 59, 73, 78], []);

  const profileName = String((auth.state.user as any)?.name || 'Norwedfilm');
  const profileInitial = profileName.charAt(0).toUpperCase();

  const openCourse = useCallback(
    (course: any) => {
      const lesson = Array.isArray(course?.lessons) && course.lessons.length > 0 ? course.lessons[0] : null;
      if (!lesson) return;

      setCurrentCourse(course);
      setCurrentLesson(lesson);
      setSelectedCourse(course);
      setSelectedLesson(lesson);
      analytics.trackEvent('academy_cinematic_course_opened', {
        courseId: course.id,
        courseTitle: course.title,
      });
    },
    [analytics, setCurrentCourse, setCurrentLesson],
  );

  const handleContinueMasterclass = useCallback(() => {
    if (!heroCourse) return;
    openCourse(heroCourse);
  }, [heroCourse, openCourse]);

  const onNextLesson = useCallback(() => {
    if (!selectedCourse || !selectedLesson) return;
    const lessons = Array.isArray(selectedCourse.lessons) ? selectedCourse.lessons : [];
    const currentIndex = lessons.findIndex((lesson: any) => lesson.id === selectedLesson.id);
    if (currentIndex >= 0 && currentIndex < lessons.length - 1) {
      const nextLesson = lessons[currentIndex + 1];
      setCurrentLesson(nextLesson);
      setSelectedLesson(nextLesson);
    }
  }, [selectedCourse, selectedLesson, setCurrentLesson]);

  const onPreviousLesson = useCallback(() => {
    if (!selectedCourse || !selectedLesson) return;
    const lessons = Array.isArray(selectedCourse.lessons) ? selectedCourse.lessons : [];
    const currentIndex = lessons.findIndex((lesson: any) => lesson.id === selectedLesson.id);
    if (currentIndex > 0) {
      const previousLesson = lessons[currentIndex - 1];
      setCurrentLesson(previousLesson);
      setSelectedLesson(previousLesson);
    }
  }, [selectedCourse, selectedLesson, setCurrentLesson]);

  if (selectedCourse && selectedLesson) {
    return (
      <Box sx={{ minHeight: '100vh', bgcolor: '#04070f' }}>
        <Box sx={{ px: { xs: 2, md: 3 }, pt: 2 }}>
          <Button
            variant="outlined"
            onClick={() => {
              setSelectedCourse(null);
              setSelectedLesson(null);
              setCurrentCourse(null);
              setCurrentLesson(null);
            }}
            sx={{
              borderColor: alpha('#f5a623', 0.5),
              color: '#f8f1e7',
              textTransform: 'none',
              fontWeight: 600,
              borderRadius: '10px',
            }}
          >
            {tt('Tilbake til Academy Dashboard', 'Back to Academy Dashboard')}
          </Button>
        </Box>
        <AcademyVideoPlayer
          course={selectedCourse}
          lesson={selectedLesson}
          onNextLesson={onNextLesson}
          onPreviousLesson={onPreviousLesson}
        />
      </Box>
    );
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        color: '#f8f1e7',
        background:
          'radial-gradient(circle at 14% -10%, rgba(245,165,35,0.25), rgba(0,0,0,0) 42%), radial-gradient(circle at 86% 0%, rgba(62,92,145,0.24), rgba(0,0,0,0) 38%), linear-gradient(180deg, #06080f 0%, #05070d 48%, #04060b 100%)',
      }}
    >
      <Box
        sx={{
          width: 'min(100%, var(--academy-shell-max-width, 1920px))',
          mx: 'auto',
          px: { xs: 2, md: 3 },
          pb: 6,
        }}
      >
        <Box
          component="header"
          sx={{
            pt: 2,
            pb: 2,
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', lg: '320px minmax(320px,1fr) 220px' },
            gap: 2,
            alignItems: 'center',
            borderBottom: `1px solid ${alpha('#f5a623', 0.18)}`,
          }}
        >
          <Stack direction="row" spacing={1.2} alignItems="center">
            <Box
              sx={{
                width: 30,
                height: 30,
                borderRadius: '7px',
                background: 'linear-gradient(135deg, #f5a623 0%, #f59e0b 65%, #d97706 100%)',
                boxShadow: '0 0 18px rgba(245,166,35,0.45)',
              }}
            />
            <Typography
              sx={{
                fontFamily: 'Barlow Condensed, sans-serif',
                letterSpacing: '0.08em',
                fontWeight: 700,
                fontSize: { xs: '1rem', md: '1.15rem' },
              }}
            >
              CREATORHUB <Box component="span" sx={{ opacity: 0.75 }}>ACADEMY</Box>
            </Typography>
          </Stack>

          <TextField
            value={search}
            onChange={(event) => {
              const value = event.target.value;
              setSearch(value);
              setSearchQuery(value);
            }}
            placeholder={tt('Søk kurs, mentorer, moduler...', 'Search courses, mentors, modules...')}
            fullWidth
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search sx={{ color: 'rgba(248,241,231,0.65)' }} />
                </InputAdornment>
              ),
            }}
            sx={{
              '& .MuiOutlinedInput-root': {
                color: '#f8f1e7',
                borderRadius: '10px',
                backgroundColor: 'rgba(11, 15, 24, 0.85)',
                fontFamily: 'Rajdhani, sans-serif',
                '& fieldset': { borderColor: 'rgba(245,166,35,0.28)' },
                '&:hover fieldset': { borderColor: 'rgba(245,166,35,0.45)' },
                '&.Mui-focused fieldset': { borderColor: '#f5a623' },
              },
            }}
          />

          <Stack direction="row" spacing={1} justifyContent={{ xs: 'flex-start', lg: 'flex-end' }}>
            <IconButton sx={{ color: 'rgba(248,241,231,0.8)' }}>
              <NotificationsNone />
            </IconButton>
            <IconButton sx={{ color: 'rgba(248,241,231,0.8)' }}>
              <MailOutline />
            </IconButton>
            <IconButton sx={{ color: 'rgba(248,241,231,0.8)' }}>
              <Badge badgeContent={3} color="warning">
                <NotificationsActive />
              </Badge>
            </IconButton>
            <Avatar sx={{ width: 38, height: 38, bgcolor: '#213047', border: '2px solid rgba(245,166,35,0.65)' }}>
              {profileInitial}
            </Avatar>
          </Stack>
        </Box>

        <Box
          sx={{
            mt: 3,
            borderRadius: '14px',
            border: `1px solid ${alpha('#f5a623', 0.2)}`,
            background:
              'radial-gradient(circle at 25% 15%, rgba(86,120,168,0.28), rgba(8,11,18,0.92) 45%), linear-gradient(135deg, rgba(7,10,17,0.9), rgba(5,7,13,0.98))',
            overflow: 'hidden',
          }}
        >
          <Box sx={{ px: { xs: 2, md: 4 }, py: { xs: 3, md: 4 } }}>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1.05fr 1fr' }, gap: 3, alignItems: 'center' }}>
              <Box>
                <Typography
                  sx={{
                    fontFamily: 'Barlow Condensed, sans-serif',
                    fontSize: { xs: '2rem', md: '3.1rem' },
                    lineHeight: 1,
                    letterSpacing: '0.01em',
                    mb: 1.3,
                  }}
                >
                  {tt('Velkommen tilbake,', 'Welcome back,')} {profileName}
                </Typography>
                <Typography sx={{ opacity: 0.84, mb: 1.2, fontFamily: 'Rajdhani, sans-serif' }}>
                  {tt('Nåværende sporprogresjon:', 'Current Track Progress:')}
                </Typography>
                <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2 }}>
                  <LinearProgress
                    variant="determinate"
                    value={heroCourse?.progress || 0}
                    sx={{
                      flex: 1,
                      height: 10,
                      borderRadius: 999,
                      bgcolor: 'rgba(255,255,255,0.15)',
                      '& .MuiLinearProgress-bar': {
                        borderRadius: 999,
                        background: 'linear-gradient(90deg, #f5a623 0%, #ffbf47 100%)',
                      },
                    }}
                  />
                  <Typography sx={{ minWidth: 112, fontFamily: 'Rajdhani, sans-serif', fontWeight: 700 }}>
                    {heroCourse?.progress || 0}% {tt('fullført', 'Complete')}
                  </Typography>
                </Stack>
                <Button
                  variant="contained"
                  startIcon={<PlayArrow />}
                  onClick={handleContinueMasterclass}
                  sx={{
                    textTransform: 'none',
                    fontFamily: 'Rajdhani, sans-serif',
                    fontWeight: 700,
                    borderRadius: '8px',
                    px: 3,
                    py: 1.15,
                    color: '#1e1306',
                    background: 'linear-gradient(180deg, #ffc64d 0%, #f5a623 100%)',
                    boxShadow: '0 8px 24px rgba(245,166,35,0.38)',
                    '&:hover': {
                      background: 'linear-gradient(180deg, #ffd76f 0%, #f6b53d 100%)',
                    },
                  }}
                >
                  {tt('Fortsett masterclass', 'Continue Masterclass')}
                </Button>
                <Button
                  variant="text"
                  onClick={() => setLocation('/academy/module-manager')}
                  sx={{
                    ml: 1.2,
                    textTransform: 'none',
                    fontFamily: 'Rajdhani, sans-serif',
                    fontWeight: 700,
                    color: '#f8f1e7',
                    px: 1.3,
                    borderRadius: '8px',
                    border: '1px solid rgba(245,166,35,0.44)',
                    background: 'rgba(245,166,35,0.08)',
                  }}
                >
                  {tt('Åpne moduladministrator', 'Open Module Manager')}
                </Button>
                <Button
                  variant="text"
                  onClick={() => setLocation('/academy/course-creator')}
                  sx={{
                    ml: 1.2,
                    textTransform: 'none',
                    fontFamily: 'Rajdhani, sans-serif',
                    fontWeight: 700,
                    color: '#f8f1e7',
                    px: 1.3,
                    borderRadius: '8px',
                    border: '1px solid rgba(245,166,35,0.44)',
                    background: 'rgba(245,166,35,0.08)',
                  }}
                >
                  {tt('Åpne kursbygger', 'Open Course Creator')}
                </Button>
                <Button
                  variant="text"
                  onClick={() => {
                    window.dispatchEvent(new Event('navigate-to-academy'));
                    setLocation('/dashboard');
                  }}
                  sx={{
                    ml: 1.2,
                    textTransform: 'none',
                    fontFamily: 'Rajdhani, sans-serif',
                    fontWeight: 700,
                    color: '#f8f1e7',
                    px: 1.3,
                    borderRadius: '8px',
                    border: '1px solid rgba(255,255,255,0.22)',
                  }}
                >
                  {tt('Åpne full arbeidsflate', 'Open Full Workspace')}
                </Button>
              </Box>

              <Box
                sx={{
                  position: 'relative',
                  minHeight: { xs: 230, md: 300 },
                  borderRadius: '10px',
                  border: '1px solid rgba(255,255,255,0.16)',
                  overflow: 'hidden',
                  background:
                    heroCourse?.thumbnail
                      ? `linear-gradient(180deg, rgba(5,8,12,0.08), rgba(4,6,10,0.82)), url(${heroCourse.thumbnail}) center / cover no-repeat`
                      : CARD_BACKDROPS[0],
                }}
              >
                <Box
                  sx={{
                    position: 'absolute',
                    left: 18,
                    bottom: 18,
                    right: 18,
                  }}
                >
                  <Typography sx={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: { xs: '1.5rem', md: '2rem' }, lineHeight: 0.95 }}>
                    {heroCourse?.title || 'Directing Masterclass'}
                  </Typography>
                  <LinearProgress
                    variant="determinate"
                    value={Math.max(10, heroCourse?.progress || 0)}
                    sx={{
                      mt: 1.2,
                      height: 6,
                      borderRadius: 999,
                      bgcolor: 'rgba(255,255,255,0.2)',
                      '& .MuiLinearProgress-bar': {
                        borderRadius: 999,
                        background: 'linear-gradient(90deg, #f5a623 0%, #ffd26a 100%)',
                      },
                    }}
                  />
                </Box>
              </Box>
            </Box>
          </Box>
        </Box>

        <Box sx={{ mt: 2.8 }}>
          <Typography sx={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: { xs: '1.6rem', md: '2rem' }, mb: 1.4 }}>
            {tt('Fortsett læring', 'Continue Learning')}
          </Typography>

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', xl: 'repeat(4, 1fr)' }, gap: 1.5 }}>
            {continueCourses.map((course, index) => (
              <Box
                key={course.id}
                role="button"
                tabIndex={0}
                onClick={() => openCourse(course)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') openCourse(course);
                }}
                sx={{
                  borderRadius: '10px',
                  border: `1px solid ${alpha('#f5a623', 0.22)}`,
                  overflow: 'hidden',
                  cursor: 'pointer',
                  transition: 'transform .22s ease, box-shadow .22s ease, border-color .22s ease',
                  background: 'rgba(7, 10, 16, 0.88)',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    borderColor: alpha('#f5a623', 0.45),
                    boxShadow: '0 16px 30px rgba(0,0,0,0.35)',
                  },
                }}
              >
                <Box
                  sx={{
                    height: 160,
                    background:
                      course.thumbnail
                        ? `linear-gradient(180deg, rgba(8,11,17,0.05), rgba(6,8,12,0.78)), url(${course.thumbnail}) center / cover no-repeat`
                        : CARD_BACKDROPS[index % CARD_BACKDROPS.length],
                  }}
                />
                <Box sx={{ p: 1.4 }}>
                  <Typography sx={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '1.55rem', lineHeight: 1 }}>
                    {course.title}
                  </Typography>
                  <Stack direction="row" justifyContent="space-between" sx={{ mt: 0.35 }}>
                    <Typography sx={{ opacity: 0.82, fontSize: '0.92rem', fontFamily: 'Rajdhani, sans-serif' }}>
                      {course.instructor}
                    </Typography>
                    <Typography sx={{ opacity: 0.86, fontSize: '0.85rem', fontFamily: 'Rajdhani, sans-serif' }}>
                      {formatMinutes(course.duration)}
                    </Typography>
                  </Stack>
                  <LinearProgress
                    variant="determinate"
                    value={course.progress}
                    sx={{
                      mt: 1,
                      height: 5,
                      borderRadius: 999,
                      bgcolor: 'rgba(255,255,255,0.18)',
                      '& .MuiLinearProgress-bar': {
                        borderRadius: 999,
                        background: 'linear-gradient(90deg, #f5a623 0%, #ffcd67 100%)',
                      },
                    }}
                  />
                </Box>
              </Box>
            ))}
          </Box>
        </Box>

        <Box sx={{ mt: 2.2, display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1.15fr 0.85fr' }, gap: 2 }}>
          <Box sx={{ borderRadius: '12px', border: `1px solid ${alpha('#f5a623', 0.2)}`, background: 'rgba(7, 10, 16, 0.82)', p: 2 }}>
            <Typography sx={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: { xs: '1.6rem', md: '2rem' }, mb: 1.2 }}>
              {tt('Mine spor', 'My Tracks')}
            </Typography>

            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', xl: 'repeat(4, 1fr)' }, gap: 1.2 }}>
              {myTracks.map((course, index) => (
                <Box
                  key={`${course.id}-track`}
                  onClick={() => openCourse(course)}
                  sx={{
                    borderRadius: '10px',
                    border: '1px solid rgba(255,255,255,0.14)',
                    overflow: 'hidden',
                    cursor: 'pointer',
                    background: 'rgba(8, 11, 18, 0.86)',
                  }}
                >
                  <Box sx={{ height: 122, background: CARD_BACKDROPS[index % CARD_BACKDROPS.length] }} />
                  <Box sx={{ p: 1.1 }}>
                    <Typography sx={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '1.25rem', lineHeight: 1.05 }}>
                      {course.title}
                    </Typography>
                    <Chip
                      size="small"
                      label={String(course.level || 'TRACK')}
                      sx={{
                        mt: 0.8,
                        height: 22,
                        fontFamily: 'Rajdhani, sans-serif',
                        fontWeight: 700,
                        letterSpacing: '0.03em',
                        bgcolor: alpha('#f5a623', 0.2),
                        color: '#ffdba1',
                      }}
                    />
                  </Box>
                </Box>
              ))}
            </Box>

            <Box
              sx={{
                mt: 1.5,
                borderRadius: '10px',
                border: `1px solid ${alpha('#f5a623', 0.16)}`,
                background: 'rgba(9, 13, 20, 0.92)',
                p: 1.6,
              }}
            >
              <Typography sx={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: { xs: '1.45rem', md: '1.75rem' }, mb: 1.2 }}>
                {tt('Ytelsesanalyse', 'Performance Analytics')}
              </Typography>

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3}>
                <Stack direction="row" spacing={3} sx={{ minWidth: { sm: 280 } }}>
                  <Box>
                    <Typography sx={{ color: '#ffcb63', fontSize: '2rem', fontFamily: 'Barlow Condensed, sans-serif', lineHeight: 1 }}>
                      {completionRate}%
                    </Typography>
                    <Typography sx={{ opacity: 0.72, fontFamily: 'Rajdhani, sans-serif' }}>{tt('Kursfullføring', 'Course Completion')}</Typography>
                  </Box>
                  <Box>
                    <Typography sx={{ color: '#f8f1e7', fontSize: '2rem', fontFamily: 'Barlow Condensed, sans-serif', lineHeight: 1 }}>
                      {tt('Ekspert', 'Expert')}
                    </Typography>
                    <Typography sx={{ opacity: 0.72, fontFamily: 'Rajdhani, sans-serif' }}>{tt('Ferdighetsnivå', 'Skill Level')}</Typography>
                  </Box>
                  <Box>
                    <Typography sx={{ color: '#f8f1e7', fontSize: '2rem', fontFamily: 'Barlow Condensed, sans-serif', lineHeight: 1 }}>
                      {Math.max(4, inProgressCourses.length * 3 + completedCourses.length * 2)}
                    </Typography>
                    <Typography sx={{ opacity: 0.72, fontFamily: 'Rajdhani, sans-serif' }}>{tt('Dagsrekke', 'Day Streak')}</Typography>
                  </Box>
                </Stack>

                <Box sx={{ flex: 1 }}>
                  <Stack direction="row" spacing={0.8} alignItems="flex-end" sx={{ height: 102 }}>
                    {analyticsBars.map((bar, index) => (
                      <Box
                        key={`bar-${index}`}
                        sx={{
                          flex: 1,
                          minWidth: 7,
                          height: `${bar}%`,
                          borderRadius: '4px 4px 2px 2px',
                          background:
                            index >= analyticsBars.length - 3
                              ? 'linear-gradient(180deg, #ffcd6a 0%, #f5a623 100%)'
                              : 'linear-gradient(180deg, rgba(108,144,199,0.82) 0%, rgba(65,89,131,0.82) 100%)',
                        }}
                      />
                    ))}
                  </Stack>
                </Box>
              </Stack>
            </Box>
          </Box>

          <Box sx={{ borderRadius: '12px', border: `1px solid ${alpha('#f5a623', 0.2)}`, background: 'rgba(7, 10, 16, 0.82)', p: 2 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.2 }}>
              <Typography sx={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: { xs: '1.6rem', md: '2rem' } }}>
                {tt('Kommende sesjoner', 'Upcoming Sessions')}
              </Typography>
              <Button
                endIcon={<ChevronRight />}
                sx={{
                  minWidth: 0,
                  textTransform: 'none',
                  color: '#f8f1e7',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '8px',
                  px: 1.2,
                  py: 0.45,
                  fontFamily: 'Rajdhani, sans-serif',
                }}
              >{tt('Alle', 'All')}</Button>
            </Stack>

            <Stack spacing={1}>
              {DEMO_SESSIONS.map((session) => (
                <Box
                  key={`${session.dateLabel}-${session.title}`}
                  sx={{
                    border: '1px solid rgba(255,255,255,0.13)',
                    borderRadius: '9px',
                    p: 1.2,
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', sm: '72px minmax(0, 1fr) 92px' },
                    alignItems: { xs: 'stretch', sm: 'center' },
                    gap: 1,
                    background: 'rgba(10, 14, 22, 0.75)',
                  }}
                >
                  <Typography sx={{ fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, opacity: 0.9 }}>
                    {session.dateLabel}
                  </Typography>
                  <Box>
                    <Typography sx={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '1.35rem', lineHeight: 1.05 }}>
                      {session.title}
                    </Typography>
                    <Typography sx={{ fontFamily: 'Rajdhani, sans-serif', opacity: 0.72 }}>{session.host}</Typography>
                  </Box>
                  <Button
                    variant="contained"
                    endIcon={<ChevronRight />}
                    sx={{
                      width: { xs: '100%', sm: 'auto' },
                      textTransform: 'none',
                      fontFamily: 'Rajdhani, sans-serif',
                      fontWeight: 700,
                      color: '#1e1306',
                      borderRadius: '7px',
                      background: 'linear-gradient(180deg, #ffc64d 0%, #f5a623 100%)',
                      '&:hover': {
                        background: 'linear-gradient(180deg, #ffd76f 0%, #f6b53d 100%)',
                      },
                    }}
                  >
                    {tt('Bli med', 'Join')}
                  </Button>
                </Box>
              ))}
            </Stack>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

export default withUniversalIntegration(AcademyDashboardCinematic, {
  componentId: 'academy-dashboard-cinematic',
  componentName: 'Academy Dashboard Cinematic',
  componentType: 'dashboard',
  componentCategory: 'academy',
  featureIds: ['academy-dashboard', 'video-player', 'course-management'],
});
