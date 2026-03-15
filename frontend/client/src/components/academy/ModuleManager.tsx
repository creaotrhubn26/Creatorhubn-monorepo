import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  alpha,
  Box,
  Button,
  Chip,
  Divider,
  IconButton,
  InputAdornment,
  LinearProgress,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import {
  Add,
  Campaign,
  DragIndicator,
  Edit,
  MonetizationOn,
  Movie,
  MoreHoriz,
  Publish,
  Quiz,
  Save,
  Search,
  Subtitles,
  VisibilityOff,
} from '@mui/icons-material';
import { useLocation } from 'wouter';
import { useAcademy } from '@/contexts/AcademyContext';
import { useEnhancedMasterIntegration } from '@/integration/EnhancedMasterIntegrationProvider';
import { withUniversalIntegration } from '@/integration/UniversalIntegrationHOC';
import { useAcademyLocale } from './academyLocale';
import AcademyLocaleSwitcher from './AcademyLocaleSwitcher';
import AcademyLeftSidebar from './AcademyLeftSidebar';
import AcademyVideoPlayerStudio from './AcademyVideoPlayerStudio';

interface ModuleLesson {
  id: string;
  title: string;
  duration: number;
  videoUrl: string;
  thumbnail?: string;
  isPreview: boolean;
  releaseScheduled: boolean;
}

interface ModuleEntity {
  id: string;
  title: string;
  description: string;
  status: 'draft' | 'published';
  releaseMode: 'manual' | 'scheduled';
  releaseDate: string;
  lessons: ModuleLesson[];
}

interface ModuleManagerProps {
  courseId?: string;
  modules?: ModuleEntity[];
  onModuleUpdate?: (modules: ModuleEntity[]) => void;
  onModuleSelect?: (module: ModuleEntity) => void;
  selectedModule?: ModuleEntity | null;
  mode?: 'create' | 'edit' | 'browse' | 'select';
  showPreview?: boolean;
  height?: number;
}

type RightPanelTab = 'module' | 'schedule' | 'prerequisites' | 'localization';
type LocalizationDraft = { title: string; description: string };

const buildLesson = (title: string, minutes: number): ModuleLesson => ({
  id: `lesson-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  title,
  duration: minutes * 60,
  videoUrl: '/assets/academy/intro-video.mp4',
  thumbnail: '',
  isPreview: false,
  releaseScheduled: true,
});

const DEFAULT_MODULES: ModuleEntity[] = [
  {
    id: 'module-foundations',
    title: 'Foundations',
    description: 'Core directing fundamentals and visual storytelling setup.',
    status: 'draft',
    releaseMode: 'scheduled',
    releaseDate: '2026-04-24T12:00',
    lessons: [buildLesson('Introduction', 44), buildLesson('Lighting Basics', 8), buildLesson('Practical Setup', 10)],
  },
  {
    id: 'module-advanced-techniques',
    title: 'Advanced Techniques',
    description: 'Advanced scene construction and camera choreography.',
    status: 'draft',
    releaseMode: 'scheduled',
    releaseDate: '2026-04-29T12:07',
    lessons: [buildLesson('Dynamic Blocking', 14)],
  },
  {
    id: 'module-directing-actors',
    title: 'Directing Actors',
    description: 'Actor communication, motivation, and intention tracking.',
    status: 'draft',
    releaseMode: 'manual',
    releaseDate: '2026-05-03T12:00',
    lessons: [buildLesson('Performance Direction Lab', 11)],
  },
];

const placeholderBackdrops = [
  'linear-gradient(145deg, rgba(26,30,40,0.88), rgba(12,16,24,0.96)), radial-gradient(circle at 85% 15%, rgba(245,165,35,0.35), rgba(0,0,0,0))',
  'linear-gradient(145deg, rgba(20,25,34,0.9), rgba(11,14,20,0.96)), radial-gradient(circle at 15% 80%, rgba(245,165,35,0.2), rgba(0,0,0,0))',
  'linear-gradient(145deg, rgba(18,22,31,0.9), rgba(9,13,20,0.95)), radial-gradient(circle at 78% 8%, rgba(116,158,224,0.25), rgba(0,0,0,0))',
];

const formatTime = (seconds: number): string => {
  const min = Math.floor(seconds / 60);
  const sec = seconds % 60;
  return `${min}:${sec.toString().padStart(2, '0')}`;
};

function ModuleManager({
  courseId,
  modules,
  onModuleUpdate,
  onModuleSelect,
  selectedModule,
  showPreview,
}: ModuleManagerProps) {
  const [, setLocation] = useLocation();
  const { getCourse, updateCourse } = useAcademy();
  const { analytics, debugging } = useEnhancedMasterIntegration();
  const { tt, navLabel } = useAcademyLocale();

  const [leftNav, setLeftNav] = useState('curriculum');
  const [rightTab, setRightTab] = useState<RightPanelTab>('module');
  const [searchValue, setSearchValue] = useState('');
  const [scheduleMode, setScheduleMode] = useState<'manual' | 'scheduled'>('scheduled');
  const [timezone, setTimezone] = useState('(UTC+2)');
  const [saveMessage, setSaveMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [previewMode, setPreviewMode] = useState(Boolean(showPreview));
  const [modulePrerequisites, setModulePrerequisites] = useState<Record<string, string[]>>({});
  const [activeLocale, setActiveLocale] = useState('nb-NO');
  const [moduleLocalizations, setModuleLocalizations] = useState<Record<string, LocalizationDraft>>({});

  const [moduleItems, setModuleItems] = useState<ModuleEntity[]>(DEFAULT_MODULES);
  const [activeModuleId, setActiveModuleId] = useState<string>('');

  useEffect(() => {
    if (modules && modules.length > 0) {
      setModuleItems(modules);
      setActiveModuleId(selectedModule?.id || modules[0].id);
      return;
    }

    if (!courseId) {
      setActiveModuleId(DEFAULT_MODULES[0].id);
      return;
    }

    const course = getCourse(courseId);
    if (!course) {
      setActiveModuleId(DEFAULT_MODULES[0].id);
      return;
    }

    const lessons = Array.isArray(course.lessons) ? course.lessons : [];
    if (lessons.length === 0) {
      setActiveModuleId(DEFAULT_MODULES[0].id);
      return;
    }

    const imported: ModuleEntity[] = [
      {
        id: `module-${course.id}`,
        title: 'Foundations',
        description: course.description || 'Imported module from selected course.',
        status: course.isPublished ? 'published' : 'draft',
        releaseMode: 'manual',
        releaseDate: new Date().toISOString().slice(0, 16),
        lessons: lessons.map((lesson: any) => ({
          id: String(lesson.id),
          title: String(lesson.title || 'Untitled Lesson'),
          duration: Number(lesson.duration || 0),
          videoUrl: lesson.videoUrl || '/assets/academy/intro-video.mp4',
          thumbnail: '',
          isPreview: Boolean(lesson.isPreview),
          releaseScheduled: true,
        })),
      },
    ];

    setModuleItems(imported);
    setActiveModuleId(imported[0].id);
  }, [courseId, getCourse, modules, selectedModule?.id]);

  const visibleModules = useMemo(() => {
    const query = searchValue.trim().toLowerCase();
    if (!query) return moduleItems;
    return moduleItems.filter((module) => {
      return (
        module.title.toLowerCase().includes(query) ||
        module.description.toLowerCase().includes(query) ||
        module.lessons.some((lesson) => lesson.title.toLowerCase().includes(query))
      );
    });
  }, [moduleItems, searchValue]);

  const activeModule = useMemo(() => {
    if (!activeModuleId) return visibleModules[0] || moduleItems[0] || null;
    return moduleItems.find((module) => module.id === activeModuleId) || null;
  }, [activeModuleId, moduleItems, visibleModules]);

  const prerequisiteOptions = useMemo(() => {
    if (!activeModuleId) return [];
    return moduleItems.filter((module) => module.id !== activeModuleId);
  }, [activeModuleId, moduleItems]);

  const activePrerequisiteIds = useMemo(() => {
    if (!activeModule) return [];
    return modulePrerequisites[activeModule.id] || [];
  }, [activeModule, modulePrerequisites]);

  const activeLocalizationKey = useMemo(() => {
    if (!activeModule) return '';
    return `${activeModule.id}:${activeLocale}`;
  }, [activeLocale, activeModule]);

  const activeLocalizationDraft = useMemo<LocalizationDraft>(() => {
    if (!activeModule) return { title: '', description: '' };
    return moduleLocalizations[activeLocalizationKey] || { title: activeModule.title, description: activeModule.description };
  }, [activeLocalizationKey, activeModule, moduleLocalizations]);

  const totalMinutes = useMemo(() => {
    return Math.round(
      moduleItems.reduce((sum, module) => {
        return sum + module.lessons.reduce((lessonSum, lesson) => lessonSum + lesson.duration, 0);
      }, 0) / 60,
    );
  }, [moduleItems]);

  const completionRate = useMemo(() => {
    const lessonCount = moduleItems.reduce((sum, module) => sum + module.lessons.length, 0);
    return Math.min(98, Math.max(12, Math.round((lessonCount * 17 + moduleItems.length * 11) % 100)));
  }, [moduleItems]);

  const previewCourse = useMemo(() => {
    const flattenedLessons = moduleItems.flatMap((module, moduleIndex) =>
      module.lessons.map((lesson, lessonIndex) => ({
        id: lesson.id,
        title: lesson.title,
        description: `${module.title} · ${lesson.title}`,
        videoUrl: lesson.videoUrl,
        duration: lesson.duration,
        order: moduleIndex * 100 + lessonIndex,
        isPreview: lesson.isPreview,
        resources: [],
      })),
    );

    return {
      id: courseId || 'module-manager-preview-course',
      title: tt('Forhåndsvisning av moduladministrator', 'Module Manager Preview'),
      lessons: flattenedLessons,
      duration: totalMinutes,
      isPublished: moduleItems.some((module) => module.status === 'published'),
    };
  }, [courseId, moduleItems, totalMinutes, tt]);

  const previewLesson = previewCourse.lessons[0] || null;

  const commitModules = useCallback(
    (nextModules: ModuleEntity[]) => {
      setModuleItems(nextModules);
      onModuleUpdate?.(nextModules);
    },
    [onModuleUpdate],
  );

  const addModule = useCallback(() => {
    const module: ModuleEntity = {
      id: `module-${Date.now()}`,
      title: `${tt('Ny kompetanse', 'New Competency')} ${moduleItems.length + 1}`,
      description: tt('Modulbeskrivelse', 'Module description'),
      status: 'draft',
      releaseMode: 'manual',
      releaseDate: new Date().toISOString().slice(0, 16),
      lessons: [buildLesson(tt('Ny leksjon', 'New Lesson'), 7)],
    };
    const nextModules = [...moduleItems, module];
    commitModules(nextModules);
    setActiveModuleId(module.id);
    onModuleSelect?.(module);
  }, [commitModules, moduleItems, onModuleSelect, tt]);

  const updateActiveModule = useCallback(
    (updater: (module: ModuleEntity) => ModuleEntity) => {
      if (!activeModule) return;
      const nextModules = moduleItems.map((module) => (module.id === activeModule.id ? updater(module) : module));
      commitModules(nextModules);
      const updated = nextModules.find((module) => module.id === activeModule.id);
      if (updated) onModuleSelect?.(updated);
    },
    [activeModule, commitModules, moduleItems, onModuleSelect],
  );

  const addLesson = useCallback(() => {
    updateActiveModule((module) => ({
      ...module,
      lessons: [...module.lessons, buildLesson(tt('Ny leksjon', 'New Lesson'), 8)],
    }));
  }, [tt, updateActiveModule]);

  const updateLesson = useCallback(
    (lessonId: string, field: keyof ModuleLesson, value: string | number | boolean) => {
      updateActiveModule((module) => ({
        ...module,
        lessons: module.lessons.map((lesson) => {
          if (lesson.id !== lessonId) return lesson;
          return { ...lesson, [field]: value };
        }),
      }));
    },
    [updateActiveModule],
  );

  const removeLesson = useCallback(
    (lessonId: string) => {
      updateActiveModule((module) => ({
        ...module,
        lessons: module.lessons.filter((lesson) => lesson.id !== lessonId),
      }));
    },
    [updateActiveModule],
  );

  const togglePrerequisiteModule = useCallback(
    (moduleId: string) => {
      if (!activeModule) return;
      setModulePrerequisites((prev) => {
        const existing = prev[activeModule.id] || [];
        const next = existing.includes(moduleId) ? existing.filter((id) => id !== moduleId) : [...existing, moduleId];
        return { ...prev, [activeModule.id]: next };
      });
    },
    [activeModule],
  );

  const updateLocalizationDraft = useCallback(
    (field: keyof LocalizationDraft, value: string) => {
      if (!activeModule) return;
      const key = `${activeModule.id}:${activeLocale}`;
      setModuleLocalizations((prev) => {
        const current = prev[key] || { title: activeModule.title, description: activeModule.description };
        return { ...prev, [key]: { ...current, [field]: value } };
      });
    },
    [activeLocale, activeModule],
  );

  const saveModules = useCallback(
    async (publish: boolean) => {
      setSaving(true);
      setSaveMessage('');

      try {
        const nextModules = publish
          ? moduleItems.map((module) => ({ ...module, status: 'published' as const }))
          : moduleItems;

        commitModules(nextModules);

        if (courseId) {
          const existing = getCourse(courseId);
          if (existing) {
            const flattenedLessons = nextModules.flatMap((module, moduleIndex) =>
              module.lessons.map((lesson, lessonIndex) => ({
                id: lesson.id,
                courseId: courseId,
                title: lesson.title,
                description: `${module.title} · ${lesson.title}`,
                videoUrl: lesson.videoUrl,
                duration: lesson.duration,
                order: moduleIndex * 100 + lessonIndex,
                isPreview: lesson.isPreview,
                resources: [],
              })),
            );

            await updateCourse({
              ...existing,
              lessons: flattenedLessons,
              duration: Math.round(flattenedLessons.reduce((sum: number, lesson: any) => sum + lesson.duration, 0) / 60),
              isPublished: publish ? true : existing.isPublished,
              updatedAt: new Date().toISOString(),
            });
          }
        }

        analytics.trackEvent(publish ? 'module_manager_publish' : 'module_manager_save', {
          moduleCount: nextModules.length,
          lessonCount: nextModules.reduce((sum, module) => sum + module.lessons.length, 0),
        });

        setSaveMessage(publish ? tt('Moduler publisert.', 'Modules published.') : tt('Moduler lagret.', 'Modules saved.'));
      } catch (error) {
        const message = error instanceof Error ? error.message : tt('Kunne ikke lagre moduler.', 'Failed to save modules.');
        debugging.logIntegration('error', 'Module manager save failed', { error: message });
        setSaveMessage(message);
      } finally {
        setSaving(false);
      }
    },
    [analytics, commitModules, courseId, debugging, getCourse, moduleItems, tt, updateCourse],
  );

  useEffect(() => {
    if (!activeModule) return;
    setScheduleMode(activeModule.releaseMode);
  }, [activeModule]);

  if (previewMode && previewLesson) {
    return (
      <Box sx={{ minHeight: '100vh', bgcolor: '#05080f' }}>
        <Box sx={{ px: 2, py: 1.5 }}>
          <Button
            onClick={() => setPreviewMode(false)}
            sx={{
              textTransform: 'none',
              color: '#f4ede1',
              borderRadius: '8px',
              border: 'var(--academy-hairline-width, 1px) solid rgba(245,166,35,0.4)',
            }}
          >
            {tt('Tilbake til moduladministrator', 'Back to Module Manager')}
          </Button>
        </Box>
        <AcademyVideoPlayerStudio
          courseId={previewCourse.id}
          lessonId={previewLesson.id}
        />
      </Box>
    );
  }

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
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr',
            lg: 'minmax(220px, 250px) minmax(0, 1fr)',
            xl: 'minmax(220px, 250px) minmax(0, 1fr) minmax(320px, var(--academy-right-panel-width, 390px))',
          },
          minHeight: '100vh',
          position: 'relative',
          zIndex: 1,
          width: 'min(100%, var(--academy-shell-max-width, 1920px))',
          mx: 'auto',
          overflowX: 'hidden',
        }}
      >
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
        />

        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            minWidth: 0,
            background: 'linear-gradient(180deg, rgba(8,12,18,0.94) 0%, rgba(7,10,16,0.92) 100%)',
          }}
        >
          <Box
            sx={{
              px: { xs: 2, md: 3 },
              py: 1.4,
              borderBottom: 'var(--academy-hairline-width, 1px) solid rgba(245,166,35,0.15)',
              background: 'rgba(7,10,16,0.72)',
              backdropFilter: 'blur(6px)',
            }}
          >
            <Stack
              direction="row"
              justifyContent="space-between"
              alignItems={{ xs: 'flex-start', xl: 'center' }}
              sx={{ gap: 1, flexWrap: 'wrap', minWidth: 0 }}
            >
              <Stack direction="row" spacing={1.4} alignItems="center" sx={{ minWidth: 260, flex: '1 1 320px' }}>
                <Typography sx={{ fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '0.11em', opacity: 0.78 }}>
                  CREATOR STUDIO
                </Typography>
                <Typography sx={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: 'clamp(1.22rem, 1.05rem + 0.45vw, 1.62rem)' }}>
                  {tt('Kursarkitektur', 'Course Architecture')}
                </Typography>
              </Stack>

              <Stack
                direction="row"
                spacing={1}
                alignItems="center"
                sx={{
                  flex: '1 1 480px',
                  minWidth: 0,
                  justifyContent: { xs: 'flex-start', xl: 'flex-end' },
                  py: 0.2,
                  rowGap: 0.4,
                  flexWrap: 'nowrap',
                  overflowX: 'auto',
                  pb: 0.2,
                  '& > *': { flexShrink: 0, whiteSpace: 'nowrap' },
                  '&::-webkit-scrollbar': { height: 6 },
                  '&::-webkit-scrollbar-thumb': {
                    backgroundColor: 'rgba(255,255,255,0.18)',
                    borderRadius: 999,
                  },
                }}
              >
                <Button
                  startIcon={<Edit />}
                  onClick={() => setLocation('/academy/annotation-editor')}
                  sx={{
                    textTransform: 'none',
                    color: '#f4ede1',
                    borderRadius: '8px',
                    border: 'var(--academy-hairline-width, 1px) solid rgba(245,166,35,0.35)',
                    px: 2,
                  }}
                >
                  {tt('Annoteringsstudio', 'Annotation Studio')}
                </Button>
                <Button
                  startIcon={<Quiz />}
                  onClick={() => setLocation('/academy/quiz-manager')}
                  sx={{
                    textTransform: 'none',
                    color: '#f4ede1',
                    borderRadius: '8px',
                    border: 'var(--academy-hairline-width, 1px) solid rgba(245,166,35,0.35)',
                    px: 2,
                  }}
                >
                  {tt('Quiz Studio', 'Quiz Studio')}
                </Button>
                <Button
                  startIcon={<Campaign />}
                  onClick={() => setLocation('/academy/cta-overlay')}
                  sx={{
                    textTransform: 'none',
                    color: '#f4ede1',
                    borderRadius: '8px',
                    border: 'var(--academy-hairline-width, 1px) solid rgba(245,166,35,0.35)',
                    px: 2,
                  }}
                >
                  CTA
                </Button>
                <Button
                  startIcon={<Subtitles />}
                  onClick={() => setLocation('/academy/lower-thirds')}
                  sx={{
                    textTransform: 'none',
                    color: '#f4ede1',
                    borderRadius: '8px',
                    border: 'var(--academy-hairline-width, 1px) solid rgba(245,166,35,0.35)',
                    px: 2,
                  }}
                >
                  {tt('Supring Studio', 'Lower Thirds Studio')}
                </Button>
                <Button
                  startIcon={<Movie />}
                  onClick={() => setLocation('/academy/player-studio')}
                  sx={{
                    textTransform: 'none',
                    color: '#f4ede1',
                    borderRadius: '8px',
                    border: 'var(--academy-hairline-width, 1px) solid rgba(245,166,35,0.35)',
                    px: 2,
                  }}
                >
                  {tt('Spiller', 'Player')}
                </Button>
                <Button
                  startIcon={<MonetizationOn />}
                  onClick={() => setLocation('/academy/monetization')}
                  sx={{
                    textTransform: 'none',
                    color: '#f4ede1',
                    borderRadius: '8px',
                    border: 'var(--academy-hairline-width, 1px) solid rgba(245,166,35,0.35)',
                    px: 2,
                  }}
                >
                  {tt('Monetiser', 'Monetize')}
                </Button>
                <AcademyLocaleSwitcher />
                <Button
                  startIcon={<VisibilityOff />}
                  onClick={() => setPreviewMode(true)}
                  sx={{
                    textTransform: 'none',
                    color: '#f4ede1',
                    borderRadius: '8px',
                    border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.22)',
                    px: 2,
                  }}
                >
                  {tt('Forhåndsvis (student)', 'Preview (learner)')}
                </Button>
                <Button
                  startIcon={<Save />}
                  onClick={() => void saveModules(false)}
                  disabled={saving}
                  sx={{
                    textTransform: 'none',
                    color: '#f4ede1',
                    borderRadius: '8px',
                    border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.22)',
                    px: 2,
                  }}
                >
                  {tt('Lagre', 'Save')}
                </Button>
                <Button
                  startIcon={<Publish />}
                  onClick={() => void saveModules(true)}
                  disabled={saving}
                  sx={{
                    textTransform: 'none',
                    borderRadius: '8px',
                    px: 2,
                    color: '#1f1304',
                    fontWeight: 700,
                    background: 'linear-gradient(180deg, #ffd36d 0%, #f5a623 100%)',
                    '&:hover': {
                      background: 'linear-gradient(180deg, #ffe08d 0%, #f6b640 100%)',
                    },
                  }}
                >
                  {tt('Publiser', 'Publish')}
                </Button>
              </Stack>
            </Stack>
          </Box>

          <Box sx={{ p: { xs: 2, md: 3 }, flex: 1, overflow: 'auto' }}>
            {!!saveMessage && (
              <Typography
                sx={{
                  mb: 1.4,
                  px: 1.1,
                  py: 0.8,
                  borderRadius: '8px',
                  border: 'var(--academy-hairline-width, 1px) solid rgba(245,166,35,0.3)',
                  background: 'rgba(245,166,35,0.08)',
                  color: '#ffdca8',
                  fontFamily: 'Rajdhani, sans-serif',
                }}
              >
                {saveMessage}
              </Typography>
            )}

            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.2 }}>
              <Select
                size="small"
                value="all"
                sx={{
                  minWidth: 170,
                  color: '#f4ede1',
                  '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' },
                  borderRadius: '8px',
                }}
              >
                <MenuItem value="all">{tt('Alle moduler', 'All Modules')}</MenuItem>
              </Select>
              <IconButton sx={{ color: 'rgba(244,237,225,0.7)' }}>
                <MoreHoriz />
              </IconButton>
            </Stack>

            <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.2} sx={{ mb: 1.5 }}>
              <TextField
                fullWidth
                size="small"
                value={searchValue}
                onChange={(event) => setSearchValue(event.target.value)}
                placeholder={tt('Søk kompetanser...', 'Search Competencies...')}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search sx={{ color: 'rgba(244,237,225,0.55)' }} />
                    </InputAdornment>
                  ),
                }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    color: '#f4ede1',
                    borderRadius: '8px',
                    '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
                  },
                }}
              />

              <Button
                startIcon={<Add />}
                onClick={addModule}
                sx={{
                  textTransform: 'none',
                  color: '#1f1304',
                  borderRadius: '8px',
                  px: 2,
                  background: 'linear-gradient(180deg, #ffd36d 0%, #f5a623 100%)',
                  '&:hover': { background: 'linear-gradient(180deg, #ffe08d 0%, #f6b640 100%)' },
                }}
              >
                {tt('Legg til kompetanse', 'Add Competency')}
              </Button>
            </Stack>

            <Stack spacing={1.2}>
              {visibleModules.map((module, moduleIndex) => {
                const selected = activeModule?.id === module.id;
                const moduleMinutes = Math.round(module.lessons.reduce((sum, lesson) => sum + lesson.duration, 0) / 60);
                const moduleCompletion = Math.max(18, Math.round((module.lessons.length * 100) / Math.max(totalMinutes, 1)));

                return (
                  <Box
                    key={module.id}
                    sx={{
                      border: `var(--academy-hairline-width, 1px) solid ${selected ? 'rgba(245,166,35,0.5)' : 'rgba(255,255,255,0.14)'}`,
                      borderRadius: '10px',
                      overflow: 'hidden',
                      background: 'rgba(8,12,18,0.78)',
                    }}
                  >
                    <Button
                      fullWidth
                      onClick={() => {
                        setActiveModuleId(module.id);
                        onModuleSelect?.(module);
                      }}
                      sx={{
                        justifyContent: 'space-between',
                        textTransform: 'none',
                        borderRadius: 0,
                        color: '#f4ede1',
                        px: 1.3,
                        py: 1,
                      }}
                    >
                      <Stack direction="row" spacing={1} alignItems="center">
                        <DragIndicator sx={{ fontSize: 18, color: 'rgba(244,237,225,0.42)' }} />
                        <Chip
                          size="small"
                          label={module.lessons.length}
                          sx={{
                            height: 20,
                            bgcolor: alpha('#f5a623', 0.25),
                            color: '#ffdca8',
                            border: 'var(--academy-hairline-width, 1px) solid rgba(245,166,35,0.3)',
                            fontFamily: 'Rajdhani, sans-serif',
                            fontWeight: 700,
                          }}
                        />
                        <Typography sx={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: 'clamp(1.1rem, 0.98rem + 0.25vw, 1.28rem)', lineHeight: 1 }}>
                          {module.title}
                        </Typography>
                      </Stack>

                      <Stack direction="row" spacing={1.1} alignItems="center">
                        <Typography sx={{ color: '#ffcf7d', fontFamily: 'Rajdhani, sans-serif', fontWeight: 700 }}>
                          {moduleCompletion}%
                        </Typography>
                        <LinearProgress
                          variant="determinate"
                          value={moduleCompletion}
                          sx={{
                            width: 110,
                            height: 5,
                            borderRadius: 999,
                            bgcolor: 'rgba(255,255,255,0.17)',
                            '& .MuiLinearProgress-bar': {
                              borderRadius: 999,
                              background: 'linear-gradient(90deg, #f5a623 0%, #ffd26a 100%)',
                            },
                          }}
                        />
                        <Box component="span" sx={{ display: 'inline-flex', color: 'rgba(244,237,225,0.72)' }}>
                          <MoreHoriz fontSize="small" />
                        </Box>
                      </Stack>
                    </Button>

                    {selected && (
                      <Box sx={{ borderTop: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.08)' }}>
                        {module.lessons.map((lesson, lessonIndex) => (
                          <Stack
                            key={lesson.id}
                            direction="row"
                            spacing={1.2}
                            alignItems="center"
                            sx={{
                              px: 1.3,
                              py: 1,
                              borderBottom:
                                lessonIndex === module.lessons.length - 1
                                  ? 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.06)'
                                  : 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.08)',
                            }}
                          >
                            <DragIndicator sx={{ fontSize: 18, color: 'rgba(244,237,225,0.4)' }} />

                            <Box
                              sx={{
                                width: 200,
                                minWidth: 200,
                                height: 76,
                                borderRadius: '7px',
                                border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.12)',
                                background: lesson.thumbnail
                                  ? `url(${lesson.thumbnail}) center / cover no-repeat`
                                  : placeholderBackdrops[(moduleIndex + lessonIndex) % placeholderBackdrops.length],
                              }}
                            />

                            <Box sx={{ flex: 1, minWidth: 0 }}>
                              <TextField
                                variant="standard"
                                value={lesson.title}
                                onChange={(event) => updateLesson(lesson.id, 'title', event.target.value)}
                                InputProps={{ disableUnderline: true }}
                                sx={{
                                  width: '100%',
                                  '& .MuiInputBase-input': {
                                    color: '#f4ede1',
                                    fontFamily: 'Barlow Condensed, sans-serif',
                                    fontSize: 'clamp(1.18rem, 1.02rem + 0.35vw, 1.35rem)',
                                    lineHeight: 1,
                                  },
                                }}
                              />

                              <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.4 }}>
                                <Chip
                                  size="small"
                                  label={lesson.releaseScheduled ? tt('Publisering planlagt', 'Release Scheduled') : tt('Manuell publisering', 'Manual Release')}
                                  sx={{
                                    height: 20,
                                    bgcolor: 'rgba(255,255,255,0.08)',
                                    color: '#f4ede1',
                                    border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.15)',
                                    fontFamily: 'Rajdhani, sans-serif',
                                  }}
                                />
                                <Chip
                                  size="small"
                                  label={`${Math.round(lesson.duration / 60)} ${tt('min', 'min')}`}
                                  sx={{
                                    height: 20,
                                    bgcolor: alpha('#f5a623', 0.2),
                                    color: '#ffdca8',
                                    border: 'var(--academy-hairline-width, 1px) solid rgba(245,166,35,0.28)',
                                    fontFamily: 'Rajdhani, sans-serif',
                                  }}
                                />
                              </Stack>
                            </Box>

                            <Typography sx={{ width: 56, textAlign: 'right', opacity: 0.86, fontFamily: 'Rajdhani, sans-serif' }}>
                              {formatTime(lesson.duration)}
                            </Typography>

                            <IconButton size="small" onClick={() => removeLesson(lesson.id)} sx={{ color: 'rgba(255,120,120,0.86)' }}>
                              <MoreHoriz fontSize="small" />
                            </IconButton>
                          </Stack>
                        ))}
                      </Box>
                    )}

                    <Box sx={{ px: 1.3, py: 0.85, borderTop: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.08)' }}>
                      <Stack direction="row" spacing={1.4}>
                        <Typography sx={{ fontFamily: 'Rajdhani, sans-serif', opacity: 0.72 }}>
                          {tt('Minutter', 'Minutes')} {moduleMinutes}
                        </Typography>
                        <Typography sx={{ fontFamily: 'Rajdhani, sans-serif', opacity: 0.72 }}>
                          {tt('Fullføringsrate', 'Completion Rate')} {moduleCompletion}%
                        </Typography>
                      </Stack>
                    </Box>
                  </Box>
                );
              })}
            </Stack>

          </Box>
        </Box>

        <Box
          className="academy-right-panel"
          sx={{
            gridColumn: { xs: '1', lg: '1 / -1', xl: 'auto' },
            borderLeft: { xs: 'none', xl: 'var(--academy-hairline-width, 1px) solid rgba(245,166,35,0.15)' },
            borderTop: { xs: 'var(--academy-hairline-width, 1px) solid rgba(245,166,35,0.15)', xl: 'none' },
            background: 'linear-gradient(180deg, rgba(7,10,16,0.96) 0%, rgba(6,8,13,0.96) 100%)',
            p: { xs: 2, lg: 1.5 },
            minWidth: 0,
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            overflow: { xs: 'visible', xl: 'hidden' },
          }}
        >
          <Stack
            direction="row"
            spacing={1}
            sx={{
              mb: 1.1,
              minWidth: 0,
              rowGap: 0.45,
              flexWrap: 'wrap',
              '& > *': { flexShrink: 0, whiteSpace: 'nowrap' },
            }}
          >
            {([
              ['module', 'Module Manager'],
              ['schedule', 'Schedule'],
              ['prerequisites', 'Prerequisites'],
              ['localization', 'Localization'],
            ] as const).map(([key, _label]) => (
              <Button
                key={key}
                onClick={() => setRightTab(key)}
                sx={{
                  textTransform: 'none',
                  color: rightTab === key ? '#ffe3b8' : 'rgba(244,237,225,0.62)',
                  borderBottom: rightTab === key ? '2px solid #f5a623' : '2px solid transparent',
                  borderRadius: 0,
                  minWidth: 0,
                  px: 0,
                  mr: 1.5,
                  fontFamily: 'Rajdhani, sans-serif',
                  fontWeight: rightTab === key ? 700 : 500,
                }}
              >
                {key === 'module'
                  ? tt('Kursarkitektur', 'Course Architecture')
                  : key === 'schedule'
                    ? tt('Planlegging', 'Schedule')
                    : key === 'prerequisites'
                      ? tt('Forutsetninger', 'Prerequisites')
                      : tt('Lokalisering', 'Localization')}
              </Button>
            ))}
          </Stack>

          <Box
            sx={{
              border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.14)',
              borderRadius: '10px',
              p: 1.2,
              background: 'rgba(8,12,18,0.85)',
            }}
          >
            {rightTab === 'module' && (
              <Box>
                <TextField
                  label={tt('Modultittel', 'Module Title')}
                  value={activeModule?.title || ''}
                  onChange={(event) => {
                    const value = event.target.value;
                    updateActiveModule((module) => ({ ...module, title: value }));
                  }}
                  fullWidth
                  size="small"
                  sx={{
                    mb: 1.2,
                    '& .MuiOutlinedInput-root': {
                      color: '#f4ede1',
                      borderRadius: '8px',
                      '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
                    },
                    '& .MuiInputLabel-root': { color: 'rgba(244,237,225,0.68)' },
                  }}
                />

                <TextField
                  label={tt('Beskrivelse', 'Description')}
                  value={activeModule?.description || ''}
                  onChange={(event) => {
                    const value = event.target.value;
                    updateActiveModule((module) => ({ ...module, description: value }));
                  }}
                  fullWidth
                  multiline
                  minRows={3}
                  size="small"
                  sx={{
                    mb: 1.2,
                    '& .MuiOutlinedInput-root': {
                      color: '#f4ede1',
                      borderRadius: '8px',
                      '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
                    },
                    '& .MuiInputLabel-root': { color: 'rgba(244,237,225,0.68)' },
                  }}
                />

                <Button
                  startIcon={<Add />}
                  onClick={addLesson}
                  sx={{
                    textTransform: 'none',
                    color: '#1f1304',
                    borderRadius: '8px',
                    px: 2,
                    background: 'linear-gradient(180deg, #ffd36d 0%, #f5a623 100%)',
                  }}
                >
                  {tt('Legg til leksjon', 'Add Lesson')}
                </Button>
              </Box>
            )}

            {rightTab === 'schedule' && (
              <Box>
                <Typography sx={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '1.8rem', mb: 0.8 }}>
                  {tt('Publiseringsdato', 'Release Date')}
                </Typography>

                <Stack spacing={1.1} sx={{ mb: 1.2 }}>
                  <Button
                    onClick={() => {
                      setScheduleMode('manual');
                      updateActiveModule((module) => ({ ...module, releaseMode: 'manual' }));
                    }}
                    sx={{
                      justifyContent: 'flex-start',
                      textTransform: 'none',
                      color: scheduleMode === 'manual' ? '#ffe3b8' : 'rgba(244,237,225,0.72)',
                      border: `var(--academy-hairline-width, 1px) solid ${scheduleMode === 'manual' ? 'rgba(245,166,35,0.42)' : 'rgba(255,255,255,0.2)'}`,
                      borderRadius: '8px',
                    }}
                  >
                    {scheduleMode === 'manual' ? '●' : '○'} {tt('Aktiver publisering manuelt', 'Manually Enable Release')}
                  </Button>

                  <Button
                    onClick={() => {
                      setScheduleMode('scheduled');
                      updateActiveModule((module) => ({ ...module, releaseMode: 'scheduled' }));
                    }}
                    sx={{
                      justifyContent: 'flex-start',
                      textTransform: 'none',
                      color: scheduleMode === 'scheduled' ? '#ffe3b8' : 'rgba(244,237,225,0.72)',
                      border: `var(--academy-hairline-width, 1px) solid ${scheduleMode === 'scheduled' ? 'rgba(245,166,35,0.42)' : 'rgba(255,255,255,0.2)'}`,
                      borderRadius: '8px',
                    }}
                  >
                    {scheduleMode === 'scheduled' ? '●' : '○'} {tt('Planlegg publisering', 'Schedule Release')}
                  </Button>
                </Stack>

                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                  <TextField
                    type="datetime-local"
                    value={activeModule?.releaseDate || new Date().toISOString().slice(0, 16)}
                    onChange={(event) => {
                      const value = event.target.value;
                      updateActiveModule((module) => ({ ...module, releaseDate: value }));
                    }}
                    size="small"
                    sx={{
                      flex: 1,
                      '& .MuiOutlinedInput-root': {
                        color: '#f4ede1',
                        borderRadius: '8px',
                        '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
                      },
                    }}
                  />
                  <Select
                    value={timezone}
                    onChange={(event) => setTimezone(String(event.target.value))}
                    size="small"
                    sx={{
                      minWidth: 110,
                      color: '#f4ede1',
                      borderRadius: '8px',
                      '& .MuiOutlinedInput-notchedOutline': {
                        borderColor: 'rgba(255,255,255,0.2)',
                      },
                    }}
                  >
                    <MenuItem value="(UTC+2)">(UTC+2)</MenuItem>
                    <MenuItem value="(UTC+1)">(UTC+1)</MenuItem>
                    <MenuItem value="(UTC)">(UTC)</MenuItem>
                  </Select>
                </Stack>

                <Box
                  sx={{
                    mt: 1.2,
                    border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.12)',
                    borderRadius: '8px',
                    p: 1,
                    background: placeholderBackdrops[2],
                  }}
                >
                  <Typography sx={{ fontFamily: 'Rajdhani, sans-serif', opacity: 0.82 }}>
                    {tt('Modulen blir publisert', 'The module will be released on')}
                  </Typography>
                  <Typography sx={{ fontFamily: 'Rajdhani, sans-serif', fontWeight: 700 }}>
                    {activeModule?.releaseDate
                      ? new Date(activeModule.releaseDate).toLocaleString()
                      : tt('Ikke planlagt', 'Not scheduled')}{' '}
                    {timezone}
                  </Typography>
                </Box>
              </Box>
            )}

            {rightTab === 'prerequisites' && (
              <Box>
                <Typography sx={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '1.8rem', mb: 0.6 }}>
                  {tt('Forutsetninger', 'Prerequisites')}
                </Typography>
                <Typography sx={{ fontFamily: 'Rajdhani, sans-serif', opacity: 0.74, mb: 1.2 }}>
                  {tt(
                    'Velg hvilke moduler som må fullføres før denne modulen blir tilgjengelig.',
                    'Select which modules must be completed before this module becomes available.',
                  )}
                </Typography>

                {prerequisiteOptions.length === 0 ? (
                  <Box
                    sx={{
                      border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.14)',
                      borderRadius: '8px',
                      p: 1.1,
                      bgcolor: 'rgba(255,255,255,0.04)',
                    }}
                  >
                    <Typography sx={{ fontFamily: 'Rajdhani, sans-serif', opacity: 0.78 }}>
                      {tt('Ingen andre moduler tilgjengelig ennå.', 'No other modules available yet.')}
                    </Typography>
                  </Box>
                ) : (
                  <Stack spacing={0.9}>
                    {prerequisiteOptions.map((module) => {
                      const selected = activePrerequisiteIds.includes(module.id);
                      return (
                        <Button
                          key={module.id}
                          onClick={() => togglePrerequisiteModule(module.id)}
                          sx={{
                            justifyContent: 'space-between',
                            textTransform: 'none',
                            color: selected ? '#ffe3b8' : 'rgba(244,237,225,0.82)',
                            border: `var(--academy-hairline-width, 1px) solid ${selected ? 'rgba(245,166,35,0.42)' : 'rgba(255,255,255,0.2)'}`,
                            borderRadius: '8px',
                            px: 1.2,
                            py: 0.75,
                          }}
                        >
                          <Typography sx={{ fontFamily: 'Rajdhani, sans-serif', fontWeight: 600, textAlign: 'left' }}>
                            {module.title}
                          </Typography>
                          <Typography sx={{ fontFamily: 'Rajdhani, sans-serif', opacity: 0.82 }}>
                            {selected ? tt('Aktiv', 'Active') : tt('Inaktiv', 'Inactive')}
                          </Typography>
                        </Button>
                      );
                    })}
                  </Stack>
                )}

                <Typography sx={{ fontFamily: 'Rajdhani, sans-serif', opacity: 0.74, mt: 1.2 }}>
                  {tt('Valgte forutsetninger', 'Selected prerequisites')}: {activePrerequisiteIds.length}
                </Typography>
              </Box>
            )}

            {rightTab === 'localization' && (
              <Box>
                <Typography sx={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '1.8rem', mb: 0.8 }}>
                  {tt('Lokalisering', 'Localization')}
                </Typography>
                <Select
                  value={activeLocale}
                  onChange={(event) => setActiveLocale(String(event.target.value))}
                  size="small"
                  sx={{
                    mb: 1.2,
                    minWidth: 150,
                    color: '#f4ede1',
                    borderRadius: '8px',
                    '& .MuiOutlinedInput-notchedOutline': {
                      borderColor: 'rgba(255,255,255,0.2)',
                    },
                  }}
                >
                  <MenuItem value="nb-NO">Norsk (nb-NO)</MenuItem>
                  <MenuItem value="en-US">English (en-US)</MenuItem>
                  <MenuItem value="de-DE">Deutsch (de-DE)</MenuItem>
                </Select>

                <TextField
                  label={tt('Lokalisert tittel', 'Localized title')}
                  value={activeLocalizationDraft.title}
                  onChange={(event) => updateLocalizationDraft('title', event.target.value)}
                  fullWidth
                  size="small"
                  sx={{
                    mb: 1.2,
                    '& .MuiOutlinedInput-root': {
                      color: '#f4ede1',
                      borderRadius: '8px',
                      '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
                    },
                    '& .MuiInputLabel-root': { color: 'rgba(244,237,225,0.68)' },
                  }}
                />

                <TextField
                  label={tt('Lokalisert beskrivelse', 'Localized description')}
                  value={activeLocalizationDraft.description}
                  onChange={(event) => updateLocalizationDraft('description', event.target.value)}
                  fullWidth
                  multiline
                  minRows={3}
                  size="small"
                  sx={{
                    mb: 1.2,
                    '& .MuiOutlinedInput-root': {
                      color: '#f4ede1',
                      borderRadius: '8px',
                      '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
                    },
                    '& .MuiInputLabel-root': { color: 'rgba(244,237,225,0.68)' },
                  }}
                />

                <Button
                  onClick={() =>
                    updateActiveModule((module) => ({
                      ...module,
                      title: activeLocalizationDraft.title,
                      description: activeLocalizationDraft.description,
                    }))
                  }
                  disabled={activeLocale !== 'nb-NO'}
                  sx={{
                    textTransform: 'none',
                    color: activeLocale === 'nb-NO' ? '#1f1304' : 'rgba(244,237,225,0.55)',
                    borderRadius: '8px',
                    px: 2,
                    bgcolor: activeLocale === 'nb-NO' ? '#f5a623' : 'rgba(255,255,255,0.1)',
                  }}
                >
                  {tt('Synk til modulinnhold', 'Sync to module content')}
                </Button>

                <Typography sx={{ fontFamily: 'Rajdhani, sans-serif', opacity: 0.74, mt: 1.1 }}>
                  {activeLocale === 'nb-NO'
                    ? tt(
                        'Norsk lokalisering kan synkroniseres direkte med hovedinnholdet.',
                        'Norwegian localization can be synced directly with the primary content.',
                      )
                    : tt(
                        'Andre språk lagres som utkast i editoren.',
                        'Other languages are stored as drafts in this editor.',
                      )}
                </Typography>
              </Box>
            )}

            <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)', my: 1.2 }} />

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mt: 1.4 }}>
              <Button
                onClick={() => setLocation('/academy/course-creator')}
                sx={{
                  textTransform: 'none',
                  color: '#f4ede1',
                  borderRadius: '8px',
                  border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.2)',
                  flex: 1,
                }}
              >
                {tt('Avbryt', 'Cancel')}
              </Button>
            </Stack>

            <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)', my: 1.2 }} />

            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography sx={{ fontFamily: 'Rajdhani, sans-serif', opacity: 0.8 }}>{tt('Moduler', 'Modules')}</Typography>
              <Typography sx={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '1.6rem' }}>
                {moduleItems.length}
              </Typography>
            </Stack>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 0.8 }}>
              <Typography sx={{ fontFamily: 'Rajdhani, sans-serif', opacity: 0.8 }}>{navLabel('Lessons')}</Typography>
              <Typography sx={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '1.6rem' }}>
                {moduleItems.reduce((sum, module) => sum + module.lessons.length, 0)}
              </Typography>
            </Stack>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 0.8 }}>
              <Typography sx={{ fontFamily: 'Rajdhani, sans-serif', opacity: 0.8 }}>{tt('Fullføring', 'Completion')}</Typography>
              <Typography sx={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '1.6rem' }}>
                {completionRate}%
              </Typography>
            </Stack>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

export default withUniversalIntegration(ModuleManager, {
  componentId: 'module-manager',
  componentName: 'Module Manager',
  componentType: 'editor',
  componentCategory: 'academy',
  featureIds: ['module-management', 'lesson-creation', 'course-management'],
});
