import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  Slider,
  Stack,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  Add,
  AttachFile,
  Campaign,
  Delete,
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
  Subtitles,
  Visibility,
  VisibilityOff,
} from '@mui/icons-material';
import { useLocation } from 'wouter';
import { withUniversalIntegration } from '@/integration/UniversalIntegrationHOC';
import { useAcademyLocale } from './academyLocale';
import AcademyBrandMark from './AcademyBrandMark';

export interface VideoAnnotation {
  id: string;
  type: 'hotspot' | 'callout' | 'note' | 'quiz' | 'link' | 'image' | 'video';
  title: string;
  content: string;
  startTime: number;
  endTime?: number;
  position: {
    x: number;
    y: number;
  };
  size: {
    width: number;
    height: number;
  };
  style: {
    backgroundColor: string;
    textColor: string;
    borderColor: string;
    borderWidth: number;
    borderRadius: number;
    opacity: number;
  };
  isVisible: boolean;
  isClickable: boolean;
  action?: {
    type: 'navigate' | 'showContent' | 'openLink' | 'playVideo' | 'showQuiz';
    target?: string;
    data?: any;
  };
  createdAt: string;
  updatedAt: string;
}

interface VideoAnnotationEditorProps {
  videoUrl?: string;
  duration?: number;
  annotations?: VideoAnnotation[];
  onAnnotationsChange?: (annotations: VideoAnnotation[]) => void;
  onSave?: (annotations: VideoAnnotation[]) => void;
  onCancel?: () => void;
}

type RightPanelTab = 'editor' | 'markers' | 'attachments';

const defaultVideoUrl = '/assets/academy/intro-video.mp4';

const annotationTypes: Array<{
  value: VideoAnnotation['type'];
  label: string;
  short: string;
  color: string;
}> = [
  { value: 'callout', label: 'Callout', short: 'C', color: '#f8b321' },
  { value: 'note', label: 'Note', short: 'N', color: '#6ac4ff' },
  { value: 'hotspot', label: 'Hotspot', short: 'H', color: '#ff6f3c' },
  { value: 'quiz', label: 'Quiz', short: 'Q', color: '#ff4d7c' },
  { value: 'link', label: 'Link', short: 'L', color: '#80e17d' },
  { value: 'image', label: 'Image', short: 'I', color: '#c8a4ff' },
  { value: 'video', label: 'Video', short: 'V', color: '#7de2dc' },
];

const waveformPattern = [
  14, 22, 18, 32, 16, 24, 28, 40, 26, 20, 30, 18, 34, 38, 22, 27, 25, 31, 37, 42, 35, 29, 21, 24,
];

const panelSectionSx = {
  borderRadius: 1.4,
  border: '1px solid rgba(255,255,255,0.08)',
  background: 'linear-gradient(145deg, rgba(20,24,36,0.88), rgba(11,14,22,0.96))',
};

const formatTime = (seconds: number): string => {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const min = Math.floor(seconds / 60);
  const sec = Math.floor(seconds % 60);
  return `${min}:${sec.toString().padStart(2, '0')}`;
};

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

const defaultAnnotationStyle = (type: VideoAnnotation['type']) => {
  const color = annotationTypes.find((entry) => entry.value === type)?.color || '#f8b321';
  return {
    backgroundColor: alpha(color, 0.22),
    textColor: '#f7f8fb',
    borderColor: color,
    borderWidth: 2,
    borderRadius: 10,
    opacity: 0.95,
  };
};

const buildAnnotation = (
  type: VideoAnnotation['type'],
  startTime: number,
  position: { x: number; y: number },
  size: { width: number; height: number },
): VideoAnnotation => {
  const now = new Date().toISOString();
  return {
    id: `annotation-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    title: `${annotationTypes.find((entry) => entry.value === type)?.label || 'Annotation'}`,
    content: 'Legg inn annoteringstekst for teamet.',
    startTime,
    endTime: undefined,
    position,
    size,
    style: defaultAnnotationStyle(type),
    isVisible: true,
    isClickable: true,
    createdAt: now,
    updatedAt: now,
  };
};

function VideoAnnotationEditor({
  videoUrl = defaultVideoUrl,
  duration,
  annotations,
  onAnnotationsChange,
  onSave,
  onCancel,
}: VideoAnnotationEditorProps) {
  const [, setLocation] = useLocation();
  
  const { navLabel, tt } = useAcademyLocale();

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [internalAnnotations, setInternalAnnotations] = useState<VideoAnnotation[]>(() =>
    Array.isArray(annotations) ? annotations : [],
  );
  const [currentTime, setCurrentTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(duration && duration > 0 ? duration : 282);
  const [isPlaying, setIsPlaying] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [activeTool, setActiveTool] = useState<VideoAnnotation['type']>('callout');
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string>('');
  const [draftAnnotation, setDraftAnnotation] = useState<VideoAnnotation | null>(null);
  const [rightTab, setRightTab] = useState<RightPanelTab>('editor');
  const [searchValue, setSearchValue] = useState('');
  const [saveMessage, setSaveMessage] = useState('');

  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);
  const [drawEnd, setDrawEnd] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (Array.isArray(annotations)) {
      setInternalAnnotations(annotations);
    }
  }, [annotations]);

  useEffect(() => {
    if (duration && duration > 0) {
      setVideoDuration(duration);
    }
  }, [duration]);

  const annotationItems = useMemo(() => {
    if (onAnnotationsChange && Array.isArray(annotations)) {
      return annotations;
    }
    return internalAnnotations;
  }, [annotations, internalAnnotations, onAnnotationsChange]);

  const selectedAnnotation = useMemo(
    () => annotationItems.find((annotation) => annotation.id === selectedAnnotationId) || null,
    [annotationItems, selectedAnnotationId],
  );

  const filteredAnnotations = useMemo(() => {
    const query = searchValue.trim().toLowerCase();
    if (!query) return annotationItems;
    return annotationItems.filter((annotation) => {
      return (
        annotation.title.toLowerCase().includes(query) ||
        annotation.content.toLowerCase().includes(query) ||
        annotation.type.toLowerCase().includes(query)
      );
    });
  }, [annotationItems, searchValue]);

  const timelinePercent = useMemo(() => {
    if (!videoDuration) return 0;
    return clamp((currentTime / videoDuration) * 100, 0, 100);
  }, [currentTime, videoDuration]);

  const commitAnnotations = useCallback(
    (nextAnnotations: VideoAnnotation[]) => {
      setInternalAnnotations(nextAnnotations);
      onAnnotationsChange?.(nextAnnotations);
    },
    [onAnnotationsChange],
  );

  useEffect(() => {
    const endTiming = performance.startTiming('video_annotation_editor_render');

    analytics.trackEvent('video_annotation_editor_mounted', {
      videoUrl,
      duration: videoDuration,
      annotationCount: annotationItems.length,
      timestamp: Date.now(),
    });

    debugging.logIntegration('info', 'VideoAnnotationEditor mounted', {
      videoUrl,
      duration: videoDuration,
      annotationCount: annotationItems.length,
    });

    return () => {
      endTiming();
      analytics.trackEvent('video_annotation_editor_unmounted', {
        videoUrl,
        duration: videoDuration,
        annotationCount: annotationItems.length,
        timestamp: Date.now(),
      });
    };
  }, [analytics, annotationItems.length, debugging, performance, videoDuration, videoUrl]);

  const syncCanvasSize = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const rect = video.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    const nextWidth = Math.round(rect.width);
    const nextHeight = Math.round(rect.height);

    if (canvas.width !== nextWidth || canvas.height !== nextHeight) {
      canvas.width = nextWidth;
      canvas.height = nextHeight;
    }
  }, []);

  useEffect(() => {
    syncCanvasSize();
    window.addEventListener('resize', syncCanvasSize);
    return () => window.removeEventListener('resize', syncCanvasSize);
  }, [syncCanvasSize]);

  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    annotationItems.forEach((annotation) => {
      if (!annotation.isVisible) return;

      const isActiveAtTime =
        currentTime >= annotation.startTime &&
        (annotation.endTime === undefined || currentTime <= annotation.endTime);

      if (previewMode && !isActiveAtTime) return;

      const x = (clamp(annotation.position.x, 0, 100) / 100) * canvas.width;
      const y = (clamp(annotation.position.y, 0, 100) / 100) * canvas.height;
      const width = (clamp(annotation.size.width, 1, 100) / 100) * canvas.width;
      const height = (clamp(annotation.size.height, 1, 100) / 100) * canvas.height;

      ctx.fillStyle = annotation.style.backgroundColor;
      ctx.globalAlpha = clamp(annotation.style.opacity, 0.1, 1);
      ctx.fillRect(x, y, width, height);

      const isSelected = annotation.id === selectedAnnotationId;
      ctx.strokeStyle = isSelected ? '#f8b321' : annotation.style.borderColor;
      ctx.lineWidth = isSelected ? annotation.style.borderWidth + 1 : annotation.style.borderWidth;
      ctx.globalAlpha = 1;
      ctx.strokeRect(x, y, width, height);

      ctx.fillStyle = annotation.style.textColor;
      ctx.font = '600 12px "Segoe UI", sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(annotation.title.slice(0, 28), x + 10, y + 8);
    });

    if (isDrawing && drawStart && drawEnd) {
      const x = Math.min(drawStart.x, drawEnd.x);
      const y = Math.min(drawStart.y, drawEnd.y);
      const w = Math.max(Math.abs(drawEnd.x - drawStart.x), 2);
      const h = Math.max(Math.abs(drawEnd.y - drawStart.y), 2);

      ctx.strokeStyle = '#f8b321';
      ctx.setLineDash([8, 4]);
      ctx.lineWidth = 2;
      ctx.strokeRect((x / 100) * canvas.width, (y / 100) * canvas.height, (w / 100) * canvas.width, (h / 100) * canvas.height);
      ctx.setLineDash([]);
    }
  }, [annotationItems, currentTime, drawEnd, drawStart, isDrawing, previewMode, selectedAnnotationId]);

  useEffect(() => {
    drawCanvas();
  }, [drawCanvas]);

  const handlePlayPause = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      video.play().catch(() => undefined);
      setIsPlaying(true);
      return;
    }

    video.pause();
    setIsPlaying(false);
  }, []);

  const handleTimeUpdate = useCallback(() => {
    if (!videoRef.current) return;
    setCurrentTime(videoRef.current.currentTime || 0);
  }, []);

  const handleSeek = useCallback((_: Event, newValue: number | number[]) => {
    const value = Array.isArray(newValue) ? newValue[0] : newValue;
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = value;
    setCurrentTime(value);
  }, []);

  const handleLoadedMetadata = useCallback(() => {
    const measuredDuration = videoRef.current?.duration;
    if (measuredDuration && Number.isFinite(measuredDuration) && measuredDuration > 0) {
      setVideoDuration(measuredDuration);
    }
    syncCanvasSize();
  }, [syncCanvasSize]);

  const prepareDraft = useCallback(
    (annotation: VideoAnnotation) => {
      setSelectedAnnotationId(annotation.id);
      setDraftAnnotation({ ...annotation });
      setRightTab('editor');
    },
    [],
  );

  const addAnnotation = useCallback(
    (type: VideoAnnotation['type']) => {
      const created = buildAnnotation(type, currentTime, { x: 14, y: 16 }, { width: 26, height: 13 });
      prepareDraft(created);
      analytics.trackEvent('annotation_added', {
        type,
        annotationTime: currentTime,
        timestamp: Date.now(),
      });
    },
    [analytics, currentTime, prepareDraft],
  );

  const saveDraft = useCallback(() => {
    if (!draftAnnotation) return;

    const now = new Date().toISOString();
    const nextAnnotation: VideoAnnotation = {
      ...draftAnnotation,
      updatedAt: now,
      startTime: clamp(draftAnnotation.startTime, 0, videoDuration || 0),
      endTime:
        draftAnnotation.endTime === undefined || draftAnnotation.endTime === null || draftAnnotation.endTime === 0
          ? undefined
          : clamp(Math.max(draftAnnotation.endTime, draftAnnotation.startTime), 0, videoDuration || 0),
      size: {
        width: clamp(draftAnnotation.size.width, 1, 100),
        height: clamp(draftAnnotation.size.height, 1, 100),
      },
      position: {
        x: clamp(draftAnnotation.position.x, 0, 100),
        y: clamp(draftAnnotation.position.y, 0, 100),
      },
    };

    const exists = annotationItems.some((annotation) => annotation.id === nextAnnotation.id);
    const nextAnnotations = exists
      ? annotationItems.map((annotation) => (annotation.id === nextAnnotation.id ? nextAnnotation : annotation))
      : [...annotationItems, nextAnnotation];

    commitAnnotations(nextAnnotations);
    setSaveMessage('Annotasjon oppdatert.');

    analytics.trackEvent('annotation_saved', {
      annotationId: nextAnnotation.id,
      type: nextAnnotation.type,
      annotationTime: nextAnnotation.startTime,
      timestamp: Date.now(),
    });
  }, [annotationItems, analytics, commitAnnotations, draftAnnotation, videoDuration]);

  const deleteAnnotation = useCallback(
    (annotationId: string) => {
      const nextAnnotations = annotationItems.filter((annotation) => annotation.id !== annotationId);
      commitAnnotations(nextAnnotations);
      if (selectedAnnotationId === annotationId) {
        setSelectedAnnotationId('');
        setDraftAnnotation(null);
      }

      analytics.trackEvent('annotation_deleted', {
        annotationId,
        timestamp: Date.now(),
      });
    },
    [annotationItems, analytics, commitAnnotations, selectedAnnotationId],
  );

  const handleSaveAll = useCallback(() => {
    onSave?.(annotationItems);
    setSaveMessage('Alle annoteringer lagret.');
    analytics.trackEvent('video_annotations_saved', {
      annotationCount: annotationItems.length,
      timestamp: Date.now(),
    });
  }, [annotationItems, analytics, onSave]);

  const getCanvasPointer = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    if (!rect.width || !rect.height) {
      return { x: 0, y: 0 };
    }
    return {
      x: clamp(((event.clientX - rect.left) / rect.width) * 100, 0, 100),
      y: clamp(((event.clientY - rect.top) / rect.height) * 100, 0, 100),
    };
  }, []);

  const handleCanvasMouseDown = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      if (previewMode) return;
      const pointer = getCanvasPointer(event);
      setDrawStart(pointer);
      setDrawEnd(pointer);
      setIsDrawing(true);
    },
    [getCanvasPointer, previewMode],
  );

  const handleCanvasMouseMove = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      if (!isDrawing) return;
      const pointer = getCanvasPointer(event);
      setDrawEnd(pointer);
    },
    [getCanvasPointer, isDrawing],
  );

  const handleCanvasMouseUp = useCallback(() => {
    if (!isDrawing || !drawStart || !drawEnd) return;

    const left = Math.min(drawStart.x, drawEnd.x);
    const top = Math.min(drawStart.y, drawEnd.y);
    const width = clamp(Math.abs(drawEnd.x - drawStart.x), 6, 95);
    const height = clamp(Math.abs(drawEnd.y - drawStart.y), 6, 95);

    const created = buildAnnotation(activeTool, currentTime, { x: left, y: top }, { width, height });
    prepareDraft(created);

    setIsDrawing(false);
    setDrawStart(null);
    setDrawEnd(null);
  }, [activeTool, currentTime, drawEnd, drawStart, isDrawing, prepareDraft]);

  const leftNavItems = [
    { id: 'overview', label: navLabel('Overview'), route: '/academy-dashboard' },
    { id: 'curriculum', label: navLabel('Curriculum'), route: '/academy/curriculum' },
    { id: 'media', label: navLabel('Media'), route: '/academy/media' },
    { id: 'lessons', label: navLabel('Lessons'), route: '/academy/lesson-editor' },
    { id: 'assignments', label: navLabel('Assignments'), route: '/academy/assignments' },
    { id: 'analytics', label: navLabel('Analytics'), route: '/academy/analytics' },
    { id: 'cta', label: navLabel('CTA Overlay'), route: '/academy/cta-overlay' },
    { id: 'lowerthirds', label: navLabel('Animated Lower Thirds'), route: '/academy/lower-thirds' },
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
            'radial-gradient(circle at 74% 14%, rgba(248,179,33,0.22), rgba(5,8,13,0) 40%), radial-gradient(circle at 20% 82%, rgba(82,121,204,0.14), rgba(6,8,14,0) 44%), linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0) 30%)',
          pointerEvents: 'none',
        }}
      />

      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', lg: 'row' }, minHeight: '100vh', position: 'relative', zIndex: 1 }}>
        <Box
          component="aside"
          sx={{
            width: { xs: '100%', lg: 252 },
            borderRight: { xs: 'none', lg: '1px solid rgba(255,255,255,0.08)' },
            borderBottom: { xs: '1px solid rgba(255,255,255,0.08)', lg: 'none' },
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
              sx={{
                justifyContent: 'flex-start',
                borderColor: 'rgba(248,179,33,0.55)',
                color: '#f8d56f',
                borderRadius: 1,
                textTransform: 'none',
                fontWeight: 600,
              }}
              onClick={() => setLocation('/academy/course-creator')}
            >
              Create New Course
            </Button>
          </Stack>

          <Stack spacing={0.5} sx={{ px: 1.5 }}>
            {leftNavItems.map((item) => {
              const active = item.id === 'media';
              return (
                <Button
                  key={item.id}
                  onClick={() => setLocation(item.route)}
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
              onClick={() => addAnnotation(activeTool)}
              sx={{
                width: '100%',
                justifyContent: 'flex-start',
                color: '#edf0f7',
                textTransform: 'none',
                border: '1px solid rgba(255,255,255,0.14)',
                borderRadius: 1,
              }}
            >
              New Annotation
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
              <Chip
                label={tt('Utkast', 'Draft')}
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
              <Avatar sx={{ width: 34, height: 34, bgcolor: '#f8b321', color: '#111' }}>N</Avatar>
            </Stack>
          </Box>

          <Box
            sx={{
              flex: 1,
              minHeight: 0,
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1fr) 360px' },
              gap: 2,
              px: 2,
              py: 2,
            }}
          >
            <Box sx={{ minHeight: 0, display: 'flex', flexDirection: 'column', gap: 1.4 }}>
              <Stack
                direction={{ xs: 'column', md: 'row' }}
                spacing={1.2}
                justifyContent="space-between"
                alignItems={{ xs: 'stretch', md: 'center' }}
              >
                <Stack direction="row" spacing={1.2} alignItems="center">
                  <Typography sx={{ fontSize: 30, fontWeight: 600, letterSpacing: '0.02em' }}>FileName.mpd</Typography>
                  <Chip label={tt('Utkast', 'Draft')} size="small" sx={{ bgcolor: 'rgba(255,255,255,0.08)', color: '#edf0f7' }} />
                </Stack>

                <Stack direction="row" spacing={1}>
                  <Button
                    variant="outlined"
                    startIcon={<PlayArrow />}
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
                    onClick={handleSaveAll}
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
                    Player
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={<Quiz />}
                    onClick={() => setLocation('/academy/quiz-manager')}
                    sx={{
                      textTransform: 'none',
                      borderColor: 'rgba(255,255,255,0.2)',
                      color: '#edf0f7',
                      borderRadius: 1,
                    }}
                  >
                    Quiz
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={<MonetizationOn />}
                    onClick={() => setLocation('/academy/monetization')}
                    sx={{
                      textTransform: 'none',
                      borderColor: 'rgba(255,255,255,0.2)',
                      color: '#edf0f7',
                      borderRadius: 1,
                    }}
                  >
                    Monetize
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={<Campaign />}
                    onClick={() => setLocation('/academy/cta-overlay')}
                    sx={{
                      textTransform: 'none',
                      borderColor: 'rgba(255,255,255,0.2)',
                      color: '#edf0f7',
                      borderRadius: 1,
                    }}
                  >
                    CTA
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={<Subtitles />}
                    onClick={() => setLocation('/academy/lower-thirds')}
                    sx={{
                      textTransform: 'none',
                      borderColor: 'rgba(255,255,255,0.2)',
                      color: '#edf0f7',
                      borderRadius: 1,
                    }}
                  >
                    LowerThirds
                  </Button>
                  <Button
                    variant="contained"
                    startIcon={<Publish />}
                    onClick={handleSaveAll}
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

              <Stack direction="row" spacing={1.2} alignItems="center" sx={{ ...panelSectionSx, px: 1.2, py: 1.1 }}>
                <Tooltip title="Drag">
                  <IconButton size="small" sx={{ color: 'rgba(237,240,247,0.74)' }}>
                    <DragIndicator fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Edit">
                  <IconButton size="small" sx={{ color: 'rgba(237,240,247,0.74)' }}>
                    <Edit fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Divider orientation="vertical" flexItem sx={{ borderColor: 'rgba(255,255,255,0.15)' }} />

                <Stack direction="row" spacing={0.8} flexWrap="wrap" useFlexGap>
                  {annotationTypes.map((type) => (
                    <Chip
                      key={type.value}
                      label={type.label}
                      onClick={() => {
                        setActiveTool(type.value);
                        addAnnotation(type.value);
                      }}
                      sx={{
                        color: type.value === activeTool ? '#0f0f0f' : '#edf0f7',
                        bgcolor: type.value === activeTool ? type.color : 'rgba(255,255,255,0.07)',
                        border: `1px solid ${alpha(type.color, 0.5)}`,
                        fontWeight: 600,
                      }}
                    />
                  ))}
                </Stack>

                <Button
                  variant="text"
                  size="small"
                  onClick={() => setPreviewMode((prev) => !prev)}
                  startIcon={previewMode ? <Visibility /> : <VisibilityOff />}
                  sx={{ ml: 'auto', color: '#edf0f7', textTransform: 'none' }}
                >
                  {previewMode ? 'Preview On' : 'Preview Off'}
                </Button>
              </Stack>

              <Box
                sx={{
                  ...panelSectionSx,
                  p: 1,
                  position: 'relative',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 1,
                  minHeight: 360,
                }}
              >
                <Box
                  sx={{
                    borderRadius: 1,
                    overflow: 'hidden',
                    border: '1px solid rgba(255,255,255,0.08)',
                    position: 'relative',
                    aspectRatio: '16 / 9',
                    background:
                      'radial-gradient(circle at 70% 16%, rgba(248,179,33,0.18), rgba(9,12,18,0) 46%), linear-gradient(145deg, rgba(20,24,35,0.96), rgba(9,12,18,0.96))',
                  }}
                >
                  <video
                    ref={videoRef}
                    src={videoUrl}
                    onLoadedMetadata={handleLoadedMetadata}
                    onTimeUpdate={handleTimeUpdate}
                    onPlay={() => setIsPlaying(true)}
                    onPause={() => setIsPlaying(false)}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  />

                  <canvas
                    ref={canvasRef}
                    onMouseDown={handleCanvasMouseDown}
                    onMouseMove={handleCanvasMouseMove}
                    onMouseUp={handleCanvasMouseUp}
                    style={{
                      position: 'absolute',
                      inset: 0,
                      width: '100%',
                      height: '100%',
                      cursor: previewMode ? 'pointer' : 'crosshair',
                    }}
                  />

                  <Box
                    sx={{
                      position: 'absolute',
                      left: 0,
                      right: 0,
                      bottom: 0,
                      p: 1.2,
                      background: 'linear-gradient(180deg, rgba(10,13,20,0), rgba(10,13,20,0.95))',
                    }}
                  >
                    <Stack direction="row" spacing={1.2} alignItems="center">
                      <IconButton
                        onClick={handlePlayPause}
                        size="small"
                        sx={{ color: '#f9fafc', border: '1px solid rgba(255,255,255,0.18)', borderRadius: 1 }}
                      >
                        {isPlaying ? <Pause fontSize="small" /> : <PlayArrow fontSize="small" />}
                      </IconButton>
                      <Typography sx={{ minWidth: 110, fontSize: 13 }}>
                        {formatTime(currentTime)} / {formatTime(videoDuration)}
                      </Typography>
                      <Slider
                        value={currentTime}
                        onChange={handleSeek}
                        min={0}
                        max={videoDuration || 1}
                        sx={{
                          flex: 1,
                          color: '#f8b321',
                          '& .MuiSlider-thumb': {
                            width: 12,
                            height: 12,
                          },
                        }}
                      />
                    </Stack>
                  </Box>
                </Box>

                <Box sx={{ ...panelSectionSx, p: 1.2 }}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography sx={{ fontSize: 12, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'rgba(237,240,247,0.65)' }}>
                      Timeline
                    </Typography>
                    <Box sx={{ ml: 'auto', display: 'flex', gap: 1 }}>
                      <Chip label="Resolved" size="small" sx={{ bgcolor: 'rgba(126,232,179,0.16)', color: '#9ef1ca' }} />
                      <Chip label={`${annotationItems.length} markers`} size="small" sx={{ bgcolor: 'rgba(248,179,33,0.16)', color: '#f8d675' }} />
                    </Box>
                  </Stack>

                  <Box sx={{ position: 'relative', height: 76, mt: 1, borderRadius: 1, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.09)' }}>
                    <Box
                      sx={{
                        position: 'absolute',
                        inset: 0,
                        display: 'flex',
                        alignItems: 'flex-end',
                        px: 0.7,
                        pb: 0.6,
                        gap: 0.45,
                        background: 'linear-gradient(180deg, rgba(18,22,31,0.76), rgba(8,11,18,0.92))',
                      }}
                    >
                      {waveformPattern.map((height, index) => (
                        <Box
                          key={`wave-${index}`}
                          sx={{
                            flex: 1,
                            borderRadius: 0.5,
                            height,
                            background:
                              index % 3 === 0
                                ? 'linear-gradient(180deg, rgba(248,179,33,0.65), rgba(248,179,33,0.25))'
                                : 'linear-gradient(180deg, rgba(154,167,199,0.56), rgba(154,167,199,0.2))',
                          }}
                        />
                      ))}
                    </Box>

                    {annotationItems.map((annotation) => {
                      const markerLeft = videoDuration > 0 ? (annotation.startTime / videoDuration) * 100 : 0;
                      return (
                        <Box
                          key={`marker-${annotation.id}`}
                          onClick={() => prepareDraft(annotation)}
                          sx={{
                            position: 'absolute',
                            top: 8,
                            left: `${clamp(markerLeft, 0, 100)}%`,
                            width: 9,
                            height: 9,
                            borderRadius: '50%',
                            bgcolor: annotationTypes.find((type) => type.value === annotation.type)?.color || '#f8b321',
                            boxShadow: '0 0 0 3px rgba(0,0,0,0.5)',
                            transform: 'translateX(-50%)',
                            cursor: 'pointer',
                          }}
                        />
                      );
                    })}

                    <Box
                      sx={{
                        position: 'absolute',
                        top: 0,
                        bottom: 0,
                        left: `${timelinePercent}%`,
                        width: 2,
                        bgcolor: '#ffd165',
                        boxShadow: '0 0 12px rgba(248,179,33,0.72)',
                        transform: 'translateX(-1px)',
                      }}
                    />
                  </Box>

                  <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} sx={{ mt: 1.1 }}>
                    <TextField
                      value={searchValue}
                      onChange={(event) => setSearchValue(event.target.value)}
                      placeholder={tt('Søk moduler...', 'Search modules...')}
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
                      onClick={() => addAnnotation(activeTool)}
                      sx={{
                        textTransform: 'none',
                        minWidth: 148,
                        color: '#f7f8fb',
                        border: '1px solid rgba(255,255,255,0.2)',
                        borderRadius: 1,
                      }}
                    >
                      Add Marker
                    </Button>
                  </Stack>
                </Box>
              </Box>

              {saveMessage && (
                <Typography sx={{ fontSize: 12, color: '#a8f7c4', px: 0.4 }}>
                  {saveMessage}
                </Typography>
              )}
            </Box>

            <Box sx={{ ...panelSectionSx, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
              <Tabs
                value={rightTab}
                onChange={(_, value: RightPanelTab) => setRightTab(value)}
                textColor="inherit"
                sx={{
                  borderBottom: '1px solid rgba(255,255,255,0.08)',
                  '& .MuiTabs-indicator': { backgroundColor: '#f8b321' },
                  '& .MuiTab-root': { color: 'rgba(237,240,247,0.78)', textTransform: 'none', minHeight: 44 },
                  '& .Mui-selected': { color: '#f7f8fb' },
                }}
              >
                <Tab label="Annotation Editor" value="editor" />
                <Tab label="Markers" value="markers" />
                <Tab label="Attachments" value="attachments" />
              </Tabs>

              {rightTab === 'editor' && (
                <Box sx={{ p: 1.25, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 1.1 }}>
                  <TextField
                    select
                    value={selectedAnnotation?.id || 'none'}
                    onChange={(event) => {
                      const nextAnnotation = annotationItems.find((annotation) => annotation.id === event.target.value);
                      if (nextAnnotation) {
                        prepareDraft(nextAnnotation);
                      }
                    }}
                    size="small"
                    label="Annotation"
                    sx={{
                      '& .MuiInputBase-root': { bgcolor: 'rgba(10,13,20,0.8)', color: '#edf0f7' },
                    }}
                  >
                    <MenuItem value="none">Velg annotasjon</MenuItem>
                    {annotationItems.map((annotation) => (
                      <MenuItem key={annotation.id} value={annotation.id}>
                        {formatTime(annotation.startTime)} · {annotation.title}
                      </MenuItem>
                    ))}
                  </TextField>

                  <Stack direction="row" spacing={0.8} flexWrap="wrap" useFlexGap>
                    {annotationTypes.map((type) => (
                      <Chip
                        key={`quick-${type.value}`}
                        label={type.label}
                        onClick={() => addAnnotation(type.value)}
                        sx={{
                          border: `1px solid ${alpha(type.color, 0.55)}`,
                          color: '#edf0f7',
                          bgcolor: alpha(type.color, 0.16),
                        }}
                      />
                    ))}
                  </Stack>

                  <TextField
                    value={searchValue}
                    onChange={(event) => setSearchValue(event.target.value)}
                    size="small"
                    placeholder="Søk annoteringer..."
                    InputProps={{
                      startAdornment: <Search fontSize="small" sx={{ mr: 0.6, color: 'rgba(237,240,247,0.58)' }} />,
                    }}
                    sx={{ '& .MuiInputBase-root': { bgcolor: 'rgba(10,13,20,0.78)', color: '#edf0f7' } }}
                  />

                  <Box sx={{ flex: 1, minHeight: 180, overflowY: 'auto', pr: 0.3 }}>
                    <Stack spacing={0.8}>
                      {filteredAnnotations.map((annotation) => {
                        const typeMeta = annotationTypes.find((type) => type.value === annotation.type);
                        const selected = annotation.id === selectedAnnotationId;
                        return (
                          <Box
                            key={annotation.id}
                            onClick={() => prepareDraft(annotation)}
                            sx={{
                              border: selected ? `1px solid ${alpha('#f8b321', 0.7)}` : '1px solid rgba(255,255,255,0.08)',
                              borderRadius: 1,
                              p: 1,
                              background:
                                selected
                                  ? 'linear-gradient(145deg, rgba(248,179,33,0.16), rgba(14,17,27,0.92))'
                                  : 'linear-gradient(145deg, rgba(20,24,35,0.9), rgba(10,13,22,0.9))',
                              cursor: 'pointer',
                            }}
                          >
                            <Stack direction="row" spacing={1} alignItems="flex-start">
                              <Avatar sx={{ width: 28, height: 28, bgcolor: alpha(typeMeta?.color || '#f8b321', 0.3), color: '#fff' }}>
                                {typeMeta?.short || 'A'}
                              </Avatar>
                              <Box sx={{ flex: 1, minWidth: 0 }}>
                                <Stack direction="row" spacing={0.6} alignItems="center">
                                  <Typography sx={{ fontSize: 14, fontWeight: 600 }} noWrap>
                                    {annotation.title}
                                  </Typography>
                                  <Typography sx={{ fontSize: 11, color: 'rgba(237,240,247,0.62)' }}>
                                    {formatTime(annotation.startTime)}
                                  </Typography>
                                </Stack>
                                <Typography sx={{ fontSize: 12, color: 'rgba(237,240,247,0.75)' }} noWrap>
                                  {annotation.content}
                                </Typography>
                                <Stack direction="row" spacing={0.7} sx={{ mt: 0.6 }}>
                                  <Chip
                                    label={annotation.type}
                                    size="small"
                                    sx={{
                                      height: 20,
                                      bgcolor: alpha(typeMeta?.color || '#f8b321', 0.2),
                                      color: '#edf0f7',
                                    }}
                                  />
                                  {annotation.endTime !== undefined && (
                                    <Chip
                                      label={`to ${formatTime(annotation.endTime)}`}
                                      size="small"
                                      sx={{ height: 20, bgcolor: 'rgba(255,255,255,0.09)', color: '#edf0f7' }}
                                    />
                                  )}
                                </Stack>
                              </Box>
                              <IconButton
                                size="small"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  deleteAnnotation(annotation.id);
                                }}
                                sx={{ color: 'rgba(255,255,255,0.64)' }}
                              >
                                <Delete fontSize="small" />
                              </IconButton>
                            </Stack>
                          </Box>
                        );
                      })}

                      {filteredAnnotations.length === 0 && (
                        <Typography sx={{ color: 'rgba(237,240,247,0.64)', fontSize: 13, py: 2, textAlign: 'center' }}>
                          Ingen annoteringer funnet.
                        </Typography>
                      )}
                    </Stack>
                  </Box>

                  {draftAnnotation && (
                    <Box sx={{ border: '1px solid rgba(255,255,255,0.09)', borderRadius: 1, p: 1.1, bgcolor: 'rgba(7,10,16,0.85)' }}>
                      <Typography sx={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'rgba(237,240,247,0.62)', mb: 0.8 }}>
                        Edit Annotation
                      </Typography>

                      <Stack spacing={0.9}>
                        <TextField
                          label="Title"
                          size="small"
                          value={draftAnnotation.title}
                          onChange={(event) =>
                            setDraftAnnotation((prev) => (prev ? { ...prev, title: event.target.value } : prev))
                          }
                          sx={{ '& .MuiInputBase-root': { color: '#edf0f7' } }}
                        />

                        <TextField
                          label="Content"
                          size="small"
                          multiline
                          minRows={2}
                          value={draftAnnotation.content}
                          onChange={(event) =>
                            setDraftAnnotation((prev) => (prev ? { ...prev, content: event.target.value } : prev))
                          }
                          sx={{ '& .MuiInputBase-root': { color: '#edf0f7' } }}
                        />

                        <TextField
                          select
                          label="Type"
                          size="small"
                          value={draftAnnotation.type}
                          onChange={(event) => {
                            const nextType = event.target.value as VideoAnnotation['type'];
                            setDraftAnnotation((prev) =>
                              prev
                                ? {
                                    ...prev,
                                    type: nextType,
                                    style: defaultAnnotationStyle(nextType),
                                  }
                                : prev,
                            );
                          }}
                          sx={{ '& .MuiInputBase-root': { color: '#edf0f7' } }}
                        >
                          {annotationTypes.map((type) => (
                            <MenuItem key={type.value} value={type.value}>
                              {type.label}
                            </MenuItem>
                          ))}
                        </TextField>

                        <Stack direction="row" spacing={0.8}>
                          <TextField
                            label="Start"
                            type="number"
                            size="small"
                            value={draftAnnotation.startTime}
                            onChange={(event) =>
                              setDraftAnnotation((prev) =>
                                prev ? { ...prev, startTime: Number(event.target.value || 0) } : prev,
                              )
                            }
                            sx={{ '& .MuiInputBase-root': { color: '#edf0f7' } }}
                          />
                          <TextField
                            label="End"
                            type="number"
                            size="small"
                            value={draftAnnotation.endTime ?? ''}
                            onChange={(event) =>
                              setDraftAnnotation((prev) =>
                                prev
                                  ? {
                                      ...prev,
                                      endTime: event.target.value === '' ? undefined : Number(event.target.value),
                                    }
                                  : prev,
                              )
                            }
                            sx={{ '& .MuiInputBase-root': { color: '#edf0f7' } }}
                          />
                        </Stack>

                        <Stack direction="row" spacing={0.8}>
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={() =>
                              setDraftAnnotation((prev) =>
                                prev ? { ...prev, isVisible: !prev.isVisible } : prev,
                              )
                            }
                            startIcon={draftAnnotation.isVisible ? <Visibility fontSize="small" /> : <VisibilityOff fontSize="small" />}
                            sx={{ textTransform: 'none', color: '#edf0f7', borderColor: 'rgba(255,255,255,0.22)' }}
                          >
                            {draftAnnotation.isVisible ? 'Visible' : 'Hidden'}
                          </Button>
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={() =>
                              setDraftAnnotation((prev) =>
                                prev ? { ...prev, isClickable: !prev.isClickable } : prev,
                              )
                            }
                            sx={{ textTransform: 'none', color: '#edf0f7', borderColor: 'rgba(255,255,255,0.22)' }}
                          >
                            {draftAnnotation.isClickable ? 'Clickable' : 'Static'}
                          </Button>
                        </Stack>

                        <Stack direction="row" spacing={0.8}>
                          <Button
                            size="small"
                            variant="contained"
                            onClick={saveDraft}
                            sx={{
                              textTransform: 'none',
                              color: '#0f0f0f',
                              background: 'linear-gradient(180deg, #ffd44e, #f2a616)',
                              fontWeight: 700,
                            }}
                          >
                            Save Annotation
                          </Button>
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={() => setDraftAnnotation(null)}
                            sx={{ textTransform: 'none', color: '#edf0f7', borderColor: 'rgba(255,255,255,0.2)' }}
                          >
                            Cancel
                          </Button>
                          <Button
                            size="small"
                            variant="outlined"
                            color="error"
                            onClick={() => deleteAnnotation(draftAnnotation.id)}
                            sx={{ textTransform: 'none' }}
                          >
                            Delete
                          </Button>
                        </Stack>
                      </Stack>
                    </Box>
                  )}
                </Box>
              )}

              {rightTab === 'markers' && (
                <Box sx={{ p: 1.3, display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <Typography sx={{ fontSize: 13, color: 'rgba(237,240,247,0.72)' }}>
                    Marker timeline and release notes
                  </Typography>
                  <LinearProgress
                    variant="determinate"
                    value={timelinePercent}
                    sx={{
                      height: 8,
                      borderRadius: 4,
                      bgcolor: 'rgba(255,255,255,0.1)',
                      '& .MuiLinearProgress-bar': {
                        background: 'linear-gradient(90deg, #f8b321, #f6d06d)',
                      },
                    }}
                  />
                  <Stack spacing={0.8}>
                    {annotationItems.map((annotation) => (
                      <Stack
                        key={`marker-row-${annotation.id}`}
                        direction="row"
                        spacing={1}
                        alignItems="center"
                        sx={{
                          border: '1px solid rgba(255,255,255,0.08)',
                          borderRadius: 1,
                          px: 1,
                          py: 0.7,
                          background: 'rgba(12,16,24,0.88)',
                        }}
                      >
                        <Box
                          sx={{
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            bgcolor: annotationTypes.find((type) => type.value === annotation.type)?.color || '#f8b321',
                          }}
                        />
                        <Typography sx={{ fontSize: 13, flex: 1 }} noWrap>
                          {annotation.title}
                        </Typography>
                        <Typography sx={{ fontSize: 12, color: 'rgba(237,240,247,0.64)' }}>
                          {formatTime(annotation.startTime)}
                        </Typography>
                      </Stack>
                    ))}
                  </Stack>
                </Box>
              )}

              {rightTab === 'attachments' && (
                <Box sx={{ p: 1.3, display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <Typography sx={{ fontSize: 13, color: 'rgba(237,240,247,0.72)' }}>
                    Placeholder attachments for prototype
                  </Typography>
                  {['Storyboard Notes.pdf', 'Shotlist-v2.csv', 'Audio Cue Sheet.docx'].map((file) => (
                    <Stack
                      key={file}
                      direction="row"
                      alignItems="center"
                      spacing={1}
                      sx={{
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: 1,
                        px: 1,
                        py: 0.8,
                        background: 'rgba(12,16,24,0.88)',
                      }}
                    >
                      <AttachFile fontSize="small" sx={{ color: 'rgba(237,240,247,0.7)' }} />
                      <Typography sx={{ flex: 1, fontSize: 13 }}>{file}</Typography>
                      <Button size="small" sx={{ textTransform: 'none', color: '#f8d675' }}>
                        Open
                      </Button>
                    </Stack>
                  ))}
                </Box>
              )}

              <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)' }} />

              <Stack direction="row" spacing={1} sx={{ p: 1.1 }}>
                <Button
                  startIcon={<Add />}
                  onClick={() => addAnnotation(activeTool)}
                  sx={{
                    flex: 1,
                    textTransform: 'none',
                    color: '#0f0f0f',
                    background: 'linear-gradient(180deg, #ffd44e, #f2a616)',
                    fontWeight: 700,
                  }}
                >
                  Add
                </Button>
                <Button
                  startIcon={<Save />}
                  onClick={handleSaveAll}
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
                      setLocation('/academy/lesson-editor');
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
              </Stack>
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

export default withUniversalIntegration(VideoAnnotationEditor, {
  componentId: 'video-annotation-editor',
  componentName: 'Video Annotation Editor',
  componentType: 'editor',
  componentCategory: 'academy',
  featureIds: ['annotation-editor', 'video-player-academy'],
});
