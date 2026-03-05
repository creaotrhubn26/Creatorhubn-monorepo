import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  alpha,
  Avatar,
  Box,
  Button,
  Chip,
  Divider,
  FormControlLabel,
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
  Campaign,
  ContentCopy,
  Delete,
  MailOutline,
  MonetizationOn,
  MoreHoriz,
  NotificationsNone,
  Pause,
  PlayArrow,
  Publish,
  Save,
  Search,
  Subtitles,
} from '@mui/icons-material';
import { useLocation } from 'wouter';
import { useAcademy, type Course } from '@/contexts/AcademyContext';
import { useEnhancedMasterIntegration } from '@/integration/EnhancedMasterIntegrationProvider';
import { withUniversalIntegration } from '@/integration/UniversalIntegrationHOC';
import { useAcademyLocale } from './academyLocale';
import AcademyBrandMark from './AcademyBrandMark';

interface AcademyCTAOverlayStudioProps {
  courseId?: string;
  onSave?: (payload: Record<string, unknown>) => void;
  onCancel?: () => void;
}

type CTAType = 'checkout' | 'newsletter' | 'community' | 'download' | 'custom';
type Placement = 'bottom-center' | 'bottom-right' | 'center' | 'top-right';
type RightTab = 'performance' | 'abtest' | 'analytics';
type EditorTab = 'content' | 'design' | 'analytics';

interface CTAOverlayItem {
  id: string;
  name: string;
  type: CTAType;
  title: string;
  subtitle: string;
  primaryLabel: string;
  secondaryLabel: string;
  urgency: string;
  url: string;
  triggerAt: number;
  endAt: number;
  placement: Placement;
  enabled: boolean;
  abTestEnabled: boolean;
  style: {
    bg: string;
    text: string;
    button: string;
    buttonText: string;
    opacity: number;
    borderRadius: number;
  };
  analytics: {
    views: number;
    clicks: number;
    conversions: number;
    revenue: number;
    avgWatchBeforeTrigger: number;
    variantA: number;
    variantB: number;
  };
}

const panelSx = {
  borderRadius: 1.4,
  border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.08)',
  background: 'linear-gradient(145deg, rgba(20,24,36,0.88), rgba(11,14,22,0.96))',
};

const academyShellMaxWidth = 'min(100%, var(--academy-shell-max-width, 1920px))';

const toNok = (value: number): string =>
  new Intl.NumberFormat('nb-NO', {
    style: 'currency',
    currency: 'NOK',
    maximumFractionDigits: 0,
  }).format(Math.max(0, value));

const formatTime = (seconds: number): string => {
  const safe = Number.isFinite(seconds) && seconds >= 0 ? seconds : 0;
  const min = Math.floor(safe / 60);
  const sec = Math.floor(safe % 60);
  return `${min}:${sec.toString().padStart(2, '0')}`;
};

const fallbackCourses: Course[] = [
  {
    id: 'cta-course-1',
    title: 'Directing Masterclass',
    description: 'Premium directing track.',
    instructor: {
      id: 'studio',
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
    tags: ['directing', 'cinematography'],
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

const defaultOverlays = (): CTAOverlayItem[] => [
  {
    id: `cta-${Date.now()}-1`,
    name: 'Checkout CTA',
    type: 'checkout',
    title: 'Advance Your Filmmaking Skills',
    subtitle: 'Join the comprehensive 6-week course',
    primaryLabel: 'Enroll Now',
    secondaryLabel: 'No Thanks',
    urgency: 'Ends soon! 3 spots left',
    url: 'https://academy.creatorhub.no/checkout',
    triggerAt: 230,
    endAt: 280,
    placement: 'bottom-center',
    enabled: true,
    abTestEnabled: true,
    style: {
      bg: 'rgba(10,15,25,0.84)',
      text: '#f5f1e7',
      button: '#d99622',
      buttonText: '#1a1306',
      opacity: 0.97,
      borderRadius: 12,
    },
    analytics: {
      views: 6540,
      clicks: 835,
      conversions: 178,
      revenue: 19320,
      avgWatchBeforeTrigger: 36,
      variantA: 12.8,
      variantB: 9.4,
    },
  },
  {
    id: `cta-${Date.now()}-2`,
    name: 'Community CTA',
    type: 'community',
    title: 'Join CreatorHub Community',
    subtitle: 'Get production feedback and cohort support',
    primaryLabel: 'Join Community',
    secondaryLabel: 'Later',
    urgency: 'Network with 500+ creators',
    url: 'https://community.creatorhub.no',
    triggerAt: 140,
    endAt: 188,
    placement: 'bottom-right',
    enabled: false,
    abTestEnabled: false,
    style: {
      bg: 'rgba(14,19,29,0.88)',
      text: '#f4efe4',
      button: '#f2b131',
      buttonText: '#1e1506',
      opacity: 0.96,
      borderRadius: 10,
    },
    analytics: {
      views: 2280,
      clicks: 302,
      conversions: 59,
      revenue: 5840,
      avgWatchBeforeTrigger: 22,
      variantA: 8.2,
      variantB: 7.5,
    },
  },
];

function AcademyCTAOverlayStudio({ courseId, onSave, onCancel }: AcademyCTAOverlayStudioProps) {
  const [, setLocation] = useLocation();
  const { state, getCourse, updateCourse } = useAcademy();
  const { analytics, debugging } = useEnhancedMasterIntegration();
  
  const { navLabel, tt } = useAcademyLocale();

  const [leftNav, setLeftNav] = useState('cta');
  const [rightTab, setRightTab] = useState<RightTab>('performance');
  const [editorTab, setEditorTab] = useState<EditorTab>('content');
  const [search, setSearch] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(230);
  const [duration, setDuration] = useState(289);
  const [triggerEnabled, setTriggerEnabled] = useState(true);
  const [resetToKeyframe, setResetToKeyframe] = useState(true);
  const [overlayItems, setOverlayItems] = useState<CTAOverlayItem[]>(defaultOverlays);
  const [selectedOverlayId, setSelectedOverlayId] = useState('');
  const [saveMessage, setSaveMessage] = useState('');
  const [selectedCourseId, setSelectedCourseId] = useState(courseId || '');

  const courseItems = useMemo(() => {
    if (state.courses.length > 0) {
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

  useEffect(() => {
    if (!selectedCourseId && activeCourse?.id) {
      setSelectedCourseId(activeCourse.id);
    }
  }, [activeCourse?.id, selectedCourseId]);

  useEffect(() => {
    if (!selectedOverlayId && overlayItems.length > 0) {
      setSelectedOverlayId(overlayItems[0].id);
    }
  }, [overlayItems, selectedOverlayId]);

  useEffect(() => {
    const courseDuration = Number(activeCourse?.duration || 0);
    if (!Number.isFinite(courseDuration) || courseDuration <= 0) return;
    const safeDuration = Math.max(60, Math.round(courseDuration));
    setDuration(safeDuration);
    setCurrentTime((prev) => Math.min(prev, safeDuration));
  }, [activeCourse?.duration]);

  useEffect(() => {
    analytics.trackEvent('academy_cta_overlay_studio_opened', {
      courseId: activeCourse?.id || null,
      overlayCount: overlayItems.length,
      timestamp: Date.now(),
    });
    debugging.logIntegration('info', 'AcademyCTAOverlayStudio opened', {
      courseId: activeCourse?.id || null,
      overlayCount: overlayItems.length,
    });
  }, [activeCourse?.id, analytics, debugging, overlayItems.length]);

  useEffect(() => {
    if (!isPlaying) return;
    const timer = window.setInterval(() => {
      setCurrentTime((prev) => {
        const next = prev + 1;
        if (next >= duration) {
          return resetToKeyframe ? selectedOverlay?.triggerAt || 0 : 0;
        }
        return next;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [duration, isPlaying, resetToKeyframe]);

  const selectedOverlay = useMemo(() => {
    return overlayItems.find((overlay) => overlay.id === selectedOverlayId) || overlayItems[0] || null;
  }, [overlayItems, selectedOverlayId]);

  const filteredOverlays = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return overlayItems;
    return overlayItems.filter((overlay) => {
      return overlay.name.toLowerCase().includes(query) || overlay.title.toLowerCase().includes(query);
    });
  }, [overlayItems, search]);

  const liveOverlayVisible = Boolean(
    selectedOverlay &&
      selectedOverlay.enabled &&
      triggerEnabled &&
      currentTime >= selectedOverlay.triggerAt &&
      currentTime <= selectedOverlay.endAt,
  );

  const ctr = useMemo(() => {
    if (!selectedOverlay) return 0;
    if (!selectedOverlay.analytics.views) return 0;
    return Number(((selectedOverlay.analytics.clicks / selectedOverlay.analytics.views) * 100).toFixed(1));
  }, [selectedOverlay]);

  const conversionRate = useMemo(() => {
    if (!selectedOverlay) return 0;
    if (!selectedOverlay.analytics.views) return 0;
    return Number(((selectedOverlay.analytics.conversions / selectedOverlay.analytics.views) * 100).toFixed(1));
  }, [selectedOverlay]);

  const uplift = useMemo(() => {
    if (!selectedOverlay) return 0;
    return Math.round((selectedOverlay.analytics.variantA - selectedOverlay.analytics.variantB) * 10);
  }, [selectedOverlay]);

  const setSelectedOverlayField = useCallback(
    <K extends keyof CTAOverlayItem>(field: K, value: CTAOverlayItem[K]) => {
      setOverlayItems((prev) =>
        prev.map((item) => {
          if (item.id !== selectedOverlayId) return item;
          return { ...item, [field]: value };
        }),
      );
    },
    [selectedOverlayId],
  );

  const setSelectedStyleField = useCallback(
    <K extends keyof CTAOverlayItem['style']>(field: K, value: CTAOverlayItem['style'][K]) => {
      setOverlayItems((prev) =>
        prev.map((item) => {
          if (item.id !== selectedOverlayId) return item;
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
    [selectedOverlayId],
  );

  const addOverlay = useCallback(() => {
    const next: CTAOverlayItem = {
      id: `cta-${Date.now()}`,
      name: `New CTA ${overlayItems.length + 1}`,
      type: 'custom',
      title: 'New CTA title',
      subtitle: 'Add CTA subtitle',
      primaryLabel: 'Primary Action',
      secondaryLabel: 'Dismiss',
      urgency: 'Limited window',
      url: 'https://academy.creatorhub.no',
      triggerAt: Math.max(5, Math.round(currentTime)),
      endAt: Math.min(duration, Math.round(currentTime + 35)),
      placement: 'bottom-center',
      enabled: true,
      abTestEnabled: false,
      style: {
        bg: 'rgba(10,15,25,0.84)',
        text: '#f5f1e7',
        button: '#d99622',
        buttonText: '#1a1306',
        opacity: 0.97,
        borderRadius: 12,
      },
      analytics: {
        views: 0,
        clicks: 0,
        conversions: 0,
        revenue: 0,
        avgWatchBeforeTrigger: Math.round(currentTime),
        variantA: 0,
        variantB: 0,
      },
    };
    setOverlayItems((prev) => [next, ...prev]);
    setSelectedOverlayId(next.id);
    setSaveMessage(tt(`Overlay ${next.name} lagt til.`, `Overlay ${next.name} added.`));
  }, [currentTime, duration, overlayItems.length, tt]);

  const duplicateOverlay = useCallback(() => {
    if (!selectedOverlay) return;
    const clone: CTAOverlayItem = {
      ...selectedOverlay,
      id: `cta-${Date.now()}-copy`,
      name: `${selectedOverlay.name} Copy`,
      triggerAt: Math.min(duration - 5, selectedOverlay.triggerAt + 8),
      endAt: Math.min(duration, selectedOverlay.endAt + 8),
    };
    setOverlayItems((prev) => [clone, ...prev]);
    setSelectedOverlayId(clone.id);
    setSaveMessage(tt(`Dupliserte ${selectedOverlay.name}.`, `Duplicated ${selectedOverlay.name}.`));
  }, [duration, selectedOverlay, tt]);

  const removeOverlay = useCallback(() => {
    if (!selectedOverlay) return;
    setOverlayItems((prev) => prev.filter((item) => item.id !== selectedOverlay.id));
    setSelectedOverlayId('');
    setSaveMessage(tt(`Fjernet ${selectedOverlay.name}.`, `Removed ${selectedOverlay.name}.`));
  }, [selectedOverlay, tt]);

  const saveOverlaySetup = useCallback(
    async (publish: boolean) => {
      setSaveMessage('');

      const course = activeCourse;
      const payload = {
        courseId: course?.id || null,
        overlays: overlayItems,
        triggerEnabled,
        resetToKeyframe,
        publish,
      };

      try {
        const existing = course ? state.courses.find((entry) => entry.id === course.id) : undefined;

        if (existing) {
          const resources = Array.isArray(existing.resources) ? existing.resources : [];
          const ctaResources = overlayItems.map((overlay) => ({
            id: `cta-resource-${overlay.id}`,
            type: 'link' as const,
            title: `[CTA] ${overlay.title}`,
            url: overlay.url,
            description: `${overlay.name} · ${formatTime(overlay.triggerAt)}-${formatTime(overlay.endAt)}`,
          }));

          await updateCourse({
            ...existing,
            isPublished: publish ? true : existing.isPublished,
            tags: Array.from(new Set([...(existing.tags || []), 'cta-overlays', 'conversion'])),
            resources: [...resources.filter((resource) => !resource.id.startsWith('cta-resource-')), ...ctaResources],
          });
        }

        onSave?.(payload);
        setSaveMessage(
          publish
            ? tt('CTA-overlay publisert.', 'CTA overlay published.')
            : tt('CTA-overlay lagret.', 'CTA overlay saved.'),
        );

        analytics.trackEvent('academy_cta_overlay_saved', {
          courseId: course?.id || null,
          overlayCount: overlayItems.length,
          publish,
          timestamp: Date.now(),
        });
      } catch (error) {
        setSaveMessage(
          error instanceof Error
            ? error.message
            : tt('Kunne ikke lagre CTA-overlayoppsett.', 'Could not save CTA overlay setup.'),
        );
      }
    },
    [
      activeCourse,
      analytics,
      onSave,
      overlayItems,
      resetToKeyframe,
      state.courses,
      tt,
      triggerEnabled,
      updateCourse,
    ],
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
            'radial-gradient(circle at 70% 12%, rgba(248,179,33,0.27), rgba(5,8,13,0) 38%), radial-gradient(circle at 18% 84%, rgba(74,117,194,0.16), rgba(6,8,14,0) 42%), linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0) 30%)',
          pointerEvents: 'none',
        }}
      />

      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', lg: 'row' },
          minHeight: '100vh',
          position: 'relative',
          zIndex: 1,
          width: academyShellMaxWidth,
          mx: 'auto',
        }}
      >
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
              {navLabel('Create New Course')}
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
                    border: active
                      ? 'var(--academy-hairline-width, 1px) solid rgba(248,179,33,0.35)'
                      : 'var(--academy-hairline-width, 1px) solid transparent',
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
              onClick={addOverlay}
              sx={{
                width: '100%',
                justifyContent: 'flex-start',
                color: '#edf0f7',
                textTransform: 'none',
                border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.14)',
                borderRadius: 1,
              }}
            >
              {tt('Ny CTA', 'New CTA')}
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
                  {tt('CTA-overlayredigering', 'CTA Overlay Editor')}
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
                    {tt('Forhåndsvis', 'Preview')}
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={<Save />}
                    onClick={() => void saveOverlaySetup(false)}
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
                    onClick={() => void saveOverlaySetup(true)}
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

              <Stack
                direction={{ xs: 'column', md: 'row' }}
                spacing={1}
                alignItems={{ xs: 'stretch', md: 'center' }}
                sx={{ ...panelSx, px: 1, py: 0.9 }}
              >
                <Select
                  size="small"
                  value={selectedCourseId || activeCourse?.id || ''}
                  onChange={(event) => setSelectedCourseId(String(event.target.value))}
                  sx={{
                    minWidth: { xs: '100%', md: 250 },
                    color: '#edf0f7',
                    bgcolor: 'rgba(255,255,255,0.04)',
                    '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.16)' },
                  }}
                >
                  {courseItems.map((course) => (
                    <MenuItem key={course.id} value={course.id}>
                      {course.title}
                    </MenuItem>
                  ))}
                </Select>
                <TextField
                  size="small"
                  type="number"
                  label="Timeline (sec)"
                  value={duration}
                  onChange={(event) => {
                    const next = Math.max(60, Number(event.target.value) || 60);
                    setDuration(next);
                    setCurrentTime((prev) => Math.min(prev, next));
                  }}
                  sx={{
                    width: { xs: '100%', md: 140 },
                    '& .MuiInputBase-root': { color: '#edf0f7' },
                    '& .MuiInputLabel-root': { color: 'rgba(237,240,247,0.64)' },
                    '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.16)' },
                  }}
                />
                <Typography sx={{ color: 'rgba(237,240,247,0.68)', fontSize: 13 }}>
                  Trigger window follows selected course timeline.
                </Typography>
              </Stack>

              {!!saveMessage && (
                <Typography
                  sx={{
                    px: 1.2,
                    py: 0.8,
                    borderRadius: 1,
                    border: 'var(--academy-hairline-width, 1px) solid rgba(248,179,33,0.35)',
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
                    border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.08)',
                    overflow: 'hidden',
                    position: 'relative',
                    aspectRatio: '16 / 9',
                    background:
                      'radial-gradient(circle at 70% 18%, rgba(248,179,33,0.45), rgba(8,12,20,0) 46%), linear-gradient(140deg, rgba(17,26,38,0.95), rgba(8,12,19,0.96))',
                  }}
                >
                  <Box
                    sx={{
                      position: 'absolute',
                      inset: 0,
                      background:
                        'radial-gradient(circle at 26% 30%, rgba(108,148,220,0.2), rgba(8,12,19,0) 40%), radial-gradient(circle at 86% 24%, rgba(255,171,64,0.22), rgba(8,12,19,0) 36%)',
                    }}
                  />

                  {selectedOverlay && liveOverlayVisible && (
                    <Box
                      sx={{
                        position: 'absolute',
                        width: { xs: '90%', md: '65%' },
                        left:
                          selectedOverlay.placement === 'bottom-right'
                            ? '33%'
                            : selectedOverlay.placement === 'center'
                              ? '17%'
                              : selectedOverlay.placement === 'top-right'
                                ? '30%'
                                : '17%',
                        top:
                          selectedOverlay.placement === 'center'
                            ? '36%'
                            : selectedOverlay.placement === 'top-right'
                              ? '10%'
                              : '58%',
                        transform: selectedOverlay.placement === 'center' ? 'translateY(-50%)' : 'none',
                        borderRadius: `${selectedOverlay.style.borderRadius}px`,
                        border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.2)',
                        background: selectedOverlay.style.bg,
                        color: selectedOverlay.style.text,
                        p: 1.6,
                        opacity: selectedOverlay.style.opacity,
                        boxShadow: '0 18px 34px rgba(0,0,0,0.45)',
                      }}
                    >
                      <Typography
                        sx={{
                          fontSize: 'clamp(2rem, 1.1rem + 2.8vw, 3.25rem)',
                          lineHeight: 1,
                          fontFamily: 'Barlow Condensed, sans-serif',
                        }}
                      >
                        {selectedOverlay.title}
                      </Typography>
                      <Typography
                        sx={{
                          color: alpha(selectedOverlay.style.text, 0.9),
                          mt: 0.3,
                          fontSize: 'clamp(0.95rem, 0.7rem + 1vw, 1.45rem)',
                        }}
                      >
                        {selectedOverlay.subtitle}
                      </Typography>

                      <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                        <Button
                          sx={{
                            textTransform: 'none',
                            color: selectedOverlay.style.buttonText,
                            background: selectedOverlay.style.button,
                            px: 2.2,
                            fontWeight: 700,
                            fontSize: 'clamp(0.95rem, 0.62rem + 1.1vw, 1.5rem)',
                            borderRadius: 1,
                            '&:hover': { background: selectedOverlay.style.button },
                          }}
                        >
                          {selectedOverlay.primaryLabel}
                        </Button>
                        <Button
                          sx={{
                            textTransform: 'none',
                            color: selectedOverlay.style.text,
                            border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.26)',
                            fontSize: 'clamp(0.88rem, 0.66rem + 0.7vw, 1.25rem)',
                            borderRadius: 1,
                          }}
                        >
                          {selectedOverlay.secondaryLabel}
                        </Button>
                      </Stack>

                      <Typography
                        sx={{
                          mt: 0.8,
                          color: '#f6d78d',
                          fontWeight: 600,
                          fontSize: 'clamp(0.85rem, 0.64rem + 0.68vw, 1.22rem)',
                        }}
                      >
                        {selectedOverlay.urgency}
                      </Typography>
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

              <Box sx={{ ...panelSx, p: 1.1, display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '310px minmax(0, 1fr)' }, gap: 1.1 }}>
                <Box sx={{ ...panelSx, p: 1 }}>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.8 }}>
                    <Typography sx={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: 28 }}>{tt('CTA-overlayredigering', 'CTA Overlay Editor')}</Typography>
                    <Switch
                      size="small"
                      checked={selectedOverlay?.enabled || false}
                      onChange={(event) => setSelectedOverlayField('enabled', event.target.checked)}
                    />
                    <Chip size="small" label={selectedOverlay?.abTestEnabled ? 'A/B' : 'Single'} sx={{ bgcolor: 'rgba(255,255,255,0.08)', color: '#edf0f7' }} />
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
                    <Tab value="content" label={tt('Innhold', 'Content')} />
                    <Tab value="design" label={tt('Design', 'Design')} />
                    <Tab value="analytics" label={tt('Analyser', 'Analytics')} />
                  </Tabs>

                  {editorTab === 'content' && selectedOverlay && (
                    <Stack spacing={0.8}>
                      <TextField
                        size="small"
                        label="Overlay Name"
                        value={selectedOverlay.name}
                        onChange={(event) => setSelectedOverlayField('name', event.target.value)}
                        sx={{ '& .MuiInputBase-root': { color: '#edf0f7' } }}
                      />
                      <TextField
                        size="small"
                        label="Title"
                        value={selectedOverlay.title}
                        onChange={(event) => setSelectedOverlayField('title', event.target.value)}
                        sx={{ '& .MuiInputBase-root': { color: '#edf0f7' } }}
                      />
                      <TextField
                        size="small"
                        label="Subtitle"
                        value={selectedOverlay.subtitle}
                        onChange={(event) => setSelectedOverlayField('subtitle', event.target.value)}
                        sx={{ '& .MuiInputBase-root': { color: '#edf0f7' } }}
                      />
                      <Stack direction="row" spacing={0.8}>
                        <TextField
                          size="small"
                          label="Primary CTA"
                          value={selectedOverlay.primaryLabel}
                          onChange={(event) => setSelectedOverlayField('primaryLabel', event.target.value)}
                          sx={{ '& .MuiInputBase-root': { color: '#edf0f7' } }}
                        />
                        <TextField
                          size="small"
                          label="Secondary CTA"
                          value={selectedOverlay.secondaryLabel}
                          onChange={(event) => setSelectedOverlayField('secondaryLabel', event.target.value)}
                          sx={{ '& .MuiInputBase-root': { color: '#edf0f7' } }}
                        />
                      </Stack>
                      <TextField
                        size="small"
                        label="URL"
                        value={selectedOverlay.url}
                        onChange={(event) => setSelectedOverlayField('url', event.target.value)}
                        sx={{ '& .MuiInputBase-root': { color: '#edf0f7' } }}
                      />
                      <Stack direction="row" spacing={0.8}>
                        <TextField
                          size="small"
                          type="number"
                          label="Trigger (s)"
                          value={selectedOverlay.triggerAt}
                          onChange={(event) =>
                            setSelectedOverlayField('triggerAt', Math.max(0, Number(event.target.value) || 0))
                          }
                          sx={{ '& .MuiInputBase-root': { color: '#edf0f7' } }}
                        />
                        <TextField
                          size="small"
                          type="number"
                          label="End (s)"
                          value={selectedOverlay.endAt}
                          onChange={(event) =>
                            setSelectedOverlayField('endAt', Math.max(0, Number(event.target.value) || 0))
                          }
                          sx={{ '& .MuiInputBase-root': { color: '#edf0f7' } }}
                        />
                      </Stack>
                    </Stack>
                  )}

                  {editorTab === 'design' && selectedOverlay && (
                    <Stack spacing={0.8}>
                      <TextField
                        size="small"
                        label="Overlay Background"
                        value={selectedOverlay.style.bg}
                        onChange={(event) => setSelectedStyleField('bg', event.target.value)}
                        sx={{ '& .MuiInputBase-root': { color: '#edf0f7' } }}
                      />
                      <TextField
                        size="small"
                        label="Text Color"
                        value={selectedOverlay.style.text}
                        onChange={(event) => setSelectedStyleField('text', event.target.value)}
                        sx={{ '& .MuiInputBase-root': { color: '#edf0f7' } }}
                      />
                      <TextField
                        size="small"
                        label="Button Color"
                        value={selectedOverlay.style.button}
                        onChange={(event) => setSelectedStyleField('button', event.target.value)}
                        sx={{ '& .MuiInputBase-root': { color: '#edf0f7' } }}
                      />
                      <TextField
                        size="small"
                        label="Button Text Color"
                        value={selectedOverlay.style.buttonText}
                        onChange={(event) => setSelectedStyleField('buttonText', event.target.value)}
                        sx={{ '& .MuiInputBase-root': { color: '#edf0f7' } }}
                      />
                      <Typography sx={{ color: 'rgba(237,240,247,0.72)', fontSize: 12 }}>Border Radius</Typography>
                      <Slider
                        value={selectedOverlay.style.borderRadius}
                        min={0}
                        max={30}
                        onChange={(_, value) => {
                          const next = Array.isArray(value) ? value[0] : value;
                          setSelectedStyleField('borderRadius', next);
                        }}
                        sx={{ color: '#f8b321' }}
                      />
                      <Typography sx={{ color: 'rgba(237,240,247,0.72)', fontSize: 12 }}>Opacity</Typography>
                      <Slider
                        value={selectedOverlay.style.opacity}
                        min={0.2}
                        max={1}
                        step={0.01}
                        onChange={(_, value) => {
                          const next = Array.isArray(value) ? value[0] : value;
                          setSelectedStyleField('opacity', next);
                        }}
                        sx={{ color: '#f8b321' }}
                      />
                    </Stack>
                  )}

                  {editorTab === 'analytics' && selectedOverlay && (
                    <Stack spacing={1}>
                      <Stack direction="row" justifyContent="space-between">
                        <Typography sx={{ color: 'rgba(237,240,247,0.72)' }}>Views</Typography>
                        <Typography>{selectedOverlay.analytics.views.toLocaleString()}</Typography>
                      </Stack>
                      <Stack direction="row" justifyContent="space-between">
                        <Typography sx={{ color: 'rgba(237,240,247,0.72)' }}>Clicks</Typography>
                        <Typography>{selectedOverlay.analytics.clicks.toLocaleString()}</Typography>
                      </Stack>
                      <Stack direction="row" justifyContent="space-between">
                        <Typography sx={{ color: 'rgba(237,240,247,0.72)' }}>Conversions</Typography>
                        <Typography>{selectedOverlay.analytics.conversions.toLocaleString()}</Typography>
                      </Stack>
                      <Stack direction="row" justifyContent="space-between">
                        <Typography sx={{ color: 'rgba(237,240,247,0.72)' }}>Revenue</Typography>
                        <Typography>{toNok(selectedOverlay.analytics.revenue)}</Typography>
                      </Stack>
                      <Stack direction="row" justifyContent="space-between">
                        <Typography sx={{ color: 'rgba(237,240,247,0.72)' }}>CTR</Typography>
                        <Typography>{ctr}%</Typography>
                      </Stack>
                      <Stack direction="row" justifyContent="space-between">
                        <Typography sx={{ color: 'rgba(237,240,247,0.72)' }}>Uplift (A vs B)</Typography>
                        <Typography sx={{ color: '#7eea8e' }}>+{uplift}%</Typography>
                      </Stack>
                    </Stack>
                  )}
                </Box>

                <Box sx={{ ...panelSx, p: 0.9 }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.9 }}>
                    <Typography sx={{ color: 'rgba(237,240,247,0.7)' }}>Trigger at</Typography>
                    <TextField
                      size="small"
                      value={selectedOverlay ? formatTime(selectedOverlay.triggerAt) : '0:00'}
                      sx={{ width: 86, '& .MuiInputBase-root': { color: '#edf0f7', fontSize: 12 } }}
                      inputProps={{ readOnly: true }}
                    />
                  </Stack>
                  <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
                    <FormControlLabel
                      control={
                        <Switch
                          size="small"
                          checked={triggerEnabled}
                          onChange={(event) => setTriggerEnabled(event.target.checked)}
                        />
                      }
                      label="Trigger"
                      sx={{ '& .MuiFormControlLabel-label': { fontSize: 12 } }}
                    />
                    <FormControlLabel
                      control={
                        <Switch
                          size="small"
                          checked={resetToKeyframe}
                          onChange={(event) => setResetToKeyframe(event.target.checked)}
                        />
                      }
                      label="Reset"
                      sx={{ '& .MuiFormControlLabel-label': { fontSize: 12 } }}
                    />
                  </Stack>

                  <Box
                    sx={{
                      borderRadius: 1,
                      border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.1)',
                      aspectRatio: '16/9',
                      position: 'relative',
                      overflow: 'hidden',
                      background:
                        'radial-gradient(circle at 72% 20%, rgba(248,179,33,0.35), rgba(8,12,19,0) 44%), linear-gradient(145deg, rgba(15,24,36,0.94), rgba(8,12,18,0.96))',
                    }}
                  >
                    {selectedOverlay && (
                      <Box
                        sx={{
                          position: 'absolute',
                          right: 14,
                          bottom: 16,
                          width: '52%',
                          borderRadius: 1,
                          border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.15)',
                          background: alpha(selectedOverlay.style.bg, 0.95),
                          p: 1,
                        }}
                      >
                        <Typography sx={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: 28, lineHeight: 1 }}>
                          {selectedOverlay.title}
                        </Typography>
                        <Button
                          fullWidth
                          sx={{
                            mt: 0.8,
                            textTransform: 'none',
                            fontWeight: 700,
                            color: selectedOverlay.style.buttonText,
                            background: selectedOverlay.style.button,
                            '&:hover': { background: selectedOverlay.style.button },
                          }}
                        >
                          {selectedOverlay.primaryLabel}
                        </Button>
                      </Box>
                    )}
                  </Box>

                  <Stack direction="row" spacing={0.8} sx={{ mt: 1 }}>
                    <Button
                      startIcon={<Campaign />}
                      onClick={() => setLocation('/academy/monetization')}
                      sx={{
                        flex: 1,
                        textTransform: 'none',
                        color: '#edf0f7',
                        border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.17)',
                      }}
                    >
                      {tt('Monetisering', 'Monetization')}
                    </Button>
                    <Button
                      startIcon={<Subtitles />}
                      onClick={() => setLocation('/academy/lower-thirds')}
                      sx={{
                        flex: 1,
                        textTransform: 'none',
                        color: '#edf0f7',
                        border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.17)',
                      }}
                    >
                      {tt('LowerThirds', 'LowerThirds')}
                    </Button>
                    <Button
                      startIcon={<Save />}
                      onClick={() => void saveOverlaySetup(false)}
                      sx={{
                        flex: 1,
                        textTransform: 'none',
                        color: '#edf0f7',
                        border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.17)',
                      }}
                    >
                      {tt('Lagre', 'Save')}
                    </Button>
                  </Stack>
                </Box>
              </Box>
            </Box>

            <Box sx={{ ...panelSx, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
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
                <Tab label={tt('CTA-ytelse', 'CTA Performance')} value="performance" />
                <Tab label={tt('A/B-test', 'A/B Test')} value="abtest" />
                <Tab label={tt('Analyser', 'Analytics')} value="analytics" />
              </Tabs>

              <Box sx={{ p: 1.2, minHeight: 0, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Box sx={{ ...panelSx, p: 1 }}>
                  <Stack direction="row" spacing={0.8} alignItems="center">
                    <Switch
                      size="small"
                      checked={selectedOverlay?.enabled || false}
                      onChange={(event) => setSelectedOverlayField('enabled', event.target.checked)}
                    />
                    <Typography sx={{ fontWeight: 600 }}>{selectedOverlay?.name || tt('Overlay', 'Overlay')}</Typography>
                    <Chip
                      size="small"
                      label={selectedOverlay?.abTestEnabled ? tt('A/B-test', 'A/B Test') : tt('Enkeltvariant', 'Single Variant')}
                      sx={{ bgcolor: 'rgba(255,255,255,0.08)', color: '#edf0f7' }}
                    />
                    <IconButton size="small" sx={{ ml: 'auto', color: 'rgba(237,240,247,0.68)' }}>
                      <MoreHoriz fontSize="small" />
                    </IconButton>
                  </Stack>
                </Box>

                <Box sx={{ ...panelSx, p: 1 }}>
                  <Stack direction="row" spacing={0.8} sx={{ mb: 0.9 }}>
                    <TextField
                      size="small"
                      placeholder={tt('Søk overlegg...', 'Search overlays...')}
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <Search sx={{ color: 'rgba(237,240,247,0.5)' }} />
                          </InputAdornment>
                        ),
                      }}
                      sx={{
                        flex: 1,
                        '& .MuiInputBase-root': {
                          color: '#edf0f7',
                          bgcolor: 'rgba(10,13,20,0.7)',
                        },
                      }}
                    />
                    <IconButton onClick={duplicateOverlay} sx={{ color: '#edf0f7', border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.2)' }}>
                      <ContentCopy fontSize="small" />
                    </IconButton>
                    <IconButton onClick={removeOverlay} sx={{ color: '#edf0f7', border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.2)' }}>
                      <Delete fontSize="small" />
                    </IconButton>
                  </Stack>

                  <Stack spacing={0.7}>
                    {filteredOverlays.map((overlay) => {
                      const active = selectedOverlayId === overlay.id;
                      return (
                        <Button
                          key={overlay.id}
                          onClick={() => setSelectedOverlayId(overlay.id)}
                          sx={{
                            justifyContent: 'space-between',
                            textTransform: 'none',
                            color: '#edf0f7',
                            borderRadius: 1,
                            border: active ? 'var(--academy-hairline-width, 1px) solid rgba(248,179,33,0.52)' : 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.14)',
                            background: active
                              ? 'linear-gradient(90deg, rgba(248,179,33,0.18), rgba(248,179,33,0.04))'
                              : 'rgba(255,255,255,0.02)',
                          }}
                        >
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Campaign fontSize="small" sx={{ color: '#f8d56f' }} />
                            <Typography>{overlay.name}</Typography>
                          </Stack>
                          <Chip
                            size="small"
                            label={`${overlay.analytics.variantA.toFixed(1)}%`}
                            sx={{ bgcolor: 'rgba(255,255,255,0.09)', color: '#edf0f7' }}
                          />
                        </Button>
                      );
                    })}
                  </Stack>
                </Box>

                {selectedOverlay && (
                  <>
                    <Box sx={{ ...panelSx, p: 1 }}>
                      <Typography sx={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: 26 }}>{tt('CTA-innsikt', 'CTA Insights')}</Typography>
                      <Stack direction="row" justifyContent="space-between" sx={{ mt: 0.8 }}>
                        <Stack>
                          <Typography sx={{ color: 'rgba(237,240,247,0.65)', fontSize: 12 }}>{tt('Gj.sn. visning', 'Avg Watch')}</Typography>
                          <Typography sx={{ fontSize: 34, lineHeight: 1, fontFamily: 'Barlow Condensed, sans-serif' }}>
                            {selectedOverlay.analytics.avgWatchBeforeTrigger}s
                          </Typography>
                        </Stack>
                        <Stack>
                          <Typography sx={{ color: 'rgba(237,240,247,0.65)', fontSize: 12 }}>{tt('Klikkrate', 'Click Through')}</Typography>
                          <Typography sx={{ fontSize: 34, lineHeight: 1, fontFamily: 'Barlow Condensed, sans-serif' }}>
                            {ctr}%
                          </Typography>
                        </Stack>
                        <Stack>
                          <Typography sx={{ color: 'rgba(237,240,247,0.65)', fontSize: 12 }}>{tt('Konverteringer', 'Conversions')}</Typography>
                          <Typography sx={{ fontSize: 34, lineHeight: 1, fontFamily: 'Barlow Condensed, sans-serif' }}>
                            {selectedOverlay.analytics.conversions}
                          </Typography>
                        </Stack>
                      </Stack>

                      <Box sx={{ mt: 1, height: 84, borderRadius: 1, border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.1)', p: 1 }}>
                        <Box
                          component="svg"
                          viewBox="0 0 100 30"
                          preserveAspectRatio="none"
                          sx={{ width: '100%', height: '100%' }}
                        >
                          <defs>
                            <linearGradient id="ctaLineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                              <stop offset="0%" stopColor="#6ea8ff" />
                              <stop offset="100%" stopColor="#f8b321" />
                            </linearGradient>
                          </defs>
                          <polyline
                            fill="none"
                            stroke="url(#ctaLineGradient)"
                            strokeWidth="1.2"
                            points="0,23 10,22 20,20 30,16 40,14 50,15 60,16 70,13 80,11 90,9 100,4"
                          />
                        </Box>
                      </Box>
                    </Box>

                    <Box sx={{ ...panelSx, p: 1 }}>
                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Typography sx={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: 26 }}>{tt('Konverteringsmål', 'Conversion Goals')}</Typography>
                        <Typography sx={{ color: '#f8d56f' }}>{selectedOverlay.analytics.views.toLocaleString()}</Typography>
                      </Stack>
                      <Stack direction="row" justifyContent="space-between" sx={{ mt: 0.8 }}>
                        <Typography sx={{ color: 'rgba(237,240,247,0.75)' }}>{tt('Konverteringsrate', 'Conversion Rate')}</Typography>
                        <Typography sx={{ fontSize: 34, fontFamily: 'Barlow Condensed, sans-serif', lineHeight: 1 }}>
                          {conversionRate}%
                        </Typography>
                      </Stack>
                      <Stack direction="row" justifyContent="space-between" sx={{ mt: 0.35 }}>
                        <Typography sx={{ color: 'rgba(237,240,247,0.75)' }}>{tt('Inntekt', 'Revenue')}</Typography>
                        <Typography sx={{ fontSize: 34, fontFamily: 'Barlow Condensed, sans-serif', lineHeight: 1 }}>
                          {toNok(selectedOverlay.analytics.revenue)}
                        </Typography>
                      </Stack>
                      <Stack direction="row" justifyContent="space-between" sx={{ mt: 0.35 }}>
                        <Typography sx={{ color: 'rgba(237,240,247,0.75)' }}>{tt('Nåværende løft (A vs B)', 'Current Uplift (A vs B)')}</Typography>
                        <Typography sx={{ color: '#7eea8e', fontSize: 28, fontFamily: 'Barlow Condensed, sans-serif', lineHeight: 1 }}>
                          +{uplift}%
                        </Typography>
                      </Stack>
                      <LinearProgress
                        variant="determinate"
                        value={Math.max(8, Math.min(100, 50 + uplift))}
                        sx={{
                          mt: 0.9,
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

                    <Stack direction="row" spacing={1}>
                      <Button
                        startIcon={<PlayArrow />}
                        onClick={() => setIsPlaying((prev) => !prev)}
                        sx={{
                          flex: 1,
                          textTransform: 'none',
                          color: '#edf0f7',
                          border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.18)',
                        }}
                      >
                        {tt('Forhåndsvis', 'Preview')}
                      </Button>
                      <Button
                        startIcon={<MonetizationOn />}
                        onClick={() => setLocation('/academy/monetization')}
                        sx={{
                          flex: 1,
                          textTransform: 'none',
                          color: '#edf0f7',
                          border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.18)',
                        }}
                      >
                        {tt('Inntekt', 'Revenue')}
                      </Button>
                      <Button
                        onClick={() => void saveOverlaySetup(false)}
                        sx={{
                          textTransform: 'none',
                          color: '#0f0f0f',
                          background: 'linear-gradient(180deg, #ffd44e, #f2a616)',
                          fontWeight: 700,
                        }}
                      >
                        {tt('Lagre', 'Save')}
                      </Button>
                    </Stack>
                  </>
                )}
              </Box>

              <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)' }} />
              <Stack direction="row" spacing={1} sx={{ p: 1.1 }}>
                <Button
                  startIcon={<Add />}
                  onClick={addOverlay}
                  sx={{
                    flex: 1,
                    textTransform: 'none',
                    color: '#0f0f0f',
                    background: 'linear-gradient(180deg, #ffd44e, #f2a616)',
                    fontWeight: 700,
                  }}
                >
                  {tt('Legg til', 'Add')}
                </Button>
                <Button
                  startIcon={<Save />}
                  onClick={() => void saveOverlaySetup(false)}
                  sx={{
                    flex: 1,
                    textTransform: 'none',
                    color: '#edf0f7',
                    border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.18)',
                  }}
                >
                  {tt('Lagre', 'Save')}
                </Button>
                <Button
                  onClick={() => {
                    if (onCancel) {
                      onCancel();
                    } else {
                      setLocation('/academy/monetization');
                    }
                  }}
                  sx={{
                    textTransform: 'none',
                    color: 'rgba(237,240,247,0.76)',
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

export default withUniversalIntegration(AcademyCTAOverlayStudio, {
  componentId: 'academy-cta-overlay-studio',
  componentName: 'Academy CTA Overlay Studio',
  componentType: 'editor',
  componentCategory: 'academy',
  featureIds: ['cta-overlays', 'ab-testing', 'conversion-analytics', 'academy-monetization'],
});
