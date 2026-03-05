import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  Bookmark,
  Campaign,
  Check,
  FastForward,
  FastRewind,
  MailOutline,
  Mic,
  MonetizationOn,
  NotificationsNone,
  Pause,
  PlayArrow,
  Publish,
  Quiz,
  Search,
  Settings,
  SkipNext,
  SkipPrevious,
  Subtitles,
  VolumeOff,
  VolumeUp,
  Save,
} from '@mui/icons-material';
import { useLocation } from 'wouter';
import { useAcademy } from '@/contexts/AcademyContext';
import { useEnhancedMasterIntegration } from '@/integration/EnhancedMasterIntegrationProvider';
import { withUniversalIntegration } from '@/integration/UniversalIntegrationHOC';
import { useAcademyLocale } from './academyLocale';
import AcademyBrandMark from './AcademyBrandMark';
import AcademyPlayerStudio from './AcademyPlayerStudio';

interface ChapterItem {
  id: string;
  title: string;
  startTime: number;
  duration: number;
  icon: string;
}

interface TranscriptLine {
  id: string;
  speaker: string;
  timestamp: number;
  text: string;
}

interface QuizChoice {
  id: string;
  label: string;
  text: string;
  isCorrect: boolean;
}

interface PlayerQuiz {
  id: string;
  question: string;
  helper: string;
  timestamp: number;
  choices: QuizChoice[];
}

interface AcademyVideoPlayerStudioProps {
  courseId?: string;
  lessonId?: string;
  onSave?: (payload: Record<string, unknown>) => void;
  onCancel?: () => void;
}

type RightTab = 'chapters' | 'shownotes' | 'transcript';

const VIDEO_PLACEHOLDER = '/assets/academy/intro-video.mp4';

const cinematicPanelSx = {
  borderRadius: 1.4,
  border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.08)',
  background: 'linear-gradient(145deg, rgba(20,24,36,0.88), rgba(11,14,22,0.96))',
};

const academyShellMaxWidth = 'min(100%, var(--academy-shell-max-width, 1920px))';

const formatTime = (seconds: number): string => {
  const safe = Number.isFinite(seconds) && seconds >= 0 ? seconds : 0;
  const min = Math.floor(safe / 60);
  const sec = Math.floor(safe % 60);
  return `${min}:${sec.toString().padStart(2, '0')}`;
};

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

const buildFallbackCourse = () => ({
  id: 'video-player-preview-course',
  title: 'Directing Masterclass',
  description: 'Studio preview player.',
  instructor: {
    id: 'studio-instructor',
    name: 'Norwedfilm',
    avatar: '',
    bio: 'Film director',
    profession: 'videographer' as const,
  },
  thumbnail: '',
  videoUrl: VIDEO_PLACEHOLDER,
  duration: 336,
  level: 'advanced' as const,
  category: 'videography' as const,
  tags: ['directing', 'filmmaking'],
  price: 0,
  isFree: true,
  isPublished: false,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  rating: 4.8,
  studentCount: 370,
  prerequisites: [],
  learningOutcomes: [],
  resources: [],
  lessons: [
    {
      id: 'lesson-preview-1',
      courseId: 'video-player-preview-course',
      title: 'Lighting Setup',
      description: 'Key light scene review',
      videoUrl: VIDEO_PLACEHOLDER,
      duration: 336,
      order: 1,
      isPreview: true,
      resources: [],
    },
  ],
});

const buildDefaultChapters = (duration: number): ChapterItem[] => {
  const safeDuration = Math.max(duration, 240);
  return [
    { id: 'chapter-1', title: 'Introduction', startTime: 0, duration: Math.round(safeDuration * 0.23), icon: 'T' },
    { id: 'chapter-2', title: 'Lighting Basics', startTime: Math.round(safeDuration * 0.23), duration: Math.round(safeDuration * 0.22), icon: '⚡' },
    { id: 'chapter-3', title: 'Practical Setup', startTime: Math.round(safeDuration * 0.45), duration: Math.round(safeDuration * 0.27), icon: '◼' },
    { id: 'chapter-4', title: 'Scene Review', startTime: Math.round(safeDuration * 0.72), duration: Math.round(safeDuration * 0.28), icon: 'B' },
  ];
};

const buildDefaultTranscript = (): TranscriptLine[] => [
  {
    id: 'line-1',
    speaker: 'Norwedfilm',
    timestamp: 2,
    text: 'Welcome, I\'m excited to kick off our masterclass and share filmmaking insights.',
  },
  {
    id: 'line-2',
    speaker: 'Alex Jensen',
    timestamp: 24,
    text: 'Let\'s start with the importance of key lighting in directing.',
  },
  {
    id: 'line-3',
    speaker: 'Alex Jensen',
    timestamp: 62,
    text: 'Always begin with proper setup. A shot is only as strong as its foundation.',
  },
  {
    id: 'line-4',
    speaker: 'Norwedfilm',
    timestamp: 118,
    text: 'For this scene we use three-point lighting. I\'ll show you how to position each light.',
  },
];

const buildDefaultQuiz = (): PlayerQuiz => ({
  id: 'quiz-keylight-1',
  question: 'What is the primary function of a key light in film lighting?',
  helper: 'Watch the scene and choose the correct answer to proceed.',
  timestamp: 373,
  choices: [
    { id: 'qa', label: 'A', text: 'Introduction', isCorrect: false },
    { id: 'qb', label: 'B', text: 'Lighting Basics', isCorrect: false },
    { id: 'qc', label: 'C', text: 'Practical Setup', isCorrect: false },
    { id: 'qd', label: 'D', text: 'Scene Review', isCorrect: true },
  ],
});

function AcademyVideoPlayerStudio({ courseId, lessonId, onSave, onCancel }: AcademyVideoPlayerStudioProps) {
  const [location, setLocation] = useLocation();
  const { state, updateProgress, updateSettings, addBookmark, addNote, getCourse } = useAcademy();
  const { analytics, debugging } = useEnhancedMasterIntegration();
  
  const { navLabel, tt } = useAcademyLocale();

  const videoRef = useRef<HTMLVideoElement>(null);
  const progressRef = useRef(0);

  const fallbackCourse = useMemo(() => buildFallbackCourse(), []);

  const activeCourse = useMemo(() => {
    if (courseId) {
      return getCourse(courseId) || fallbackCourse;
    }
    return state.currentCourse || state.courses[0] || fallbackCourse;
  }, [courseId, fallbackCourse, getCourse, state.courses, state.currentCourse]);

  const activeLesson = useMemo(() => {
    const lessons = Array.isArray(activeCourse?.lessons) ? activeCourse.lessons : [];
    if (lessonId) {
      return lessons.find((lesson) => String(lesson.id) === String(lessonId)) || lessons[0] || fallbackCourse.lessons[0];
    }
    return state.currentLesson || lessons[0] || fallbackCourse.lessons[0];
  }, [activeCourse, fallbackCourse.lessons, lessonId, state.currentLesson]);

  const [rightTab, setRightTab] = useState<RightTab>('chapters');
  const [transcriptSearch, setTranscriptSearch] = useState('');
  const [speed, setSpeed] = useState(state.settings.playbackSpeed || 1);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(Number(activeLesson?.duration || activeCourse?.duration || 336));
  const [selectedChapterId, setSelectedChapterId] = useState('');
  const [noteDraft, setNoteDraft] = useState('');
  const [saveMessage, setSaveMessage] = useState('');
  const [quizAnswer, setQuizAnswer] = useState('');
  const [quizSubmitted, setQuizSubmitted] = useState(false);

  const [chapters, setChapters] = useState<ChapterItem[]>(() => buildDefaultChapters(Number(activeLesson?.duration || 336)));
  const [transcriptLines, setTranscriptLines] = useState<TranscriptLine[]>(buildDefaultTranscript);
  const [activeQuiz] = useState<PlayerQuiz>(buildDefaultQuiz);

  useEffect(() => {
    setDuration(Number(activeLesson?.duration || activeCourse?.duration || 336));
    setChapters(buildDefaultChapters(Number(activeLesson?.duration || activeCourse?.duration || 336)));
  }, [activeCourse?.duration, activeLesson?.duration]);

  useEffect(() => {
    if (!selectedChapterId && chapters.length > 0) {
      setSelectedChapterId(chapters[0].id);
    }
  }, [chapters, selectedChapterId]);

  const filteredTranscript = useMemo(() => {
    const query = transcriptSearch.trim().toLowerCase();
    if (!query) return transcriptLines;
    return transcriptLines.filter((line) => {
      return line.speaker.toLowerCase().includes(query) || line.text.toLowerCase().includes(query);
    });
  }, [transcriptLines, transcriptSearch]);

  useEffect(() => {
    analytics.trackEvent('academy_video_player_studio_opened', {
      courseId: activeCourse?.id,
      lessonId: activeLesson?.id,
      timestamp: Date.now(),
    });

    debugging.logIntegration('info', 'AcademyVideoPlayerStudio opened', {
      courseId: activeCourse?.id,
      lessonId: activeLesson?.id,
    });
  }, [activeCourse?.id, activeLesson?.id, analytics, debugging]);

  const syncVideoSettings = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.playbackRate = speed;
    video.volume = muted ? 0 : volume;
    video.muted = muted;
  }, [muted, speed, volume]);

  useEffect(() => {
    syncVideoSettings();
  }, [syncVideoSettings]);

  const handleLoadedMetadata = useCallback(() => {
    const measured = videoRef.current?.duration;
    if (measured && Number.isFinite(measured) && measured > 0) {
      setDuration(measured);
    }
  }, []);

  const handleTimeUpdate = useCallback(() => {
    const nextTime = videoRef.current?.currentTime;
    if (typeof nextTime !== 'number' || !Number.isFinite(nextTime)) return;
    setCurrentTime(nextTime);

    const nextProgress = duration > 0 ? clamp((nextTime / duration) * 100, 0, 100) : 0;
    const rounded = Math.floor(nextProgress);
    if (Math.abs(rounded - progressRef.current) >= 5) {
      progressRef.current = rounded;
      void updateProgress(String(activeCourse?.id), String(activeLesson?.id), rounded);
    }

    const chapterAtTime =
      [...chapters]
        .reverse()
        .find((chapter) => nextTime >= chapter.startTime) || chapters[0];
    if (chapterAtTime && chapterAtTime.id !== selectedChapterId) {
      setSelectedChapterId(chapterAtTime.id);
    }
  }, [activeCourse?.id, activeLesson?.id, chapters, duration, selectedChapterId, updateProgress]);

  const handleSeek = useCallback((_: Event, newValue: number | number[]) => {
    const value = Array.isArray(newValue) ? newValue[0] : newValue;
    if (videoRef.current) {
      videoRef.current.currentTime = value;
    }
    setCurrentTime(value);
  }, []);

  const togglePlayback = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().catch(() => undefined);
      setIsPlaying(true);
    } else {
      video.pause();
      setIsPlaying(false);
    }
  }, []);

  const skipBy = useCallback((delta: number) => {
    const target = clamp(currentTime + delta, 0, duration || 1);
    if (videoRef.current) {
      videoRef.current.currentTime = target;
    }
    setCurrentTime(target);
  }, [currentTime, duration]);

  const goToChapter = useCallback((chapter: ChapterItem) => {
    setSelectedChapterId(chapter.id);
    if (videoRef.current) {
      videoRef.current.currentTime = chapter.startTime;
    }
    setCurrentTime(chapter.startTime);

    analytics.trackEvent('academy_video_player_chapter_selected', {
      courseId: activeCourse?.id,
      lessonId: activeLesson?.id,
      chapterId: chapter.id,
      chapterTitle: chapter.title,
      timestamp: Date.now(),
    });
  }, [activeCourse?.id, activeLesson?.id, analytics]);

  const saveSettings = useCallback((next: { speed?: number; subtitles?: boolean }) => {
    void updateSettings({
      playbackSpeed: next.speed ?? speed,
      subtitles: next.subtitles ?? state.settings.subtitles,
    });
  }, [speed, state.settings.subtitles, updateSettings]);

  const toggleSubtitles = useCallback(() => {
    const nextValue = !state.settings.subtitles;
    saveSettings({ subtitles: nextValue });
  }, [saveSettings, state.settings.subtitles]);

  const handleSpeedChange = useCallback((nextSpeed: number) => {
    setSpeed(nextSpeed);
    saveSettings({ speed: nextSpeed });
  }, [saveSettings]);

  const handleBookmark = useCallback(() => {
    void addBookmark(String(activeCourse?.id), String(activeLesson?.id), Math.floor(currentTime));
    setSaveMessage(tt(`Bokmerke lagt til ved ${formatTime(currentTime)}.`, `Bookmark added at ${formatTime(currentTime)}.`));
  }, [activeCourse?.id, activeLesson?.id, addBookmark, currentTime, tt]);

  const handleAddNote = useCallback(() => {
    const note = noteDraft.trim();
    if (!note) return;
    void addNote(String(activeCourse?.id), String(activeLesson?.id), note);

    setTranscriptLines((prev) => [
      ...prev,
      {
        id: `note-${Date.now()}`,
        speaker: tt('Deg', 'You'),
        timestamp: Math.floor(currentTime),
        text: note,
      },
    ]);

    setNoteDraft('');
    setSaveMessage(tt('Notat lagt til i transkripsjonen.', 'Note added to transcript.'));
  }, [activeCourse?.id, activeLesson?.id, addNote, currentTime, noteDraft, tt]);

  const handleQuizSubmit = useCallback(() => {
    if (!quizAnswer) return;
    setQuizSubmitted(true);

    analytics.trackEvent('academy_video_quiz_submitted', {
      courseId: activeCourse?.id,
      lessonId: activeLesson?.id,
      quizId: activeQuiz.id,
      answerId: quizAnswer,
      isCorrect: activeQuiz.choices.find((choice) => choice.id === quizAnswer)?.isCorrect || false,
      timestamp: Date.now(),
    });
  }, [activeCourse?.id, activeLesson?.id, activeQuiz, analytics, quizAnswer]);

  const handleSave = useCallback((publish: boolean) => {
    const payload = {
      id: `video-player-config-${activeCourse?.id || 'preview'}`,
      courseId: activeCourse?.id,
      lessonId: activeLesson?.id,
      chapters,
      transcriptLines,
      speed,
      subtitles: state.settings.subtitles,
      publish,
      updatedAt: new Date().toISOString(),
    };

    onSave?.(payload);
    setSaveMessage(tt(
      publish ? 'Spilleroppsett publisert.' : 'Spilleroppsett lagret.',
      publish ? 'Player setup published.' : 'Player setup saved.',
    ));
  }, [activeCourse?.id, activeLesson?.id, chapters, onSave, speed, state.settings.subtitles, transcriptLines, tt]);

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

  const speedOptions = [0.5, 1, 1.25, 1.5, 2, 6];

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
              {navLabel('Create New Course')}
            </Button>
          </Stack>

          <Stack spacing={0.5} sx={{ px: 1.5 }}>
            {leftNavItems.map((item) => {
              const active =
                location === item.route ||
                (item.id === 'media' && location === '/academy/video-player');
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
              startIcon={<Bookmark />}
              onClick={handleBookmark}
              sx={{
                width: '100%',
                justifyContent: 'flex-start',
                color: '#edf0f7',
                textTransform: 'none',
                border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.14)',
                borderRadius: 1,
              }}
            >
              {tt('Legg til bokmerke', 'Add Bookmark')}
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
              <Chip label={tt('Utkast', 'Draft')} size="small" sx={{ bgcolor: 'rgba(255,255,255,0.08)', color: '#edf0f7', fontWeight: 600 }} />
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
                  <Typography sx={{ fontSize: 30, fontWeight: 600, letterSpacing: '0.02em' }}>
                    {activeCourse?.title || 'Directing Masterclass'}
                  </Typography>
                  <Chip label={tt('Utkast', 'Draft')} size="small" sx={{ bgcolor: 'rgba(255,255,255,0.08)', color: '#edf0f7' }} />
                </Stack>

                <Stack direction="row" spacing={1}>
                  <Button
                    variant="outlined"
                    startIcon={<PlayArrow />}
                    onClick={togglePlayback}
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
                    onClick={() => handleSave(false)}
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
                    {tt('Monetisering', 'Monetization')}
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
                  >{tt('CTA-overlegg', 'CTA Overlay')}</Button>
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
                    {tt('Nedre tredeler', 'Lower Thirds')}
                  </Button>
                  <Button
                    variant="contained"
                    startIcon={<Publish />}
                    onClick={() => handleSave(true)}
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

              <Box sx={{ ...cinematicPanelSx, p: 1, position: 'relative' }}>
                <AcademyPlayerStudio
                  src={activeLesson?.videoUrl || activeCourse?.videoUrl || VIDEO_PLACEHOLDER}
                  videoRef={videoRef}
                  onLoadedMetadata={handleLoadedMetadata}
                  onTimeUpdate={handleTimeUpdate}
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                >

                  <Box
                    sx={{
                      position: 'absolute',
                      left: '50%',
                      bottom: 24,
                      transform: 'translateX(-50%)',
                      width: 'min(84%, 900px)',
                      borderRadius: 1,
                      border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.12)',
                      background: 'linear-gradient(180deg, rgba(13,16,24,0.9), rgba(8,11,18,0.95))',
                      p: 1.6,
                    }}
                  >
                    <Typography sx={{ fontSize: 'clamp(1rem, 0.82rem + 0.9vw, 1.38rem)', fontWeight: 600, mb: 1, textAlign: 'left' }}>
                      {activeQuiz.question}
                    </Typography>

                    <Stack spacing={0.8}>
                      {activeQuiz.choices.map((choice) => {
                        const selected = quizAnswer === choice.id;
                        const showCorrect = quizSubmitted && choice.isCorrect;
                        const showWrong = quizSubmitted && selected && !choice.isCorrect;
                        return (
                          <Button
                            key={choice.id}
                            onClick={() => {
                              if (quizSubmitted) return;
                              setQuizAnswer(choice.id);
                            }}
                            sx={{
                              justifyContent: 'flex-start',
                              textTransform: 'none',
                              color: '#edf0f7',
                              borderRadius: 0.8,
                              border: `var(--academy-hairline-width, 1px) solid ${
                                showCorrect
                                  ? 'rgba(248,179,33,0.85)'
                                  : showWrong
                                    ? 'rgba(255,108,108,0.7)'
                                    : selected
                                      ? 'rgba(248,179,33,0.5)'
                                      : 'rgba(255,255,255,0.18)'
                              }`,
                              background:
                                showCorrect
                                  ? 'linear-gradient(90deg, rgba(248,179,33,0.22), rgba(248,179,33,0.08))'
                                  : selected
                                    ? 'linear-gradient(90deg, rgba(248,179,33,0.16), rgba(255,255,255,0.03))'
                                    : 'rgba(0,0,0,0.2)',
                            }}
                          >
                            <Stack direction="row" spacing={1} alignItems="center" sx={{ width: '100%' }}>
                              <Chip
                                label={choice.label}
                                size="small"
                                sx={{ bgcolor: 'rgba(255,255,255,0.08)', color: '#edf0f7' }}
                              />
                              <Typography sx={{ textAlign: 'left' }}>{choice.text}</Typography>
                              <Box sx={{ ml: 'auto' }}>{showCorrect && <Check sx={{ color: '#f8d56f' }} />}</Box>
                            </Stack>
                          </Button>
                        );
                      })}
                    </Stack>

                    <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: 1.1 }}>
                      <Chip label={formatTime(activeQuiz.timestamp)} size="small" sx={{ bgcolor: 'rgba(248,179,33,0.2)', color: '#f8d56f' }} />
                      <Typography sx={{ color: 'rgba(237,240,247,0.72)', fontSize: 13 }}>{activeQuiz.helper}</Typography>
                      <Button
                        onClick={handleQuizSubmit}
                        disabled={!quizAnswer || quizSubmitted}
                        sx={{
                          ml: 'auto',
                          textTransform: 'none',
                          color: '#0f0f0f',
                          background: 'linear-gradient(180deg, #ffd44e, #f2a616)',
                          '&.Mui-disabled': {
                            color: 'rgba(255,255,255,0.55)',
                            background: 'rgba(255,255,255,0.12)',
                          },
                        }}
                      >
                        {quizSubmitted ? tt('Sendt inn', 'Submitted') : tt('Send inn', 'Submit')}
                      </Button>
                    </Stack>
                  </Box>
                </AcademyPlayerStudio>

                <Box sx={{ mt: 1.1, ...cinematicPanelSx, p: 0.9 }}>
                  <Stack direction="row" spacing={0.8} alignItems="center">
                    <IconButton size="small" onClick={() => skipBy(-10)} sx={{ color: '#edf0f7' }}>
                      <FastRewind fontSize="small" />
                    </IconButton>
                    <IconButton size="small" onClick={togglePlayback} sx={{ color: '#edf0f7' }}>
                      {isPlaying ? <Pause fontSize="small" /> : <PlayArrow fontSize="small" />}
                    </IconButton>
                    <IconButton size="small" onClick={() => skipBy(10)} sx={{ color: '#edf0f7' }}>
                      <FastForward fontSize="small" />
                    </IconButton>
                    <Divider orientation="vertical" flexItem sx={{ borderColor: 'rgba(255,255,255,0.12)' }} />
                    <IconButton size="small" onClick={() => goToChapter(chapters[0])} sx={{ color: '#edf0f7' }}>
                      <SkipPrevious fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => {
                        const index = chapters.findIndex((chapter) => chapter.id === selectedChapterId);
                        const next = chapters[Math.min(index + 1, chapters.length - 1)];
                        if (next) goToChapter(next);
                      }}
                      sx={{ color: '#edf0f7' }}
                    >
                      <SkipNext fontSize="small" />
                    </IconButton>

                    <Slider
                      value={currentTime}
                      onChange={handleSeek}
                      min={0}
                      max={duration || 1}
                      sx={{
                        mx: 1,
                        color: '#f8b321',
                        '& .MuiSlider-thumb': {
                          width: 12,
                          height: 12,
                        },
                      }}
                    />

                    <Typography sx={{ minWidth: 92, fontSize: 13, color: 'rgba(237,240,247,0.78)' }}>
                      {formatTime(currentTime)} / {formatTime(duration)}
                    </Typography>

                    <IconButton size="small" onClick={() => setMuted((prev) => !prev)} sx={{ color: '#edf0f7' }}>
                      {muted ? <VolumeOff fontSize="small" /> : <VolumeUp fontSize="small" />}
                    </IconButton>
                    <Slider
                      value={muted ? 0 : volume * 100}
                      onChange={(_, value) => {
                        const next = Array.isArray(value) ? value[0] : value;
                        setVolume(next / 100);
                        if (next > 0 && muted) {
                          setMuted(false);
                        }
                      }}
                      min={0}
                      max={100}
                      sx={{ width: 90, color: '#f8b321' }}
                    />

                    <Select
                      size="small"
                      value={speed}
                      onChange={(event) => handleSpeedChange(Number(event.target.value))}
                      sx={{
                        minWidth: 74,
                        color: '#edf0f7',
                        '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.16)' },
                      }}
                    >
                      {speedOptions.map((option) => (
                        <MenuItem key={`speed-${option}`} value={option}>{option}x</MenuItem>
                      ))}
                    </Select>

                    <IconButton size="small" onClick={toggleSubtitles} sx={{ color: state.settings.subtitles ? '#f8d56f' : '#edf0f7' }}>
                      <Subtitles fontSize="small" />
                    </IconButton>

                    <IconButton size="small" onClick={handleBookmark} sx={{ color: '#edf0f7' }}>
                      <Bookmark fontSize="small" />
                    </IconButton>
                  </Stack>
                </Box>

                <Box sx={{ mt: 1, ...cinematicPanelSx, p: 0.9 }}>
                  <Stack direction="row" spacing={0.8} alignItems="center">
                    <TextField
                      size="small"
                      placeholder={tt('Legg til notat i transkripsjonen...', 'Add note to transcript...')}
                      value={noteDraft}
                      onChange={(event) => setNoteDraft(event.target.value)}
                      sx={{
                        flex: 1,
                        '& .MuiInputBase-root': {
                          color: '#edf0f7',
                          bgcolor: 'rgba(10,13,20,0.68)',
                        },
                      }}
                    />
                    <Button
                      onClick={handleAddNote}
                      startIcon={<Mic />}
                      sx={{
                        textTransform: 'none',
                        color: '#edf0f7',
                        border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.18)',
                      }}
                    >
                      {tt('Legg til notat', 'Add Note')}
                    </Button>
                    <Button
                      onClick={() => setLocation('/academy/quiz-manager')}
                      startIcon={<Quiz />}
                      sx={{
                        textTransform: 'none',
                        color: '#edf0f7',
                        border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.18)',
                      }}
                    >
                      Quiz
                    </Button>
                  </Stack>
                </Box>
              </Box>

              {!!saveMessage && (
                <Typography sx={{ fontSize: 12, color: '#a8f7c4', px: 0.4 }}>
                  {saveMessage}
                </Typography>
              )}
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
                <Tab label={tt('Kapitler', 'Chapters')} value="chapters" />
                <Tab label={tt('Vis notater', 'Show Notes')} value="shownotes" />
                <Tab label={tt('Transkripsjon', 'Transcript')} value="transcript" />
              </Tabs>

              {rightTab === 'chapters' && (
                <Box sx={{ p: 1.2, display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ color: 'rgba(237,240,247,0.72)' }}>
                    <Typography sx={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      {tt('Kapitler', 'Chapters')}
                    </Typography>
                    <Typography sx={{ ml: 'auto', fontSize: 12 }}>
                      {activeLesson?.title || tt('Leksjon', 'Lesson')}
                    </Typography>
                  </Stack>

                  <Stack spacing={0.7}>
                    {chapters.map((chapter) => {
                      const active = chapter.id === selectedChapterId;
                      return (
                        <Button
                          key={chapter.id}
                          onClick={() => goToChapter(chapter)}
                          sx={{
                            justifyContent: 'flex-start',
                            textTransform: 'none',
                            color: '#edf0f7',
                            borderRadius: 1,
                            border: active ? 'var(--academy-hairline-width, 1px) solid rgba(248,179,33,0.62)' : 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.12)',
                            background: active
                              ? 'linear-gradient(90deg, rgba(248,179,33,0.18), rgba(248,179,33,0.03))'
                              : 'rgba(255,255,255,0.01)',
                          }}
                        >
                          <Stack direction="row" spacing={1} alignItems="center" sx={{ width: '100%' }}>
                            <Chip
                              label={chapter.icon}
                              size="small"
                              sx={{
                                bgcolor: active ? 'rgba(248,179,33,0.25)' : 'rgba(255,255,255,0.1)',
                                color: '#edf0f7',
                              }}
                            />
                            <Typography sx={{ textAlign: 'left' }}>{chapter.title}</Typography>
                            <Typography sx={{ ml: 'auto', color: 'rgba(237,240,247,0.67)', fontSize: 13 }}>
                              {formatTime(chapter.startTime)}
                            </Typography>
                          </Stack>
                        </Button>
                      );
                    })}
                  </Stack>

                  <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)' }} />

                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography sx={{ color: 'rgba(237,240,247,0.68)' }}>{tt('Undertekster', 'Subtitles')}</Typography>
                    <Button
                      onClick={toggleSubtitles}
                      size="small"
                      sx={{
                        ml: 'auto',
                        textTransform: 'none',
                        color: state.settings.subtitles ? '#f8d56f' : '#edf0f7',
                        border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.16)',
                      }}
                    >
                      {state.settings.subtitles ? tt('På', 'On') : tt('Av', 'Off')}
                    </Button>
                  </Stack>

                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography sx={{ color: 'rgba(237,240,247,0.68)' }}>{tt('Hastighet', 'Speed')}</Typography>
                    <Select
                      size="small"
                      value={speed}
                      onChange={(event) => handleSpeedChange(Number(event.target.value))}
                      sx={{
                        ml: 'auto',
                        minWidth: 82,
                        color: '#edf0f7',
                        '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.16)' },
                      }}
                    >
                      {speedOptions.map((option) => (
                        <MenuItem key={`right-speed-${option}`} value={option}>{option}x</MenuItem>
                      ))}
                    </Select>
                  </Stack>
                </Box>
              )}

              {rightTab === 'shownotes' && (
                <Box sx={{ p: 1.2, display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <Typography sx={{ fontWeight: 600 }}>{tt('Scenenotater', 'Scene Notes')}</Typography>
                  <Typography sx={{ color: 'rgba(237,240,247,0.75)', fontSize: 14 }}>
                    Focus on key-light direction and subject separation. Keep the subject well defined while preserving ambient highlights in the background.
                  </Typography>

                  <LinearProgress
                    variant="determinate"
                    value={duration > 0 ? clamp((currentTime / duration) * 100, 0, 100) : 0}
                    sx={{
                      height: 7,
                      borderRadius: 4,
                      bgcolor: 'rgba(255,255,255,0.1)',
                      '& .MuiLinearProgress-bar': {
                        background: 'linear-gradient(90deg, #f8b321, #f7d782)',
                      },
                    }}
                  />

                  <Stack spacing={0.9}>
                    {[
                      'Key light angle: 45° to camera left',
                      'Add subtle fill at 20% intensity',
                      'Keep practicals warm for depth',
                      'Push actor 1 meter from background',
                    ].map((note) => (
                      <Box
                        key={note}
                        sx={{
                          border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.1)',
                          borderRadius: 1,
                          px: 1,
                          py: 0.8,
                          bgcolor: 'rgba(11,14,22,0.7)',
                        }}
                      >
                        <Typography sx={{ fontSize: 13 }}>{note}</Typography>
                      </Box>
                    ))}
                  </Stack>
                </Box>
              )}

              {rightTab === 'transcript' && (
                <Box sx={{ p: 1.2, display: 'flex', flexDirection: 'column', gap: 1, minHeight: 0 }}>
                  <TextField
                    value={transcriptSearch}
                    onChange={(event) => setTranscriptSearch(event.target.value)}
                    placeholder={tt('Søk i transkripsjon...', 'Search transcript...')}
                    size="small"
                    InputProps={{
                      startAdornment: <Search fontSize="small" sx={{ mr: 0.7, color: 'rgba(237,240,247,0.58)' }} />,
                    }}
                    sx={{ '& .MuiInputBase-root': { bgcolor: 'rgba(10,13,20,0.78)', color: '#edf0f7' } }}
                  />

                  <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', pr: 0.3 }}>
                    <Stack spacing={0.8}>
                      {filteredTranscript.map((line) => (
                        <Box
                          key={line.id}
                          onClick={() => {
                            if (videoRef.current) {
                              videoRef.current.currentTime = line.timestamp;
                            }
                            setCurrentTime(line.timestamp);
                          }}
                          sx={{
                            border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.08)',
                            borderRadius: 1,
                            p: 1,
                            background: 'rgba(10,13,20,0.72)',
                            cursor: 'pointer',
                          }}
                        >
                          <Stack direction="row" alignItems="center" spacing={0.8}>
                            <Typography sx={{ fontWeight: 600 }}>{line.speaker}</Typography>
                            <Typography sx={{ color: 'rgba(237,240,247,0.62)', fontSize: 12 }}>
                              {formatTime(line.timestamp)}
                            </Typography>
                          </Stack>
                          <Typography sx={{ color: 'rgba(237,240,247,0.78)', fontSize: 14, mt: 0.3 }}>
                            {line.text}
                          </Typography>
                        </Box>
                      ))}

                      {filteredTranscript.length === 0 && (
                        <Typography sx={{ color: 'rgba(237,240,247,0.62)', fontSize: 13, py: 2, textAlign: 'center' }}>
                          {tt('Ingen transkripsjonslinjer funnet.', 'No transcript lines found.')}
                        </Typography>
                      )}
                    </Stack>
                  </Box>
                </Box>
              )}

              <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)' }} />

              <Stack direction="row" spacing={1} sx={{ p: 1.1 }}>
                <Button
                  startIcon={<Settings />}
                  onClick={() => setRightTab('chapters')}
                  sx={{
                    flex: 1,
                    textTransform: 'none',
                    color: '#edf0f7',
                    border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.18)',
                  }}
                >
                  {tt('Spiller', 'Player')}
                </Button>
                <Button
                  startIcon={<Quiz />}
                  onClick={() => setLocation('/academy/quiz-manager')}
                  sx={{
                    flex: 1,
                    textTransform: 'none',
                    color: '#edf0f7',
                    border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.18)',
                  }}
                >
                  Quiz
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
                    color: 'rgba(237,240,247,0.76)',
                    border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.16)',
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

export default withUniversalIntegration(AcademyVideoPlayerStudio, {
  componentId: 'academy-video-player-studio',
  componentName: 'Academy Video Player Studio',
  componentType: 'player',
  componentCategory: 'academy',
  featureIds: ['video-player-academy', 'chapter-manager', 'annotation-editor', 'assessment'],
});
