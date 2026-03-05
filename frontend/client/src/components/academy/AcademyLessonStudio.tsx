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
  Slider,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import {
  Add,
  Campaign,
  Description,
  DragIndicator,
  Edit,
  MailOutline,
  MonetizationOn,
  Movie,
  NotificationsNone,
  Pause,
  PlayArrow,
  Publish,
  Quiz,
  Save,
  Search,
  Settings,
  Subtitles,
  VideoLibrary,
} from '@mui/icons-material';
import { useLocation } from 'wouter';
import { useAcademy, type Course, type Lesson, type LessonResource } from '@/contexts/AcademyContext';
import { useEnhancedMasterIntegration } from '@/integration/EnhancedMasterIntegrationProvider';
import { withUniversalIntegration } from '@/integration/UniversalIntegrationHOC';
import { useAcademyLocale } from './academyLocale';
import AcademyBrandMark from './AcademyBrandMark';
import AcademyPlayerStudio from './AcademyPlayerStudio';

interface AcademyLessonStudioProps {
  courseId?: string;
  lessonId?: string;
  onSave?: (payload: Record<string, unknown>) => void;
  onCancel?: () => void;
}

interface LessonChapter {
  id: string;
  title: string;
  duration: number;
  type: 'video' | 'pdf' | 'quiz';
}

interface LessonResourceItem {
  id: string;
  title: string;
  type: 'video' | 'pdf' | 'link' | 'image';
  url: string;
  duration?: number;
}

type CenterTab = 'content' | 'engagement' | 'quiz' | 'monetization';
type RightTab = 'info' | 'resources' | 'comments' | 'settings';

const VIDEO_PLACEHOLDER = '/assets/academy/intro-video.mp4';

const cinematicPanelSx = {
  borderRadius: 1.4,
  border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.08)',
  background: 'linear-gradient(145deg, rgba(20,24,36,0.88), rgba(11,14,22,0.96))',
};

const placeholderBackgrounds = [
  'linear-gradient(145deg, rgba(26,30,40,0.92), rgba(12,16,24,0.98)), radial-gradient(circle at 85% 14%, rgba(245,166,35,0.34), rgba(0,0,0,0))',
  'linear-gradient(145deg, rgba(18,23,34,0.94), rgba(9,13,20,0.98)), radial-gradient(circle at 20% 80%, rgba(245,166,35,0.22), rgba(0,0,0,0))',
  'linear-gradient(145deg, rgba(16,20,30,0.92), rgba(8,12,18,0.98)), radial-gradient(circle at 73% 10%, rgba(103,154,233,0.2), rgba(0,0,0,0))',
];

const createFallbackCourse = (): Course => {
  const now = new Date().toISOString();
  return {
    id: 'lesson-studio-fallback',
    title: 'Directing Masterclass',
    description: 'Professional lesson editing workflows for cinematic learning content.',
    instructor: {
      id: 'studio-user',
      name: 'Norwedfilm',
      avatar: '',
      bio: 'Film director',
      profession: 'videographer',
    },
    thumbnail: '',
    videoUrl: VIDEO_PLACEHOLDER,
    duration: 588,
    level: 'advanced',
    category: 'videography',
    tags: ['directing', 'filmmaking', 'cinematography'],
    price: 36984,
    isFree: false,
    isPublished: false,
    createdAt: now,
    updatedAt: now,
    rating: 4.8,
    studentCount: 370,
    prerequisites: [],
    learningOutcomes: [],
    resources: [],
    lessons: [
      {
        id: 'lesson-studio-fallback-lesson',
        courseId: 'lesson-studio-fallback',
        title: 'Lighting Basics',
        description: 'Understanding key light, fill light, and practical setup in directing.',
        videoUrl: VIDEO_PLACEHOLDER,
        duration: 588,
        order: 1,
        isPreview: true,
        resources: [
          {
            id: 'resource-intro-video',
            type: 'video',
            title: 'Intro-lights.mp4',
            url: VIDEO_PLACEHOLDER,
            description: 'Main lesson media',
          },
          {
            id: 'resource-guide-pdf',
            type: 'pdf',
            title: 'Lighting_basics_guide.pdf',
            url: '/assets/academy/guide.pdf',
            description: 'Lesson worksheet',
          },
        ],
      },
    ],
  };
};

const createDefaultChapters = (): LessonChapter[] => [
  { id: 'chapter-1', title: 'The Importance of Key Light', duration: 123, type: 'video' },
  { id: 'chapter-2', title: 'Setting Up 3-Point Lighting', duration: 206, type: 'video' },
  { id: 'chapter-3', title: 'Practical Setup', duration: 157, type: 'video' },
];

const formatTime = (seconds: number): string => {
  const safeSeconds = Number.isFinite(seconds) && seconds >= 0 ? Math.floor(seconds) : 0;
  const min = Math.floor(safeSeconds / 60);
  const sec = safeSeconds % 60;
  return `${min}:${sec.toString().padStart(2, '0')}`;
};

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

const lessonToChapterList = (lesson: Lesson | null): LessonChapter[] => {
  const description = String(lesson?.description || '');
  const lines = description
    .split('\n')
    .map((line) => line.replace(/^[-•]\s*/, '').trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return createDefaultChapters();
  }

  const lessonDuration = Number(lesson?.duration || 480);
  const chunk = Math.max(45, Math.round(lessonDuration / lines.length));

  return lines.map((line, index) => ({
    id: `chapter-from-lesson-${index + 1}`,
    title: line,
    duration: chunk,
    type: 'video',
  }));
};

const lessonToResourceList = (lesson: Lesson | null): LessonResourceItem[] => {
  if (!lesson || !Array.isArray(lesson.resources) || lesson.resources.length === 0) {
    return [
      {
        id: 'resource-lesson-video',
        title: 'Intro-lights.mp4',
        type: 'video',
        url: VIDEO_PLACEHOLDER,
        duration: 6 * 60 + 59,
      },
      {
        id: 'resource-lesson-pdf',
        title: 'Lighting_basics_guide.pdf',
        type: 'pdf',
        url: '/assets/academy/guide.pdf',
      },
    ];
  }

  return lesson.resources.map((resource) => ({
    id: String(resource.id),
    title: String(resource.title || 'Resource'),
    type: (resource.type as LessonResourceItem['type']) || 'link',
    url: resource.url || '#',
    duration: resource.type === 'video' ? Number(lesson.duration || 0) : undefined,
  }));
};

const buildSummaryFromDescription = (description: string): string[] => {
  const lines = description
    .split('\n')
    .map((line) => line.replace(/^[-•]\s*/, '').trim())
    .filter(Boolean);

  if (lines.length > 0) return lines;

  return [
    'Understanding key light, fill light, and back light.',
    'Setting up 3-point lighting with affordable gear.',
    'Adjusting white balance for different lighting conditions.',
  ];
};

function AcademyLessonStudio({ courseId, lessonId, onSave, onCancel }: AcademyLessonStudioProps) {
  const [, setLocation] = useLocation();
  const { state, getCourse, updateCourse } = useAcademy();
  const { analytics, debugging } = useEnhancedMasterIntegration();
  const { navLabel, tt } = useAcademyLocale();

  const fallbackCourse = useMemo(() => createFallbackCourse(), []);

  const [leftNav, setLeftNav] = useState('lessons');
  const [centerTab, setCenterTab] = useState<CenterTab>('content');
  const [rightTab, setRightTab] = useState<RightTab>('info');
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [selectedCourseId, setSelectedCourseId] = useState(courseId || '');
  const [saveMessage, setSaveMessage] = useState('');
  const [searchValue, setSearchValue] = useState('');
  const [summaryPoints, setSummaryPoints] = useState<string[]>([]);
  const [lessonTitle, setLessonTitle] = useState(tt('Lyssetting grunnleggende', 'Lighting Basics'));
  const [chapterItems, setChapterItems] = useState<LessonChapter[]>(createDefaultChapters);
  const [resourceItems, setResourceItems] = useState<LessonResourceItem[]>([]);

  const courseItems = useMemo(() => {
    if (Array.isArray(state.courses) && state.courses.length > 0) {
      return state.courses;
    }
    return [fallbackCourse];
  }, [fallbackCourse, state.courses]);

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

    return state.currentCourse || courseItems[0] || fallbackCourse;
  }, [courseId, courseItems, fallbackCourse, getCourse, selectedCourseId, state.currentCourse]);

  const selectedCourseValue = useMemo(() => {
    const preferredId = String(selectedCourseId || activeCourse?.id || '');
    if (preferredId && courseOptionIds.includes(preferredId)) {
      return preferredId;
    }
    return courseOptionIds[0] || '';
  }, [activeCourse?.id, courseOptionIds, selectedCourseId]);

  const courseLessons = useMemo(() => {
    if (Array.isArray(activeCourse?.lessons) && activeCourse.lessons.length > 0) {
      return activeCourse.lessons;
    }
    return fallbackCourse.lessons;
  }, [activeCourse?.lessons, fallbackCourse.lessons]);

  const activeLesson = useMemo(() => {
    if (lessonId) {
      return (
        courseLessons.find((lesson) => String(lesson.id) === String(lessonId)) ||
        state.currentLesson ||
        courseLessons[0] ||
        fallbackCourse.lessons[0]
      );
    }

    return state.currentLesson || courseLessons[0] || fallbackCourse.lessons[0];
  }, [courseLessons, fallbackCourse.lessons, lessonId, state.currentLesson]);

  const duration = Number(activeLesson?.duration || activeCourse?.duration || 588);

  const visibleResources = useMemo(() => {
    const query = searchValue.trim().toLowerCase();
    if (!query) return resourceItems;
    return resourceItems.filter((resource) => {
      return resource.title.toLowerCase().includes(query) || resource.type.toLowerCase().includes(query);
    });
  }, [resourceItems, searchValue]);

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
    setLessonTitle(String(activeLesson?.title || tt('Lyssetting grunnleggende', 'Lighting Basics')));
    setSummaryPoints(buildSummaryFromDescription(String(activeLesson?.description || '')));
    setChapterItems(lessonToChapterList(activeLesson));
    setResourceItems(lessonToResourceList(activeLesson));
  }, [activeLesson, tt]);

  useEffect(() => {
    analytics.trackEvent('academy_lesson_studio_opened', {
      courseId: activeCourse?.id || null,
      lessonId: activeLesson?.id || null,
      chapterCount: chapterItems.length,
      timestamp: Date.now(),
    });

    debugging.logIntegration('info', 'AcademyLessonStudio opened', {
      courseId: activeCourse?.id || null,
      lessonId: activeLesson?.id || null,
      chapterCount: chapterItems.length,
    });
  }, [activeCourse?.id, activeLesson?.id, analytics, chapterItems.length, debugging]);

  useEffect(() => {
    if (!isPlaying) return;

    const timer = window.setInterval(() => {
      setCurrentTime((prev) => {
        const next = prev + 1;
        if (next >= duration) {
          return 0;
        }
        return next;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [duration, isPlaying]);

  const addChapter = useCallback(() => {
    setChapterItems((prev) => {
      const id = `chapter-${Date.now()}`;
      return [
        ...prev,
        {
          id,
          title: `New Chapter ${prev.length + 1}`,
          duration: 120,
          type: 'video',
        },
      ];
    });
  }, []);

  const updateChapter = useCallback((chapterId: string, title: string) => {
    setChapterItems((prev) =>
      prev.map((chapter) => {
        if (chapter.id !== chapterId) return chapter;
        return { ...chapter, title };
      }),
    );
  }, []);

  const duplicateLesson = useCallback(() => {
    setChapterItems((prev) => [
      ...prev,
      {
        id: `chapter-${Date.now()}-copy`,
        title: lessonTitle ? `${lessonTitle} (Copy)` : 'Lesson Copy',
        duration: Math.max(90, Math.round(duration / 2)),
        type: 'video',
      },
    ]);
    setSaveMessage(tt('Leksjon duplisert til kapittelutkast.', 'Lesson duplicated into chapter draft.'));
  }, [duration, lessonTitle, tt]);

  const addResource = useCallback(() => {
    setResourceItems((prev) => [
      ...prev,
      {
        id: `resource-${Date.now()}`,
        title: `New Resource ${prev.length + 1}`,
        type: 'link',
        url: 'https://academy.creatorhub.no/resource',
      },
    ]);
  }, []);

  const saveLesson = useCallback(
    async (publish: boolean) => {
      const lessonDescription = summaryPoints.map((point) => `• ${point}`).join('\n');
      const lessonResources: LessonResource[] = resourceItems.map((resource) => ({
        id: resource.id,
        title: resource.title,
        type: resource.type,
        url: resource.url,
        description: resource.title,
      }));

      const fallbackLesson: Lesson = {
        id: String(activeLesson?.id || `lesson-${Date.now()}`),
        courseId: String(activeCourse?.id || fallbackCourse.id),
        title: lessonTitle || 'Untitled Lesson',
        description: lessonDescription,
        videoUrl: activeLesson?.videoUrl || VIDEO_PLACEHOLDER,
        duration,
        order: Number(activeLesson?.order || 1),
        isPreview: Boolean(activeLesson?.isPreview),
        resources: lessonResources,
      };

      const currentLessons = Array.isArray(activeCourse?.lessons) && activeCourse.lessons.length > 0
        ? activeCourse.lessons
        : [fallbackLesson];

      const hasActive = currentLessons.some((lesson) => String(lesson.id) === String(fallbackLesson.id));
      const nextLessons = hasActive
        ? currentLessons.map((lesson) => {
            if (String(lesson.id) !== String(fallbackLesson.id)) return lesson;
            return {
              ...lesson,
              title: lessonTitle || 'Untitled Lesson',
              description: lessonDescription,
              duration,
              resources: lessonResources,
            };
          })
        : [...currentLessons, fallbackLesson];

      const payload = {
        id: activeCourse?.id || fallbackCourse.id,
        lessonId: fallbackLesson.id,
        title: lessonTitle,
        description: lessonDescription,
        chapters: chapterItems,
        resources: lessonResources,
        publish,
        updatedAt: new Date().toISOString(),
      };

      try {
        if (activeCourse?.id && state.courses.some((course) => String(course.id) === String(activeCourse.id))) {
          await updateCourse({
            ...activeCourse,
            lessons: nextLessons,
            isPublished: publish ? true : activeCourse.isPublished,
            updatedAt: new Date().toISOString(),
          });
        }

        onSave?.(payload);
        setSaveMessage(publish ? tt('Leksjon publisert.', 'Lesson published.') : tt('Leksjon lagret.', 'Lesson saved.'));

        analytics.trackEvent(publish ? 'academy_lesson_publish' : 'academy_lesson_save', {
          courseId: activeCourse?.id || null,
          lessonId: fallbackLesson.id,
          chapterCount: chapterItems.length,
          resourceCount: lessonResources.length,
          timestamp: Date.now(),
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : tt('Kunne ikke lagre leksjon.', 'Failed to save lesson.');
        setSaveMessage(message);
        debugging.logIntegration('error', 'Academy lesson save failed', {
          message,
          courseId: activeCourse?.id || null,
          lessonId: fallbackLesson.id,
        });
      }
    },
    [
      activeCourse,
      activeLesson?.id,
      activeLesson?.isPreview,
      activeLesson?.order,
      activeLesson?.videoUrl,
      analytics,
      chapterItems,
      debugging,
      duration,
      fallbackCourse.id,
      lessonTitle,
      onSave,
      resourceItems,
      state.courses,
      summaryPoints,
      tt,
      updateCourse,
    ],
  );

  const leftNavItems = [
    { id: 'overview', label: navLabel('Overview'), route: '/academy-dashboard' },
    { id: 'curriculum', label: navLabel('Curriculum'), route: '/academy/curriculum' },
    { id: 'lessons', label: navLabel('Lessons'), route: '/academy/lesson-editor' },
    { id: 'lesson-current', label: lessonTitle || tt('Lyssetting grunnleggende', 'Lighting Basics'), route: '/academy/lesson-editor', inset: true },
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
            'radial-gradient(circle at 74% 12%, rgba(248,179,33,0.24), rgba(5,8,13,0) 42%), radial-gradient(circle at 16% 74%, rgba(82,121,204,0.14), rgba(6,8,14,0) 44%), linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0) 32%)',
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
                    color: active ? '#fce3a1' : item.id === 'lesson-current' ? 'rgba(237,240,247,0.74)' : 'rgba(237,240,247,0.82)',
                    borderRadius: item.id === 'lesson-current' ? 0.8 : 1,
                    textTransform: 'none',
                    px: item.id === 'lesson-current' ? 1.4 : 2,
                    py: item.id === 'lesson-current' ? 0.75 : 1.15,
                    ml: item.id === 'lesson-current' ? 2.1 : 0,
                    width: item.id === 'lesson-current' ? 'calc(100% - 16px)' : '100%',
                    border: item.id === 'lesson-current' ? 'var(--academy-hairline-width, 1px) solid transparent' : active ? 'var(--academy-hairline-width, 1px) solid rgba(248,179,33,0.35)' : 'var(--academy-hairline-width, 1px) solid transparent',
                    borderLeft: item.id === 'lesson-current' ? (active ? '2px solid rgba(248,179,33,0.55)' : '2px solid rgba(255,255,255,0.18)') : 'none',
                    background: item.id === 'lesson-current'
                      ? active
                        ? 'rgba(248,179,33,0.08)'
                        : 'transparent'
                      : active
                        ? 'linear-gradient(90deg, rgba(248,179,33,0.22), rgba(248,179,33,0.04))'
                        : 'transparent',
                    fontSize: item.id === 'lesson-current' ? 13.5 : 15,
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
              onClick={addChapter}
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
              gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1fr) 390px' },
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
                <Stack direction="row" spacing={1.2} alignItems="center" flexWrap="wrap" useFlexGap>
                  <Typography sx={{ fontSize: 36, fontWeight: 600, letterSpacing: '0.02em' }}>
                    {tt('Leksjonsredigering', 'Lesson Editor')}
                  </Typography>
                  <Select
                    size="small"
                    value={selectedCourseValue}
                    onChange={(event) => setSelectedCourseId(String(event.target.value))}
                    sx={{
                      minWidth: 200,
                      color: '#edf0f7',
                      bgcolor: 'rgba(255,255,255,0.05)',
                      '& .MuiOutlinedInput-notchedOutline': {
                        borderColor: 'rgba(255,255,255,0.14)',
                      },
                    }}
                  >
                    {courseItems.map((course) => (
                      <MenuItem key={course.id} value={course.id}>
                        {course.title}
                      </MenuItem>
                    ))}
                  </Select>
                </Stack>

                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  <Button
                    variant="outlined"
                    startIcon={<PlayArrow />}
                    onClick={() => setLocation('/academy/video-player')}
                    sx={{
                      textTransform: 'none',
                      borderColor: 'rgba(255,255,255,0.2)',
                      color: '#edf0f7',
                      borderRadius: 1,
                    }}
                  >
                    {tt('Forhåndsvis', 'Preview')}
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={<Movie />}
                    onClick={() => setLocation('/academy/video-player')}
                    sx={{
                      textTransform: 'none',
                      borderColor: 'rgba(255,255,255,0.2)',
                      color: '#edf0f7',
                      borderRadius: 1,
                    }}
                  >
                    {tt('Spiller', 'Player')}
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={<Save />}
                    onClick={() => void saveLesson(false)}
                    sx={{
                      textTransform: 'none',
                      borderColor: 'rgba(255,255,255,0.2)',
                      color: '#edf0f7',
                      borderRadius: 1,
                    }}
                  >
                    {tt('Lagre', 'Save')}
                  </Button>
                  <Button
                    variant="contained"
                    startIcon={<Publish />}
                    onClick={() => void saveLesson(true)}
                    sx={{
                      textTransform: 'none',
                      borderRadius: 1,
                      color: '#0f0f0f',
                      background: 'linear-gradient(180deg, #ffd44e, #f2a616)',
                      boxShadow: '0 10px 24px rgba(248,179,33,0.25)',
                    }}
                  >
                    {tt('Publiser', 'Publish')}
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

              <Box sx={{ ...cinematicPanelSx, p: 1.2 }}>
                <Stack
                  direction={{ xs: 'column', md: 'row' }}
                  spacing={1}
                  alignItems={{ xs: 'stretch', md: 'center' }}
                  justifyContent="space-between"
                  sx={{ mb: 1.2 }}
                >
                  <Stack direction="row" spacing={1} alignItems="center">
                    <DragIndicator sx={{ color: '#f8b321' }} />
                    <Typography sx={{ fontSize: 34, fontWeight: 600 }}>{lessonTitle || tt('Lyssetting grunnleggende', 'Lighting Basics')}</Typography>
                  </Stack>

                  <Button
                    startIcon={<Add />}
                    onClick={addChapter}
                    sx={{
                      textTransform: 'none',
                      color: '#0f0f0f',
                      background: 'linear-gradient(180deg, #ffd44e, #f2a616)',
                      fontWeight: 700,
                    }}
                  >
                    {tt('Legg til kapittel', 'Add Chapter')}
                  </Button>
                </Stack>

                <Box
                  sx={{
                    borderRadius: 1,
                    border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.08)',
                    overflow: 'hidden',
                    background: 'linear-gradient(145deg, rgba(18,22,32,0.96), rgba(10,13,20,0.95))',
                  }}
                >
                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1fr) 235px' },
                      gap: 1,
                      p: 1,
                    }}
                  >
                    <AcademyPlayerStudio
                      src={activeLesson?.videoUrl || VIDEO_PLACEHOLDER}
                      muted
                      loop
                      containerSx={{
                        background:
                          'radial-gradient(circle at 72% 20%, rgba(248,179,33,0.18), rgba(10,13,20,0) 46%), linear-gradient(145deg, rgba(20,24,35,0.96), rgba(9,12,18,0.96))',
                      }}
                    >
                      <Box
                        sx={{
                          position: 'absolute',
                          left: '50%',
                          top: '50%',
                          transform: 'translate(-50%, -50%)',
                        }}
                      >
                        <IconButton
                          onClick={() => setIsPlaying((prev) => !prev)}
                          disableRipple
                          disableFocusRipple
                          sx={{
                            width: 84,
                            height: 84,
                            border: '2px solid rgba(255,255,255,0.45)',
                            color: '#f7f8fb',
                            bgcolor: 'rgba(4,5,8,0.42)',
                            transition: 'background-color 0.2s ease',
                            transform: 'none !important',
                            '&:hover': {
                              bgcolor: 'rgba(0,0,0,0.56)',
                              transform: 'none !important',
                            },
                            '&:active': {
                              transform: 'none !important',
                            },
                          }}
                        >
                          {isPlaying ? <Pause sx={{ fontSize: 42 }} /> : <PlayArrow sx={{ fontSize: 42 }} />}
                        </IconButton>
                      </Box>

                      <Box
                        sx={{
                          position: 'absolute',
                          left: 14,
                          right: 14,
                          bottom: 12,
                        }}
                      >
                        <Stack direction="row" alignItems="center" spacing={1}>
                          <Typography sx={{ fontSize: 13, color: 'rgba(237,240,247,0.78)' }}>
                            {formatTime(currentTime)}
                          </Typography>
                          <Slider
                            value={currentTime}
                            onChange={(_, value) => {
                              const next = Array.isArray(value) ? value[0] : value;
                              setCurrentTime(clamp(next, 0, Math.max(duration, 1)));
                            }}
                            min={0}
                            max={Math.max(duration, 1)}
                            sx={{
                              flex: 1,
                              color: '#f8b321',
                              '& .MuiSlider-thumb': { width: 10, height: 10 },
                            }}
                          />
                          <Typography sx={{ fontSize: 13, color: 'rgba(237,240,247,0.78)' }}>
                            {formatTime(duration)}
                          </Typography>
                        </Stack>
                      </Box>
                    </AcademyPlayerStudio>

                    <Stack spacing={1}>
                      <Box
                        sx={{
                          borderRadius: 1,
                          border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.08)',
                          background: placeholderBackgrounds[0],
                          minHeight: 130,
                          p: 1,
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'flex-end',
                        }}
                      >
                        <Typography sx={{ fontSize: 34, fontWeight: 600, lineHeight: 1.1 }}>{lessonTitle}</Typography>
                        <Stack direction="row" spacing={0.6} sx={{ mt: 1 }}>
                          <Button
                            size="small"
                            sx={{
                              textTransform: 'none',
                              color: '#edf0f7',
                              border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.18)',
                            }}
                          >
                            Edit
                          </Button>
                          <Button
                            size="small"
                            sx={{
                              textTransform: 'none',
                              color: '#edf0f7',
                              border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.18)',
                            }}
                          >
                            Set to Video
                          </Button>
                        </Stack>
                      </Box>

                      <Box sx={{ ...cinematicPanelSx, p: 0.9 }}>
                        <Typography sx={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(237,240,247,0.62)' }}>
                          Thumbnail
                        </Typography>
                        <Box
                          sx={{
                            mt: 0.7,
                            borderRadius: 1,
                            minHeight: 86,
                            background: placeholderBackgrounds[1],
                            border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.1)',
                          }}
                        />
                      </Box>

                      <Box sx={{ ...cinematicPanelSx, p: 0.9 }}>
                        <Stack spacing={0.65}>
                          {resourceItems.slice(0, 2).map((resource) => (
                            <Stack
                              key={resource.id}
                              direction="row"
                              alignItems="center"
                              spacing={0.8}
                              sx={{
                                borderRadius: 1,
                                border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.1)',
                                px: 0.9,
                                py: 0.75,
                                bgcolor: 'rgba(11,15,24,0.7)',
                              }}
                            >
                              {resource.type === 'pdf' ? (
                                <Description sx={{ fontSize: 18, color: '#f8d56f' }} />
                              ) : (
                                <VideoLibrary sx={{ fontSize: 18, color: '#8ec6ff' }} />
                              )}
                              <Typography sx={{ flex: 1, fontSize: 13 }} noWrap>
                                {resource.title}
                              </Typography>
                              <Typography sx={{ fontSize: 12, color: 'rgba(237,240,247,0.62)' }}>
                                {resource.duration ? formatTime(resource.duration) : '--'}
                              </Typography>
                            </Stack>
                          ))}
                        </Stack>
                      </Box>
                    </Stack>
                  </Box>

                  <Tabs
                    value={centerTab}
                    onChange={(_, value: CenterTab) => setCenterTab(value)}
                    textColor="inherit"
                    sx={{
                      mt: 0.2,
                      px: 0.6,
                      borderTop: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.08)',
                      borderBottom: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.08)',
                      '& .MuiTabs-indicator': { backgroundColor: '#f8b321' },
                      '& .MuiTab-root': {
                        color: 'rgba(237,240,247,0.74)',
                        textTransform: 'none',
                        minHeight: 42,
                        fontSize: 14,
                      },
                      '& .Mui-selected': { color: '#f7f8fb' },
                    }}
                  >
                    <Tab label={tt('Innhold', 'Content')} value="content" />
                    <Tab label={tt('Engasjement', 'Engagement')} value="engagement" />
                    <Tab label={tt('Quiz og oppgaver', 'Quiz & Assignments')} value="quiz" />
                    <Tab label={tt('Monetisering', 'Monetization')} value="monetization" />
                  </Tabs>

                  <Box sx={{ p: 1 }}>
                    {centerTab === 'content' && (
                      <Stack spacing={0.8}>
                        {chapterItems.map((chapter, index) => (
                          <Stack
                            key={chapter.id}
                            direction="row"
                            alignItems="center"
                            spacing={1}
                            sx={{
                              px: 1,
                              py: 1,
                              borderRadius: 1,
                              border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.11)',
                              bgcolor: 'rgba(11,15,24,0.74)',
                            }}
                          >
                            <DragIndicator sx={{ color: 'rgba(237,240,247,0.48)' }} />
                            <Chip
                              label={chapter.type.toUpperCase()}
                              size="small"
                              sx={{
                                bgcolor: 'rgba(248,179,33,0.2)',
                                color: '#f7f8fb',
                                fontWeight: 700,
                              }}
                            />
                            <TextField
                              size="small"
                              value={chapter.title}
                              onChange={(event) => updateChapter(chapter.id, event.target.value)}
                              sx={{
                                flex: 1,
                                '& .MuiInputBase-root': {
                                  color: '#edf0f7',
                                  bgcolor: 'rgba(255,255,255,0.03)',
                                },
                              }}
                            />
                            <Typography sx={{ minWidth: 60, textAlign: 'right', color: 'rgba(237,240,247,0.72)' }}>
                              {formatTime(chapter.duration)}
                            </Typography>
                            <IconButton size="small" sx={{ color: 'rgba(237,240,247,0.7)' }}>
                              <Edit fontSize="small" />
                            </IconButton>
                            <Typography sx={{ fontWeight: 700, color: '#f8d56f' }}>{index + 1}</Typography>
                          </Stack>
                        ))}
                      </Stack>
                    )}

                    {centerTab === 'engagement' && (
                      <Box sx={{ ...cinematicPanelSx, p: 1.2 }}>
                        <Typography sx={{ fontSize: 18, fontWeight: 600, mb: 1 }}>{tt('Leksjonssynlighet', 'Lesson Visibility')}</Typography>
                        <Stack spacing={0.9}>
                          <Stack direction="row" justifyContent="space-between">
                            <Typography>Completion Heatmap Coverage</Typography>
                            <Typography sx={{ color: '#f8d56f' }}>82%</Typography>
                          </Stack>
                          <LinearProgress
                            variant="determinate"
                            value={82}
                            sx={{
                              height: 7,
                              borderRadius: 999,
                              bgcolor: 'rgba(255,255,255,0.12)',
                              '& .MuiLinearProgress-bar': {
                                borderRadius: 999,
                                background: 'linear-gradient(90deg, #8de270 0%, #f8b321 100%)',
                              },
                            }}
                          />
                          <Stack direction="row" justifyContent="space-between">
                            <Typography>Avg Watch Retention</Typography>
                            <Typography sx={{ color: '#f8d56f' }}>74%</Typography>
                          </Stack>
                          <LinearProgress
                            variant="determinate"
                            value={74}
                            sx={{
                              height: 7,
                              borderRadius: 999,
                              bgcolor: 'rgba(255,255,255,0.12)',
                              '& .MuiLinearProgress-bar': {
                                borderRadius: 999,
                                background: 'linear-gradient(90deg, #7fb4ff 0%, #f8b321 100%)',
                              },
                            }}
                          />
                        </Stack>
                      </Box>
                    )}

                    {centerTab === 'quiz' && (
                      <Box sx={{ ...cinematicPanelSx, p: 1.2 }}>
                        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                          <Typography sx={{ fontSize: 18, fontWeight: 600 }}>Quiz & Assignments</Typography>
                          <Button
                            startIcon={<Quiz />}
                            onClick={() => setLocation('/academy/quiz-manager')}
                            sx={{
                              textTransform: 'none',
                              color: '#edf0f7',
                              border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.16)',
                            }}
                          >
                            {tt('Åpne Quiz Manager', 'Open Quiz Manager')}
                          </Button>
                        </Stack>
                        <Typography sx={{ color: 'rgba(237,240,247,0.72)' }}>
                          {tt('Legg til sjekkpunkter i video, korte oppgaver og automatisk tilbakemelding for denne leksjonen.', 'Add in-video checks, short assignments and auto-feedback for this lesson.')}
                        </Typography>
                      </Box>
                    )}

                    {centerTab === 'monetization' && (
                      <Box sx={{ ...cinematicPanelSx, p: 1.2 }}>
                        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                          <Typography sx={{ fontSize: 18, fontWeight: 600 }}>{tt('Monetiseringskontroller', 'Monetization Controls')}</Typography>
                          <Button
                            startIcon={<MonetizationOn />}
                            onClick={() => setLocation('/academy/monetization')}
                            sx={{
                              textTransform: 'none',
                              color: '#edf0f7',
                              border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.16)',
                            }}
                          >
                            {tt('Åpne monetisering', 'Open Monetization')}
                          </Button>
                        </Stack>
                        <Typography sx={{ color: 'rgba(237,240,247,0.72)' }}>
                          {tt('Konfigurer forhåndsvisningstilgang, mersalgspunkter og pakkesynlighet for denne leksjonen.', 'Configure preview access, upsell moments, and bundle visibility for this lesson.')}
                        </Typography>
                      </Box>
                    )}
                  </Box>
                </Box>

                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  spacing={1}
                  alignItems={{ xs: 'stretch', sm: 'center' }}
                  justifyContent="space-between"
                >
                  <Button
                    startIcon={<Add />}
                    onClick={addChapter}
                    sx={{
                      textTransform: 'none',
                      minWidth: 160,
                      color: '#0f0f0f',
                      background: 'linear-gradient(180deg, #ffd44e, #f2a616)',
                      fontWeight: 700,
                    }}
                  >
                    {tt('Legg til kapittel', 'Add Chapter')}
                  </Button>

                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography sx={{ color: 'rgba(237,240,247,0.72)' }}>{tt('Leksjonssynlighet', 'Lesson Visibility')}</Typography>
                    <Chip
                      label={activeCourse?.isPublished ? tt('Publisert', 'Published') : tt('Utkast', 'Draft')}
                      size="small"
                      sx={{
                        bgcolor: activeCourse?.isPublished
                          ? 'rgba(127,214,153,0.22)'
                          : 'rgba(248,179,33,0.18)',
                        color: '#f7f8fb',
                      }}
                    />
                  </Stack>
                </Stack>
              </Box>
            </Box>

            <Box sx={{ ...cinematicPanelSx, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
              <Tabs
                value={rightTab}
                onChange={(_, value: RightTab) => setRightTab(value)}
                textColor="inherit"
                sx={{
                  borderBottom: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.08)',
                  '& .MuiTabs-indicator': { backgroundColor: '#f8b321' },
                  '& .MuiTab-root': { color: 'rgba(237,240,247,0.78)', textTransform: 'none', minHeight: 44 },
                  '& .Mui-selected': { color: '#f7f8fb' },
                }}
              >
                <Tab label={tt('Info', 'Info')} value="info" />
                <Tab label={tt('Ressurser', 'Resources')} value="resources" />
                <Tab label={tt('Kommentarer og spørsmål', 'Comments & QA')} value="comments" />
                <Tab label={tt('Innstillinger', 'Settings')} value="settings" />
              </Tabs>

              {rightTab === 'info' && (
                <Box sx={{ p: 1.3, display: 'flex', flexDirection: 'column', gap: 1.2 }}>
                  <Typography sx={{ fontWeight: 700, fontSize: 18 }}>Text</Typography>
                  <TextField
                    value={lessonTitle}
                    onChange={(event) => setLessonTitle(event.target.value)}
                    size="small"
                    sx={{ '& .MuiInputBase-root': { color: '#edf0f7' } }}
                  />

                  <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                    {[Movie, Subtitles, Campaign, Settings].map((Icon, index) => (
                      <IconButton
                        key={`format-icon-${index}`}
                        size="small"
                        sx={{
                          color: 'rgba(237,240,247,0.74)',
                          border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.12)',
                        }}
                      >
                        <Icon fontSize="small" />
                      </IconButton>
                    ))}
                  </Stack>

                  <Stack spacing={0.8}>
                    {summaryPoints.map((point, index) => (
                      <Stack key={`summary-${index}`} direction="row" spacing={0.8} alignItems="center">
                        <Typography sx={{ color: '#f8d56f', fontSize: 16 }}>▸</Typography>
                        <TextField
                          value={point}
                          onChange={(event) => {
                            const value = event.target.value;
                            setSummaryPoints((prev) => prev.map((entry, itemIndex) => (itemIndex === index ? value : entry)));
                          }}
                          size="small"
                          sx={{ flex: 1, '& .MuiInputBase-root': { color: '#edf0f7' } }}
                        />
                      </Stack>
                    ))}
                  </Stack>

                  <Button
                    startIcon={<Add />}
                    onClick={() => setSummaryPoints((prev) => [...prev, tt('Nytt læringsmål', 'New lesson objective')])}
                    sx={{
                      alignSelf: 'flex-start',
                      textTransform: 'none',
                      color: '#edf0f7',
                      border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.16)',
                    }}
                  >
                    {tt('Legg til læringsmål', 'Add Objective')}
                  </Button>

                  <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)' }} />

                  <Typography sx={{ fontWeight: 700, fontSize: 18 }}>{tt('Ressurssamling', 'Resource Set')}</Typography>
                  <Box
                    sx={{
                      borderRadius: 1,
                      border: '1px dashed rgba(255,255,255,0.2)',
                      px: 1,
                      py: 1.1,
                      color: 'rgba(237,240,247,0.68)',
                    }}
                  >
                    {tt('Dra og slipp ressurser inn i denne leksjonen.', 'Drag & drop resource items into this lesson.')}
                  </Box>

                  <Box sx={{ ...cinematicPanelSx, p: 1 }}>
                    <Stack spacing={0.8}>
                      {resourceItems.map((resource) => (
                        <Stack
                          key={`resource-info-${resource.id}`}
                          direction="row"
                          alignItems="center"
                          spacing={0.8}
                          sx={{
                            px: 0.9,
                            py: 0.75,
                            borderRadius: 1,
                            border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.1)',
                            bgcolor: 'rgba(9,12,19,0.74)',
                          }}
                        >
                          {resource.type === 'pdf' ? (
                            <Description sx={{ fontSize: 18, color: '#f8d56f' }} />
                          ) : (
                            <VideoLibrary sx={{ fontSize: 18, color: '#8ec6ff' }} />
                          )}
                          <Typography sx={{ flex: 1, fontSize: 14 }} noWrap>
                            {resource.title}
                          </Typography>
                          <IconButton size="small" sx={{ color: 'rgba(237,240,247,0.7)' }}>
                            <Edit fontSize="small" />
                          </IconButton>
                        </Stack>
                      ))}
                    </Stack>
                  </Box>

                  <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)' }} />

                  <Typography sx={{ fontWeight: 700, fontSize: 18 }}>{tt('Kapitler', 'Chapters')}</Typography>
                  <Stack spacing={0.8}>
                    {chapterItems.map((chapter) => (
                      <Stack
                        key={`chapter-side-${chapter.id}`}
                        direction="row"
                        alignItems="center"
                        spacing={0.7}
                        sx={{
                          px: 0.95,
                          py: 0.75,
                          borderRadius: 1,
                          border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.1)',
                          bgcolor: 'rgba(9,12,19,0.74)',
                        }}
                      >
                        <Typography sx={{ color: '#f8d56f', fontWeight: 700 }}>#{chapterItems.indexOf(chapter) + 1}</Typography>
                        <Typography sx={{ flex: 1 }} noWrap>
                          {chapter.title}
                        </Typography>
                        <Typography sx={{ color: 'rgba(237,240,247,0.64)', fontSize: 13 }}>
                          {formatTime(chapter.duration)}
                        </Typography>
                        <IconButton size="small" sx={{ color: 'rgba(237,240,247,0.7)' }}>
                          <Edit fontSize="small" />
                        </IconButton>
                      </Stack>
                    ))}
                  </Stack>

                  <Stack direction="row" spacing={1}>
                    <Button
                      startIcon={<Add />}
                      onClick={addChapter}
                      sx={{
                        flex: 1,
                        textTransform: 'none',
                        color: '#0f0f0f',
                        background: 'linear-gradient(180deg, #ffd44e, #f2a616)',
                      }}
                    >
                      {tt('Legg til kapittel', 'Add Chapter')}
                    </Button>
                    <Button
                      sx={{
                        textTransform: 'none',
                        color: '#edf0f7',
                        border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.18)',
                      }}
                    >
                      {tt('Eksporter disposisjon', 'Export Outline')}
                    </Button>
                  </Stack>
                </Box>
              )}

              {rightTab === 'resources' && (
                <Box sx={{ p: 1.3, display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <TextField
                    value={searchValue}
                    onChange={(event) => setSearchValue(event.target.value)}
                    placeholder={tt('Søk ressurser...', 'Search resources...')}
                    size="small"
                    InputProps={{
                      startAdornment: <Search fontSize="small" sx={{ mr: 0.7, color: 'rgba(237,240,247,0.6)' }} />,
                    }}
                    sx={{
                      '& .MuiInputBase-root': {
                        bgcolor: 'rgba(11,14,22,0.8)',
                        color: '#edf0f7',
                      },
                    }}
                  />

                  <Box sx={{ ...cinematicPanelSx, p: 1 }}>
                    <Stack spacing={0.8}>
                      {visibleResources.map((resource) => (
                        <Stack
                          key={`resource-tab-${resource.id}`}
                          direction="row"
                          alignItems="center"
                          spacing={0.8}
                          sx={{
                            px: 0.9,
                            py: 0.75,
                            borderRadius: 1,
                            border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.1)',
                            bgcolor: 'rgba(11,15,24,0.74)',
                          }}
                        >
                          <Chip label={resource.type.toUpperCase()} size="small" sx={{ bgcolor: 'rgba(255,255,255,0.12)', color: '#edf0f7' }} />
                          <Typography sx={{ flex: 1 }} noWrap>
                            {resource.title}
                          </Typography>
                          <Typography sx={{ fontSize: 12, color: 'rgba(237,240,247,0.66)' }}>
                            {resource.duration ? formatTime(resource.duration) : '--'}
                          </Typography>
                        </Stack>
                      ))}
                    </Stack>
                  </Box>

                  <Stack direction="row" spacing={1}>
                    <Button
                      startIcon={<Add />}
                      onClick={addResource}
                      sx={{
                        flex: 1,
                        textTransform: 'none',
                        color: '#0f0f0f',
                        background: 'linear-gradient(180deg, #ffd44e, #f2a616)',
                      }}
                    >
                      Add Resource
                    </Button>
                    <Button
                      sx={{
                        textTransform: 'none',
                        color: '#edf0f7',
                        border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.18)',
                      }}
                    >
                      Upload
                    </Button>
                  </Stack>
                </Box>
              )}

              {rightTab === 'comments' && (
                <Box sx={{ p: 1.3, display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {[0, 1, 2].map((index) => (
                    <Box
                      key={`comment-${index}`}
                      sx={{
                        ...cinematicPanelSx,
                        p: 1,
                        borderColor: 'rgba(255,255,255,0.1)',
                      }}
                    >
                      <Stack direction="row" spacing={0.8} alignItems="center">
                        <Avatar sx={{ width: 30, height: 30, bgcolor: 'rgba(248,179,33,0.75)', color: '#111' }}>
                          {index === 0 ? 'E' : index === 1 ? 'D' : 'A'}
                        </Avatar>
                        <Typography sx={{ fontWeight: 700 }}>
                          {index === 0 ? 'Emma Berg' : index === 1 ? 'David Skar' : 'Alex Jensen'}
                        </Typography>
                        <Typography sx={{ ml: 'auto', fontSize: 12, color: 'rgba(237,240,247,0.6)' }}>
                          {formatTime(62 + index * 28)}
                        </Typography>
                      </Stack>
                      <Typography sx={{ mt: 0.8, color: 'rgba(237,240,247,0.78)' }}>
                        {index === 0
                          ? 'Nice flow here. Consider adding a short setup recap before the chapter switch.'
                          : index === 1
                            ? 'Lower the background music by 3dB when the speaker starts.'
                            : 'Good pacing. A tighter chapter title can improve navigation.'}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              )}

              {rightTab === 'settings' && (
                <Box sx={{ p: 1.3, display: 'flex', flexDirection: 'column', gap: 1.1 }}>
                  <TextField
                    label={tt('Tilgangsnivå', 'Access Level')}
                    value={activeLesson?.isPreview ? tt('Forhåndsvisning aktivert', 'Preview Enabled') : tt('Kun medlemmer', 'Members Only')}
                    size="small"
                    sx={{ '& .MuiInputBase-root': { color: '#edf0f7' } }}
                  />
                  <TextField
                    label={tt('Publiseringsdato', 'Release Date')}
                    value={new Date().toISOString().slice(0, 16)}
                    size="small"
                    sx={{ '& .MuiInputBase-root': { color: '#edf0f7' } }}
                  />
                  <TextField
                    label={tt('Lokalisering', 'Localization')}
                    value="Norwegian (nb-NO)"
                    size="small"
                    sx={{ '& .MuiInputBase-root': { color: '#edf0f7' } }}
                  />

                  <Box sx={{ ...cinematicPanelSx, p: 1 }}>
                    <Typography sx={{ fontWeight: 700, mb: 0.7 }}>{tt('Automatisering', 'Automation')}</Typography>
                    <Typography sx={{ color: 'rgba(237,240,247,0.72)' }}>
                      {tt(
                        'Autogenerer transkripsjon, kapittelmarkører og læringsmål etter opplasting.',
                        'Auto-generate transcript, chapter markers and learning objectives after upload.',
                      )}
                    </Typography>
                  </Box>
                </Box>
              )}

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
                >{tt('CTA-overlegg', 'CTA Overlay')}</Button>
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
                  {tt('Nedre tredeler', 'Lower Thirds')}
                </Button>
              </Stack>

              <Stack direction="row" spacing={1} sx={{ p: 1.1, pt: 0 }}>
                <Button
                  onClick={duplicateLesson}
                  sx={{
                    flex: 1,
                    textTransform: 'none',
                    color: '#edf0f7',
                    border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.16)',
                  }}
                >
                  {tt('Dupliser leksjon', 'Duplicate Lesson')}
                </Button>
                <Button
                  onClick={() => void saveLesson(true)}
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
                  startIcon={<Quiz />}
                  onClick={() => setLocation('/academy/quiz-manager')}
                  sx={{
                    flex: 1,
                    textTransform: 'none',
                    color: '#edf0f7',
                    border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.16)',
                  }}
                >
                  Quiz
                </Button>
              </Stack>

              <Stack direction="row" spacing={1} sx={{ p: 1.1, pt: 0 }}>
                <Button
                  startIcon={<Save />}
                  onClick={() => void saveLesson(false)}
                  sx={{
                    flex: 1,
                    textTransform: 'none',
                    color: '#edf0f7',
                    border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.16)',
                  }}
                >
                  {tt('Lagre utkast', 'Save Draft')}
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

export default withUniversalIntegration(AcademyLessonStudio, {
  componentId: 'academy-lesson-studio',
  componentName: 'Academy Lesson Studio',
  componentType: 'editor',
  componentCategory: 'academy',
  featureIds: ['lesson-editor', 'chapter-management', 'resource-panel', 'academy-curriculum'],
});
