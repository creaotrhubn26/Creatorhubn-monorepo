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
  TextField,
  Typography,
} from '@mui/material';
import {
  Add,
  ChevronLeft,
  ChevronRight,
  DragIndicator,
  MailOutline,
  MoreHoriz,
  NotificationsNone,
  PlayArrow,
  Publish,
  Save,
  Search,
} from '@mui/icons-material';
import { useLocation } from 'wouter';
import { useAcademy, type Course, type Lesson } from '@/contexts/AcademyContext';
import { useEnhancedMasterIntegration } from '@/integration/EnhancedMasterIntegrationProvider';
import { withUniversalIntegration } from '@/integration/UniversalIntegrationHOC';
import { useAcademyLocale } from './academyLocale';
import AcademyBrandMark from './AcademyBrandMark';

interface AcademyCurriculumStudioProps {
  courseId?: string;
  onSave?: (payload: Record<string, unknown>) => void;
  onCancel?: () => void;
}

interface CurriculumLesson {
  id: string;
  title: string;
  duration: number;
  releaseMode: 'scheduled' | 'manual';
  videoUrl: string;
  isPreview: boolean;
}

interface CurriculumModule {
  id: string;
  title: string;
  status: 'draft' | 'published';
  releaseNote: string;
  lessons: CurriculumLesson[];
  expanded: boolean;
  imageTheme: number;
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
    id: 'curriculum-course-1',
    title: 'Directing Masterclass',
    description: 'Cinematic directing workflows with practical scene execution.',
    instructor: {
      id: 'curriculum-instructor-1',
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
    tags: ['directing', 'curriculum'],
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

const buildLesson = (
  title: string,
  duration: number,
  releaseMode: 'scheduled' | 'manual' = 'scheduled',
): CurriculumLesson => ({
  id: `lesson-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  title,
  duration,
  releaseMode,
  videoUrl: '/assets/academy/intro-video.mp4',
  isPreview: false,
});

const defaultModules = (): CurriculumModule[] => [
  {
    id: 'curriculum-module-1',
    title: 'Foundations',
    status: 'draft',
    releaseNote: 'Release Scheduled',
    expanded: true,
    imageTheme: 0,
    lessons: [
      buildLesson('Introduction', 612),
      buildLesson('Lighting Basics', 2615),
      buildLesson('Practical Setup', 577),
    ],
  },
  {
    id: 'curriculum-module-2',
    title: 'Advanced Techniques',
    status: 'draft',
    releaseNote: 'Release scheduled for Apr 29, 2026 · 12:00 PM',
    expanded: false,
    imageTheme: 1,
    lessons: [buildLesson('Advanced Blocking', 760)],
  },
  {
    id: 'curriculum-module-3',
    title: 'Directing Actors',
    status: 'draft',
    releaseNote: 'Not published',
    expanded: false,
    imageTheme: 2,
    lessons: [buildLesson('Scene Psychology', 680)],
  },
];

const formatDuration = (seconds: number): string => {
  const mins = Math.floor(Math.max(0, seconds) / 60);
  const secs = Math.max(0, seconds) % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
};

const buildModulesFromCourse = (course: Course | null | undefined): CurriculumModule[] => {
  const lessons = Array.isArray(course?.lessons) ? course.lessons : [];
  if (lessons.length === 0) return defaultModules();

  return [
    {
      id: `curriculum-module-${course?.id || 'imported'}`,
      title: 'Foundations',
      status: course?.isPublished ? 'published' : 'draft',
      releaseNote: course?.isPublished ? 'Published' : 'Release Scheduled',
      expanded: true,
      imageTheme: 0,
      lessons: lessons.map((lesson) => ({
        id: String(lesson.id),
        title: String(lesson.title || 'Untitled Lesson'),
        duration: Number(lesson.duration || 0),
        releaseMode: 'scheduled',
        videoUrl: lesson.videoUrl || '/assets/academy/intro-video.mp4',
        isPreview: Boolean(lesson.isPreview),
      })),
    },
  ];
};

function AcademyCurriculumStudio({ courseId, onSave, onCancel }: AcademyCurriculumStudioProps) {
  const [, setLocation] = useLocation();
  const { state, getCourse, updateCourse } = useAcademy();
  const { analytics, debugging } = useEnhancedMasterIntegration();
  
  const { navLabel, tt } = useAcademyLocale();

  const [leftNav, setLeftNav] = useState('curriculum');
  const [selectedCourseId, setSelectedCourseId] = useState(courseId || 'all');
  const [searchValue, setSearchValue] = useState('');
  const [saveMessage, setSaveMessage] = useState('');
  const [saving, setSaving] = useState(false);

  const [moduleItems, setModuleItems] = useState<CurriculumModule[]>(defaultModules);
  const [activeModuleId, setActiveModuleId] = useState('');

  const courseItems = useMemo(() => {
    if (Array.isArray(state?.courses) && state.courses.length > 0) {
      return state.courses;
    }
    return fallbackCourses;
  }, [state?.courses]);

  const activeCourse = useMemo(() => {
    const fromParam = courseId ? getCourse(courseId) : null;
    if (fromParam) return fromParam;

    if (selectedCourseId !== 'all') {
      const fromSelected = courseItems.find((course) => String(course.id) === String(selectedCourseId));
      if (fromSelected) return fromSelected;
    }

    return state.currentCourse || courseItems[0] || fallbackCourses[0];
  }, [courseId, courseItems, getCourse, selectedCourseId, state.currentCourse]);

  useEffect(() => {
    const imported = buildModulesFromCourse(activeCourse);
    setModuleItems(imported);
    setActiveModuleId(imported[0]?.id || '');
  }, [activeCourse?.id]);

  useEffect(() => {
    analytics.trackEvent('academy_curriculum_studio_opened', {
      courseId: activeCourse?.id || null,
      moduleCount: moduleItems.length,
      timestamp: Date.now(),
    });

    debugging.logIntegration('info', 'AcademyCurriculumStudio opened', {
      courseId: activeCourse?.id || null,
      moduleCount: moduleItems.length,
    });
  }, [activeCourse?.id, analytics, debugging, moduleItems.length]);

  const visibleModules = useMemo(() => {
    const query = searchValue.trim().toLowerCase();
    if (!query) return moduleItems;

    return moduleItems.filter((module) => {
      return (
        module.title.toLowerCase().includes(query) ||
        module.releaseNote.toLowerCase().includes(query) ||
        module.lessons.some((lesson) => lesson.title.toLowerCase().includes(query))
      );
    });
  }, [moduleItems, searchValue]);

  const selectedModule = useMemo(() => {
    return moduleItems.find((module) => module.id === activeModuleId) || moduleItems[0] || null;
  }, [activeModuleId, moduleItems]);

  const totalLessons = useMemo(
    () => moduleItems.reduce((sum, module) => sum + module.lessons.length, 0),
    [moduleItems],
  );

  const totalModules = moduleItems.length;

  const totalDurationMinutes = useMemo(() => {
    const seconds = moduleItems.reduce(
      (moduleSum, module) => moduleSum + module.lessons.reduce((sum, lesson) => sum + lesson.duration, 0),
      0,
    );
    return Math.round(seconds / 60);
  }, [moduleItems]);

  const completionRate = useMemo(() => {
    if (totalLessons === 0) return 0;
    return Math.min(99, Math.max(12, Math.round((totalLessons * 16 + totalModules * 8) % 100)));
  }, [totalLessons, totalModules]);

  const totalEnrollments = useMemo(() => {
    const fromCourse = Number(activeCourse?.studentCount || 0);
    return Math.max(fromCourse, totalLessons * 11 + totalModules * 9);
  }, [activeCourse?.studentCount, totalLessons, totalModules]);

  const avgWatchMinutes = useMemo(() => {
    if (totalLessons === 0) return 0;
    return Math.max(1, Math.round(totalDurationMinutes / totalLessons));
  }, [totalDurationMinutes, totalLessons]);

  const addModule = useCallback(() => {
    const moduleIndex = moduleItems.length + 1;
    const newModule: CurriculumModule = {
      id: `curriculum-module-${Date.now()}`,
      title: `${tt('Modul', 'Module')} ${moduleIndex}`,
      status: 'draft',
      releaseNote: tt('Planlagt publisering', 'Release Scheduled'),
      expanded: true,
      imageTheme: moduleIndex % placeholderBackgrounds.length,
      lessons: [buildLesson(tt('Ny leksjon', 'New Lesson'), 600)],
    };

    setModuleItems((prev) => [
      ...prev.map((entry) => ({ ...entry, expanded: false })),
      newModule,
    ]);
    setActiveModuleId(newModule.id);
  }, [moduleItems.length, tt]);

  const toggleModule = useCallback((moduleId: string) => {
    setModuleItems((prev) =>
      prev.map((module) =>
        module.id === moduleId
          ? { ...module, expanded: !module.expanded }
          : module,
      ),
    );
    setActiveModuleId(moduleId);
  }, []);

  const addLessonToModule = useCallback((moduleId: string) => {
    setModuleItems((prev) =>
      prev.map((module) => {
        if (module.id !== moduleId) return module;
        return {
          ...module,
          lessons: [...module.lessons, buildLesson(tt('Ny leksjon', 'New Lesson'), 540)],
        };
      }),
    );
    setActiveModuleId(moduleId);
  }, [tt]);

  const saveCurriculum = useCallback(
    async (publish: boolean) => {
      setSaving(true);
      setSaveMessage('');

      const modulesForSave = publish
        ? moduleItems.map((module) => ({ ...module, status: 'published' as const }))
        : moduleItems;

      try {
        setModuleItems(modulesForSave);

        const lessonsPayload: Lesson[] = modulesForSave.flatMap((module, moduleIndex) =>
          module.lessons.map((lesson, lessonIndex) => ({
            id: lesson.id,
            courseId: String(activeCourse?.id || 'academy-curriculum-course'),
            title: lesson.title,
            description: `${module.title} · ${lesson.title}`,
            videoUrl: lesson.videoUrl,
            duration: lesson.duration,
            order: moduleIndex * 100 + lessonIndex,
            isPreview: lesson.isPreview,
            resources: [],
          })),
        );
        const totalDurationSeconds = lessonsPayload.reduce((sum, lesson) => sum + Number(lesson.duration || 0), 0);

        if (activeCourse?.id && Array.isArray(state?.courses) && state.courses.some((course) => String(course.id) === String(activeCourse.id))) {
          const nextTags = Array.from(new Set([...(activeCourse.tags || []), 'curriculum']));
          await updateCourse({
            ...activeCourse,
            lessons: lessonsPayload,
            tags: nextTags,
            duration: totalDurationSeconds,
            isPublished: publish ? true : activeCourse.isPublished,
            updatedAt: new Date().toISOString(),
          });
        }

        onSave?.({
          courseId: activeCourse?.id || null,
          modules: modulesForSave,
          lessons: lessonsPayload,
          publish,
          updatedAt: new Date().toISOString(),
        });

        analytics.trackEvent(publish ? 'academy_curriculum_publish' : 'academy_curriculum_save', {
          courseId: activeCourse?.id || null,
          moduleCount: modulesForSave.length,
          lessonCount: lessonsPayload.length,
          publish,
          timestamp: Date.now(),
        });

        setSaveMessage(
          publish
            ? tt('Læreplan publisert.', 'Curriculum published.')
            : tt('Læreplan lagret.', 'Curriculum saved.'),
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : tt('Kunne ikke lagre læreplan.', 'Failed to save curriculum.');
        setSaveMessage(message);
        debugging.logIntegration('error', 'Academy curriculum save failed', {
          courseId: activeCourse?.id || null,
          message,
        });
      } finally {
        setSaving(false);
      }
    },
    [activeCourse, analytics, debugging, moduleItems, onSave, state?.courses, tt, updateCourse],
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
          pointerEvents: 'none',
          background:
            'radial-gradient(circle at 74% 14%, rgba(248,179,33,0.25), rgba(5,8,13,0) 43%), radial-gradient(circle at 18% 82%, rgba(82,121,204,0.13), rgba(6,8,14,0) 44%), linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0) 30%)',
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
              onClick={addModule}
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
            <Typography sx={{ letterSpacing: '0.22em', fontSize: 15, color: 'rgba(237,240,247,0.82)' }}>
              CREATOR STUDIO
            </Typography>

            <Stack direction="row" spacing={1.2} alignItems="center">
              <Button
                startIcon={<PlayArrow />}
                onClick={() => setLocation('/academy/video-player')}
                sx={{
                  textTransform: 'none',
                  color: '#edf0f7',
                  border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.18)',
                  borderRadius: 1,
                }}
              >
                {tt('Forhåndsvis', 'Preview')}
              </Button>
              <Button
                startIcon={<Save />}
                onClick={() => void saveCurriculum(false)}
                disabled={saving}
                sx={{
                  textTransform: 'none',
                  color: '#edf0f7',
                  border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.18)',
                  borderRadius: 1,
                }}
              >
                {tt('Lagre', 'Save')}
              </Button>
              <Button
                startIcon={<Publish />}
                onClick={() => void saveCurriculum(true)}
                disabled={saving}
                sx={{
                  textTransform: 'none',
                  borderRadius: 1,
                  color: '#0f0f0f',
                  background: 'linear-gradient(180deg, #ffd44e, #f2a616)',
                  boxShadow: '0 10px 24px rgba(248,179,33,0.25)',
                  fontWeight: 700,
                }}
              >
                {tt('Publiser', 'Publish')}
              </Button>
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
                  {tt('Læreplan', 'Curriculum')}
                </Typography>

                <Stack direction="row" spacing={1} alignItems="center">
                  <Select
                    size="small"
                    value={selectedCourseId}
                    onChange={(event) => setSelectedCourseId(String(event.target.value))}
                    sx={{
                      minWidth: 170,
                      color: '#edf0f7',
                      bgcolor: 'rgba(255,255,255,0.04)',
                      '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.16)' },
                    }}
                  >
                    <MenuItem value="all">{tt('Alle moduler', 'All Modules')}</MenuItem>
                    {courseItems.map((course) => (
                      <MenuItem key={course.id} value={course.id}>
                        {course.title}
                      </MenuItem>
                    ))}
                  </Select>

                  <Stack direction="row" spacing={0.5}>
                    <IconButton size="small" sx={{ color: 'rgba(237,240,247,0.68)', border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.16)' }}>
                      <ChevronLeft fontSize="small" />
                    </IconButton>
                    <IconButton size="small" sx={{ color: 'rgba(237,240,247,0.68)', border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.16)' }}>
                      <ChevronRight fontSize="small" />
                    </IconButton>
                  </Stack>
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
                <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.2} sx={{ mb: 1.2 }}>
                  <TextField
                    value={searchValue}
                    onChange={(event) => setSearchValue(event.target.value)}
                    placeholder={tt('Søk leksjoner...', 'Search Lessons...')}
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
                    onClick={addModule}
                    sx={{
                      textTransform: 'none',
                      borderRadius: 1,
                      color: '#0f0f0f',
                      background: 'linear-gradient(180deg, #ffd44e, #f2a616)',
                      boxShadow: '0 10px 24px rgba(248,179,33,0.25)',
                      fontWeight: 700,
                    }}
                  >
                    {tt('Legg til modul', 'Add Module')}
                  </Button>
                </Stack>

                <Stack spacing={1}>
                  {visibleModules.map((module, moduleIndex) => {
                    const moduleMinutes = Math.round(
                      module.lessons.reduce((sum, lesson) => sum + lesson.duration, 0) / 60,
                    );
                    const moduleCompletion = Math.max(
                      20,
                      Math.round(
                        (module.lessons.reduce((sum, lesson) => sum + Math.min(100, lesson.duration / 20), 0) /
                          Math.max(module.lessons.length * 100, 1)) *
                          100,
                      ),
                    );

                    return (
                      <Box
                        key={module.id}
                        sx={{
                          borderRadius: 1,
                          border: `var(--academy-hairline-width, 1px) solid ${selectedModule?.id === module.id ? 'rgba(248,179,33,0.4)' : 'rgba(255,255,255,0.14)'}`,
                          bgcolor: 'rgba(8,11,18,0.7)',
                          boxShadow: `inset 3px 0 0 ${
                            moduleIndex % 2 === 0 ? 'rgba(248,179,33,0.36)' : 'rgba(111,149,219,0.25)'
                          }`,
                          overflow: 'hidden',
                        }}
                      >
                        <Box
                          role="button"
                          tabIndex={0}
                          onClick={() => {
                            setActiveModuleId(module.id);
                            toggleModule(module.id);
                          }}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              setActiveModuleId(module.id);
                              toggleModule(module.id);
                            }
                          }}
                          sx={{
                            display: 'flex',
                            width: '100%',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            color: '#edf0f7',
                            px: 1,
                            py: 1,
                            cursor: 'pointer',
                            borderRadius: 0,
                            bgcolor:
                              selectedModule?.id === module.id
                                ? 'linear-gradient(90deg, rgba(248,179,33,0.12), rgba(255,255,255,0.02))'
                                : 'transparent',
                          }}
                        >
                          <Stack direction="row" spacing={1} alignItems="center">
                            <DragIndicator sx={{ color: 'rgba(237,240,247,0.45)' }} />
                            <Chip
                              size="small"
                              label={module.lessons.length}
                              sx={{
                                height: 20,
                                color: '#111',
                                bgcolor: 'rgba(248,179,33,0.9)',
                                fontSize: 11,
                                fontWeight: 700,
                              }}
                            />
                            <Typography sx={{ fontSize: 37, fontWeight: 600, lineHeight: 1 }}>
                              {navLabel(module.title)}
                            </Typography>
                          </Stack>

                          <Stack direction="row" spacing={0.8} alignItems="center">
                            <Button
                              size="small"
                              onClick={(event) => {
                                event.stopPropagation();
                                addLessonToModule(module.id);
                              }}
                              sx={{
                                textTransform: 'none',
                                color: '#edf0f7',
                                border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.16)',
                              }}
                            >
                              + {tt('Varigheter', 'Durations')}
                            </Button>
                            <IconButton size="small" sx={{ color: 'rgba(237,240,247,0.68)' }}>
                              <MoreHoriz fontSize="small" />
                            </IconButton>
                          </Stack>
                        </Box>

                        {module.expanded && (
                          <Box sx={{ borderTop: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.08)' }}>
                            {module.lessons.map((lesson, lessonIndex) => (
                              <Stack
                                key={lesson.id}
                                direction="row"
                                spacing={1}
                                alignItems="center"
                                sx={{
                                  px: 1,
                                  py: 1,
                                  borderBottom:
                                    lessonIndex === module.lessons.length - 1
                                      ? 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.08)'
                                      : 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.06)',
                                }}
                              >
                                <DragIndicator sx={{ color: 'rgba(237,240,247,0.45)' }} />

                                <Box
                                  sx={{
                                    width: 210,
                                    height: 76,
                                    borderRadius: 1,
                                    border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.1)',
                                    background:
                                      placeholderBackgrounds[(module.imageTheme + lessonIndex) % placeholderBackgrounds.length],
                                    flexShrink: 0,
                                  }}
                                />

                                <Box sx={{ minWidth: 0, flex: 1 }}>
                                  <Typography sx={{ fontSize: 39, lineHeight: 1, fontWeight: 600 }} noWrap>
                                    {navLabel(lesson.title)}
                                  </Typography>
                                  <Stack direction="row" spacing={0.6} sx={{ mt: 0.5 }}>
                                    <Chip
                                      size="small"
                                      label={
                                        lesson.releaseMode === 'scheduled'
                                          ? tt('Planlagt publisering', 'Release Scheduled')
                                          : tt('Manuell publisering', 'Manual Release')
                                      }
                                      sx={{
                                        height: 20,
                                        color: '#edf0f7',
                                        bgcolor: 'rgba(255,255,255,0.1)',
                                        fontSize: 11,
                                      }}
                                    />
                                  </Stack>
                                </Box>

                                <Typography sx={{ minWidth: 54, textAlign: 'right', color: '#f8d56f', fontWeight: 700 }}>
                                  {formatDuration(lesson.duration)}
                                </Typography>

                                <IconButton size="small" sx={{ color: 'rgba(237,240,247,0.68)' }}>
                                  <MoreHoriz fontSize="small" />
                                </IconButton>
                              </Stack>
                            ))}

                            <Stack direction="row" spacing={1.4} sx={{ px: 1, py: 0.8 }}>
                              <Typography sx={{ color: 'rgba(237,240,247,0.68)' }}>{tt('Minutter', 'Minutes')} {moduleMinutes}</Typography>
                              <Typography sx={{ color: 'rgba(237,240,247,0.68)' }}>{tt('Fullføringsrate', 'Completion Rate')}: {moduleCompletion}%</Typography>
                              <Typography sx={{ color: 'rgba(237,240,247,0.68)' }}>
                                {tt('Gj.sn. seertid', 'Avg Watch Time')}: {avgWatchMinutes} {tt('min', 'min')}
                              </Typography>
                            </Stack>
                            <LinearProgress
                              variant="determinate"
                              value={moduleCompletion}
                              sx={{
                                mx: 1,
                                mb: 1,
                                height: 6,
                                borderRadius: 999,
                                bgcolor: 'rgba(255,255,255,0.1)',
                                '& .MuiLinearProgress-bar': {
                                  borderRadius: 999,
                                  background: 'linear-gradient(90deg, #8de270 0%, #f8b321 100%)',
                                },
                              }}
                            />
                          </Box>
                        )}
                      </Box>
                    );
                  })}
                </Stack>

                <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1.1 }}>
                  <TextField
                    placeholder={tt('Søk moduler...', 'Search Modules...')}
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
                  <Button sx={{ textTransform: 'none', color: '#edf0f7', border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.16)' }}>
                    {tt('Side 1 av 1', 'Page 1 of 1')}
                  </Button>
                  <IconButton size="small" sx={{ color: 'rgba(237,240,247,0.68)', border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.16)' }}>
                    <ChevronLeft fontSize="small" />
                  </IconButton>
                  <IconButton size="small" sx={{ color: 'rgba(237,240,247,0.68)', border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.16)' }}>
                    <ChevronRight fontSize="small" />
                  </IconButton>
                </Stack>

                <Typography sx={{ mt: 1.4, fontSize: 39, fontWeight: 600 }}>{tt('Kursanalyse', 'Course Analytics')}</Typography>

                <Stack
                  direction={{ xs: 'column', lg: 'row' }}
                  spacing={1}
                  sx={{ mt: 0.8 }}
                >
                  <Box sx={{ ...panelSx, flex: 1, p: 1 }}>
                    <Stack direction="row" spacing={2.2}>
                      <Box>
                        <Typography sx={{ fontSize: 44, fontWeight: 700, lineHeight: 1 }}>{totalLessons}</Typography>
                        <Typography sx={{ color: 'rgba(237,240,247,0.72)' }}>{tt('Leksjoner', 'Lessons')}</Typography>
                      </Box>
                      <Box>
                        <Typography sx={{ fontSize: 44, fontWeight: 700, lineHeight: 1 }}>{totalModules}</Typography>
                        <Typography sx={{ color: 'rgba(237,240,247,0.72)' }}>{tt('Moduler', 'Modules')}</Typography>
                      </Box>
                      <Box>
                        <Typography sx={{ fontSize: 44, fontWeight: 700, lineHeight: 1 }}>{completionRate}%</Typography>
                        <Typography sx={{ color: 'rgba(237,240,247,0.72)' }}>{tt('Fullføring', 'Completion')}</Typography>
                      </Box>
                      <Box>
                        <Typography sx={{ fontSize: 44, fontWeight: 700, lineHeight: 1 }}>{totalEnrollments}</Typography>
                        <Typography sx={{ color: 'rgba(237,240,247,0.72)' }}>{tt('Totale påmeldinger', 'Total Enrollments')}</Typography>
                      </Box>
                    </Stack>
                  </Box>

                  <Box sx={{ ...panelSx, width: { xs: '100%', lg: 420 }, p: 1 }}>
                    <Typography sx={{ color: 'rgba(237,240,247,0.72)' }}>{tt('Gj.sn. seertid', 'Avg Watch Time')}</Typography>
                    <Box
                      sx={{
                        mt: 0.8,
                        height: 72,
                        borderRadius: 1,
                        border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.12)',
                        background:
                          'linear-gradient(180deg, rgba(248,179,33,0.08), rgba(248,179,33,0.01)), repeating-linear-gradient(90deg, rgba(255,255,255,0.06) 0 1px, transparent 1px 42px)',
                        position: 'relative',
                      }}
                    >
                      <Box
                        sx={{
                          position: 'absolute',
                          left: 8,
                          right: 8,
                          top: '54%',
                          height: 2,
                          bgcolor: 'rgba(248,179,33,0.8)',
                          transform: 'skewX(-8deg)',
                          boxShadow: '0 0 14px rgba(248,179,33,0.42)',
                        }}
                      />
                    </Box>
                  </Box>
                </Stack>
              </Box>
            </Box>

            <Box sx={{ ...panelSx, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
              <Box
                sx={{
                  height: 210,
                  borderBottom: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.08)',
                  background: placeholderBackgrounds[selectedModule?.imageTheme || 0],
                  borderTopLeftRadius: 6,
                  borderTopRightRadius: 6,
                }}
              />

              <Box sx={{ p: 1.2, borderBottom: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.08)' }}>
                <Typography sx={{ fontSize: 38, fontWeight: 600 }}>
                  {selectedModule?.title || tt('Grunnlag', 'Foundations')}
                </Typography>
              </Box>

              <Box sx={{ p: 1.2, flex: 1, minHeight: 0, overflow: 'auto' }}>
                <Stack spacing={0.8}>
                  {(selectedModule?.lessons || []).map((lesson, idx) => (
                    <Stack
                      key={lesson.id}
                      direction="row"
                      spacing={0.8}
                      alignItems="center"
                      sx={{
                        px: 0.8,
                        py: 0.9,
                        borderRadius: 1,
                        border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.1)',
                        bgcolor: idx === 0 ? 'rgba(248,179,33,0.08)' : 'rgba(10,14,22,0.7)',
                      }}
                    >
                      <DragIndicator sx={{ color: 'rgba(237,240,247,0.45)' }} />
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography sx={{ fontSize: 37, lineHeight: 1, fontWeight: 600 }} noWrap>
                          {navLabel(lesson.title)}
                        </Typography>
                        <Stack direction="row" spacing={0.8} sx={{ mt: 0.4 }}>
                          <Chip
                            label={`${Math.max(1, Math.round(lesson.duration / 60))} min`}
                            size="small"
                            sx={{
                              height: 20,
                              color: '#edf0f7',
                              bgcolor: 'rgba(255,255,255,0.1)',
                              fontSize: 11,
                            }}
                          />
                          <Typography sx={{ color: 'rgba(237,240,247,0.66)' }}>{formatDuration(lesson.duration)}</Typography>
                        </Stack>
                      </Box>

                      <Button
                        size="small"
                        sx={{ textTransform: 'none', color: '#edf0f7', border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.14)' }}
                      >
                        + {tt('Varighet', 'Duration')}
                      </Button>
                    </Stack>
                  ))}
                </Stack>

                <Button
                  startIcon={<Add />}
                  onClick={() => selectedModule && addLessonToModule(selectedModule.id)}
                  sx={{
                    mt: 1,
                    textTransform: 'none',
                    color: '#edf0f7',
                    border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.18)',
                  }}
                >
                  {tt('Ny modul', 'New Module')}
                </Button>
              </Box>

              <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)' }} />

              <Box sx={{ p: 1.2 }}>
                <Box
                  sx={{
                    height: 120,
                    borderRadius: 1,
                    border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.12)',
                    background:
                      'linear-gradient(180deg, rgba(248,179,33,0.08), rgba(248,179,33,0.01)), repeating-linear-gradient(90deg, rgba(255,255,255,0.05) 0 1px, transparent 1px 46px), repeating-linear-gradient(0deg, rgba(255,255,255,0.03) 0 1px, transparent 1px 28px)',
                    position: 'relative',
                  }}
                >
                  <Box
                    sx={{
                      position: 'absolute',
                      left: 10,
                      right: 10,
                      top: '40%',
                      height: 2,
                      bgcolor: 'rgba(248,179,33,0.8)',
                      transform: 'skewX(-8deg)',
                      boxShadow: '0 0 14px rgba(248,179,33,0.42)',
                    }}
                  />
                </Box>
              </Box>

              <Stack direction="row" spacing={1} sx={{ p: 1.1, pt: 0 }}>
                <Button
                  startIcon={<Save />}
                  onClick={() => void saveCurriculum(false)}
                  disabled={saving}
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
                  onClick={() => void saveCurriculum(true)}
                  disabled={saving}
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
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

export default withUniversalIntegration(AcademyCurriculumStudio, {
  componentId: 'academy-curriculum-studio',
  componentName: 'Academy Curriculum Studio',
  componentType: 'manager',
  componentCategory: 'academy',
  featureIds: ['curriculum-management', 'module-management', 'lesson-ordering', 'academy-course-structure'],
});
