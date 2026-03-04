import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  alpha,
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
  ArrowBack,
  Campaign,
  Delete,
  DragIndicator,
  Edit,
  MailOutline,
  MonetizationOn,
  Movie,
  MoreHoriz,
  NotificationsNone,
  PlayArrow,
  Publish,
  Quiz,
  Save,
  Search,
  Subtitles,
} from '@mui/icons-material';
import { useLocation } from 'wouter';
import { useAcademy } from '@/contexts/AcademyContext';
import { useEnhancedMasterIntegration } from '@/integration/EnhancedMasterIntegrationProvider';
import { withUniversalIntegration } from '@/integration/UniversalIntegrationHOC';
import { useAcademyLocale } from './academyLocale';
import AcademyBrandMark from './AcademyBrandMark';
import AcademyVideoPlayer from './AcademyVideoPlayer';

interface CourseCreatorProps {
  courseId?: string;
  onSave?: (course: any) => void;
  onCancel?: () => void;
}

interface CreatorLesson {
  id: string;
  title: string;
  duration: number;
  videoUrl: string;
  thumbnail: string;
  isPreview: boolean;
  resources: any[];
}

interface CreatorModule {
  id: string;
  title: string;
  collapsed: boolean;
  lessons: CreatorLesson[];
}

type AcademyTextFn = (no: string, en: string) => string;

const fallbackCourseTitle = 'Directing Masterclass';

const createLesson = (title: string, durationMin: number): CreatorLesson => ({
  id: `lesson-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  title,
  duration: durationMin * 60,
  videoUrl: '/assets/academy/intro-video.mp4',
  thumbnail: '',
  isPreview: false,
  resources: [],
});

const createDefaultModules = (tt: AcademyTextFn): CreatorModule[] => [
  {
    id: `module-${Date.now()}-1`,
    title: tt('Modul 1: Grunnlag', 'Module 1: Foundations'),
    collapsed: false,
    lessons: [
      createLesson(tt('Introduksjon', 'Introduction'), 17),
      createLesson(tt('Lyssetting grunnleggende', 'Lighting Basics'), 5),
      createLesson(tt('Praktisk oppsett', 'Practical Setup'), 10),
    ],
  },
  {
    id: `module-${Date.now()}-2`,
    title: tt('Modul 2: Avanserte teknikker', 'Module 2: Advanced Techniques'),
    collapsed: true,
    lessons: [createLesson(tt('Avansert shot-planlegging', 'Advanced Shot Planning'), 12)],
  },
  {
    id: `module-${Date.now()}-3`,
    title: tt('Modul 3: Instruksjon av skuespillere', 'Module 3: Directing Actors'),
    collapsed: true,
    lessons: [createLesson(tt('Blocking og notater', 'Blocking and Performance Notes'), 11)],
  },
];

const placeholderBackgrounds = [
  'linear-gradient(145deg, rgba(26,30,40,0.88), rgba(12,16,24,0.96)), radial-gradient(circle at 85% 15%, rgba(245,165,35,0.35), rgba(0,0,0,0))',
  'linear-gradient(145deg, rgba(20,25,34,0.9), rgba(11,14,20,0.96)), radial-gradient(circle at 15% 80%, rgba(245,165,35,0.2), rgba(0,0,0,0))',
  'linear-gradient(145deg, rgba(18,22,31,0.9), rgba(9,13,20,0.95)), radial-gradient(circle at 78% 8%, rgba(116,158,224,0.25), rgba(0,0,0,0))',
];

function CourseCreator({ courseId, onSave, onCancel }: CourseCreatorProps) {
  const [, setLocation] = useLocation();
  const { createCourse, updateCourse, getCourse } = useAcademy();
  const { analytics, debugging } = useEnhancedMasterIntegration();
  const { tt, navLabel } = useAcademyLocale();

  const [leftNav, setLeftNav] = useState('curriculum');
  const [centerTab, setCenterTab] = useState<'curriculum' | 'settings' | 'lessons' | 'media'>('curriculum');
  const [rightTab, setRightTab] = useState<'settings' | 'details' | 'pricing'>('settings');
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string>('');
  const [previewMode, setPreviewMode] = useState(false);

  const [course, setCourse] = useState<any>({
    id: courseId || '',
    title: fallbackCourseTitle,
    description: 'Practical directing workflows for cinematic productions.',
    instructor: {
      id: 'current-user',
      name: 'CreatorHub Instructor',
      avatar: '',
      bio: 'Creative director and filmmaker',
      profession: 'videographer',
    },
    thumbnail: '',
    videoUrl: '/assets/academy/intro-video.mp4',
    duration: 0,
    level: 'advanced',
    category: 'videography',
    tags: ['directing', 'filmmaking', 'cinematography'],
    price: 36984,
    isFree: false,
    isPublished: false,
    rating: 4.42,
    studentCount: 120,
    lessons: [],
    prerequisites: [],
    learningOutcomes: [],
    resources: [],
  });

  const [modules, setModules] = useState<CreatorModule[]>(() => createDefaultModules(tt));

  useEffect(() => {
    if (!courseId) return;
    const existing = getCourse(courseId);
    if (!existing) return;

    setCourse((prev: any) => ({
      ...prev,
      ...existing,
      instructor: existing.instructor || prev.instructor,
      tags: Array.isArray(existing.tags) ? existing.tags : prev.tags,
    }));

    const existingLessons = Array.isArray(existing.lessons) ? existing.lessons : [];
    if (existingLessons.length > 0) {
      const moduleFromExisting: CreatorModule = {
        id: `module-${existing.id}`,
        title: tt('Modul 1: Importerte leksjoner', 'Module 1: Imported Lessons'),
        collapsed: false,
        lessons: existingLessons.map((lesson: any) => ({
          id: String(lesson.id),
          title: String(lesson.title || tt('Leksjon uten tittel', 'Untitled Lesson')),
          duration: Number(lesson.duration || 0),
          videoUrl: lesson.videoUrl || '/assets/academy/intro-video.mp4',
          thumbnail: '',
          isPreview: Boolean(lesson.isPreview),
          resources: Array.isArray(lesson.resources) ? lesson.resources : [],
        })),
      };
      setModules([moduleFromExisting]);
    }
  }, [courseId, getCourse, tt]);

  const flattenedLessons = useMemo(() => {
    return modules.flatMap((module, moduleIndex) =>
      module.lessons.map((lesson, lessonIndex) => ({
        ...lesson,
        courseId: course.id || courseId || 'temp-course',
        order: moduleIndex * 100 + lessonIndex,
      })),
    );
  }, [modules, course.id, courseId]);

  const completionRate = useMemo(() => {
    if (flattenedLessons.length === 0) return 0;
    return Math.min(100, Math.round((flattenedLessons.length * 17 + course.tags.length * 4) % 100));
  }, [flattenedLessons.length, course.tags.length]);

  const totalDurationMinutes = useMemo(() => {
    return Math.round(flattenedLessons.reduce((sum, lesson) => sum + Number(lesson.duration || 0), 0) / 60);
  }, [flattenedLessons]);

  const previewCourse = useMemo(() => {
    return {
      ...course,
      lessons: flattenedLessons,
      duration: totalDurationMinutes,
      isPublished: course.isPublished,
    };
  }, [course, flattenedLessons, totalDurationMinutes]);

  const previewLesson = flattenedLessons[0] || null;

  const addModule = useCallback(() => {
    setModules((prev) => [
      ...prev,
      {
        id: `module-${Date.now()}-${prev.length + 1}`,
        title: `${tt('Modul', 'Module')} ${prev.length + 1}: ${tt('Ny modul', 'New Module')}`,
        collapsed: false,
        lessons: [createLesson(tt('Ny leksjon', 'New Lesson'), 8)],
      },
    ]);
  }, [tt]);

  const addLessonToModule = useCallback((moduleId: string) => {
    setModules((prev) =>
      prev.map((module) => {
        if (module.id !== moduleId) return module;
        return {
          ...module,
          lessons: [...module.lessons, createLesson(tt('Ny leksjon', 'New Lesson'), 7)],
        };
      }),
    );
  }, [tt]);

  const updateLessonField = useCallback((moduleId: string, lessonId: string, field: keyof CreatorLesson, value: string | number | boolean) => {
    setModules((prev) =>
      prev.map((module) => {
        if (module.id !== moduleId) return module;
        return {
          ...module,
          lessons: module.lessons.map((lesson) => {
            if (lesson.id !== lessonId) return lesson;
            return { ...lesson, [field]: value };
          }),
        };
      }),
    );
  }, []);

  const removeLesson = useCallback((moduleId: string, lessonId: string) => {
    setModules((prev) =>
      prev.map((module) => {
        if (module.id !== moduleId) return module;
        return {
          ...module,
          lessons: module.lessons.filter((lesson) => lesson.id !== lessonId),
        };
      }),
    );
  }, []);

  const toggleModuleCollapsed = useCallback((moduleId: string) => {
    setModules((prev) =>
      prev.map((module) => (module.id === moduleId ? { ...module, collapsed: !module.collapsed } : module)),
    );
  }, []);

  const saveCourse = useCallback(
    async (publish: boolean) => {
      setSaving(true);
      setSaveMessage('');
      try {
        const payload = {
          ...course,
          title: course.title || fallbackCourseTitle,
          lessons: flattenedLessons,
          duration: totalDurationMinutes,
          isPublished: publish ? true : course.isPublished,
          updatedAt: new Date().toISOString(),
        };

        if (courseId || course.id) {
          const id = course.id || courseId;
          await updateCourse({ ...payload, id, createdAt: payload.createdAt || new Date().toISOString() });
          setCourse((prev: any) => ({ ...prev, id, isPublished: publish ? true : prev.isPublished }));
        } else {
          const created = await createCourse(payload);
          setCourse((prev: any) => ({ ...prev, ...created }));
        }

        const message = publish ? tt('Kurs publisert.', 'Course published.') : tt('Utkast lagret.', 'Draft saved.');
        setSaveMessage(message);
        analytics.trackEvent(publish ? 'course_creator_publish' : 'course_creator_save', {
          courseTitle: payload.title,
          lessonCount: payload.lessons.length,
          moduleCount: modules.length,
        });
        onSave?.(payload);
      } catch (error) {
        const message = error instanceof Error ? error.message : tt('Kunne ikke lagre kurs.', 'Failed to save course.');
        setSaveMessage(message);
        debugging.logIntegration('error', 'Course creator save failed', { error: message });
      } finally {
        setSaving(false);
      }
    },
    [analytics, course, courseId, createCourse, debugging, flattenedLessons, modules.length, onSave, totalDurationMinutes, tt, updateCourse],
  );

  const addTag = useCallback(() => {
    const newTag = window.prompt(tt('Skriv inn ny tagg', 'Enter new tag'));
    if (!newTag) return;
    setCourse((prev: any) => {
      if (prev.tags.includes(newTag.trim().toLowerCase())) return prev;
      return { ...prev, tags: [...prev.tags, newTag.trim().toLowerCase()] };
    });
  }, [tt]);

  if (previewMode && previewLesson) {
    return (
      <Box sx={{ minHeight: '100vh', bgcolor: '#05080f' }}>
        <Box sx={{ px: 2, py: 1.5 }}>
          <Button
            startIcon={<ArrowBack />}
            onClick={() => setPreviewMode(false)}
            sx={{
              color: '#f8f1e7',
              textTransform: 'none',
              borderRadius: '8px',
              border: '1px solid rgba(245,166,35,0.4)',
            }}
          >
            {tt('Tilbake til kursredigering', 'Back to Course Creator')}
          </Button>
        </Box>
        <AcademyVideoPlayer course={previewCourse} lesson={previewLesson} />
      </Box>
    );
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        color: '#f4ede1',
        background:
          'radial-gradient(circle at 15% -5%, rgba(245,166,35,0.2), rgba(0,0,0,0) 38%), radial-gradient(circle at 85% 12%, rgba(70,101,150,0.23), rgba(0,0,0,0) 42%), linear-gradient(180deg, #060910 0%, #05070d 55%, #04060a 100%)',
      }}
    >
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: '260px 1fr 330px' },
          minHeight: '100vh',
          width: 'min(100%, var(--academy-shell-max-width, 1920px))',
          mx: 'auto',
        }}
      >
        <Box
          sx={{
            borderRight: '1px solid rgba(245,166,35,0.15)',
            background: 'linear-gradient(180deg, rgba(7,10,16,0.96) 0%, rgba(6,8,13,0.96) 100%)',
          }}
        >
          <Box sx={{ p: 2, borderBottom: '1px solid rgba(245,166,35,0.15)' }}>
            <AcademyBrandMark />
          </Box>

          <Box sx={{ p: 1.5 }}>
            <Button
              fullWidth
              startIcon={<Add />}
              onClick={() => {
                setCourse((prev: any) => ({ ...prev, title: tt('Nytt kursutkast', 'New Course Draft') }));
                setModules(createDefaultModules(tt));
              }}
              sx={{
                justifyContent: 'flex-start',
                textTransform: 'none',
                color: '#ffdca8',
                border: '1px solid rgba(245,166,35,0.35)',
                borderRadius: '8px',
                mb: 1.2,
              }}
            >
              {tt('Opprett nytt kurs', 'Create New Course')}
            </Button>

            <Stack spacing={0.6}>
              {[
                ['overview', 'Overview'],
                ['curriculum', 'Curriculum'],
                ['lessons', 'Lessons'],
                ['media', 'Media'],
                ['assignments', 'Assignments'],
                ['cohorts', 'Cohort Settings'],
                ['analytics', 'Analytics'],
                ['monetization', 'Monetization'],
                ['lowerthirds', 'Animated Lower Thirds'],
                ['settings', 'Settings'],
              ].map(([key, label]) => {
                const active = leftNav === key;
                return (
                  <Button
                    key={key}
                    onClick={() => {
                      setLeftNav(key);
                      const leftNavRoutes: Record<string, string> = {
                        overview: '/academy-dashboard',
                        curriculum: '/academy/curriculum',
                        lessons: '/academy/lesson-editor',
                        media: '/academy/media',
                        assignments: '/academy/assignments',
                        cohorts: '/academy/cohort-settings',
                        analytics: '/academy/analytics',
                        monetization: '/academy/monetization',
                        lowerthirds: '/academy/lower-thirds',
                        settings: '/academy/course-creator',
                      };
                      if (key === 'settings') {
                        setCenterTab(key as 'curriculum' | 'settings' | 'lessons' | 'media');
                        return;
                      }
                      const targetRoute = leftNavRoutes[key];
                      if (targetRoute) {
                        setLocation(targetRoute);
                      }
                    }}
                    sx={{
                      justifyContent: 'flex-start',
                      textTransform: 'none',
                      color: active ? '#ffe2b5' : 'rgba(244,237,225,0.74)',
                      borderRadius: '8px',
                      fontFamily: 'Rajdhani, sans-serif',
                      fontWeight: active ? 700 : 500,
                      background: active
                        ? 'linear-gradient(90deg, rgba(245,166,35,0.32) 0%, rgba(245,166,35,0.08) 100%)'
                        : 'transparent',
                      border: active ? '1px solid rgba(245,166,35,0.42)' : '1px solid transparent',
                    }}
                  >
                    {navLabel(label)}
                  </Button>
                );
              })}
            </Stack>
          </Box>

          <Box sx={{ mt: 'auto', p: 1.5, borderTop: '1px solid rgba(245,166,35,0.15)' }}>
            <Button
              fullWidth
              startIcon={<Add />}
              onClick={addModule}
              sx={{
                justifyContent: 'flex-start',
                textTransform: 'none',
                color: '#f4ede1',
                border: '1px solid rgba(255,255,255,0.18)',
                borderRadius: '8px',
              }}
            >
              {tt('Ny modul', 'New Module')}
            </Button>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column' }}>
          <Box
            sx={{
              px: { xs: 2, md: 3 },
              py: 1.4,
              borderBottom: '1px solid rgba(245,166,35,0.15)',
              background: 'rgba(7,10,16,0.72)',
              backdropFilter: 'blur(6px)',
            }}
          >
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ gap: 1, flexWrap: 'wrap' }}>
              <Stack direction="row" spacing={1.4} alignItems="center" sx={{ minWidth: 260, flex: 1 }}>
                <Typography sx={{ fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '0.11em', opacity: 0.78 }}>
                  CREATOR STUDIO
                </Typography>
                <TextField
                  size="small"
                  placeholder={tt('Søk moduler...', 'Search modules...')}
                  InputProps={{
                    startAdornment: (
                      <Box sx={{ display: 'flex', alignItems: 'center', mr: 0.8 }}>
                        <Search sx={{ fontSize: 18, color: 'rgba(244,237,225,0.65)' }} />
                      </Box>
                    ),
                  }}
                  sx={{
                    minWidth: 180,
                    '& .MuiOutlinedInput-root': {
                      color: '#f4ede1',
                      borderRadius: '8px',
                      background: 'rgba(8,12,18,0.7)',
                      '& fieldset': { borderColor: 'rgba(245,166,35,0.2)' },
                    },
                  }}
                />
              </Stack>

              <Stack direction="row" spacing={1} alignItems="center">
                <IconButton sx={{ color: 'rgba(244,237,225,0.75)' }}>
                  <NotificationsNone />
                </IconButton>
                <IconButton sx={{ color: 'rgba(244,237,225,0.75)' }}>
                  <MailOutline />
                </IconButton>
                <Avatar sx={{ width: 32, height: 32, bgcolor: '#24354d', border: '2px solid rgba(245,166,35,0.58)' }}>C</Avatar>
              </Stack>
            </Stack>
          </Box>

          <Box sx={{ px: { xs: 2, md: 3 }, py: 1.5, borderBottom: '1px solid rgba(245,166,35,0.14)' }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ gap: 1, flexWrap: 'wrap' }}>
              <Stack direction="row" spacing={1.4} alignItems="center" sx={{ minWidth: 260 }}>
                <TextField
                  value={course.title}
                  onChange={(event) => setCourse((prev: any) => ({ ...prev, title: event.target.value }))}
                  variant="standard"
                  InputProps={{ disableUnderline: true }}
                  sx={{
                    '& .MuiInputBase-input': {
                      fontFamily: 'Barlow Condensed, sans-serif',
                      fontSize: { xs: '1.8rem', md: '2.2rem' },
                      color: '#f4ede1',
                      lineHeight: 1,
                    },
                  }}
                />
                <Chip
                  size="small"
                  label={course.isPublished ? tt('Publisert', 'Published') : tt('Utkast', 'Draft')}
                  sx={{
                    bgcolor: course.isPublished ? alpha('#f5a623', 0.26) : alpha('#9aa5b6', 0.2),
                    color: '#f4ede1',
                    border: '1px solid rgba(255,255,255,0.2)',
                    fontFamily: 'Rajdhani, sans-serif',
                    fontWeight: 700,
                  }}
                />
              </Stack>

              <Stack direction="row" spacing={1} alignItems="center">
                <Button
                  startIcon={<Add />}
                  onClick={() => setLocation('/academy/module-manager')}
                  sx={{
                    textTransform: 'none',
                    color: '#f4ede1',
                    borderRadius: '8px',
                    border: '1px solid rgba(245,166,35,0.35)',
                    px: 2,
                  }}
                >
                  {tt('Moduladministrator', 'Module Manager')}
                </Button>
                <Button
                  startIcon={<Edit />}
                  onClick={() => setLocation('/academy/lesson-editor')}
                  sx={{
                    textTransform: 'none',
                    color: '#f4ede1',
                    borderRadius: '8px',
                    border: '1px solid rgba(245,166,35,0.35)',
                    px: 2,
                  }}
                >
                  {tt('Leksjonsredigering', 'Lesson Editor')}
                </Button>
                <Button
                  startIcon={<Add />}
                  onClick={() => setLocation('/academy/cohort-settings')}
                  sx={{
                    textTransform: 'none',
                    color: '#f4ede1',
                    borderRadius: '8px',
                    border: '1px solid rgba(245,166,35,0.35)',
                    px: 2,
                  }}
                >
                  {tt('Kohortinnstillinger', 'Cohort Settings')}
                </Button>
                <Button
                  startIcon={<Edit />}
                  onClick={() => setLocation('/academy/annotation-editor')}
                  sx={{
                    textTransform: 'none',
                    color: '#f4ede1',
                    borderRadius: '8px',
                    border: '1px solid rgba(245,166,35,0.35)',
                    px: 2,
                  }}
                >
                  {tt('Annotering', 'Annotation')}
                </Button>
                <Button
                  startIcon={<Quiz />}
                  onClick={() => setLocation('/academy/quiz-manager')}
                  sx={{
                    textTransform: 'none',
                    color: '#f4ede1',
                    borderRadius: '8px',
                    border: '1px solid rgba(245,166,35,0.35)',
                    px: 2,
                  }}
                >
                  {tt('Quiz', 'Quiz')}
                </Button>
                <Button
                  startIcon={<Quiz />}
                  onClick={() => setLocation('/academy/assignments')}
                  sx={{
                    textTransform: 'none',
                    color: '#f4ede1',
                    borderRadius: '8px',
                    border: '1px solid rgba(245,166,35,0.35)',
                    px: 2,
                  }}
                >
                  {tt('Oppgaver', 'Assignments')}
                </Button>
                <Button
                  startIcon={<Campaign />}
                  onClick={() => setLocation('/academy/cta-overlay')}
                  sx={{
                    textTransform: 'none',
                    color: '#f4ede1',
                    borderRadius: '8px',
                    border: '1px solid rgba(245,166,35,0.35)',
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
                    border: '1px solid rgba(245,166,35,0.35)',
                    px: 2,
                  }}
                >
                  {tt('LowerThirds', 'LowerThirds')}
                </Button>
                <Button
                  startIcon={<Movie />}
                  onClick={() => setLocation('/academy/video-player')}
                  sx={{
                    textTransform: 'none',
                    color: '#f4ede1',
                    borderRadius: '8px',
                    border: '1px solid rgba(245,166,35,0.35)',
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
                    border: '1px solid rgba(245,166,35,0.35)',
                    px: 2,
                  }}
                >
                  {tt('Monetiser', 'Monetize')}
                </Button>
                <Button
                  startIcon={<PlayArrow />}
                  onClick={() => setPreviewMode(true)}
                  sx={{
                    textTransform: 'none',
                    color: '#f4ede1',
                    borderRadius: '8px',
                    border: '1px solid rgba(255,255,255,0.22)',
                    px: 2,
                  }}
                >
                  {tt('Forhåndsvis', 'Preview')}
                </Button>
                <Button
                  startIcon={<Save />}
                  onClick={() => void saveCourse(false)}
                  disabled={saving}
                  sx={{
                    textTransform: 'none',
                    color: '#f4ede1',
                    borderRadius: '8px',
                    border: '1px solid rgba(255,255,255,0.22)',
                    px: 2,
                  }}
                >
                  {tt('Lagre', 'Save')}
                </Button>
                <Button
                  startIcon={<Publish />}
                  onClick={() => void saveCourse(true)}
                  disabled={saving}
                  sx={{
                    textTransform: 'none',
                    borderRadius: '8px',
                    px: 2,
                    color: '#1f1304',
                    fontWeight: 700,
                    background: 'linear-gradient(180deg, #ffd36d 0%, #f5a623 100%)',
                    '&:hover': { background: 'linear-gradient(180deg, #ffe08d 0%, #f6b640 100%)' },
                  }}
                >
                  {tt('Publiser', 'Publish')}
                </Button>
              </Stack>
            </Stack>

            <Stack direction="row" spacing={2} sx={{ mt: 1.2 }}>
              {[
                ['curriculum', 'Curriculum'],
                ['settings', 'Settings'],
                ['lessons', 'Lessons'],
                ['media', 'Media'],
              ].map(([key, label]) => (
                <Button
                  key={key}
                  onClick={() => setCenterTab(key as 'curriculum' | 'settings' | 'lessons' | 'media')}
                  sx={{
                    textTransform: 'none',
                    color: centerTab === key ? '#ffe3b8' : 'rgba(244,237,225,0.6)',
                    borderBottom: centerTab === key ? '2px solid #f5a623' : '2px solid transparent',
                    borderRadius: 0,
                    px: 0,
                    minWidth: 0,
                    fontFamily: 'Rajdhani, sans-serif',
                    fontWeight: centerTab === key ? 700 : 500,
                  }}
                >
                  {navLabel(label)}
                </Button>
              ))}
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
                  border: '1px solid rgba(245,166,35,0.3)',
                  background: 'rgba(245,166,35,0.08)',
                  color: '#ffdca8',
                  fontFamily: 'Rajdhani, sans-serif',
                }}
              >
                {saveMessage}
              </Typography>
            )}

            {centerTab === 'curriculum' && (
              <Stack spacing={1.3}>
                {modules.map((module, moduleIndex) => {
                  const moduleProgress = Math.max(12, Math.round((module.lessons.length * 100) / Math.max(flattenedLessons.length, 1)));
                  return (
                    <Box
                      key={module.id}
                      sx={{
                        border: '1px solid rgba(255,255,255,0.14)',
                        borderRadius: '10px',
                        overflow: 'hidden',
                        background: 'rgba(8,12,18,0.78)',
                      }}
                    >
                      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 1.4, py: 1.1 }}>
                        <Stack direction="row" alignItems="center" spacing={1.1}>
                          <Button
                            onClick={() => toggleModuleCollapsed(module.id)}
                            sx={{
                              minWidth: 0,
                              px: 0.6,
                              color: 'rgba(244,237,225,0.8)',
                              textTransform: 'none',
                            }}
                          >
                            {module.collapsed ? '▸' : '▾'}
                          </Button>
                          <TextField
                            variant="standard"
                            value={module.title}
                            onChange={(event) => {
                              const value = event.target.value;
                              setModules((prev) =>
                                prev.map((item) => (item.id === module.id ? { ...item, title: value } : item)),
                              );
                            }}
                            InputProps={{ disableUnderline: true }}
                            sx={{
                              minWidth: 240,
                              '& .MuiInputBase-input': {
                                color: '#f4ede1',
                                fontSize: '1.15rem',
                                fontFamily: 'Barlow Condensed, sans-serif',
                              },
                            }}
                          />
                        </Stack>

                        <Stack direction="row" spacing={1} alignItems="center">
                          <Typography sx={{ fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, color: '#ffcf7d' }}>
                            {moduleProgress}%
                          </Typography>
                          <LinearProgress
                            variant="determinate"
                            value={moduleProgress}
                            sx={{
                              width: 130,
                              height: 6,
                              borderRadius: 999,
                              bgcolor: 'rgba(255,255,255,0.18)',
                              '& .MuiLinearProgress-bar': {
                                borderRadius: 999,
                                background: 'linear-gradient(90deg, #f5a623 0%, #ffd26a 100%)',
                              },
                            }}
                          />
                          <IconButton size="small" sx={{ color: 'rgba(244,237,225,0.68)' }}>
                            <MoreHoriz fontSize="small" />
                          </IconButton>
                        </Stack>
                      </Stack>

                      {!module.collapsed && (
                        <Box sx={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                          {module.lessons.map((lesson, lessonIndex) => (
                            <Stack
                              key={lesson.id}
                              direction="row"
                              spacing={1.2}
                              alignItems="center"
                              sx={{
                                px: 1.4,
                                py: 1.05,
                                borderBottom:
                                  lessonIndex === module.lessons.length - 1
                                    ? '1px solid rgba(255,255,255,0.06)'
                                    : '1px solid rgba(255,255,255,0.08)',
                              }}
                            >
                              <DragIndicator sx={{ fontSize: 18, color: 'rgba(244,237,225,0.4)' }} />
                              <Box
                                sx={{
                                  width: 180,
                                  minWidth: 180,
                                  height: 78,
                                  borderRadius: '7px',
                                  border: '1px solid rgba(255,255,255,0.12)',
                                  background: lesson.thumbnail
                                    ? `url(${lesson.thumbnail}) center / cover no-repeat`
                                    : placeholderBackgrounds[(moduleIndex + lessonIndex) % placeholderBackgrounds.length],
                                }}
                              />

                              <Box sx={{ flex: 1, minWidth: 0 }}>
                                <TextField
                                  variant="standard"
                                  value={lesson.title}
                                  onChange={(event) => updateLessonField(module.id, lesson.id, 'title', event.target.value)}
                                  InputProps={{ disableUnderline: true }}
                                  sx={{
                                    width: '100%',
                                    '& .MuiInputBase-input': {
                                      color: '#f4ede1',
                                      fontFamily: 'Barlow Condensed, sans-serif',
                                      fontSize: '1.45rem',
                                      lineHeight: 1,
                                    },
                                  }}
                                />

                                <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.4 }}>
                                  <TextField
                                    size="small"
                                    value={Math.round(lesson.duration / 60)}
                                    onChange={(event) => {
                                      const minutes = Number(event.target.value || 0);
                                      updateLessonField(module.id, lesson.id, 'duration', Math.max(0, minutes) * 60);
                                    }}
                                    sx={{
                                      width: 78,
                                      '& .MuiOutlinedInput-root': {
                                        color: '#f4ede1',
                                        borderRadius: '7px',
                                        fontFamily: 'Rajdhani, sans-serif',
                                        '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
                                      },
                                    }}
                                  />
                                  <Typography sx={{ opacity: 0.7, fontFamily: 'Rajdhani, sans-serif' }}>min</Typography>
                                  <Chip
                                    size="small"
                                    label={`L${lessonIndex + 1}`}
                                    sx={{
                                      bgcolor: alpha('#f5a623', 0.2),
                                      color: '#ffdca8',
                                      border: '1px solid rgba(245,166,35,0.28)',
                                      fontFamily: 'Rajdhani, sans-serif',
                                      fontWeight: 700,
                                    }}
                                  />
                                </Stack>
                              </Box>

                              <Typography sx={{ width: 56, textAlign: 'right', opacity: 0.86, fontFamily: 'Rajdhani, sans-serif' }}>
                                {(lesson.duration / 60).toFixed(0)}:{(lesson.duration % 60).toString().padStart(2, '0')}
                              </Typography>

                              <IconButton size="small" onClick={() => removeLesson(module.id, lesson.id)} sx={{ color: 'rgba(255,120,120,0.86)' }}>
                                <Delete fontSize="small" />
                              </IconButton>
                            </Stack>
                          ))}

                          <Button
                            startIcon={<Add />}
                            onClick={() => addLessonToModule(module.id)}
                            sx={{
                              justifyContent: 'flex-start',
                              width: '100%',
                              px: 1.4,
                              py: 1,
                              textTransform: 'none',
                              color: 'rgba(244,237,225,0.82)',
                              borderRadius: 0,
                              fontFamily: 'Rajdhani, sans-serif',
                            }}
                          >
                            {tt('Ny leksjon', 'New Lesson')}
                          </Button>
                        </Box>
                      )}
                    </Box>
                  );
                })}

                <Button
                  startIcon={<Add />}
                  onClick={addModule}
                  sx={{
                    alignSelf: 'center',
                    textTransform: 'none',
                    color: '#f4ede1',
                    borderRadius: '9px',
                    border: '1px solid rgba(255,255,255,0.2)',
                    px: 2.2,
                  }}
                >
                  {tt('Legg til modul', 'Add Module')}
                </Button>
              </Stack>
            )}

            {centerTab !== 'curriculum' && (
              <Box
                sx={{
                  border: '1px solid rgba(255,255,255,0.14)',
                  borderRadius: '10px',
                  p: 2,
                  background: 'rgba(8,12,18,0.8)',
                }}
              >
                <Typography sx={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '1.9rem', mb: 0.7 }}>
                  {centerTab === 'curriculum'
                    ? navLabel('Curriculum')
                    : centerTab === 'settings'
                      ? navLabel('Settings')
                      : centerTab === 'lessons'
                        ? navLabel('Lessons')
                        : navLabel('Media')}
                </Typography>
                <Typography sx={{ opacity: 0.75, fontFamily: 'Rajdhani, sans-serif' }}>
                  {tt(
                    'Eksisterende funksjonalitet er aktiv. Bruk Læreplan for full redigering av moduler og leksjoner.',
                    'Existing functionality is active. Use Curriculum for full module and lesson editing.',
                  )}
                </Typography>
              </Box>
            )}

            <Box
              sx={{
                mt: 2,
                border: '1px solid rgba(255,255,255,0.14)',
                borderRadius: '10px',
                overflow: 'hidden',
                background: 'rgba(8,12,18,0.75)',
              }}
            >
              <Box sx={{ px: 1.4, py: 1, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                <Typography sx={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '1.85rem' }}>
                  {tt('Ytelsesanalyse', 'Performance Analytics')}
                </Typography>
              </Box>

              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(4, 1fr)' }, gap: 1.2, p: 1.2 }}>
                {[
                  { label: tt('Totalt antall deltakere', 'Total Learners'), value: String(Math.max(825, course.studentCount * 7)) },
                  { label: tt('Gj.sn. seertid', 'Avg Watch Time'), value: `${Math.max(41, Math.min(95, completionRate))}%` },
                  { label: tt('Fullføringsrate', 'Completion Rate'), value: `${completionRate}%` },
                  { label: tt('Inntekt', 'Revenue'), value: `$${(course.price * Math.max(1, course.studentCount || 14) / 1000).toFixed(1)}k` },
                ].map((card, index) => (
                  <Box
                    key={card.label}
                    sx={{
                      border: '1px solid rgba(255,255,255,0.12)',
                      borderRadius: '8px',
                      p: 1.2,
                      minHeight: 130,
                      background: placeholderBackgrounds[index % placeholderBackgrounds.length],
                    }}
                  >
                    <Typography sx={{ opacity: 0.84, fontFamily: 'Rajdhani, sans-serif' }}>{card.label}</Typography>
                    <Typography sx={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '2rem', mt: 0.5 }}>{card.value}</Typography>
                    <Box sx={{ mt: 1.2, height: 36, borderRadius: '6px', background: 'rgba(0,0,0,0.25)' }} />
                  </Box>
                ))}
              </Box>
            </Box>
          </Box>
        </Box>

        <Box
          sx={{
            borderLeft: '1px solid rgba(245,166,35,0.15)',
            background: 'linear-gradient(180deg, rgba(7,10,16,0.96) 0%, rgba(6,8,13,0.96) 100%)',
            p: { xs: 2, lg: 1.5 },
          }}
        >
          <Stack direction="row" spacing={1} sx={{ mb: 1.1 }}>
            {(['settings', 'details', 'pricing'] as const).map((tab) => (
              <Button
                key={tab}
                onClick={() => setRightTab(tab)}
                sx={{
                  textTransform: 'none',
                  color: rightTab === tab ? '#ffe3b8' : 'rgba(244,237,225,0.62)',
                  borderBottom: rightTab === tab ? '2px solid #f5a623' : '2px solid transparent',
                  borderRadius: 0,
                  minWidth: 0,
                  px: 0,
                  mr: 1.5,
                  fontFamily: 'Rajdhani, sans-serif',
                  fontWeight: rightTab === tab ? 700 : 500,
                }}
              >
                {tab === 'settings'
                  ? navLabel('Settings')
                  : tab === 'details'
                    ? tt('Detaljer', 'Details')
                    : tt('Prising', 'Pricing')}
              </Button>
            ))}
            <IconButton size="small" sx={{ color: 'rgba(244,237,225,0.6)', ml: 'auto' }}>
              <MoreHoriz fontSize="small" />
            </IconButton>
          </Stack>

          <Box
            sx={{
              border: '1px solid rgba(255,255,255,0.14)',
              borderRadius: '10px',
              overflow: 'hidden',
              background: 'rgba(8,12,18,0.85)',
            }}
          >
            <Box sx={{ height: 172, background: placeholderBackgrounds[0] }} />
            <Box sx={{ p: 1.2 }}>
              <Typography sx={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '2rem', lineHeight: 0.95 }}>
                {course.title || fallbackCourseTitle}
              </Typography>
              <Stack direction="row" spacing={0.8} alignItems="center" sx={{ mt: 1 }}>
                <Typography sx={{ opacity: 0.72, fontFamily: 'Rajdhani, sans-serif' }}>NOK</Typography>
                <Typography sx={{ fontFamily: 'Rajdhani, sans-serif', fontWeight: 700 }}>{course.price}</Typography>
              </Stack>
            </Box>
          </Box>

          <Stack spacing={1.2} sx={{ mt: 1.5 }}>
            <TextField
              label={tt('Kategori', 'Category')}
              value={course.category}
              onChange={(event) => setCourse((prev: any) => ({ ...prev, category: event.target.value }))}
              select
              size="small"
              sx={{
                '& .MuiOutlinedInput-root': {
                  color: '#f4ede1',
                  borderRadius: '8px',
                  '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
                },
                '& .MuiInputLabel-root': { color: 'rgba(244,237,225,0.68)' },
              }}
            >
              {['photography', 'videography', 'music_production', 'lighting', 'business'].map((value) => (
                <MenuItem key={value} value={value}>
                  {value}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              label={tt('Nivå', 'Skill Level')}
              value={course.level}
              onChange={(event) => setCourse((prev: any) => ({ ...prev, level: event.target.value }))}
              select
              size="small"
              sx={{
                '& .MuiOutlinedInput-root': {
                  color: '#f4ede1',
                  borderRadius: '8px',
                  '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
                },
                '& .MuiInputLabel-root': { color: 'rgba(244,237,225,0.68)' },
              }}
            >
              {['beginner', 'intermediate', 'advanced'].map((value) => (
                <MenuItem key={value} value={value}>
                  {value}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              label={tt('Pris (NOK)', 'Price (NOK)')}
              value={course.price}
              onChange={(event) => setCourse((prev: any) => ({ ...prev, price: Number(event.target.value || 0) }))}
              size="small"
              sx={{
                '& .MuiOutlinedInput-root': {
                  color: '#f4ede1',
                  borderRadius: '8px',
                  '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
                },
                '& .MuiInputLabel-root': { color: 'rgba(244,237,225,0.68)' },
              }}
            />

            <Box>
              <Stack direction="row" spacing={0.8} flexWrap="wrap" sx={{ mb: 0.9 }}>
                {course.tags.map((tag: string) => (
                  <Chip
                    key={tag}
                    label={tag}
                    onDelete={() => setCourse((prev: any) => ({ ...prev, tags: prev.tags.filter((item: string) => item !== tag) }))}
                    sx={{
                      height: 24,
                      bgcolor: 'rgba(255,255,255,0.08)',
                      color: '#f4ede1',
                      border: '1px solid rgba(255,255,255,0.15)',
                      fontFamily: 'Rajdhani, sans-serif',
                    }}
                  />
                ))}
              </Stack>
              <Button
                startIcon={<Add />}
                onClick={addTag}
                sx={{
                  textTransform: 'none',
                  color: '#f4ede1',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '8px',
                  px: 1.2,
                }}
              >
                {tt('Legg til tagg', 'Add Tag')}
              </Button>
            </Box>

            <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)' }} />

            <Select
              value={course.isPublished ? 'published' : 'draft'}
              size="small"
              onChange={(event) => setCourse((prev: any) => ({ ...prev, isPublished: event.target.value === 'published' }))}
              sx={{
                color: '#f4ede1',
                borderRadius: '8px',
                '& .MuiOutlinedInput-notchedOutline': {
                  borderColor: 'rgba(255,255,255,0.2)',
                },
              }}
            >
              <MenuItem value="draft">{tt('Utkast', 'Draft')}</MenuItem>
              <MenuItem value="published">{tt('Publisert', 'Published')}</MenuItem>
            </Select>

            <Stack direction="row" spacing={1}>
              <Button
                variant="outlined"
                onClick={() => setCourse((prev: any) => ({ ...prev, isPublished: false }))}
                sx={{
                  textTransform: 'none',
                  color: '#f4ede1',
                  borderColor: 'rgba(255,255,255,0.2)',
                  borderRadius: '8px',
                  flex: 1,
                }}
              >
                {tt('Avpubliser', 'Unpublish')}
              </Button>
              <Button
                variant="outlined"
                onClick={() => setCourse((prev: any) => ({ ...prev, title: `${prev.title} (Copy)` }))}
                sx={{
                  textTransform: 'none',
                  color: '#f4ede1',
                  borderColor: 'rgba(255,255,255,0.2)',
                  borderRadius: '8px',
                  flex: 1,
                }}
              >
                {tt('Dupliser', 'Duplicate')}
              </Button>
              <Button
                variant="outlined"
                onClick={() => {
                  setModules(createDefaultModules(tt));
                  setCourse((prev: any) => ({ ...prev, lessons: [] }));
                }}
                sx={{
                  textTransform: 'none',
                  color: '#ffb2b2',
                  borderColor: 'rgba(255,120,120,0.3)',
                  borderRadius: '8px',
                  flex: 1,
                }}
              >
                {tt('Slett', 'Delete')}
              </Button>
            </Stack>

            <Box
              sx={{
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: '8px',
                p: 1.1,
                background: 'rgba(8,12,18,0.9)',
              }}
            >
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography sx={{ fontFamily: 'Rajdhani, sans-serif', opacity: 0.8 }}>
                  {navLabel('Lessons')}
                </Typography>
                <Typography sx={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '1.6rem' }}>
                  {flattenedLessons.length}
                </Typography>
              </Stack>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 0.8 }}>
                <Typography sx={{ fontFamily: 'Rajdhani, sans-serif', opacity: 0.8 }}>
                  {tt('Deltakere', 'Learners')}
                </Typography>
                <Typography sx={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '1.6rem' }}>
                  {Math.max(course.studentCount, 120)}
                </Typography>
              </Stack>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 0.8 }}>
                <Typography sx={{ fontFamily: 'Rajdhani, sans-serif', opacity: 0.8 }}>
                  {tt('Fullføring', 'Completion')}
                </Typography>
                <Typography sx={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '1.6rem' }}>
                  {completionRate}%
                </Typography>
              </Stack>
            </Box>
          </Stack>

          <Stack direction="row" spacing={1.1} sx={{ mt: 2 }}>
            <Button
              startIcon={<ArrowBack />}
              onClick={onCancel}
              sx={{
                textTransform: 'none',
                color: '#f4ede1',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: '8px',
                flex: 1,
              }}
            >
              {tt('Tilbake', 'Back')}
            </Button>
            <Button
              startIcon={<Save />}
              onClick={() => void saveCourse(false)}
              disabled={saving}
              sx={{
                textTransform: 'none',
                color: '#1f1304',
                borderRadius: '8px',
                flex: 1,
                background: 'linear-gradient(180deg, #ffd36d 0%, #f5a623 100%)',
              }}
            >
              {tt('Lagre utkast', 'Save Draft')}
            </Button>
          </Stack>
        </Box>
      </Box>
    </Box>
  );
}

export default withUniversalIntegration(CourseCreator, {
  componentId: 'academy-course-creator',
  componentName: 'Academy Course Creator',
  componentType: 'editor',
  componentCategory: 'academy',
  featureIds: ['course-creation', 'lesson-creation', 'course-management'],
});
