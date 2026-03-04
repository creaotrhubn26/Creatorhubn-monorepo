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
  ArrowForward,
  Assessment,
  AutoAwesome,
  Campaign,
  Edit,
  Groups,
  MailOutline,
  MonetizationOn,
  MovieCreation,
  NotificationsActive,
  NotificationsNone,
  OndemandVideo,
  PlayArrow,
  Quiz,
  Search,
  Security,
  Subtitles,
  ViewModule,
} from '@mui/icons-material';
import { useLocation } from 'wouter';
import LoginModal from '@/components/auth/LoginModal';
import { useAcademyContext, type Course, type Lesson } from '@/contexts/AcademyContext';
import { useEnhancedMasterIntegration } from '@/integration/EnhancedMasterIntegrationProvider';
import { withUniversalIntegration } from '@/integration/UniversalIntegrationHOC';
import { withVisualEditor } from '@/components/admin/visual-editor/withVisualEditor';
import { useAcademyLocale } from './academyLocale';

interface LandingCourse {
  id: string;
  title: string;
  summaryNo: string;
  summaryEn: string;
  instructor: string;
  durationLabel: string;
  progress: number;
  thumbnail: string;
}

interface ToolCard {
  titleNo: string;
  titleEn: string;
  descriptionNo: string;
  descriptionEn: string;
  route: string;
  icon: React.ReactNode;
  badge: string;
}

const PLACEHOLDER_BACKDROPS = [
  'linear-gradient(145deg, rgba(24,28,38,0.88), rgba(14,17,24,0.95)), radial-gradient(circle at 80% 20%, rgba(245,165,35,0.35), rgba(0,0,0,0))',
  'linear-gradient(145deg, rgba(20,24,33,0.9), rgba(12,15,21,0.96)), radial-gradient(circle at 20% 80%, rgba(245,165,35,0.28), rgba(0,0,0,0))',
  'linear-gradient(145deg, rgba(18,22,31,0.9), rgba(10,14,20,0.96)), radial-gradient(circle at 85% 10%, rgba(105,145,255,0.22), rgba(0,0,0,0))',
  'linear-gradient(145deg, rgba(24,21,17,0.88), rgba(14,13,12,0.96)), radial-gradient(circle at 80% 20%, rgba(245,165,35,0.28), rgba(0,0,0,0))',
];

const DEFAULT_COURSES: LandingCourse[] = [
  {
    id: 'placeholder-directing',
    title: 'Directing Masterclass',
    summaryNo: 'Praktisk regi, blokkering og visuell historiefortelling.',
    summaryEn: 'Practical directing, blocking, and visual storytelling.',
    instructor: 'CreatorHub Team',
    durationLabel: '68 min',
    progress: 72,
    thumbnail: '',
  },
  {
    id: 'placeholder-lighting',
    title: 'Lighting Fundamentals',
    summaryNo: 'Tre-punkts lys og setups for studio og location.',
    summaryEn: 'Three-point lighting setups for studio and location work.',
    instructor: 'CreatorHub Team',
    durationLabel: '54 min',
    progress: 56,
    thumbnail: '',
  },
  {
    id: 'placeholder-editing',
    title: 'Editing Essentials',
    summaryNo: 'Rytme, flyt og klippegrep for profesjonelle leveranser.',
    summaryEn: 'Rhythm, flow, and editing techniques for professional delivery.',
    instructor: 'CreatorHub Team',
    durationLabel: '42 min',
    progress: 44,
    thumbnail: '',
  },
];

const CORE_FEATURES: ToolCard[] = [
  {
    titleNo: 'Profesjonell videospiller',
    titleEn: 'Professional Video Player',
    descriptionNo: 'Kapitler, undertekster, transkripsjoner, hurtigtaster og avspillingskontroller.',
    descriptionEn: 'Chapters, subtitles, transcripts, hotkeys, and playback controls.',
    route: '/academy/video-player',
    icon: <OndemandVideo />,
    badge: 'PLAYER',
  },
  {
    titleNo: 'Interaktive quizer',
    titleEn: 'Interactive Quizzes',
    descriptionNo: 'Spørsmål i video med karakterretur og elementanalyse for å måle læring.',
    descriptionEn: 'In-video questions with graded feedback and response analytics.',
    route: '/academy/quiz-manager',
    icon: <Quiz />,
    badge: 'QUIZ',
  },
  {
    titleNo: 'Annotasjonsredigering',
    titleEn: 'Annotation Editing',
    descriptionNo: 'Tidsstemplede notater, tegning og gjennomgangsarbeidsflyter for samarbeidende undervisning.',
    descriptionEn: 'Timestamped notes, drawing, and collaborative review workflows.',
    route: '/academy/annotation-editor',
    icon: <Edit />,
    badge: 'ANNOTATE',
  },
  {
    titleNo: 'Moduladministrator',
    titleEn: 'Module Manager',
    descriptionNo: 'Opprett moduler/leksjoner, planlegg utgivelser, sett forutsetninger og lokaliser innhold.',
    descriptionEn: 'Create modules/lessons, schedule releases, set prerequisites, and localize content.',
    route: '/academy/module-manager',
    icon: <ViewModule />,
    badge: 'MODULES',
  },
  {
    titleNo: 'Analyser som betyr noe',
    titleEn: 'Actionable Analytics',
    descriptionNo: 'Frafalls-varmekart, fullføringsrater, kohortsammenligninger og kvalitetsmålinger.',
    descriptionEn: 'Drop-off heatmaps, completion rates, cohort comparisons, and quality metrics.',
    route: '/academy/analytics',
    icon: <Assessment />,
    badge: 'INSIGHTS',
  },
  {
    titleNo: 'Personvern og sikkerhet',
    titleEn: 'Privacy & Security',
    descriptionNo: 'SSO, rollebasert tilgang, signerte URL-er/DRM, revisjonslogger og GDPR-kontroller.',
    descriptionEn: 'SSO, role-based access, signed URLs/DRM, audit logs, and GDPR controls.',
    route: '/academy/settings',
    icon: <Security />,
    badge: 'SECURE',
  },
];

const NEW_STUDIO_TOOLS: ToolCard[] = [
  {
    titleNo: 'Kursbygger',
    titleEn: 'Course Creator',
    descriptionNo: 'Bygg kursstruktur, metadata, publisering og versjonsflyt.',
    descriptionEn: 'Build course structure, metadata, publishing, and version workflows.',
    route: '/academy/course-creator',
    icon: <MovieCreation />,
    badge: 'STUDIO',
  },
  {
    titleNo: 'Monetisering',
    titleEn: 'Monetization',
    descriptionNo: 'Prisstrategi, bundles, coupons, affiliate og inntektsanalyse.',
    descriptionEn: 'Pricing strategy, bundles, coupons, affiliates, and revenue analytics.',
    route: '/academy/monetization',
    icon: <MonetizationOn />,
    badge: 'REVENUE',
  },
  {
    titleNo: 'CTA-overlay',
    titleEn: 'CTA Overlay',
    descriptionNo: 'A/B-test CTA overlays i video med konverteringsinnsikt.',
    descriptionEn: 'A/B test CTA overlays in video with conversion insights.',
    route: '/academy/cta-overlay',
    icon: <Campaign />,
    badge: 'CTA',
  },
  {
    titleNo: 'Animerte lower thirds',
    titleEn: 'Animated Lower Thirds',
    descriptionNo: 'Bygg branded lower thirds med timing, style og safe guides.',
    descriptionEn: 'Build branded lower thirds with timing, style, and safe guides.',
    route: '/academy/lower-thirds',
    icon: <Subtitles />,
    badge: 'BRANDING',
  },
  {
    titleNo: 'Oppgaver',
    titleEn: 'Assignments',
    descriptionNo: 'Opprett oppgaver, følg progresjon og gi strukturerte tilbakemeldinger.',
    descriptionEn: 'Create assignments, track progress, and provide structured feedback.',
    route: '/academy/assignments',
    icon: <AutoAwesome />,
    badge: 'LEARNING',
  },
  {
    titleNo: 'Påmelding og kohorter',
    titleEn: 'Enrollment & Cohorts',
    descriptionNo: 'Administrer kohorter, enrollment-regler og release-planer.',
    descriptionEn: 'Manage cohorts, enrollment rules, and release plans.',
    route: '/academy/enrollment',
    icon: <Groups />,
    badge: 'OPERATIONS',
  },
];

const formatDuration = (seconds: number): string => {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0 min';
  return `${Math.max(1, Math.round(seconds / 60))} min`;
};

const resolveInstructor = (course: Course): string => {
  if (typeof course.instructor === 'string') return course.instructor;
  return course.instructor?.name || 'CreatorHub Team';
};

const firstLesson = (course: Course): Lesson | null => {
  if (!Array.isArray(course.lessons) || course.lessons.length === 0) return null;
  const sorted = [...course.lessons].sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
  return sorted[0] || course.lessons[0] || null;
};

function AcademyLandingPage() {
  const [, setLocation] = useLocation();
  const {
    state,
    filteredCourses,
    setSearchQuery,
    setCurrentCourse,
    setCurrentLesson,
  } = useAcademyContext();
  const { analytics, auth } = useEnhancedMasterIntegration();
  const { tt } = useAcademyLocale();

  const [search, setSearch] = useState('');
  const [loginOpen, setLoginOpen] = useState(false);

  const profileName = useMemo(() => {
    const user = auth.state.user;
    if (typeof user !== 'object' || user === null) return 'Creator';
    const candidate = user as Record<string, unknown>;
    if (typeof candidate.name === 'string' && candidate.name.trim()) return candidate.name;
    if (typeof candidate.firstName === 'string' && candidate.firstName.trim()) return candidate.firstName;
    if (typeof candidate.email === 'string' && candidate.email.includes('@')) {
      return candidate.email.split('@')[0];
    }
    return 'Creator';
  }, [auth.state.user]);

  const allCourses = useMemo(() => {
    return filteredCourses.length > 0 ? filteredCourses : state.courses;
  }, [filteredCourses, state.courses]);

  const mappedCourses = useMemo<LandingCourse[]>(() => {
    if (allCourses.length === 0) return DEFAULT_COURSES;

    return allCourses.map((course, index) => {
      const progressRows = state.progress.filter((row) => row.courseId === course.id);
      const avgProgress =
        progressRows.length > 0
          ? Math.round(
              progressRows.reduce((sum, row) => sum + Number(row.progress || 0), 0) / progressRows.length,
            )
          : Math.max(15, 74 - index * 8);

      return {
        id: course.id,
        title: course.title,
        summaryNo: course.description || 'Kursbeskrivelse kommer snart.',
        summaryEn: course.description || 'Course description coming soon.',
        instructor: resolveInstructor(course),
        durationLabel: formatDuration(course.duration || 0),
        progress: Math.min(100, Math.max(0, avgProgress)),
        thumbnail: course.thumbnail || '',
      };
    });
  }, [allCourses, state.progress]);

  const visibleCourses = useMemo(() => {
    if (!search.trim()) return mappedCourses;
    const query = search.trim().toLowerCase();
    return mappedCourses.filter((course) => {
      return (
        course.title.toLowerCase().includes(query) ||
        tt(course.summaryNo, course.summaryEn).toLowerCase().includes(query) ||
        course.instructor.toLowerCase().includes(query)
      );
    });
  }, [mappedCourses, search, tt]);

  const heroCourse = visibleCourses[0] || mappedCourses[0] || DEFAULT_COURSES[0];

  const totals = useMemo(() => {
    const lessons = allCourses.reduce((sum, course) => sum + (Array.isArray(course.lessons) ? course.lessons.length : 0), 0);
    const students = allCourses.reduce((sum, course) => sum + Number(course.studentCount || 0), 0);
    const avgRating =
      allCourses.length > 0
        ? (allCourses.reduce((sum, course) => sum + Number(course.rating || 0), 0) / allCourses.length).toFixed(1)
        : '4.8';
    const avgCompletion =
      state.progress.length > 0
        ? Math.round(state.progress.reduce((sum, row) => sum + Number(row.progress || 0), 0) / state.progress.length)
        : 68;

    return {
      lessons,
      students,
      avgRating,
      avgCompletion,
    };
  }, [allCourses, state.progress]);

  const goTo = useCallback(
    (route: string, eventName: string) => {
      analytics.trackEvent(eventName, {
        route,
        source: 'academy-landing',
      });
      setLocation(route);
    },
    [analytics, setLocation],
  );

  const handleSearch = useCallback(
    (value: string) => {
      setSearch(value);
      setSearchQuery(value);
    },
    [setSearchQuery],
  );

  const openCourse = useCallback(
    (courseId: string) => {
      const match = allCourses.find((course) => course.id === courseId);
      if (!match) {
        goTo('/academy-dashboard', 'academy_landing_fallback_dashboard');
        return;
      }

      const lesson = firstLesson(match);
      if (lesson) {
        setCurrentCourse(match);
        setCurrentLesson(lesson);
        goTo('/academy/video-player', 'academy_landing_open_video_player');
        return;
      }

      goTo('/academy-dashboard', 'academy_landing_open_dashboard_no_lesson');
    },
    [allCourses, goTo, setCurrentCourse, setCurrentLesson],
  );

  const profileInitial = profileName.charAt(0).toUpperCase();

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
          pb: 5,
        }}
      >
        <Box
          component="header"
          sx={{
            pt: 2,
            pb: 2,
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', lg: '330px minmax(320px,1fr) 280px' },
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
            <Box>
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
              <Typography sx={{ fontSize: 11, opacity: 0.58 }}>{tt('Et produkt av CreatorHub Norge', 'A product by CreatorHub Norway')}</Typography>
            </Box>
          </Stack>

          <TextField
            value={search}
            onChange={(event) => handleSearch(event.target.value)}
            placeholder={tt('Søk kurs, funksjoner, moduler...', 'Search courses, features, modules...')}
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

          <Stack direction="row" spacing={1} justifyContent={{ xs: 'flex-start', lg: 'flex-end' }} alignItems="center">
            <IconButton sx={{ color: 'rgba(248,241,231,0.8)' }}>
              <NotificationsNone />
            </IconButton>
            <IconButton sx={{ color: 'rgba(248,241,231,0.8)' }}>
              <MailOutline />
            </IconButton>
            <IconButton sx={{ color: 'rgba(248,241,231,0.8)' }}>
              <Badge badgeContent={2} color="warning">
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
                    fontSize: { xs: '2rem', md: '3rem' },
                    lineHeight: 1,
                    letterSpacing: '0.01em',
                    mb: 1.3,
                  }}
                >
                  {tt('Velkommen til CreatorHub Academy', 'Welcome to CreatorHub Academy')}
                </Typography>
                <Typography sx={{ opacity: 0.84, mb: 1.2, fontFamily: 'Rajdhani, sans-serif' }}>
                  {tt('En moderne landingsside for læring: utforsk kurs, oppdag funksjoner og start reisen din i Academy.', 'A modern learning landing page: explore courses, discover features, and start your Academy journey.')}
                </Typography>
                <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2 }}>
                  <LinearProgress
                    variant="determinate"
                    value={heroCourse.progress}
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
                    {heroCourse.progress}% {tt('klar', 'complete')}
                  </Typography>
                </Stack>

                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.2} useFlexGap flexWrap="wrap">
                  <Button
                    variant="contained"
                    startIcon={<PlayArrow />}
                    onClick={() => goTo('/academy-dashboard', 'academy_landing_open_dashboard')}
                    sx={{
                      textTransform: 'none',
                      fontFamily: 'Rajdhani, sans-serif',
                      fontWeight: 700,
                      borderRadius: '8px',
                      px: 2.2,
                      py: 1,
                      color: '#1e1306',
                      background: 'linear-gradient(180deg, #ffc64d 0%, #f5a623 100%)',
                      boxShadow: '0 8px 24px rgba(245,166,35,0.38)',
                    }}
                  >
                    {tt('Utforsk Academy', 'Explore Academy')}
                  </Button>
                  <Button
                    variant="outlined"
                    onClick={() => goTo('/academy/course-creator', 'academy_landing_open_course_creator')}
                    sx={{
                      textTransform: 'none',
                      fontFamily: 'Rajdhani, sans-serif',
                      fontWeight: 700,
                      color: '#f8f1e7',
                      borderColor: 'rgba(245,166,35,0.44)',
                    }}
                  >
                    {tt('Bygg ditt første kurs', 'Build your first course')}
                  </Button>
                  <Button
                    variant="outlined"
                    onClick={() => setLoginOpen(true)}
                    sx={{
                      textTransform: 'none',
                      fontFamily: 'Rajdhani, sans-serif',
                      fontWeight: 700,
                      color: '#f8f1e7',
                      borderColor: 'rgba(255,255,255,0.32)',
                    }}
                  >
                    {tt('Logg inn', 'Sign in')}
                  </Button>
                </Stack>
              </Box>

              <Box
                sx={{
                  position: 'relative',
                  minHeight: { xs: 230, md: 300 },
                  borderRadius: '10px',
                  border: '1px solid rgba(255,255,255,0.16)',
                  overflow: 'hidden',
                  background:
                    heroCourse.thumbnail
                      ? `linear-gradient(180deg, rgba(5,8,12,0.08), rgba(4,6,10,0.82)), url(${heroCourse.thumbnail}) center / cover no-repeat`
                      : PLACEHOLDER_BACKDROPS[0],
                }}
              >
                <Box sx={{ position: 'absolute', left: 18, bottom: 18, right: 18 }}>
                  <Chip
                    size="small"
                    label={tt('PLACEHOLDER FORHÅNDSVISNING', 'PLACEHOLDER PREVIEW')}
                    sx={{
                      mb: 1,
                      color: '#fbe6be',
                      borderColor: 'rgba(245,166,35,0.45)',
                      background: 'rgba(245,166,35,0.15)',
                    }}
                  />
                  <Typography sx={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: { xs: '1.5rem', md: '2rem' }, lineHeight: 0.95 }}>
                    {heroCourse.title}
                  </Typography>
                  <Typography sx={{ mt: 0.6, opacity: 0.76 }}>{tt(heroCourse.summaryNo, heroCourse.summaryEn)}</Typography>
                  <LinearProgress
                    variant="determinate"
                    value={Math.max(10, heroCourse.progress)}
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

        <Box sx={{ mt: 2.4, display: 'grid', gridTemplateColumns: { xs: '1fr', xl: '1fr 1fr' }, gap: 2 }}>
          <Box sx={{ borderRadius: '12px', border: `1px solid ${alpha('#f5a623', 0.2)}`, background: 'rgba(7, 10, 16, 0.82)', p: 2 }}>
            <Typography sx={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: { xs: '1.55rem', md: '1.9rem' }, mb: 1 }}>
              {tt('Kjernefunksjoner', 'Core Features')}
            </Typography>
            <Stack spacing={1}>
              {CORE_FEATURES.map((item) => (
                <Button
                  key={item.route}
                  onClick={() => goTo(item.route, 'academy_landing_open_core_feature')}
                  sx={{
                    justifyContent: 'space-between',
                    textTransform: 'none',
                    color: '#f8f1e7',
                    border: '1px solid rgba(255,255,255,0.14)',
                    borderRadius: '10px',
                    px: 1.1,
                    py: 1.05,
                    background: 'rgba(10,14,22,0.72)',
                    '&:hover': {
                      borderColor: 'rgba(245,166,35,0.48)',
                      background: 'rgba(245,166,35,0.1)',
                    },
                  }}
                >
                  <Stack direction="row" spacing={1} alignItems="center" minWidth={0}>
                    <Avatar
                      sx={{
                        width: 30,
                        height: 30,
                        bgcolor: 'rgba(245,166,35,0.2)',
                        color: '#ffd38c',
                        border: '1px solid rgba(245,166,35,0.35)',
                      }}
                    >
                      {item.icon}
                    </Avatar>
                    <Box sx={{ textAlign: 'left', minWidth: 0 }}>
                      <Typography sx={{ fontWeight: 700 }} noWrap>{tt(item.titleNo, item.titleEn)}</Typography>
                      <Typography sx={{ fontSize: 12, opacity: 0.72 }} noWrap>{tt(item.descriptionNo, item.descriptionEn)}</Typography>
                    </Box>
                  </Stack>
                  <Chip
                    label={item.badge}
                    size="small"
                    sx={{
                      color: '#fbe6be',
                      borderColor: 'rgba(245,166,35,0.35)',
                      background: 'rgba(245,166,35,0.16)',
                    }}
                  />
                </Button>
              ))}
            </Stack>
          </Box>

          <Box sx={{ borderRadius: '12px', border: `1px solid ${alpha('#f5a623', 0.2)}`, background: 'rgba(7, 10, 16, 0.82)', p: 2 }}>
            <Typography sx={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: { xs: '1.55rem', md: '1.9rem' }, mb: 1 }}>
              {tt('Nye studio-funksjoner', 'New Studio Features')}
            </Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 1 }}>
              {NEW_STUDIO_TOOLS.map((item) => (
                <Box
                  key={item.route}
                  role="button"
                  tabIndex={0}
                  onClick={() => goTo(item.route, 'academy_landing_open_new_studio_tool')}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      goTo(item.route, 'academy_landing_open_new_studio_tool');
                    }
                  }}
                  sx={{
                    borderRadius: '10px',
                    border: '1px solid rgba(255,255,255,0.14)',
                    p: 1.1,
                    cursor: 'pointer',
                    background: 'rgba(10,14,22,0.72)',
                    transition: 'border-color .2s ease, transform .2s ease',
                    '&:hover': {
                      borderColor: 'rgba(245,166,35,0.48)',
                      transform: 'translateY(-2px)',
                    },
                  }}
                >
                  <Stack direction="row" spacing={0.8} alignItems="center">
                    <Avatar
                      sx={{
                        width: 28,
                        height: 28,
                        bgcolor: 'rgba(245,166,35,0.2)',
                        color: '#ffd38c',
                        border: '1px solid rgba(245,166,35,0.35)',
                      }}
                    >
                      {item.icon}
                    </Avatar>
                    <Typography sx={{ fontWeight: 700 }} noWrap>{tt(item.titleNo, item.titleEn)}</Typography>
                  </Stack>
                  <Typography sx={{ mt: 0.7, fontSize: 12, opacity: 0.72 }}>
                    {tt(item.descriptionNo, item.descriptionEn)}
                  </Typography>
                  <Chip
                    label={item.badge}
                    size="small"
                    sx={{
                      mt: 0.8,
                      color: '#fbe6be',
                      borderColor: 'rgba(245,166,35,0.35)',
                      background: 'rgba(245,166,35,0.16)',
                    }}
                  />
                </Box>
              ))}
            </Box>
          </Box>
        </Box>

        <Box sx={{ mt: 2.6 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.1 }}>
            <Typography sx={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: { xs: '1.55rem', md: '1.9rem' } }}>
              {tt('Kurs med eksisterende data', 'Courses with Existing Data')}
            </Typography>
            <Button
              onClick={() => goTo('/academy-dashboard', 'academy_landing_see_all_courses')}
              endIcon={<ArrowForward />}
              sx={{
                textTransform: 'none',
                color: '#f8f1e7',
                border: '1px solid rgba(255,255,255,0.22)',
                borderRadius: '8px',
              }}
            >
              {tt('Se alle', 'See all')}
            </Button>
          </Stack>

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2,1fr)', xl: 'repeat(3,1fr)' }, gap: 1.3 }}>
            {visibleCourses.slice(0, 6).map((course, index) => (
              <Box
                key={course.id}
                sx={{
                  borderRadius: '11px',
                  border: `1px solid ${alpha('#f5a623', 0.2)}`,
                  overflow: 'hidden',
                  background: 'rgba(8, 11, 18, 0.86)',
                }}
              >
                <Box
                  sx={{
                    height: 152,
                    background:
                      course.thumbnail
                        ? `linear-gradient(180deg, rgba(8,11,17,0.05), rgba(6,8,12,0.78)), url(${course.thumbnail}) center / cover no-repeat`
                        : PLACEHOLDER_BACKDROPS[index % PLACEHOLDER_BACKDROPS.length],
                  }}
                />
                <Box sx={{ p: 1.25 }}>
                  <Typography sx={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '1.5rem', lineHeight: 1 }}>
                    {course.title}
                  </Typography>
                  <Typography sx={{ mt: 0.5, opacity: 0.72 }}>{tt(course.summaryNo, course.summaryEn)}</Typography>
                  <Stack direction="row" justifyContent="space-between" sx={{ mt: 0.7 }}>
                    <Typography sx={{ fontSize: 12, opacity: 0.84 }}>{course.instructor}</Typography>
                    <Typography sx={{ fontSize: 12, opacity: 0.84 }}>{course.durationLabel}</Typography>
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
                  <Stack direction="row" spacing={0.8} sx={{ mt: 1 }}>
                    <Button
                      fullWidth
                      startIcon={<PlayArrow />}
                      onClick={() => openCourse(course.id)}
                      sx={{
                        textTransform: 'none',
                        color: '#1e1306',
                        fontWeight: 700,
                        background: 'linear-gradient(180deg, #ffc64d 0%, #f5a623 100%)',
                        borderRadius: '8px',
                      }}
                    >
                      {tt('Åpne i videospiller', 'Open in video player')}
                    </Button>
                  </Stack>
                </Box>
              </Box>
            ))}
          </Box>
        </Box>

        <Box
          sx={{
            mt: 2.4,
            p: 1.6,
            borderRadius: '10px',
            border: `1px solid ${alpha('#f5a623', 0.2)}`,
            background: 'rgba(7, 10, 16, 0.8)',
            display: 'grid',
            gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' },
            gap: 1,
          }}
        >
          <Box>
            <Typography sx={{ opacity: 0.68, fontSize: 12 }}>{tt('Totale leksjoner', 'Total Lessons')}</Typography>
            <Typography sx={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '2rem', lineHeight: 1 }}>
              {totals.lessons}
            </Typography>
          </Box>
          <Box>
            <Typography sx={{ opacity: 0.68, fontSize: 12 }}>{tt('Totale studenter', 'Total Students')}</Typography>
            <Typography sx={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '2rem', lineHeight: 1 }}>
              {totals.students}
            </Typography>
          </Box>
          <Box>
            <Typography sx={{ opacity: 0.68, fontSize: 12 }}>{tt('Snittvurdering', 'Avg Rating')}</Typography>
            <Typography sx={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '2rem', lineHeight: 1 }}>
              {totals.avgRating}
            </Typography>
          </Box>
          <Box>
            <Typography sx={{ opacity: 0.68, fontSize: 12 }}>{tt('Snittfullføring', 'Avg Completion')}</Typography>
            <Typography sx={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '2rem', lineHeight: 1 }}>
              {totals.avgCompletion}%
            </Typography>
          </Box>
        </Box>
      </Box>

      <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} />
    </Box>
  );
}

const AcademyLandingPageWithVisualEditor = withVisualEditor(AcademyLandingPage, {
  componentId: 'academy-landing',
  componentName: 'Academy Home',
  category: 'academy',
  editable: true,
  previewable: true,
  templateable: true,
  propsEditable: true,
});

export default withUniversalIntegration(AcademyLandingPageWithVisualEditor, {
  componentId: 'academy-landing-page',
  componentName: 'Academy Home',
  componentType: 'page',
  componentCategory: 'academy',
  featureIds: ['academy-dashboard', 'course-creation', 'course-analytics', 'video-player'],
});
