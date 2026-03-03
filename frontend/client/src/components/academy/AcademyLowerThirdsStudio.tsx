import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  alpha,
  Avatar,
  Box,
  Button,
  Chip,
  Divider,
  IconButton,
  InputAdornment,
  LinearProgress,
  MenuItem,
  Select,
  Slider,
  Stack,
  Switch,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import {
  Add,
  AutoAwesome,
  MailOutline,
  MoreHoriz,
  NotificationsNone,
  Pause,
  PlayArrow,
  Publish,
  Save,
  Search,
  Subtitles,
  Tune,
} from '@mui/icons-material';
import { useLocation } from 'wouter';
import { useAcademy, type Course } from '@/contexts/AcademyContext';
import { useEnhancedMasterIntegration } from '@/integration/EnhancedMasterIntegrationProvider';
import { withUniversalIntegration } from '@/integration/UniversalIntegrationHOC';

interface AcademyLowerThirdsStudioProps {
  courseId?: string;
  onSave?: (payload: Record<string, unknown>) => void;
  onCancel?: () => void;
}

type LowerThirdPosition =
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right'
  | 'top-left'
  | 'top-center'
  | 'top-right';

type LowerThirdAnimation =
  | 'slide-up'
  | 'slide-down'
  | 'slide-left'
  | 'slide-right'
  | 'fade-in'
  | 'zoom-in';

type RightTab = 'style-animation' | 'safe-guides';
type EditorTab = 'content' | 'style' | 'animation' | 'safe-guides';

interface LowerThirdItem {
  id: string;
  name: string;
  title: string;
  subtitle: string;
  startTime: number;
  duration: number;
  delay: number;
  position: LowerThirdPosition;
  animation: LowerThirdAnimation;
  enabled: boolean;
  bounce: boolean;
  elastic: boolean;
  easeIn: number;
  easeOut: number;
  style: {
    background: string;
    text: string;
    accent: string;
    opacity: number;
    borderRadius: number;
    padding: number;
    fontSize: number;
  };
  safeGuides: {
    enabled: boolean;
    type: 'title-safe' | 'action-safe' | 'custom';
    marginTop: number;
    marginRight: number;
    marginBottom: number;
    marginLeft: number;
  };
  analytics: {
    views: number;
    avgWatch: number;
    completionRate: number;
  };
}

const panelSx = {
  borderRadius: 1.4,
  border: '1px solid rgba(255,255,255,0.08)',
  background: 'linear-gradient(145deg, rgba(20,24,36,0.88), rgba(11,14,22,0.96))',
};

const formatTime = (seconds: number): string => {
  const safe = Number.isFinite(seconds) && seconds >= 0 ? seconds : 0;
  const min = Math.floor(safe / 60);
  const sec = Math.floor(safe % 60);
  return `${min}:${sec.toString().padStart(2, '0')}`;
};

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

const fallbackCourses: Course[] = [
  {
    id: 'lower-third-course-1',
    title: 'Directing Masterclass',
    description: 'Professional directing workflows.',
    instructor: {
      id: 'instructor-1',
      name: 'Norwedfilm',
      avatar: '',
      bio: 'Filmmaker',
      profession: 'videographer',
    },
    thumbnail: '',
    videoUrl: '/assets/academy/intro-video.mp4',
    duration: 336,
    level: 'advanced',
    category: 'videography',
    tags: ['directing', 'academy'],
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

const defaultLowerThirds = (): LowerThirdItem[] => [
  {
    id: `lt-${Date.now()}-1`,
    name: 'Instructor Intro',
    title: 'Sarah Johnson',
    subtitle: 'Lead Photography Instructor',
    startTime: 163,
    duration: 4.5,
    delay: 0,
    position: 'bottom-left',
    animation: 'slide-up',
    enabled: true,
    bounce: false,
    elastic: true,
    easeIn: 0.3,
    easeOut: 0.7,
    style: {
      background: 'rgba(8,12,20,0.76)',
      text: '#f5f1e8',
      accent: '#9ad76a',
      opacity: 0.97,
      borderRadius: 10,
      padding: 14,
      fontSize: 16,
    },
    safeGuides: {
      enabled: true,
      type: 'title-safe',
      marginTop: 8,
      marginRight: 6,
      marginBottom: 10,
      marginLeft: 6,
    },
    analytics: {
      views: 6540,
      avgWatch: 3.6,
      completionRate: 82,
    },
  },
  {
    id: `lt-${Date.now()}-2`,
    name: 'Lesson Card',
    title: 'Lesson 3 of 12',
    subtitle: 'Understanding Light and Composition',
    startTime: 222,
    duration: 2.2,
    delay: 0,
    position: 'bottom-right',
    animation: 'slide-left',
    enabled: true,
    bounce: false,
    elastic: false,
    easeIn: 0.25,
    easeOut: 0.68,
    style: {
      background: 'rgba(10,15,24,0.8)',
      text: '#f4f0e5',
      accent: '#62b6ff',
      opacity: 0.94,
      borderRadius: 9,
      padding: 12,
      fontSize: 14,
    },
    safeGuides: {
      enabled: true,
      type: 'action-safe',
      marginTop: 8,
      marginRight: 6,
      marginBottom: 10,
      marginLeft: 6,
    },
    analytics: {
      views: 3710,
      avgWatch: 2.1,
      completionRate: 74,
    },
  },
];

function AcademyLowerThirdsStudio({ courseId, onSave, onCancel }: AcademyLowerThirdsStudioProps) {
  const [, setLocation] = useLocation();
  const { state, getCourse, updateCourse } = useAcademy();
  const { analytics, debugging } = useEnhancedMasterIntegration();

  const [leftNav, setLeftNav] = useState('lower-thirds');
  const [rightTab, setRightTab] = useState<RightTab>('style-animation');
  const [editorTab, setEditorTab] = useState<EditorTab>('content');
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(163);
  const [duration] = useState(356);
  const [searchValue, setSearchValue] = useState('');
  const [saveMessage, setSaveMessage] = useState('');
  const [selectedCourseId, setSelectedCourseId] = useState(courseId || '');
  const [lowerThirdItems, setLowerThirdItems] = useState<LowerThirdItem[]>(defaultLowerThirds);
  const [selectedLowerThirdId, setSelectedLowerThirdId] = useState('');

  const courseItems = useMemo(() => {
    if (Array.isArray(state.courses) && state.courses.length > 0) {
      return state.courses;
    }
    return fallbackCourses;
  }, [state.courses]);

  const activeCourse = useMemo(() => {
    const fromParam = courseId ? getCourse(courseId) : null;
    if (fromParam) return fromParam;
    const fromSelected = selectedCourseId
      ? courseItems.find((course) => course.id === selectedCourseId)
      : null;
    if (fromSelected) return fromSelected;
    return state.currentCourse || courseItems[0] || fallbackCourses[0];
  }, [courseId, courseItems, getCourse, selectedCourseId, state.currentCourse]);

  const selectedLowerThird = useMemo(() => {
    return (
      lowerThirdItems.find((lowerThird) => lowerThird.id === selectedLowerThirdId) ||
      lowerThirdItems[0] ||
      null
    );
  }, [lowerThirdItems, selectedLowerThirdId]);

  const filteredLowerThirds = useMemo(() => {
    const query = searchValue.trim().toLowerCase();
    if (!query) return lowerThirdItems;
    return lowerThirdItems.filter((lowerThird) => {
      return (
        lowerThird.name.toLowerCase().includes(query) ||
        lowerThird.title.toLowerCase().includes(query) ||
        lowerThird.subtitle.toLowerCase().includes(query)
      );
    });
  }, [lowerThirdItems, searchValue]);

  const activeLowerThirdVisible = useMemo(() => {
    if (!selectedLowerThird || !selectedLowerThird.enabled) return false;
    const begin = selectedLowerThird.startTime + selectedLowerThird.delay;
    const end = begin + selectedLowerThird.duration;
    return currentTime >= begin && currentTime <= end;
  }, [currentTime, selectedLowerThird]);

  useEffect(() => {
    if (!selectedCourseId && activeCourse?.id) {
      setSelectedCourseId(activeCourse.id);
    }
  }, [activeCourse?.id, selectedCourseId]);

  useEffect(() => {
    if (!selectedLowerThirdId && lowerThirdItems.length > 0) {
      setSelectedLowerThirdId(lowerThirdItems[0].id);
    }
  }, [lowerThirdItems, selectedLowerThirdId]);

  useEffect(() => {
    analytics.trackEvent('academy_lower_thirds_studio_opened', {
      courseId: activeCourse?.id || null,
      lowerThirdCount: lowerThirdItems.length,
      timestamp: Date.now(),
    });
    debugging.logIntegration('info', 'AcademyLowerThirdsStudio opened', {
      courseId: activeCourse?.id || null,
      lowerThirdCount: lowerThirdItems.length,
    });
  }, [activeCourse?.id, analytics, debugging, lowerThirdItems.length]);

  useEffect(() => {
    if (!isPlaying) return;
    const timer = window.setInterval(() => {
      setCurrentTime((prev) => {
        const next = prev + 1;
        if (next >= duration) {
          return selectedLowerThird ? selectedLowerThird.startTime : 0;
        }
        return next;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [duration, isPlaying, selectedLowerThird]);

  const setSelectedLowerThirdField = useCallback(
    <K extends keyof LowerThirdItem>(field: K, value: LowerThirdItem[K]) => {
      setLowerThirdItems((prev) =>
        prev.map((item) => {
          if (item.id !== selectedLowerThirdId) return item;
          return { ...item, [field]: value };
        }),
      );
    },
    [selectedLowerThirdId],
  );

  const setSelectedLowerThirdStyleField = useCallback(
    <K extends keyof LowerThirdItem['style']>(field: K, value: LowerThirdItem['style'][K]) => {
      setLowerThirdItems((prev) =>
        prev.map((item) => {
          if (item.id !== selectedLowerThirdId) return item;
          return {
            ...item,
            style: {
              ...item.style,
              [field]: value,
            },
          };
        }),
      );
    },
    [selectedLowerThirdId],
  );

  const setSelectedLowerThirdSafeField = useCallback(
    <K extends keyof LowerThirdItem['safeGuides']>(field: K, value: LowerThirdItem['safeGuides'][K]) => {
      setLowerThirdItems((prev) =>
        prev.map((item) => {
          if (item.id !== selectedLowerThirdId) return item;
          return {
            ...item,
            safeGuides: {
              ...item.safeGuides,
              [field]: value,
            },
          };
        }),
      );
    },
    [selectedLowerThirdId],
  );

  const addLowerThird = useCallback(() => {
    const next: LowerThirdItem = {
      id: `lt-${Date.now()}`,
      name: `New Lower Third ${lowerThirdItems.length + 1}`,
      title: 'New title',
      subtitle: 'New subtitle',
      startTime: clamp(Math.round(currentTime), 0, duration),
      duration: 4.5,
      delay: 0,
      position: 'bottom-left',
      animation: 'slide-up',
      enabled: true,
      bounce: false,
      elastic: false,
      easeIn: 0.3,
      easeOut: 0.7,
      style: {
        background: 'rgba(8,12,20,0.8)',
        text: '#f5f1e8',
        accent: '#f8b321',
        opacity: 0.96,
        borderRadius: 10,
        padding: 14,
        fontSize: 16,
      },
      safeGuides: {
        enabled: true,
        type: 'title-safe',
        marginTop: 8,
        marginRight: 6,
        marginBottom: 10,
        marginLeft: 6,
      },
      analytics: {
        views: 0,
        avgWatch: 0,
        completionRate: 0,
      },
    };
    setLowerThirdItems((prev) => [next, ...prev]);
    setSelectedLowerThirdId(next.id);
    setSaveMessage(`Added ${next.name}.`);
  }, [currentTime, duration, lowerThirdItems.length]);

  const duplicateLowerThird = useCallback(() => {
    if (!selectedLowerThird) return;
    const clone: LowerThirdItem = {
      ...selectedLowerThird,
      id: `lt-${Date.now()}-copy`,
      name: `${selectedLowerThird.name} Copy`,
      startTime: clamp(selectedLowerThird.startTime + 5, 0, duration),
    };
    setLowerThirdItems((prev) => [clone, ...prev]);
    setSelectedLowerThirdId(clone.id);
    setSaveMessage(`Duplicated ${selectedLowerThird.name}.`);
  }, [duration, selectedLowerThird]);

  const saveLowerThirdSetup = useCallback(
    async (publish: boolean) => {
      setSaveMessage('');

      const payload = {
        courseId: activeCourse?.id || null,
        lowerThirds: lowerThirdItems,
        publish,
      };

      try {
        const existing = activeCourse
          ? state.courses.find((entry) => entry.id === activeCourse.id)
          : undefined;

        if (existing) {
          const resources = Array.isArray(existing.resources) ? existing.resources : [];
          const lowerThirdResources = lowerThirdItems.map((lowerThird) => ({
            id: `lowerthird-resource-${lowerThird.id}`,
            type: 'link' as const,
            title: `[LowerThird] ${lowerThird.title}`,
            url: '#',
            description: `${lowerThird.name} · ${formatTime(lowerThird.startTime)} · ${lowerThird.duration.toFixed(1)}s`,
          }));

          await updateCourse({
            ...existing,
            isPublished: publish ? true : existing.isPublished,
            tags: Array.from(new Set([...(existing.tags || []), 'lower-thirds'])),
            resources: [
              ...resources.filter((resource) => !resource.id.startsWith('lowerthird-resource-')),
              ...lowerThirdResources,
            ],
          });
        }

        onSave?.(payload);
        setSaveMessage(publish ? 'Lower thirds published.' : 'Lower thirds saved.');

        analytics.trackEvent('academy_lower_thirds_saved', {
          courseId: activeCourse?.id || null,
          lowerThirdCount: lowerThirdItems.length,
          publish,
          timestamp: Date.now(),
        });
      } catch (error) {
        setSaveMessage(error instanceof Error ? error.message : 'Could not save lower thirds.');
      }
    },
    [activeCourse, analytics, lowerThirdItems, onSave, state.courses, updateCourse],
  );

  const leftNavItems = [
    { id: 'overview', label: 'Overview', route: '/academy-dashboard' },
    { id: 'lessons', label: 'Lessons', route: '/academy/lesson-editor' },
    { id: 'media', label: 'Media', route: '/academy/media' },
    { id: 'assignments', label: 'Assignments', route: '/academy/assignments' },
    { id: 'cohort', label: 'Cohort Settings', route: '/academy/cohort-settings' },
    { id: 'analytics', label: 'Analytics', route: '/academy/analytics' },
    { id: 'monetization', label: 'Monetization', route: '/academy/monetization' },
    { id: 'lower-thirds', label: 'Animated Lower Thirds', route: '/academy/lower-thirds' },
    { id: 'settings', label: 'Settings', route: '/academy/course-creator' },
  ];

  return (
    <Box
      sx={{
        minHeight: '100vh',
        color: '#edf0f7',
        bgcolor: '#06080d',
        fontFamily: '"Manrope", "Segoe UI", sans-serif',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(circle at 70% 14%, rgba(248,179,33,0.28), rgba(5,8,13,0) 38%), radial-gradient(circle at 20% 82%, rgba(84,119,197,0.16), rgba(6,8,14,0) 43%), linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0) 30%)',
          pointerEvents: 'none',
        }}
      />

      <Box sx={{ display: 'flex', minHeight: '100vh', position: 'relative', zIndex: 1 }}>
        <Box
          component="aside"
          sx={{
            width: 252,
            borderRight: '1px solid rgba(255,255,255,0.08)',
            background: 'linear-gradient(180deg, rgba(10,13,22,0.95), rgba(8,10,16,0.96))',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <Stack spacing={2} sx={{ px: 2.5, py: 2.4 }}>
            <Typography sx={{ letterSpacing: '0.13em', fontSize: 19, fontWeight: 700 }}>
              CREATORHUB ACADEMY
            </Typography>
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
              onClick={addLowerThird}
              sx={{
                width: '100%',
                justifyContent: 'flex-start',
                color: '#edf0f7',
                textTransform: 'none',
                border: '1px solid rgba(255,255,255,0.14)',
                borderRadius: 1,
              }}
            >
              New Module
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
            </Stack>

            <Stack direction="row" spacing={1.2} alignItems="center">
              <IconButton size="small" sx={{ color: 'rgba(237,240,247,0.75)' }}>
                <NotificationsNone fontSize="small" />
              </IconButton>
              <IconButton size="small" sx={{ color: 'rgba(237,240,247,0.75)' }}>
                <MailOutline fontSize="small" />
              </IconButton>
              <Avatar sx={{ width: 34, height: 34, bgcolor: '#f8b321', color: '#111' }}>N</Avatar>
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
            <Box sx={{ minHeight: 0, display: 'flex', flexDirection: 'column', gap: 1.2 }}>
              <Stack
                direction={{ xs: 'column', md: 'row' }}
                spacing={1.2}
                justifyContent="space-between"
                alignItems={{ xs: 'stretch', md: 'center' }}
              >
                <Typography sx={{ fontSize: 40, fontWeight: 600, letterSpacing: '0.02em' }}>
                  Animated Lower Thirds
                </Typography>

                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  <Button
                    variant="outlined"
                    startIcon={<PlayArrow />}
                    onClick={() => setIsPlaying((prev) => !prev)}
                    sx={{
                      textTransform: 'none',
                      borderColor: 'rgba(255,255,255,0.2)',
                      color: '#edf0f7',
                      borderRadius: 1,
                    }}
                  >
                    Preview
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={<Save />}
                    onClick={() => void saveLowerThirdSetup(false)}
                    sx={{
                      textTransform: 'none',
                      borderColor: 'rgba(255,255,255,0.2)',
                      color: '#edf0f7',
                      borderRadius: 1,
                    }}
                  >
                    Save
                  </Button>
                  <Button
                    variant="contained"
                    startIcon={<Publish />}
                    onClick={() => void saveLowerThirdSetup(true)}
                    sx={{
                      textTransform: 'none',
                      borderRadius: 1,
                      color: '#0f0f0f',
                      background: 'linear-gradient(180deg, #ffd44e, #f2a616)',
                      boxShadow: '0 10px 24px rgba(248,179,33,0.25)',
                    }}
                  >
                    Publish
                  </Button>
                </Stack>
              </Stack>

              {!!saveMessage && (
                <Typography
                  sx={{
                    px: 1.2,
                    py: 0.8,
                    borderRadius: 1,
                    border: '1px solid rgba(248,179,33,0.34)',
                    background: 'rgba(248,179,33,0.08)',
                    color: '#f8d56f',
                  }}
                >
                  {saveMessage}
                </Typography>
              )}

              <Stack direction="row" spacing={1.1} sx={{ ...panelSx, px: 1.2, py: 1 }}>
                <IconButton size="small" onClick={() => setIsPlaying((prev) => !prev)} sx={{ color: '#edf0f7' }}>
                  {isPlaying ? <Pause fontSize="small" /> : <PlayArrow fontSize="small" />}
                </IconButton>
                <Typography sx={{ minWidth: 52, color: 'rgba(237,240,247,0.78)' }}>{formatTime(currentTime)}</Typography>
                <Slider
                  value={currentTime}
                  min={0}
                  max={duration}
                  onChange={(_, value) => {
                    const next = Array.isArray(value) ? value[0] : value;
                    setCurrentTime(next);
                  }}
                  sx={{
                    color: '#f8b321',
                    '& .MuiSlider-thumb': {
                      width: 12,
                      height: 12,
                    },
                  }}
                />
                <Typography sx={{ minWidth: 92, textAlign: 'right', color: 'rgba(237,240,247,0.78)' }}>
                  {formatTime(duration)}
                </Typography>
              </Stack>

              <Box sx={{ ...panelSx, p: 1.1 }}>
                <Box
                  sx={{
                    borderRadius: 1.1,
                    border: '1px solid rgba(255,255,255,0.08)',
                    overflow: 'hidden',
                    position: 'relative',
                    aspectRatio: '16 / 9',
                    background:
                      'radial-gradient(circle at 72% 18%, rgba(248,179,33,0.4), rgba(8,12,19,0) 46%), radial-gradient(circle at 28% 28%, rgba(78,118,195,0.2), rgba(8,12,19,0) 44%), linear-gradient(140deg, rgba(15,23,34,0.95), rgba(8,12,19,0.95))',
                  }}
                >
                  {selectedLowerThird && activeLowerThirdVisible && (
                    <Box
                      sx={{
                        position: 'absolute',
                        left:
                          selectedLowerThird.position === 'bottom-left' ||
                          selectedLowerThird.position === 'top-left'
                            ? 24
                            : selectedLowerThird.position === 'bottom-center' ||
                                selectedLowerThird.position === 'top-center'
                              ? '50%'
                              : 'auto',
                        right:
                          selectedLowerThird.position === 'bottom-right' ||
                          selectedLowerThird.position === 'top-right'
                            ? 24
                            : 'auto',
                        transform:
                          selectedLowerThird.position === 'bottom-center' ||
                          selectedLowerThird.position === 'top-center'
                            ? 'translateX(-50%)'
                            : 'none',
                        bottom:
                          selectedLowerThird.position.includes('bottom')
                            ? 24
                            : 'auto',
                        top: selectedLowerThird.position.includes('top') ? 24 : 'auto',
                        width: { xs: '88%', sm: '56%' },
                        borderRadius: `${selectedLowerThird.style.borderRadius}px`,
                        border: '1px solid rgba(255,255,255,0.18)',
                        background: selectedLowerThird.style.background,
                        color: selectedLowerThird.style.text,
                        p: `${selectedLowerThird.style.padding}px`,
                        opacity: selectedLowerThird.style.opacity,
                        boxShadow: '0 18px 34px rgba(0,0,0,0.45)',
                      }}
                    >
                      <Box
                        sx={{
                          position: 'absolute',
                          left: 6,
                          top: 8,
                          bottom: 8,
                          width: 4,
                          borderRadius: 1,
                          bgcolor: selectedLowerThird.style.accent,
                        }}
                      />
                      <Stack sx={{ pl: 1.1 }}>
                        <Typography
                          sx={{
                            fontSize: `${selectedLowerThird.style.fontSize + 14}px`,
                            lineHeight: 1.05,
                            fontFamily: 'Barlow Condensed, sans-serif',
                          }}
                        >
                          {selectedLowerThird.title}
                        </Typography>
                        <Typography
                          sx={{
                            mt: 0.2,
                            color: alpha(selectedLowerThird.style.text, 0.88),
                            fontSize: `${selectedLowerThird.style.fontSize + 6}px`,
                          }}
                        >
                          {selectedLowerThird.subtitle}
                        </Typography>
                      </Stack>
                    </Box>
                  )}
                </Box>

                <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: 1 }}>
                  <IconButton size="small" sx={{ color: '#edf0f7' }} onClick={() => setIsPlaying((prev) => !prev)}>
                    {isPlaying ? <Pause fontSize="small" /> : <PlayArrow fontSize="small" />}
                  </IconButton>
                  <Typography sx={{ color: 'rgba(237,240,247,0.76)', minWidth: 74 }}>{formatTime(currentTime)}</Typography>
                  <Slider
                    value={currentTime}
                    min={0}
                    max={duration}
                    onChange={(_, value) => {
                      const next = Array.isArray(value) ? value[0] : value;
                      setCurrentTime(next);
                    }}
                    sx={{
                      color: '#f8b321',
                      '& .MuiSlider-thumb': {
                        width: 11,
                        height: 11,
                      },
                    }}
                  />
                </Stack>
              </Box>

              <Box sx={{ ...panelSx, p: 1.1 }}>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.8 }}>
                  <Typography sx={{ fontSize: 34, fontFamily: 'Barlow Condensed, sans-serif', lineHeight: 1 }}>
                    Animated Lower Thirds
                  </Typography>
                  <Switch
                    size="small"
                    checked={selectedLowerThird?.enabled || false}
                    onChange={(event) => setSelectedLowerThirdField('enabled', event.target.checked)}
                  />
                  <Chip
                    size="small"
                    label={selectedLowerThird?.animation || 'slide-up'}
                    sx={{ bgcolor: 'rgba(255,255,255,0.08)', color: '#edf0f7' }}
                  />
                </Stack>

                <Tabs
                  value={editorTab}
                  onChange={(_, value: EditorTab) => setEditorTab(value)}
                  textColor="inherit"
                  sx={{
                    mb: 1,
                    '& .MuiTabs-indicator': { backgroundColor: '#f8b321' },
                    '& .MuiTab-root': { color: 'rgba(237,240,247,0.7)', textTransform: 'none', minHeight: 38 },
                    '& .Mui-selected': { color: '#f7f8fb' },
                  }}
                >
                  <Tab value="content" label="Content" />
                  <Tab value="style" label="Style" />
                  <Tab value="animation" label="Animation" />
                  <Tab value="safe-guides" label="Safe Guides" />
                </Tabs>

                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1fr) 290px' },
                    gap: 1.1,
                  }}
                >
                  <Box sx={{ ...panelSx, p: 1 }}>
                    {editorTab === 'content' && selectedLowerThird && (
                      <Stack spacing={0.8}>
                        <TextField
                          size="small"
                          label="Name"
                          value={selectedLowerThird.name}
                          onChange={(event) => setSelectedLowerThirdField('name', event.target.value)}
                          sx={{ '& .MuiInputBase-root': { color: '#edf0f7' } }}
                        />
                        <TextField
                          size="small"
                          label="Title"
                          value={selectedLowerThird.title}
                          onChange={(event) => setSelectedLowerThirdField('title', event.target.value)}
                          sx={{ '& .MuiInputBase-root': { color: '#edf0f7' } }}
                        />
                        <TextField
                          size="small"
                          label="Subtitle"
                          value={selectedLowerThird.subtitle}
                          onChange={(event) => setSelectedLowerThirdField('subtitle', event.target.value)}
                          sx={{ '& .MuiInputBase-root': { color: '#edf0f7' } }}
                        />
                        <Stack direction="row" spacing={0.8}>
                          <TextField
                            size="small"
                            type="number"
                            label="Start"
                            value={selectedLowerThird.startTime}
                            onChange={(event) =>
                              setSelectedLowerThirdField('startTime', Math.max(0, Number(event.target.value) || 0))
                            }
                            sx={{ '& .MuiInputBase-root': { color: '#edf0f7' } }}
                          />
                          <TextField
                            size="small"
                            type="number"
                            label="Duration"
                            value={selectedLowerThird.duration}
                            onChange={(event) =>
                              setSelectedLowerThirdField('duration', Math.max(0.5, Number(event.target.value) || 0))
                            }
                            sx={{ '& .MuiInputBase-root': { color: '#edf0f7' } }}
                          />
                        </Stack>
                      </Stack>
                    )}

                    {editorTab === 'style' && selectedLowerThird && (
                      <Stack spacing={0.8}>
                        <TextField
                          size="small"
                          label="Background"
                          value={selectedLowerThird.style.background}
                          onChange={(event) => setSelectedLowerThirdStyleField('background', event.target.value)}
                          sx={{ '& .MuiInputBase-root': { color: '#edf0f7' } }}
                        />
                        <TextField
                          size="small"
                          label="Text Color"
                          value={selectedLowerThird.style.text}
                          onChange={(event) => setSelectedLowerThirdStyleField('text', event.target.value)}
                          sx={{ '& .MuiInputBase-root': { color: '#edf0f7' } }}
                        />
                        <TextField
                          size="small"
                          label="Accent Color"
                          value={selectedLowerThird.style.accent}
                          onChange={(event) => setSelectedLowerThirdStyleField('accent', event.target.value)}
                          sx={{ '& .MuiInputBase-root': { color: '#edf0f7' } }}
                        />
                        <Typography sx={{ color: 'rgba(237,240,247,0.72)', fontSize: 12 }}>Opacity</Typography>
                        <Slider
                          value={selectedLowerThird.style.opacity}
                          min={0.2}
                          max={1}
                          step={0.01}
                          onChange={(_, value) => {
                            const next = Array.isArray(value) ? value[0] : value;
                            setSelectedLowerThirdStyleField('opacity', next);
                          }}
                          sx={{ color: '#f8b321' }}
                        />
                        <Typography sx={{ color: 'rgba(237,240,247,0.72)', fontSize: 12 }}>Font Size</Typography>
                        <Slider
                          value={selectedLowerThird.style.fontSize}
                          min={11}
                          max={28}
                          step={1}
                          onChange={(_, value) => {
                            const next = Array.isArray(value) ? value[0] : value;
                            setSelectedLowerThirdStyleField('fontSize', next);
                          }}
                          sx={{ color: '#f8b321' }}
                        />
                      </Stack>
                    )}

                    {editorTab === 'animation' && selectedLowerThird && (
                      <Stack spacing={0.8}>
                        <Stack direction="row" spacing={0.8}>
                          <Select
                            size="small"
                            value={selectedLowerThird.animation}
                            onChange={(event) =>
                              setSelectedLowerThirdField('animation', event.target.value as LowerThirdAnimation)
                            }
                            sx={{
                              flex: 1,
                              color: '#edf0f7',
                              '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.17)' },
                            }}
                          >
                            <MenuItem value="slide-up">Slide Up</MenuItem>
                            <MenuItem value="slide-down">Slide Down</MenuItem>
                            <MenuItem value="slide-left">Slide Left</MenuItem>
                            <MenuItem value="slide-right">Slide Right</MenuItem>
                            <MenuItem value="fade-in">Fade In</MenuItem>
                            <MenuItem value="zoom-in">Zoom In</MenuItem>
                          </Select>
                          <Select
                            size="small"
                            value={selectedLowerThird.position}
                            onChange={(event) =>
                              setSelectedLowerThirdField('position', event.target.value as LowerThirdPosition)
                            }
                            sx={{
                              flex: 1,
                              color: '#edf0f7',
                              '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.17)' },
                            }}
                          >
                            <MenuItem value="bottom-left">Bottom Left</MenuItem>
                            <MenuItem value="bottom-center">Bottom Center</MenuItem>
                            <MenuItem value="bottom-right">Bottom Right</MenuItem>
                            <MenuItem value="top-left">Top Left</MenuItem>
                            <MenuItem value="top-center">Top Center</MenuItem>
                            <MenuItem value="top-right">Top Right</MenuItem>
                          </Select>
                        </Stack>
                        <Typography sx={{ color: 'rgba(237,240,247,0.72)', fontSize: 12 }}>
                          Duration: {selectedLowerThird.duration.toFixed(1)}s
                        </Typography>
                        <Slider
                          value={selectedLowerThird.duration}
                          min={1}
                          max={8}
                          step={0.1}
                          onChange={(_, value) => {
                            const next = Array.isArray(value) ? value[0] : value;
                            setSelectedLowerThirdField('duration', next);
                          }}
                          sx={{ color: '#f8b321' }}
                        />
                        <Typography sx={{ color: 'rgba(237,240,247,0.72)', fontSize: 12 }}>
                          Delay: {selectedLowerThird.delay.toFixed(1)}s
                        </Typography>
                        <Slider
                          value={selectedLowerThird.delay}
                          min={0}
                          max={4}
                          step={0.1}
                          onChange={(_, value) => {
                            const next = Array.isArray(value) ? value[0] : value;
                            setSelectedLowerThirdField('delay', next);
                          }}
                          sx={{ color: '#89b5d8' }}
                        />
                      </Stack>
                    )}

                    {editorTab === 'safe-guides' && selectedLowerThird && (
                      <Stack spacing={0.8}>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Switch
                            size="small"
                            checked={selectedLowerThird.safeGuides.enabled}
                            onChange={(event) => setSelectedLowerThirdSafeField('enabled', event.target.checked)}
                          />
                          <Typography sx={{ color: 'rgba(237,240,247,0.78)' }}>Enable Safe Guides</Typography>
                        </Stack>
                        <Select
                          size="small"
                          value={selectedLowerThird.safeGuides.type}
                          onChange={(event) =>
                            setSelectedLowerThirdSafeField(
                              'type',
                              event.target.value as LowerThirdItem['safeGuides']['type'],
                            )
                          }
                          sx={{
                            color: '#edf0f7',
                            '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.17)' },
                          }}
                        >
                          <MenuItem value="title-safe">Title Safe</MenuItem>
                          <MenuItem value="action-safe">Action Safe</MenuItem>
                          <MenuItem value="custom">Custom</MenuItem>
                        </Select>

                        <Stack direction="row" spacing={0.8}>
                          <TextField
                            size="small"
                            type="number"
                            label="Top %"
                            value={selectedLowerThird.safeGuides.marginTop}
                            onChange={(event) =>
                              setSelectedLowerThirdSafeField('marginTop', Math.max(0, Number(event.target.value) || 0))
                            }
                            sx={{ '& .MuiInputBase-root': { color: '#edf0f7' } }}
                          />
                          <TextField
                            size="small"
                            type="number"
                            label="Bottom %"
                            value={selectedLowerThird.safeGuides.marginBottom}
                            onChange={(event) =>
                              setSelectedLowerThirdSafeField(
                                'marginBottom',
                                Math.max(0, Number(event.target.value) || 0),
                              )
                            }
                            sx={{ '& .MuiInputBase-root': { color: '#edf0f7' } }}
                          />
                        </Stack>
                      </Stack>
                    )}
                  </Box>

                  <Box sx={{ ...panelSx, p: 1 }}>
                    <TextField
                      size="small"
                      placeholder="Search lower thirds..."
                      value={searchValue}
                      onChange={(event) => setSearchValue(event.target.value)}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <Search sx={{ color: 'rgba(237,240,247,0.5)' }} />
                          </InputAdornment>
                        ),
                      }}
                      sx={{
                        mb: 0.9,
                        '& .MuiInputBase-root': {
                          color: '#edf0f7',
                          bgcolor: 'rgba(10,13,20,0.7)',
                        },
                      }}
                    />

                    <Stack spacing={0.7}>
                      {filteredLowerThirds.map((lowerThird) => {
                        const active = selectedLowerThirdId === lowerThird.id;
                        return (
                          <Button
                            key={lowerThird.id}
                            onClick={() => setSelectedLowerThirdId(lowerThird.id)}
                            sx={{
                              justifyContent: 'space-between',
                              textTransform: 'none',
                              color: '#edf0f7',
                              borderRadius: 1,
                              border: active ? '1px solid rgba(248,179,33,0.52)' : '1px solid rgba(255,255,255,0.14)',
                              background: active
                                ? 'linear-gradient(90deg, rgba(248,179,33,0.18), rgba(248,179,33,0.04))'
                                : 'rgba(255,255,255,0.02)',
                            }}
                          >
                            <Stack direction="row" spacing={0.8} alignItems="center">
                              <Subtitles fontSize="small" sx={{ color: '#f8d56f' }} />
                              <Typography noWrap>{lowerThird.name}</Typography>
                            </Stack>
                            <Chip
                              size="small"
                              label={`${lowerThird.duration.toFixed(1)}s`}
                              sx={{ bgcolor: 'rgba(255,255,255,0.09)', color: '#edf0f7' }}
                            />
                          </Button>
                        );
                      })}
                    </Stack>

                    <Stack direction="row" spacing={0.7} sx={{ mt: 1 }}>
                      <IconButton
                        size="small"
                        onClick={duplicateLowerThird}
                        sx={{ color: '#edf0f7', border: '1px solid rgba(255,255,255,0.2)' }}
                      >
                        <AutoAwesome fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        sx={{ color: '#edf0f7', border: '1px solid rgba(255,255,255,0.2)' }}
                      >
                        <MoreHoriz fontSize="small" />
                      </IconButton>
                    </Stack>
                  </Box>
                </Box>

                <Button
                  startIcon={<Add />}
                  onClick={addLowerThird}
                  sx={{
                    mt: 1,
                    textTransform: 'none',
                    color: '#edf0f7',
                    border: '1px solid rgba(255,255,255,0.2)',
                  }}
                >
                  New Lower Third
                </Button>
              </Box>
            </Box>

            <Box sx={{ ...panelSx, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
              <Tabs
                value={rightTab}
                onChange={(_, value: RightTab) => setRightTab(value)}
                textColor="inherit"
                sx={{
                  borderBottom: '1px solid rgba(255,255,255,0.08)',
                  '& .MuiTabs-indicator': { backgroundColor: '#f8b321' },
                  '& .MuiTab-root': { color: 'rgba(237,240,247,0.78)', textTransform: 'none', minHeight: 44 },
                  '& .Mui-selected': { color: '#f7f8fb' },
                }}
              >
                <Tab label="Style & Animation" value="style-animation" />
                <Tab label="Safe Guides" value="safe-guides" />
              </Tabs>

              <Box sx={{ p: 1.2, minHeight: 0, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 1 }}>
                {selectedLowerThird && rightTab === 'style-animation' && (
                  <>
                    <Box sx={{ ...panelSx, p: 1 }}>
                      <Stack direction="row" spacing={0.8} alignItems="center" sx={{ mb: 0.8 }}>
                        <Tune fontSize="small" sx={{ color: '#f8d56f' }} />
                        <Typography sx={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: 30, lineHeight: 1 }}>
                          Animation
                        </Typography>
                      </Stack>

                      <Stack spacing={0.8}>
                        <Select
                          size="small"
                          value={selectedLowerThird.animation}
                          onChange={(event) =>
                            setSelectedLowerThirdField('animation', event.target.value as LowerThirdAnimation)
                          }
                          sx={{
                            color: '#edf0f7',
                            '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.17)' },
                          }}
                        >
                          <MenuItem value="slide-up">Slide Up</MenuItem>
                          <MenuItem value="slide-down">Slide Down</MenuItem>
                          <MenuItem value="slide-left">Slide Left</MenuItem>
                          <MenuItem value="slide-right">Slide Right</MenuItem>
                          <MenuItem value="fade-in">Fade In</MenuItem>
                          <MenuItem value="zoom-in">Zoom In</MenuItem>
                        </Select>
                        <Select
                          size="small"
                          value={selectedLowerThird.position}
                          onChange={(event) =>
                            setSelectedLowerThirdField('position', event.target.value as LowerThirdPosition)
                          }
                          sx={{
                            color: '#edf0f7',
                            '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.17)' },
                          }}
                        >
                          <MenuItem value="bottom-left">Bottom Left</MenuItem>
                          <MenuItem value="bottom-center">Bottom Center</MenuItem>
                          <MenuItem value="bottom-right">Bottom Right</MenuItem>
                          <MenuItem value="top-left">Top Left</MenuItem>
                          <MenuItem value="top-center">Top Center</MenuItem>
                          <MenuItem value="top-right">Top Right</MenuItem>
                        </Select>

                        <Typography sx={{ color: 'rgba(237,240,247,0.72)', fontSize: 12 }}>
                          Duration {selectedLowerThird.duration.toFixed(1)}s
                        </Typography>
                        <Slider
                          value={selectedLowerThird.duration}
                          min={1}
                          max={8}
                          step={0.1}
                          onChange={(_, value) => {
                            const next = Array.isArray(value) ? value[0] : value;
                            setSelectedLowerThirdField('duration', next);
                          }}
                          sx={{ color: '#f8b321' }}
                        />
                        <Typography sx={{ color: 'rgba(237,240,247,0.72)', fontSize: 12 }}>
                          Delay {selectedLowerThird.delay.toFixed(1)}s
                        </Typography>
                        <Slider
                          value={selectedLowerThird.delay}
                          min={0}
                          max={4}
                          step={0.1}
                          onChange={(_, value) => {
                            const next = Array.isArray(value) ? value[0] : value;
                            setSelectedLowerThirdField('delay', next);
                          }}
                          sx={{ color: '#89b5d8' }}
                        />
                      </Stack>
                    </Box>

                    <Box sx={{ ...panelSx, p: 1 }}>
                      <Stack direction="row" spacing={1.2}>
                        <Stack direction="row" spacing={0.8} alignItems="center">
                          <Switch
                            size="small"
                            checked={selectedLowerThird.bounce}
                            onChange={(event) => setSelectedLowerThirdField('bounce', event.target.checked)}
                          />
                          <Typography>Bounce</Typography>
                        </Stack>
                        <Stack direction="row" spacing={0.8} alignItems="center">
                          <Switch
                            size="small"
                            checked={selectedLowerThird.elastic}
                            onChange={(event) => setSelectedLowerThirdField('elastic', event.target.checked)}
                          />
                          <Typography>Elastic</Typography>
                        </Stack>
                      </Stack>

                      <Typography sx={{ color: 'rgba(237,240,247,0.72)', mt: 0.8, fontSize: 12 }}>
                        Ease In {selectedLowerThird.easeIn.toFixed(1)}
                      </Typography>
                      <Slider
                        value={selectedLowerThird.easeIn}
                        min={0}
                        max={1}
                        step={0.1}
                        onChange={(_, value) => {
                          const next = Array.isArray(value) ? value[0] : value;
                          setSelectedLowerThirdField('easeIn', next);
                        }}
                        sx={{ color: '#89b5d8' }}
                      />
                      <Typography sx={{ color: 'rgba(237,240,247,0.72)', fontSize: 12 }}>
                        Ease Out {selectedLowerThird.easeOut.toFixed(1)}
                      </Typography>
                      <Slider
                        value={selectedLowerThird.easeOut}
                        min={0}
                        max={1}
                        step={0.1}
                        onChange={(_, value) => {
                          const next = Array.isArray(value) ? value[0] : value;
                          setSelectedLowerThirdField('easeOut', next);
                        }}
                        sx={{ color: '#89b5d8' }}
                      />
                    </Box>
                  </>
                )}

                {selectedLowerThird && rightTab === 'safe-guides' && (
                  <Box sx={{ ...panelSx, p: 1 }}>
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                      <Switch
                        size="small"
                        checked={selectedLowerThird.safeGuides.enabled}
                        onChange={(event) => setSelectedLowerThirdSafeField('enabled', event.target.checked)}
                      />
                      <Typography sx={{ fontWeight: 600 }}>Safe Guidelines</Typography>
                    </Stack>

                    <Select
                      fullWidth
                      size="small"
                      value={selectedLowerThird.safeGuides.type}
                      onChange={(event) =>
                        setSelectedLowerThirdSafeField(
                          'type',
                          event.target.value as LowerThirdItem['safeGuides']['type'],
                        )
                      }
                      sx={{
                        mb: 1,
                        color: '#edf0f7',
                        '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.17)' },
                      }}
                    >
                      <MenuItem value="title-safe">Title Safe</MenuItem>
                      <MenuItem value="action-safe">Action Safe</MenuItem>
                      <MenuItem value="custom">Custom</MenuItem>
                    </Select>

                    <Stack spacing={0.8}>
                      <TextField
                        size="small"
                        type="number"
                        label="Top Margin %"
                        value={selectedLowerThird.safeGuides.marginTop}
                        onChange={(event) =>
                          setSelectedLowerThirdSafeField('marginTop', Math.max(0, Number(event.target.value) || 0))
                        }
                        sx={{ '& .MuiInputBase-root': { color: '#edf0f7' } }}
                      />
                      <TextField
                        size="small"
                        type="number"
                        label="Right Margin %"
                        value={selectedLowerThird.safeGuides.marginRight}
                        onChange={(event) =>
                          setSelectedLowerThirdSafeField('marginRight', Math.max(0, Number(event.target.value) || 0))
                        }
                        sx={{ '& .MuiInputBase-root': { color: '#edf0f7' } }}
                      />
                      <TextField
                        size="small"
                        type="number"
                        label="Bottom Margin %"
                        value={selectedLowerThird.safeGuides.marginBottom}
                        onChange={(event) =>
                          setSelectedLowerThirdSafeField(
                            'marginBottom',
                            Math.max(0, Number(event.target.value) || 0),
                          )
                        }
                        sx={{ '& .MuiInputBase-root': { color: '#edf0f7' } }}
                      />
                      <TextField
                        size="small"
                        type="number"
                        label="Left Margin %"
                        value={selectedLowerThird.safeGuides.marginLeft}
                        onChange={(event) =>
                          setSelectedLowerThirdSafeField('marginLeft', Math.max(0, Number(event.target.value) || 0))
                        }
                        sx={{ '& .MuiInputBase-root': { color: '#edf0f7' } }}
                      />
                    </Stack>
                  </Box>
                )}

                <Box sx={{ ...panelSx, p: 1 }}>
                  <Typography sx={{ color: '#f8d56f', fontWeight: 600 }}>
                    Lower Thirds: 3-6s (4.5s recommended)
                  </Typography>
                  <Typography sx={{ color: '#f8d56f', fontWeight: 600, mt: 0.4 }}>
                    Captions: 1.5-6s (3.5s recommended)
                  </Typography>
                  <Typography sx={{ color: 'rgba(237,240,247,0.67)', fontSize: 12, mt: 0.6 }}>
                    Keep text readable, avoid edge clipping, and stay inside safe areas.
                  </Typography>
                </Box>

                <Box sx={{ ...panelSx, p: 1 }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography sx={{ color: 'rgba(237,240,247,0.72)' }}>Views</Typography>
                    <Typography>{selectedLowerThird?.analytics.views.toLocaleString() || 0}</Typography>
                  </Stack>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 0.5 }}>
                    <Typography sx={{ color: 'rgba(237,240,247,0.72)' }}>Avg Watch</Typography>
                    <Typography>{selectedLowerThird?.analytics.avgWatch.toFixed(1) || '0.0'}s</Typography>
                  </Stack>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 0.5 }}>
                    <Typography sx={{ color: 'rgba(237,240,247,0.72)' }}>Completion</Typography>
                    <Typography sx={{ color: '#7eea8e' }}>
                      {selectedLowerThird?.analytics.completionRate || 0}%
                    </Typography>
                  </Stack>
                  <LinearProgress
                    variant="determinate"
                    value={Math.max(6, selectedLowerThird?.analytics.completionRate || 0)}
                    sx={{
                      mt: 0.8,
                      height: 7,
                      borderRadius: 999,
                      bgcolor: 'rgba(255,255,255,0.14)',
                      '& .MuiLinearProgress-bar': {
                        borderRadius: 999,
                        background: 'linear-gradient(90deg, #8de270 0%, #f8b321 100%)',
                      },
                    }}
                  />
                </Box>
              </Box>

              <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)' }} />
              <Stack direction="row" spacing={1} sx={{ p: 1.1 }}>
                <Button
                  startIcon={<PlayArrow />}
                  onClick={() => setIsPlaying((prev) => !prev)}
                  sx={{
                    flex: 1,
                    textTransform: 'none',
                    color: '#edf0f7',
                    border: '1px solid rgba(255,255,255,0.18)',
                  }}
                >
                  Preview
                </Button>
                <Button
                  startIcon={<Save />}
                  onClick={() => void saveLowerThirdSetup(false)}
                  sx={{
                    flex: 1,
                    textTransform: 'none',
                    color: '#edf0f7',
                    border: '1px solid rgba(255,255,255,0.18)',
                  }}
                >
                  Save
                </Button>
                <Button
                  onClick={() => {
                    if (onCancel) {
                      onCancel();
                    } else {
                      setLocation('/academy/video-player');
                    }
                  }}
                  sx={{
                    textTransform: 'none',
                    color: 'rgba(237,240,247,0.76)',
                    border: '1px solid rgba(255,255,255,0.16)',
                  }}
                >
                  Close
                </Button>
                <Button
                  onClick={() => void saveLowerThirdSetup(true)}
                  sx={{
                    textTransform: 'none',
                    color: '#0f0f0f',
                    background: 'linear-gradient(180deg, #ffd44e, #f2a616)',
                    fontWeight: 700,
                  }}
                >
                  Publish
                </Button>
              </Stack>
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

export default withUniversalIntegration(AcademyLowerThirdsStudio, {
  componentId: 'academy-lower-thirds-studio',
  componentName: 'Academy Lower Thirds Studio',
  componentType: 'editor',
  componentCategory: 'academy',
  featureIds: ['lower-thirds', 'safe-guides', 'animation-controls', 'academy-video-branding'],
});
