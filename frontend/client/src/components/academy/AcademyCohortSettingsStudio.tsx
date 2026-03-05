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
  Lock,
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
import { useAcademy, type Course } from '@/contexts/AcademyContext';
import { useEnhancedMasterIntegration } from '@/integration/EnhancedMasterIntegrationProvider';
import { withUniversalIntegration } from '@/integration/UniversalIntegrationHOC';
import { useAcademyLocale } from './academyLocale';
import AcademyBrandMark from './AcademyBrandMark';

interface AcademyCohortSettingsStudioProps {
  courseId?: string;
  onSave?: (payload: Record<string, unknown>) => void;
  onCancel?: () => void;
}

type CohortStatus = 'active' | 'closed' | 'early_access' | 'invitation_only';

type CohortFilter = 'all' | CohortStatus;

interface CohortItem {
  id: string;
  name: string;
  subtitle: string;
  startDate: string;
  endDate: string;
  enrollments: number;
  capacity: number;
  completionRate: number;
  revenue: number;
  status: CohortStatus;
  tags: string[];
  imageTheme: number;
}

interface DiscussionItem {
  id: string;
  author: string;
  message: string;
  timestamp: string;
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
    id: 'cohort-course-1',
    title: 'Directing Masterclass',
    description: 'Premium directing education with live cohort support.',
    instructor: {
      id: 'cohort-instructor-1',
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
    tags: ['directing', 'cohort'],
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
];

const defaultCohorts = (): CohortItem[] => [
  {
    id: 'cohort-1',
    name: 'Digital Photography',
    subtitle: 'Freelance · Foundation track',
    startDate: '2026-01-05',
    endDate: '2026-02-29',
    enrollments: 45,
    capacity: 100,
    completionRate: 78,
    revenue: 50700,
    status: 'active',
    tags: ['Early Access'],
    imageTheme: 0,
  },
  {
    id: 'cohort-2',
    name: 'Cinematic Filmmaking [Closed]',
    subtitle: 'Filmmaking · Advanced',
    startDate: '2025-12-01',
    endDate: '2026-01-31',
    enrollments: 120,
    capacity: 150,
    completionRate: 66,
    revenue: 90600,
    status: 'closed',
    tags: ['Closed'],
    imageTheme: 1,
  },
  {
    id: 'cohort-3',
    name: 'Vocal Production Pros [Early Access]',
    subtitle: 'Music production · Pro',
    startDate: '2026-03-01',
    endDate: '2026-04-15',
    enrollments: 80,
    capacity: 200,
    completionRate: 32,
    revenue: 38900,
    status: 'early_access',
    tags: ['Early Access', 'Drip Release'],
    imageTheme: 2,
  },
  {
    id: 'cohort-4',
    name: 'Freelance Photographers',
    subtitle: 'Business growth · 8-week sprint',
    startDate: '2026-04-10',
    endDate: '2026-05-15',
    enrollments: 92,
    capacity: 100,
    completionRate: 48,
    revenue: 80100,
    status: 'invitation_only',
    tags: ['Invitation Only'],
    imageTheme: 3,
  },
];

const defaultDiscussions = (): DiscussionItem[] => [
  {
    id: 'discussion-1',
    author: 'Adrain Bergland',
    message: 'Posted ideas for onboarding prompts in filmmaking cohort.',
    timestamp: '1h ago',
  },
  {
    id: 'discussion-2',
    author: 'Sarah Ornnson',
    message: 'Completed Lesson & Finessing the progression timeline.',
    timestamp: '23m ago',
  },
  {
    id: 'discussion-3',
    author: 'Armette Lindo',
    message: 'Shared cinematic LUT pack and setup feedback.',
    timestamp: '5h ago',
  },
];

const formatDateRange = (startDate: string, endDate: string): string => {
  const format = (value: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(date);
  };

  return `${format(startDate)} - ${format(endDate)}`;
};

const toNok = (value: number): string =>
  new Intl.NumberFormat('nb-NO', {
    style: 'currency',
    currency: 'NOK',
    maximumFractionDigits: 0,
  }).format(Math.max(0, value));

function AcademyCohortSettingsStudio({ courseId, onSave, onCancel }: AcademyCohortSettingsStudioProps) {
  const [, setLocation] = useLocation();
  const { state, getCourse, updateCourse } = useAcademy();
  const { analytics, debugging } = useEnhancedMasterIntegration();
  
  const { navLabel, tt } = useAcademyLocale();

  const [leftNav, setLeftNav] = useState('cohort');
  const [filter, setFilter] = useState<CohortFilter>('all');
  const [searchValue, setSearchValue] = useState('');
  const [selectedCourseId, setSelectedCourseId] = useState(courseId || '');
  const [saveMessage, setSaveMessage] = useState('');

  const [cohortItems, setCohortItems] = useState<CohortItem[]>(defaultCohorts);
  const [selectedCohortId, setSelectedCohortId] = useState('');
  const [discussionItems, setDiscussionItems] = useState<DiscussionItem[]>(defaultDiscussions);
  const [discussionAuthor, setDiscussionAuthor] = useState('You');
  const [discussionDraft, setDiscussionDraft] = useState('');

  const [featureFlags, setFeatureFlags] = useState({
    earlyAccess: true,
    invitationOnly: true,
    closed: true,
    dripRelease: false,
  });

  const [tagDraft, setTagDraft] = useState('');

  const localizedStatusLabel = useCallback(
    (status: CohortStatus): string => {
      if (status === 'early_access') return tt('Tidlig tilgang', 'Early Access');
      if (status === 'invitation_only') return tt('Kun invitasjon', 'Invitation Only');
      if (status === 'closed') return tt('Lukket', 'Closed');
      return tt('Aktiv', 'Active');
    },
    [tt],
  );

  const courseItems = useMemo(() => {
    if (Array.isArray(state.courses) && state.courses.length > 0) {
      return state.courses;
    }
    return fallbackCourses;
  }, [state.courses]);

  const courseOptionIds = useMemo(
    () => courseItems.map((course) => String(course.id)),
    [courseItems],
  );

  const activeCourse = useMemo(() => {
    const fromParam = courseId ? getCourse(courseId) : null;
    if (fromParam) return fromParam;

    const fromSelected = selectedCourseId
      ? courseItems.find((course) => String(course.id) === String(selectedCourseId))
      : null;
    if (fromSelected) return fromSelected;

    return state.currentCourse || courseItems[0] || fallbackCourses[0];
  }, [courseId, courseItems, getCourse, selectedCourseId, state.currentCourse]);

  const selectedCourseValue = useMemo(() => {
    const preferredId = String(selectedCourseId || activeCourse?.id || '');
    if (preferredId && courseOptionIds.includes(preferredId)) {
      return preferredId;
    }
    return courseOptionIds[0] || '';
  }, [activeCourse?.id, courseOptionIds, selectedCourseId]);

  useEffect(() => {
    if (!selectedCourseId && activeCourse?.id) {
      setSelectedCourseId(String(activeCourse.id));
    }
  }, [activeCourse?.id, selectedCourseId]);

  useEffect(() => {
    if (selectedCourseValue && selectedCourseId !== selectedCourseValue) {
      setSelectedCourseId(selectedCourseValue);
    }
  }, [selectedCourseId, selectedCourseValue]);

  useEffect(() => {
    if (!selectedCohortId && cohortItems.length > 0) {
      setSelectedCohortId(cohortItems[0].id);
    }
  }, [cohortItems, selectedCohortId]);

  useEffect(() => {
    analytics.trackEvent('academy_cohort_settings_opened', {
      courseId: activeCourse?.id || null,
      cohortCount: cohortItems.length,
      timestamp: Date.now(),
    });

    debugging.logIntegration('info', 'AcademyCohortSettingsStudio opened', {
      courseId: activeCourse?.id || null,
      cohortCount: cohortItems.length,
    });
  }, [activeCourse?.id, analytics, cohortItems.length, debugging]);

  const selectedCohort = useMemo(() => {
    return cohortItems.find((item) => item.id === selectedCohortId) || cohortItems[0] || null;
  }, [cohortItems, selectedCohortId]);

  const visibleCohorts = useMemo(() => {
    const query = searchValue.trim().toLowerCase();

    return cohortItems.filter((cohort) => {
      const statusMatch = filter === 'all' ? true : cohort.status === filter;
      if (!statusMatch) return false;
      if (!query) return true;
      return (
        cohort.name.toLowerCase().includes(query) ||
        cohort.subtitle.toLowerCase().includes(query) ||
        cohort.tags.some((tag) => tag.toLowerCase().includes(query))
      );
    });
  }, [cohortItems, filter, searchValue]);

  const totalRevenue = useMemo(
    () => cohortItems.reduce((sum, cohort) => sum + cohort.revenue, 0),
    [cohortItems],
  );

  const averageCompletion = useMemo(() => {
    if (cohortItems.length === 0) return 0;
    const total = cohortItems.reduce((sum, cohort) => sum + cohort.completionRate, 0);
    return Math.round(total / cohortItems.length);
  }, [cohortItems]);

  const enrollmentVelocity = useMemo(() => {
    const active = cohortItems.filter((cohort) => cohort.status !== 'closed');
    if (active.length === 0) return 0;
    const currentFill = active.reduce((sum, cohort) => sum + cohort.enrollments / Math.max(cohort.capacity, 1), 0);
    return Number(((currentFill / active.length) * 100).toFixed(1));
  }, [cohortItems]);

  const leaderboard = useMemo(() => {
    return [...cohortItems]
      .sort((a, b) => b.completionRate - a.completionRate)
      .slice(0, 3);
  }, [cohortItems]);

  const upcomingCohorts = useMemo(() => {
    return [...cohortItems]
      .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
      .slice(0, 3);
  }, [cohortItems]);

  const addCohort = useCallback(() => {
    const index = cohortItems.length + 1;
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() + 1, 8 + index);
    const end = new Date(start.getFullYear(), start.getMonth() + 1, start.getDate() + 10);

    const newCohort: CohortItem = {
      id: `cohort-${Date.now()}`,
      name: `New Cohort ${index}`,
      subtitle: 'Creator track · Scheduled',
      startDate: start.toISOString().slice(0, 10),
      endDate: end.toISOString().slice(0, 10),
      enrollments: 0,
      capacity: 100,
      completionRate: 0,
      revenue: 0,
      status: 'active',
      tags: ['Invitation Only'],
      imageTheme: index % placeholderBackgrounds.length,
    };

    setCohortItems((prev) => [newCohort, ...prev]);
    setSelectedCohortId(newCohort.id);
  }, [cohortItems.length]);

  const toggleFeatureFlag = useCallback((key: keyof typeof featureFlags) => {
    setFeatureFlags((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  }, []);

  const addTagToSelected = useCallback(() => {
    const tag = tagDraft.trim();
    if (!tag || !selectedCohort) return;

    setCohortItems((prev) =>
      prev.map((item) => {
        if (item.id !== selectedCohort.id) return item;
        if (item.tags.some((existing) => existing.toLowerCase() === tag.toLowerCase())) return item;
        return { ...item, tags: [...item.tags, tag] };
      }),
    );

    setTagDraft('');
  }, [selectedCohort, tagDraft]);

  const removeTagFromSelected = useCallback(
    (tag: string) => {
      if (!selectedCohort) return;
      setCohortItems((prev) =>
        prev.map((item) => {
          if (item.id !== selectedCohort.id) return item;
          return { ...item, tags: item.tags.filter((entry) => entry !== tag) };
        }),
      );
    },
    [selectedCohort],
  );

  const saveCohortSettings = useCallback(
    async (publish: boolean) => {
      const payload = {
        courseId: activeCourse?.id || null,
        cohorts: cohortItems,
        featureFlags,
        selectedCohortId,
        publish,
        updatedAt: new Date().toISOString(),
      };

      try {
        if (activeCourse?.id && state.courses.some((course) => String(course.id) === String(activeCourse.id))) {
          const enrichedTags = Array.from(new Set([...(activeCourse.tags || []), 'cohort'])) as string[];
          await updateCourse({
            ...activeCourse,
            tags: enrichedTags,
            updatedAt: new Date().toISOString(),
            isPublished: publish ? true : activeCourse.isPublished,
          });
        }

        setSaveMessage(
          publish
            ? tt('Kohortinnstillinger publisert.', 'Cohort settings published.')
            : tt('Kohortinnstillinger lagret.', 'Cohort settings saved.'),
        );
        onSave?.(payload);

        analytics.trackEvent(publish ? 'academy_cohort_settings_publish' : 'academy_cohort_settings_save', {
          courseId: activeCourse?.id || null,
          cohortCount: cohortItems.length,
          publish,
          timestamp: Date.now(),
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : tt('Kunne ikke lagre kohortinnstillinger.', 'Failed to save cohort settings.');
        setSaveMessage(message);
        debugging.logIntegration('error', 'Academy cohort settings save failed', {
          courseId: activeCourse?.id || null,
          message,
        });
      }
    },
    [
      activeCourse,
      analytics,
      cohortItems,
      debugging,
      featureFlags,
      onSave,
      selectedCohortId,
      state.courses,
      tt,
      updateCourse,
    ],
  );

  const addDiscussion = useCallback(() => {
    const draft = discussionDraft.trim();
    if (!draft) {
      setSaveMessage(tt('Skriv et diskusjonsnotat før publisering.', 'Write a discussion note before posting.'));
      return;
    }

    const newDiscussion: DiscussionItem = {
      id: `discussion-${Date.now()}`,
      author: discussionAuthor.trim() || tt('Du', 'You'),
      message: draft,
      timestamp: tt('nå', 'now'),
    };

    setDiscussionItems((prev) => [newDiscussion, ...prev]);
    setDiscussionDraft('');
    setSaveMessage(tt('Diskusjonsnotat lagt til.', 'Discussion note added.'));
  }, [discussionAuthor, discussionDraft, tt]);

  const leftNavItems = [
    { id: 'overview', label: navLabel('Overview'), route: '/academy-dashboard' },
    { id: 'curriculum', label: navLabel('Curriculum'), route: '/academy/curriculum' },
    { id: 'lessons', label: navLabel('Lessons'), route: '/academy/lesson-editor' },
    { id: 'media', label: navLabel('Media'), route: '/academy/media' },
    { id: 'assignments', label: navLabel('Assignments'), route: '/academy/assignments' },
    { id: 'enrollment', label: navLabel('Enrollment'), route: '/academy/enrollment' },
    { id: 'cohort', label: navLabel('Cohort Settings'), route: '/academy/cohort-settings' },
    { id: 'analytics', label: navLabel('Analytics'), route: '/academy/analytics' },
    { id: 'cta', label: navLabel('CTA Overlay'), route: '/academy/cta-overlay' },
    { id: 'lower-thirds', label: navLabel('Animated Lower Thirds'), route: '/academy/lower-thirds' },
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
          background:
            'radial-gradient(circle at 76% 14%, rgba(248,179,33,0.24), rgba(5,8,13,0) 42%), radial-gradient(circle at 15% 80%, rgba(82,121,204,0.13), rgba(6,8,14,0) 44%), linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0) 30%)',
          pointerEvents: 'none',
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

          <Box sx={{ mt: 'auto', p: 2 }}>
            <Button
              variant="text"
              startIcon={<Add />}
              onClick={addCohort}
              sx={{
                width: '100%',
                justifyContent: 'flex-start',
                color: '#edf0f7',
                textTransform: 'none',
                border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.14)',
                borderRadius: 1,
              }}
            >
              {tt('Ny modul', 'New Module')}
            </Button>
          </Box>
        </Box>

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
                  {tt('Kohortinnstillinger', 'Cohort Settings')}
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
                    onClick={addCohort}
                    sx={{
                      textTransform: 'none',
                      borderRadius: 1,
                      color: '#0f0f0f',
                      background: 'linear-gradient(180deg, #ffd44e, #f2a616)',
                      boxShadow: '0 10px 24px rgba(248,179,33,0.26)',
                    }}
                  >
                    {tt('Opprett diagram', 'Create Chart')}
                  </Button>
                </Stack>
              </Stack>

              {!!saveMessage && (
                <Typography
                  sx={{
                    px: 1.2,
                    py: 0.85,
                    borderRadius: 1,
                    border: 'var(--academy-hairline-width, 1px) solid rgba(248,179,33,0.34)',
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
                      value={selectedCourseValue}
                      onChange={(event) => setSelectedCourseId(String(event.target.value))}
                      sx={{
                        minWidth: 210,
                        color: '#edf0f7',
                        bgcolor: 'rgba(255,255,255,0.05)',
                        '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.16)' },
                      }}
                    >
                      {courseItems.map((course) => (
                        <MenuItem key={course.id} value={course.id}>
                          {course.title}
                        </MenuItem>
                      ))}
                    </Select>
                    <Select
                      size="small"
                      value={filter}
                      onChange={(event) => setFilter(event.target.value as CohortFilter)}
                      sx={{
                        minWidth: 160,
                        color: '#edf0f7',
                        bgcolor: 'rgba(255,255,255,0.05)',
                        '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.16)' },
                      }}
                    >
                      <MenuItem value="all">{tt('Alle kohorter', 'All Cohorts')}</MenuItem>
                      <MenuItem value="active">{tt('Aktiv', 'Active')}</MenuItem>
                      <MenuItem value="early_access">{tt('Tidlig tilgang', 'Early Access')}</MenuItem>
                      <MenuItem value="invitation_only">{tt('Kun invitasjon', 'Invitation Only')}</MenuItem>
                      <MenuItem value="closed">{tt('Lukket', 'Closed')}</MenuItem>
                    </Select>
                  </Stack>

                  <Button
                    startIcon={<Add />}
                    onClick={addCohort}
                    sx={{
                      textTransform: 'none',
                      color: '#0f0f0f',
                      background: 'linear-gradient(180deg, #ffd44e, #f2a616)',
                      fontWeight: 700,
                    }}
                  >
                    {tt('Legg til kohort', 'Add Cohort')}
                  </Button>
                </Stack>

                <TextField
                  value={searchValue}
                  onChange={(event) => setSearchValue(event.target.value)}
                  placeholder={tt('Søk kohorter...', 'Search cohorts...')}
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

                <Stack direction="row" spacing={2} sx={{ mt: 1.1, color: 'rgba(237,240,247,0.7)' }}>
                  <Typography>{visibleCohorts.length} {tt('kohorter', 'Cohorts')}</Typography>
                  <Typography>{tt('Side 1 av', 'Page 1 of')} {Math.max(1, Math.ceil(visibleCohorts.length / 5))}</Typography>
                </Stack>

                <Box
                  sx={{
                    mt: 1.1,
                    borderRadius: 1,
                    overflowX: 'auto',
                    overflowY: 'hidden',
                    border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.09)',
                  }}
                >
                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: 'minmax(220px, 1.4fr) 1fr 0.8fr 0.8fr 0.5fr',
                      minWidth: 920,
                      px: 1,
                      py: 0.8,
                      background: 'rgba(255,255,255,0.04)',
                      borderBottom: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.1)',
                    }}
                  >
                    <Typography sx={{ fontSize: 13, color: 'rgba(237,240,247,0.7)' }}>{tt('Kohortnavn', 'Cohort Name')}</Typography>
                    <Typography sx={{ fontSize: 13, color: 'rgba(237,240,247,0.7)' }}>{tt('Start og slutt', 'Start & End')}</Typography>
                    <Typography sx={{ fontSize: 13, color: 'rgba(237,240,247,0.7)' }}>{tt('Påmeldinger', 'Enrollments')}</Typography>
                    <Typography sx={{ fontSize: 13, color: 'rgba(237,240,247,0.7)' }}>{tt('Fullføringsrate', 'Completion Rate')}</Typography>
                    <Typography sx={{ fontSize: 13, color: 'rgba(237,240,247,0.7)', textAlign: 'right' }}>{tt('Handlinger', 'Actions')}</Typography>
                  </Box>

                  <Stack spacing={0}>
                    {visibleCohorts.map((cohort) => {
                      const isSelected = selectedCohort?.id === cohort.id;
                      const fill = Math.round((cohort.enrollments / Math.max(cohort.capacity, 1)) * 100);

                      return (
                        <Box
                          key={cohort.id}
                          onClick={() => setSelectedCohortId(cohort.id)}
                          sx={{
                            display: 'grid',
                            gridTemplateColumns: 'minmax(220px, 1.4fr) 1fr 0.8fr 0.8fr 0.5fr',
                            minWidth: 920,
                            gap: 0.8,
                            px: 1,
                            py: 1,
                            cursor: 'pointer',
                            background: isSelected
                              ? 'linear-gradient(90deg, rgba(248,179,33,0.12), rgba(255,255,255,0.02))'
                              : 'rgba(8,11,18,0.6)',
                            borderBottom: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.08)',
                            '&:hover': {
                              background: 'linear-gradient(90deg, rgba(248,179,33,0.12), rgba(255,255,255,0.02))',
                            },
                          }}
                        >
                          <Stack direction="row" spacing={1} alignItems="center" minWidth={0}>
                            <Box
                              sx={{
                                width: 84,
                                height: 50,
                                borderRadius: 1,
                                border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.1)',
                                background: placeholderBackgrounds[cohort.imageTheme % placeholderBackgrounds.length],
                                flexShrink: 0,
                              }}
                            />
                            <Box minWidth={0}>
                              <Typography sx={{ fontWeight: 600 }} noWrap>
                                {cohort.name}
                              </Typography>
                              <Typography sx={{ fontSize: 12, color: 'rgba(237,240,247,0.66)' }} noWrap>
                                {cohort.subtitle}
                              </Typography>
                            </Box>
                          </Stack>

                          <Typography sx={{ color: 'rgba(237,240,247,0.76)', fontSize: 13 }}>
                            {formatDateRange(cohort.startDate, cohort.endDate)}
                          </Typography>

                          <Box>
                            <Typography sx={{ fontWeight: 600 }}>
                              {cohort.enrollments}/{cohort.capacity}
                            </Typography>
                            <LinearProgress
                              variant="determinate"
                              value={fill}
                              sx={{
                                mt: 0.4,
                                height: 5,
                                borderRadius: 999,
                                bgcolor: 'rgba(255,255,255,0.14)',
                                '& .MuiLinearProgress-bar': {
                                  borderRadius: 999,
                                  background: 'linear-gradient(90deg, #7fb4ff 0%, #f8b321 100%)',
                                },
                              }}
                            />
                          </Box>

                          <Box>
                            <Typography sx={{ color: '#f8d56f', fontWeight: 700 }}>▲ {cohort.completionRate}%</Typography>
                            <Typography sx={{ fontSize: 12, color: 'rgba(237,240,247,0.66)' }}>
                              {toNok(cohort.revenue)}
                            </Typography>
                          </Box>

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
                      );
                    })}
                  </Stack>
                </Box>

                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  spacing={1}
                  alignItems={{ xs: 'stretch', sm: 'center' }}
                  sx={{ mt: 1.1 }}
                >
                  <TextField
                    placeholder={tt('Søk leksjoner...', 'Search lessons...')}
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
                  <Stack direction="row" spacing={1}>
                    <Button sx={{ textTransform: 'none', color: '#edf0f7', border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.16)' }}>{tt('Side 1 av 14', 'Page 1 of 14')}</Button>
                    <Button sx={{ minWidth: 36, color: '#edf0f7', border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.16)' }}>{'<'}</Button>
                    <Button sx={{ minWidth: 36, color: '#edf0f7', border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.16)' }}>{'>'}</Button>
                  </Stack>
                </Stack>

                <Typography sx={{ mt: 1.3, fontSize: 32, fontWeight: 600 }}>{tt('Kommende kohorter', 'Upcoming Cohorts')}</Typography>

                <Box
                  sx={{
                    mt: 1,
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' },
                    gap: 1,
                  }}
                >
                  {upcomingCohorts.map((cohort, index) => (
                    <Box
                      key={`upcoming-${cohort.id}`}
                      sx={{
                        ...panelSx,
                        p: 1,
                        minHeight: 184,
                        borderColor: 'rgba(255,255,255,0.1)',
                      }}
                    >
                      <Box
                        sx={{
                          height: 90,
                          borderRadius: 1,
                          border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.1)',
                          background: placeholderBackgrounds[(index + 1) % placeholderBackgrounds.length],
                        }}
                      />
                      <Typography sx={{ mt: 0.8, fontSize: 17, fontWeight: 600, minHeight: 48 }}>
                        {cohort.name}
                      </Typography>
                      <Typography sx={{ fontSize: 13, color: 'rgba(237,240,247,0.64)' }}>
                        {formatDateRange(cohort.startDate, cohort.endDate)}
                      </Typography>
                      <Stack direction="row" spacing={0.8} sx={{ mt: 0.8 }}>
                        <Button
                          size="small"
                          sx={{ textTransform: 'none', color: '#edf0f7', border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.16)' }}
                        >
                          {tt('Administrer', 'Manage')}
                        </Button>
                        <Button
                          size="small"
                          sx={{ textTransform: 'none', color: '#edf0f7', border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.16)' }}
                        >
                          {tt('Vis', 'View')}
                        </Button>
                      </Stack>
                    </Box>
                  ))}
                </Box>
              </Box>
            </Box>

            <Box sx={{ ...panelSx, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
              <Box sx={{ p: 1.2, borderBottom: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.08)' }}>
                <Typography sx={{ fontSize: 34, fontWeight: 600 }}>{tt('Kohortadministrasjon', 'Cohort Management')}</Typography>
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
                  <Typography sx={{ fontSize: 18, fontWeight: 700 }}>{tt('Kohorttagger', 'Cohort Tags')}</Typography>

                  <Stack direction="row" spacing={0.8} flexWrap="wrap" useFlexGap sx={{ mt: 0.8 }}>
                    {(selectedCohort?.tags || []).map((tag) => (
                      <Chip
                        key={`selected-tag-${tag}`}
                        label={navLabel(tag)}
                        onDelete={() => removeTagFromSelected(tag)}
                        sx={{
                          color: '#edf0f7',
                          bgcolor: 'rgba(255,255,255,0.08)',
                          '& .MuiChip-deleteIcon': { color: 'rgba(237,240,247,0.7)' },
                        }}
                      />
                    ))}
                  </Stack>

                  <Stack direction="row" spacing={0.8} sx={{ mt: 1 }}>
                    <TextField
                      value={tagDraft}
                      onChange={(event) => setTagDraft(event.target.value)}
                      placeholder={tt('Legg til tagg', 'Add tag')}
                      size="small"
                      sx={{ flex: 1, '& .MuiInputBase-root': { color: '#edf0f7' } }}
                    />
                    <Button
                      onClick={addTagToSelected}
                      sx={{ textTransform: 'none', color: '#edf0f7', border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.16)' }}
                    >
                      {tt('Legg til', 'Add')}
                    </Button>
                  </Stack>
                </Box>

                <Box sx={{ ...panelSx, p: 1 }}>
                  <Typography sx={{ fontSize: 32, fontWeight: 600, mb: 0.8 }}>{tt('Ytelseshøydepunkter', 'Performance Highlights')}</Typography>
                  <Stack direction="row" spacing={1}>
                    <Box sx={{ flex: 1 }}>
                      <Typography sx={{ fontSize: 30, fontWeight: 700, color: '#f8d56f' }}>+{enrollmentVelocity}%</Typography>
                      <Typography sx={{ color: 'rgba(237,240,247,0.7)' }}>{tt('Påmeldingshastighet', 'Enrollment Velocity')}</Typography>
                    </Box>
                    <Box sx={{ flex: 1 }}>
                      <Typography sx={{ fontSize: 30, fontWeight: 700 }}>{averageCompletion}%</Typography>
                      <Typography sx={{ color: 'rgba(237,240,247,0.7)' }}>{tt('Gj.sn. fullføring', 'Avg Completion')}</Typography>
                    </Box>
                    <Box sx={{ flex: 1 }}>
                      <Typography sx={{ fontSize: 30, fontWeight: 700 }}>{toNok(totalRevenue)}</Typography>
                      <Typography sx={{ color: 'rgba(237,240,247,0.7)' }}>{tt('Inntekt', 'Revenue')}</Typography>
                    </Box>
                  </Stack>
                </Box>

                <Box sx={{ ...panelSx, p: 1 }}>
                  <Typography sx={{ fontSize: 32, fontWeight: 600, mb: 0.8 }}>{tt('Kohort-toppliste', 'Cohort Leaderboard')}</Typography>
                  <Stack spacing={0.8}>
                    {leaderboard.map((cohort) => (
                      <Stack
                        key={`leader-${cohort.id}`}
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
                        <Box
                          sx={{
                            width: 46,
                            height: 46,
                            borderRadius: 1,
                            border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.1)',
                            background: placeholderBackgrounds[cohort.imageTheme % placeholderBackgrounds.length],
                            flexShrink: 0,
                          }}
                        />
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography noWrap sx={{ fontWeight: 600 }}>{cohort.name}</Typography>
                          <Typography sx={{ fontSize: 12, color: 'rgba(237,240,247,0.64)' }} noWrap>
                            {formatDateRange(cohort.startDate, cohort.endDate)}
                          </Typography>
                        </Box>
                        <Typography sx={{ color: '#f8d56f', fontWeight: 700 }}>{cohort.completionRate}%</Typography>
                      </Stack>
                    ))}
                  </Stack>
                </Box>

                <Box sx={{ ...panelSx, p: 1 }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography sx={{ fontSize: 32, fontWeight: 600 }}>{tt('Ny diskusjon', 'New Discussion')}</Typography>
                    <Button
                      size="small"
                      onClick={addDiscussion}
                      sx={{ textTransform: 'none', color: '#edf0f7', border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.16)' }}
                    >
                      {tt('Legg til', 'Add')}
                    </Button>
                  </Stack>

                  <Stack direction="row" spacing={0.8} sx={{ mt: 0.8 }}>
                    <TextField
                      value={discussionAuthor}
                      onChange={(event) => setDiscussionAuthor(event.target.value)}
                      size="small"
                      label={tt('Forfatter', 'Author')}
                      sx={{
                        width: 130,
                        '& .MuiInputBase-root': { color: '#edf0f7', bgcolor: 'rgba(255,255,255,0.03)' },
                      }}
                    />
                    <TextField
                      value={discussionDraft}
                      onChange={(event) => setDiscussionDraft(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' && !event.shiftKey) {
                          event.preventDefault();
                          addDiscussion();
                        }
                      }}
                      size="small"
                      label={tt('Diskusjonsnotat', 'Discussion Note')}
                      placeholder={tt('Skriv notat for kohortdiskusjon', 'Write cohort discussion note')}
                      sx={{
                        flex: 1,
                        '& .MuiInputBase-root': { color: '#edf0f7', bgcolor: 'rgba(255,255,255,0.03)' },
                      }}
                    />
                    <Button
                      size="small"
                      onClick={addDiscussion}
                      sx={{
                        textTransform: 'none',
                        color: '#edf0f7',
                        border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.2)',
                        minWidth: 70,
                      }}
                    >
                      Post
                    </Button>
                  </Stack>

                  <Stack spacing={0.8} sx={{ mt: 0.8 }}>
                    {discussionItems.map((item, index) => (
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
                          <Typography sx={{ fontWeight: 700 }}>{item.author}</Typography>
                          <Typography sx={{ color: 'rgba(237,240,247,0.72)' }}>{item.message}</Typography>
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
                    border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.18)',
                  }}
                >
                  {tt('CTA', 'CTA')}
                </Button>
                <Button
                  startIcon={<Subtitles />}
                  onClick={() => setLocation('/academy/lower-thirds')}
                  sx={{
                    flex: 1,
                    textTransform: 'none',
                    color: '#edf0f7',
                    border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.18)',
                  }}
                >
                  {tt('LowerThirds', 'LowerThirds')}
                </Button>
              </Stack>

              <Stack direction="row" spacing={1} sx={{ p: 1.1, pt: 0 }}>
                <Button
                  startIcon={<PeopleAlt />}
                  onClick={addCohort}
                  sx={{
                    flex: 1,
                    textTransform: 'none',
                    color: '#edf0f7',
                    border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.16)',
                  }}
                >
                  {tt('Legg til kohort', 'Add Cohort')}
                </Button>
                <Button
                  startIcon={<Lock />}
                  onClick={() => toggleFeatureFlag('closed')}
                  sx={{
                    textTransform: 'none',
                    color: '#edf0f7',
                    border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.16)',
                  }}
                >
                  {featureFlags.closed ? tt('Sikret', 'Secured') : tt('Sikre', 'Secure')}
                </Button>
              </Stack>

              <Stack direction="row" spacing={1} sx={{ p: 1.1, pt: 0 }}>
                <Button
                  startIcon={<Save />}
                  onClick={() => void saveCohortSettings(false)}
                  sx={{
                    flex: 1,
                    textTransform: 'none',
                    color: '#edf0f7',
                    border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.16)',
                  }}
                >
                  {tt('Lagre', 'Save')}
                </Button>
                <Button
                  startIcon={<Publish />}
                  onClick={() => void saveCohortSettings(true)}
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
                    border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.16)',
                  }}
                >
                  {tt('Lukk', 'Close')}
                </Button>
              </Stack>

              <Stack direction="row" spacing={1} sx={{ p: 1.1, pt: 0 }}>
                <Button
                  startIcon={<MonetizationOn />}
                  onClick={() => setLocation('/academy/monetization')}
                  sx={{
                    flex: 1,
                    textTransform: 'none',
                    color: '#edf0f7',
                    border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.16)',
                  }}
                >
                  {tt('Monetisering', 'Monetization')}
                </Button>
                <Button
                  startIcon={<TrendingUp />}
                  onClick={() => setLocation('/academy/analytics')}
                  sx={{
                    flex: 1,
                    textTransform: 'none',
                    color: '#edf0f7',
                    border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.16)',
                  }}
                >
                  {tt('Analyser', 'Analytics')}
                </Button>
              </Stack>

              <Stack direction="row" spacing={1} sx={{ p: 1.1, pt: 0 }}>
                <Typography sx={{ color: 'rgba(237,240,247,0.62)', fontSize: 12 }}>
                  {tt('Status', 'Status')}: {localizedStatusLabel(selectedCohort?.status || 'active')} · {selectedCohort?.enrollments || 0} {tt('påmeldt', 'enrolled')}
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

export default withUniversalIntegration(AcademyCohortSettingsStudio, {
  componentId: 'academy-cohort-settings-studio',
  componentName: 'Academy Cohort Settings Studio',
  componentType: 'manager',
  componentCategory: 'academy',
  featureIds: ['cohort-settings', 'cohort-management', 'cohort-analytics', 'academy-live-cohorts'],
});
