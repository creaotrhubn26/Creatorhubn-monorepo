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
  Check,
  MailOutline,
  MonetizationOn,
  Movie,
  NotificationsNone,
  Pause,
  PlayArrow,
  Publish,
  RadioButtonUnchecked,
  Save,
  Search,
  Subtitles,
} from '@mui/icons-material';
import { useLocation } from 'wouter';
import { useAcademy, type CourseResource } from '@/contexts/AcademyContext';
import { useEnhancedMasterIntegration } from '@/integration/EnhancedMasterIntegrationProvider';
import { withUniversalIntegration } from '@/integration/UniversalIntegrationHOC';

interface QuizOption {
  id: string;
  label: string;
  text: string;
  isCorrect: boolean;
  responses: number;
}

interface QuizQuestion {
  id: string;
  prompt: string;
  hint: string;
  timestamp: number;
  duration: number;
  options: QuizOption[];
}

interface QuizManagerProps {
  courseId?: string;
  onSave?: (payload: Record<string, unknown>) => void;
  onCancel?: () => void;
}

type RightTab = 'analytics' | 'results' | 'insights';

const VIDEO_PLACEHOLDER = '/assets/academy/intro-video.mp4';

const defaultQuestions = (): QuizQuestion[] => [
  {
    id: `question-${Date.now()}-1`,
    prompt: 'What is the primary function of a key light in film lighting?',
    hint: 'Watch the clip then choose the correct answer to proceed.',
    timestamp: 135,
    duration: 15,
    options: [
      { id: 'opt-a', label: 'A', text: 'Fill in shadows', isCorrect: false, responses: 192 },
      { id: 'opt-b', label: 'B', text: 'Provide a dramatic backlight', isCorrect: false, responses: 18 },
      { id: 'opt-c', label: 'C', text: 'Open up background detail', isCorrect: false, responses: 18 },
      { id: 'opt-d', label: 'D', text: 'Highlight the main subject', isCorrect: true, responses: 310 },
    ],
  },
];

const cinematicPanelSx = {
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
const quizGold = '#f8b321';
const quizGoldSoft = alpha(quizGold, 0.16);
const quizGoldBorder = alpha(quizGold, 0.5);

function QuizManager({ courseId, onSave, onCancel }: QuizManagerProps) {
  const [, setLocation] = useLocation();
  const { getCourse, updateCourse } = useAcademy();
  const { analytics, debugging } = useEnhancedMasterIntegration();

  const videoRef = useRef<HTMLVideoElement>(null);

  const [leftNav, setLeftNav] = useState('assignments');
  const [rightTab, setRightTab] = useState<RightTab>('results');
  const [searchValue, setSearchValue] = useState('');
  const [questions, setQuestions] = useState<QuizQuestion[]>(defaultQuestions);
  const [activeQuestionId, setActiveQuestionId] = useState('');
  const [selectedOptionId, setSelectedOptionId] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [participants, setParticipants] = useState(370);
  const [attempts, setAttempts] = useState(0);
  const [individualScore, setIndividualScore] = useState(0);
  const [saveMessage, setSaveMessage] = useState('');

  const [currentTime, setCurrentTime] = useState(156);
  const [duration, setDuration] = useState(336);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    if (questions.length > 0 && !activeQuestionId) {
      setActiveQuestionId(questions[0].id);
    }
  }, [questions, activeQuestionId]);

  const activeQuestion = useMemo(() => {
    return questions.find((question) => question.id === activeQuestionId) || questions[0] || null;
  }, [questions, activeQuestionId]);

  const selectedOption = useMemo(() => {
    if (!activeQuestion) return null;
    return activeQuestion.options.find((option) => option.id === selectedOptionId) || null;
  }, [activeQuestion, selectedOptionId]);

  const questionResults = useMemo(() => {
    if (!activeQuestion) {
      return { correctRate: 0, avgScore: 0 };
    }

    const correctResponses = activeQuestion.options.find((option) => option.isCorrect)?.responses || 0;
    const correctRate = clamp(Math.round((correctResponses / Math.max(participants, 1)) * 100), 0, 100);
    const avgScore = clamp(correctRate + 2, 0, 100);
    return { correctRate, avgScore };
  }, [activeQuestion, participants]);

  const filteredQuestions = useMemo(() => {
    const query = searchValue.trim().toLowerCase();
    if (!query) return questions;
    return questions.filter((question) => {
      return (
        question.prompt.toLowerCase().includes(query) ||
        question.options.some((option) => option.text.toLowerCase().includes(query))
      );
    });
  }, [questions, searchValue]);

  useEffect(() => {
    analytics.trackEvent('quiz_manager_opened', {
      courseId,
      questionCount: questions.length,
      timestamp: Date.now(),
    });

    debugging.logIntegration('info', 'QuizManager opened', {
      courseId,
      questionCount: questions.length,
    });
  }, [analytics, courseId, debugging, questions.length]);

  const handleLoadedMetadata = useCallback(() => {
    const measured = videoRef.current?.duration;
    if (measured && Number.isFinite(measured) && measured > 0) {
      setDuration(measured);
    }
  }, []);

  const handleTimeUpdate = useCallback(() => {
    const nextTime = videoRef.current?.currentTime;
    if (typeof nextTime === 'number' && Number.isFinite(nextTime)) {
      setCurrentTime(nextTime);
    }
  }, []);

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

  const handleQuestionSelect = useCallback((questionId: string) => {
    setActiveQuestionId(questionId);
    setSelectedOptionId('');
    setSubmitted(false);
    setIndividualScore(0);
  }, []);

  const handleOptionPick = useCallback((optionId: string) => {
    if (submitted) return;
    setSelectedOptionId(optionId);
  }, [submitted]);

  const handleSubmitAnswer = useCallback(() => {
    if (!activeQuestion || !selectedOption) return;

    const isCorrect = selectedOption.isCorrect;

    setQuestions((prev) =>
      prev.map((question) => {
        if (question.id !== activeQuestion.id) return question;

        return {
          ...question,
          options: question.options.map((option) => {
            if (option.id !== selectedOption.id) return option;
            return { ...option, responses: option.responses + 1 };
          }),
        };
      }),
    );

    setParticipants((prev) => prev + 1);
    setAttempts((prev) => prev + 1);
    setSubmitted(true);
    setIndividualScore(isCorrect ? 100 : 45);

    analytics.trackEvent('quiz_submitted', {
      courseId,
      questionId: activeQuestion.id,
      selectedOptionId: selectedOption.id,
      isCorrect,
      timestamp: Date.now(),
    });
  }, [activeQuestion, analytics, courseId, selectedOption]);

  const handleSaveQuiz = useCallback(async (publish: boolean) => {
    const payload = {
      id: `quiz-config-${courseId || 'local'}`,
      title: 'Directing Masterclass Quiz',
      updatedAt: new Date().toISOString(),
      participants,
      attempts,
      questions,
      publish,
    };

    setSaveMessage('');

    try {
      if (courseId) {
        const course = getCourse(courseId);
        if (course) {
          const resources = Array.isArray(course.resources) ? course.resources : [];
          const withoutQuiz = resources.filter(
            (resource: CourseResource) => !(resource.type === 'code' && resource.id.startsWith('quiz-config-'))
          );

          const quizConfigResource: CourseResource = {
            id: `quiz-config-${courseId}`,
            type: 'code',
            title: 'Quiz Configuration',
            description: 'Serialized quiz manager state for this course.',
            url: `data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify(payload))}`,
          };

          await updateCourse({
            ...course,
            resources: [...withoutQuiz, quizConfigResource],
            isPublished: publish ? true : course.isPublished,
            updatedAt: new Date().toISOString(),
          });
        }
      }

      onSave?.(payload);
      setSaveMessage(publish ? 'Quiz published.' : 'Quiz saved.');
    } catch (error) {
      debugging.logIntegration('error', 'Failed to save quiz manager payload', {
        error: error instanceof Error ? error.message : String(error),
      });
      setSaveMessage('Could not save quiz.');
    }
  }, [attempts, courseId, debugging, getCourse, onSave, participants, questions, updateCourse]);

  const updateActiveQuestion = useCallback((updater: (question: QuizQuestion) => QuizQuestion) => {
    setQuestions((prev) =>
      prev.map((question) => (question.id === activeQuestionId ? updater(question) : question)),
    );
  }, [activeQuestionId]);

  const addQuestion = useCallback(() => {
    const id = `question-${Date.now()}`;
    const next: QuizQuestion = {
      id,
      prompt: 'New quiz question',
      hint: 'Add hint for learners',
      timestamp: Math.floor(currentTime),
      duration: 20,
      options: [
        { id: `${id}-a`, label: 'A', text: 'Option A', isCorrect: true, responses: 0 },
        { id: `${id}-b`, label: 'B', text: 'Option B', isCorrect: false, responses: 0 },
        { id: `${id}-c`, label: 'C', text: 'Option C', isCorrect: false, responses: 0 },
        { id: `${id}-d`, label: 'D', text: 'Option D', isCorrect: false, responses: 0 },
      ],
    };

    setQuestions((prev) => [...prev, next]);
    setActiveQuestionId(id);
    setSelectedOptionId('');
    setSubmitted(false);
    setIndividualScore(0);
  }, [currentTime]);

  const leftNavItems = [
    { id: 'overview', label: 'Overview', route: '/academy-dashboard' },
    { id: 'curriculum', label: 'Curriculum', route: '/academy/curriculum' },
    { id: 'lessons', label: 'Lessons', route: '/academy/lesson-editor' },
    { id: 'media', label: 'Media', route: '/academy/media' },
    { id: 'assignments', label: 'Assignments', route: '/academy/assignments' },
    { id: 'analytics', label: 'Analytics', route: '/academy/analytics' },
    { id: 'cta', label: 'CTA Overlay', route: '/academy/cta-overlay' },
    { id: 'lowerthirds', label: 'Animated Lower Thirds', route: '/academy/lower-thirds' },
    { id: 'monetization', label: 'Monetization', route: '/academy/monetization' },
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
            'radial-gradient(circle at 74% 14%, rgba(248,179,33,0.22), rgba(5,8,13,0) 40%), radial-gradient(circle at 20% 82%, rgba(82,121,204,0.14), rgba(6,8,14,0) 44%), linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0) 30%)',
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
              onClick={addQuestion}
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
              <Chip label="Draft" size="small" sx={{ bgcolor: 'rgba(255,255,255,0.08)', color: '#edf0f7', fontWeight: 600 }} />
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
                    Directing Masterclass
                  </Typography>
                  <Chip label="Draft" size="small" sx={{ bgcolor: 'rgba(255,255,255,0.08)', color: '#edf0f7' }} />
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
                    variant="outlined"
                    startIcon={<Save />}
                    onClick={() => void handleSaveQuiz(false)}
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
                    onClick={() => void handleSaveQuiz(true)}
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

              <Stack
                direction="row"
                spacing={1.2}
                alignItems="center"
                sx={{
                  ...cinematicPanelSx,
                  px: 1.2,
                  py: 1,
                }}
              >
                <IconButton size="small" onClick={togglePlayback} sx={{ color: 'rgba(237,240,247,0.75)' }}>
                  {isPlaying ? <Pause fontSize="small" /> : <PlayArrow fontSize="small" />}
                </IconButton>

                <Slider
                  value={currentTime}
                  onChange={handleSeek}
                  min={0}
                  max={duration || 1}
                  sx={{
                    flex: 1,
                    color: '#f8b321',
                    '& .MuiSlider-thumb': {
                      width: 12,
                      height: 12,
                    },
                  }}
                />

                <Typography sx={{ fontSize: 14, color: 'rgba(237,240,247,0.8)', minWidth: 120, textAlign: 'right' }}>
                  {formatTime(currentTime)} · {formatTime(duration)}
                </Typography>
              </Stack>

              <Box
                sx={{
                  ...cinematicPanelSx,
                  position: 'relative',
                  p: 1,
                  minHeight: 510,
                  display: 'flex',
                  flexDirection: 'column',
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
                    src={VIDEO_PLACEHOLDER}
                    onLoadedMetadata={handleLoadedMetadata}
                    onTimeUpdate={handleTimeUpdate}
                    onPlay={() => setIsPlaying(true)}
                    onPause={() => setIsPlaying(false)}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  />

                  {activeQuestion && (
                    <Box
                      sx={{
                        position: 'absolute',
                        left: '50%',
                        bottom: 18,
                        transform: 'translateX(-50%)',
                        width: 'min(84%, 820px)',
                        borderRadius: 1,
                        border: '1px solid rgba(255,255,255,0.12)',
                        background: 'linear-gradient(180deg, rgba(13,16,24,0.9), rgba(8,11,18,0.95))',
                        p: 2,
                      }}
                    >
                      <Typography sx={{ fontSize: 34, fontWeight: 600, mb: 1.4, textAlign: 'center' }}>
                        {activeQuestion.prompt}
                      </Typography>

                      <Stack spacing={1}>
                        {activeQuestion.options.map((option) => {
                          const selected = selectedOptionId === option.id;
                          const showCorrect = submitted && option.isCorrect;
                          const showWrong = submitted && selected && !option.isCorrect;

                          return (
                            <Button
                              key={option.id}
                              onClick={() => handleOptionPick(option.id)}
                              sx={{
                                justifyContent: 'flex-start',
                                textTransform: 'none',
                                color: '#edf0f7',
                                borderRadius: 1,
                                border: `1px solid ${
                                  showCorrect
                                    ? alpha(quizGold, 0.85)
                                    : showWrong
                                      ? 'rgba(255,108,108,0.7)'
                                      : selected
                                        ? quizGoldBorder
                                        : 'rgba(255,255,255,0.18)'
                                }`,
                                background:
                                  showCorrect
                                    ? `linear-gradient(90deg, ${alpha(quizGold, 0.22)}, ${alpha(quizGold, 0.08)})`
                                    : selected
                                      ? `linear-gradient(90deg, ${quizGoldSoft}, rgba(255,255,255,0.02))`
                                      : 'rgba(0,0,0,0.2)',
                                '&:hover': {
                                  borderColor: alpha(quizGold, 0.62),
                                  background: `linear-gradient(90deg, ${alpha(quizGold, 0.17)}, rgba(255,255,255,0.03))`,
                                },
                              }}
                            >
                              <Stack direction="row" spacing={1.2} alignItems="center" sx={{ width: '100%' }}>
                                {selected ? (
                                  <Check sx={{ fontSize: 18, color: '#f8d56f' }} />
                                ) : (
                                  <RadioButtonUnchecked sx={{ fontSize: 18, color: 'rgba(237,240,247,0.75)' }} />
                                )}
                                <Chip
                                  label={option.label}
                                  size="small"
                                  sx={{
                                    bgcolor: 'rgba(255,255,255,0.08)',
                                    color: '#edf0f7',
                                    minWidth: 28,
                                  }}
                                />
                                <Typography sx={{ fontSize: 27, textAlign: 'left' }}>{option.text}</Typography>
                                <Box sx={{ ml: 'auto' }}>
                                  {showCorrect && <Check sx={{ color: '#f8d56f' }} />}
                                </Box>
                              </Stack>
                            </Button>
                          );
                        })}
                      </Stack>

                      <Stack direction="row" alignItems="center" sx={{ mt: 1.4 }}>
                        <Typography sx={{ color: 'rgba(237,240,247,0.72)', fontSize: 20 }}>
                          {activeQuestion.hint}
                        </Typography>
                        <Typography sx={{ ml: 'auto', color: 'rgba(237,240,247,0.72)', fontSize: 20 }}>
                          0:{activeQuestion.duration.toString().padStart(2, '0')}
                        </Typography>
                      </Stack>

                      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 1.5 }}>
                        <Button
                          onClick={handleSubmitAnswer}
                          disabled={!selectedOptionId || submitted}
                          sx={{
                            minWidth: 220,
                            textTransform: 'none',
                            color: '#0f0f0f',
                            fontWeight: 700,
                            background: 'linear-gradient(180deg, #ffd44e, #f2a616)',
                            '&.Mui-disabled': {
                              color: 'rgba(255,255,255,0.6)',
                              background: 'rgba(255,255,255,0.15)',
                            },
                          }}
                        >
                          {submitted ? 'Answer Submitted' : 'Submit Answer'}
                        </Button>
                      </Box>
                    </Box>
                  )}
                </Box>

                <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} sx={{ mt: 1.1 }}>
                  <TextField
                    value={searchValue}
                    onChange={(event) => setSearchValue(event.target.value)}
                    placeholder="Search Modules..."
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
                    onClick={addQuestion}
                    sx={{
                      textTransform: 'none',
                      minWidth: 166,
                      color: '#f7f8fb',
                      border: '1px solid rgba(255,255,255,0.2)',
                      borderRadius: 1,
                    }}
                  >
                    Add Module
                  </Button>
                </Stack>

                {!!saveMessage && (
                  <Typography sx={{ mt: 1, color: '#a8f7c4', fontSize: 12 }}>{saveMessage}</Typography>
                )}
              </Box>
            </Box>

            <Box sx={{ ...cinematicPanelSx, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
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
                <Tab label="Quiz Analytics" value="analytics" />
                <Tab label="Results" value="results" />
                <Tab label="Insights" value="insights" />
              </Tabs>

              {(rightTab === 'analytics' || rightTab === 'results') && activeQuestion && (
                <Box sx={{ p: 1.3, display: 'flex', flexDirection: 'column', gap: 1.2 }}>
                  <Stack spacing={1}>
                    <Typography sx={{ fontSize: 26, fontWeight: 600 }}>
                      {participants} Participants
                    </Typography>
                    <Typography sx={{ fontSize: 26, fontWeight: 600 }}>
                      Avg. Score: {questionResults.avgScore}%
                    </Typography>
                    <LinearProgress
                      variant="determinate"
                      value={questionResults.avgScore}
                      sx={{
                        height: 8,
                        borderRadius: 4,
                        bgcolor: 'rgba(255,255,255,0.1)',
                        '& .MuiLinearProgress-bar': {
                          background: 'linear-gradient(90deg, #70b4ff, #f8b321)',
                        },
                      }}
                    />
                  </Stack>

                  <Box sx={{ ...cinematicPanelSx, p: 1.2 }}>
                    <Stack direction="row" alignItems="center" spacing={1.2}>
                      <Box
                        sx={{
                          width: 92,
                          height: 92,
                          borderRadius: '50%',
                          background: `conic-gradient(#f8b321 ${questionResults.correctRate * 3.6}deg, rgba(255,255,255,0.12) 0deg)`,
                          display: 'grid',
                          placeItems: 'center',
                        }}
                      >
                        <Box
                          sx={{
                            width: 62,
                            height: 62,
                            borderRadius: '50%',
                            bgcolor: '#0f1420',
                            display: 'grid',
                            placeItems: 'center',
                            fontWeight: 700,
                          }}
                        >
                          {questionResults.correctRate}%
                        </Box>
                      </Box>

                      <Box>
                        <Typography sx={{ fontSize: 30, fontWeight: 700 }}>{questionResults.correctRate}%</Typography>
                        <Typography sx={{ color: 'rgba(237,240,247,0.76)' }}>Answered Correctly</Typography>
                      </Box>
                    </Stack>

                    <Typography sx={{ mt: 1.2, mb: 0.8, fontWeight: 600 }}>Question Analysis</Typography>
                    <Stack spacing={0.8}>
                      {activeQuestion.options.map((option) => {
                        const responseRate = clamp(Math.round((option.responses / Math.max(participants, 1)) * 100), 0, 100);
                        return (
                          <Stack key={option.id} direction="row" alignItems="center" spacing={0.8}>
                            <Chip
                              label={option.label}
                              size="small"
                              sx={{
                                minWidth: 28,
                                bgcolor: option.isCorrect ? 'rgba(248,179,33,0.25)' : 'rgba(255,255,255,0.1)',
                                color: '#edf0f7',
                              }}
                            />
                            <Typography sx={{ flex: 1, fontSize: 14 }} noWrap>
                              {option.text}
                            </Typography>
                            <Box sx={{ width: 120 }}>
                              <LinearProgress
                                variant="determinate"
                                value={responseRate}
                                sx={{
                                  height: 6,
                                  borderRadius: 4,
                                  bgcolor: 'rgba(255,255,255,0.1)',
                                  '& .MuiLinearProgress-bar': {
                                    background: option.isCorrect
                                      ? 'linear-gradient(90deg, #f8b321, #f9d77e)'
                                      : 'linear-gradient(90deg, #56709f, #7ca8e4)',
                                  },
                                }}
                              />
                            </Box>
                            <Typography sx={{ minWidth: 34, textAlign: 'right', fontWeight: 600 }}>
                              {responseRate}%
                            </Typography>
                          </Stack>
                        );
                      })}
                    </Stack>
                  </Box>

                  <Box sx={{ ...cinematicPanelSx, p: 1.1 }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Typography sx={{ fontWeight: 600 }}>Individual Result</Typography>
                      <Typography sx={{ color: selectedOption?.isCorrect ? '#9ceab9' : '#ff9b9b', fontWeight: 600 }}>
                        {submitted ? (selectedOption?.isCorrect ? 'Correct' : 'Incorrect') : 'Pending'}
                      </Typography>
                    </Stack>
                    <Stack spacing={0.8} sx={{ mt: 0.9 }}>
                      <Stack direction="row" justifyContent="space-between">
                        <Typography sx={{ color: 'rgba(237,240,247,0.7)' }}>Score</Typography>
                        <Typography sx={{ fontWeight: 700 }}>{individualScore}%</Typography>
                      </Stack>
                      <LinearProgress
                        variant="determinate"
                        value={individualScore}
                        sx={{
                          height: 7,
                          borderRadius: 4,
                          bgcolor: 'rgba(255,255,255,0.1)',
                          '& .MuiLinearProgress-bar': {
                            background: selectedOption?.isCorrect
                              ? 'linear-gradient(90deg, #7fd699, #b4f6ca)'
                              : 'linear-gradient(90deg, #ff9f8e, #ffc8bb)',
                          },
                        }}
                      />

                      <Stack direction="row" justifyContent="space-between">
                        <Typography sx={{ color: 'rgba(237,240,247,0.7)' }}>Attempts</Typography>
                        <Typography sx={{ fontWeight: 700 }}>{attempts}</Typography>
                      </Stack>
                    </Stack>
                  </Box>
                </Box>
              )}

              {rightTab === 'insights' && activeQuestion && (
                <Box sx={{ p: 1.3, display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <Typography sx={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'rgba(237,240,247,0.64)' }}>
                    Question Library
                  </Typography>

                  <Stack spacing={0.7}>
                    {filteredQuestions.map((question) => (
                      <Button
                        key={question.id}
                        onClick={() => handleQuestionSelect(question.id)}
                        sx={{
                          justifyContent: 'flex-start',
                          textTransform: 'none',
                          color: '#edf0f7',
                          border: question.id === activeQuestion.id ? '1px solid rgba(248,179,33,0.55)' : '1px solid rgba(255,255,255,0.14)',
                          background:
                            question.id === activeQuestion.id
                              ? 'linear-gradient(90deg, rgba(248,179,33,0.22), rgba(248,179,33,0.04))'
                              : 'transparent',
                        }}
                      >
                        {question.prompt}
                      </Button>
                    ))}
                  </Stack>

                  <Divider sx={{ borderColor: 'rgba(255,255,255,0.09)' }} />

                  <TextField
                    label="Prompt"
                    size="small"
                    value={activeQuestion.prompt}
                    onChange={(event) =>
                      updateActiveQuestion((question) => ({
                        ...question,
                        prompt: event.target.value,
                      }))
                    }
                    sx={{ '& .MuiInputBase-root': { color: '#edf0f7' } }}
                  />
                  <TextField
                    label="Hint"
                    size="small"
                    value={activeQuestion.hint}
                    onChange={(event) =>
                      updateActiveQuestion((question) => ({
                        ...question,
                        hint: event.target.value,
                      }))
                    }
                    sx={{ '& .MuiInputBase-root': { color: '#edf0f7' } }}
                  />

                  <Typography sx={{ fontSize: 12, color: 'rgba(237,240,247,0.62)', mt: 0.5 }}>
                    Options
                  </Typography>

                  <Stack spacing={0.8}>
                    {activeQuestion.options.map((option) => (
                      <Stack key={`edit-${option.id}`} direction="row" spacing={0.8} alignItems="center">
                        <Chip
                          label={option.label}
                          size="small"
                          sx={{
                            bgcolor: option.isCorrect ? 'rgba(248,179,33,0.28)' : 'rgba(255,255,255,0.1)',
                            color: '#edf0f7',
                          }}
                        />
                        <TextField
                          size="small"
                          value={option.text}
                          onChange={(event) =>
                            updateActiveQuestion((question) => ({
                              ...question,
                              options: question.options.map((entry) =>
                                entry.id === option.id ? { ...entry, text: event.target.value } : entry,
                              ),
                            }))
                          }
                          sx={{
                            flex: 1,
                            '& .MuiInputBase-root': { color: '#edf0f7' },
                          }}
                        />
                        <Button
                          size="small"
                          onClick={() =>
                            updateActiveQuestion((question) => ({
                              ...question,
                              options: question.options.map((entry) => ({
                                ...entry,
                                isCorrect: entry.id === option.id,
                              })),
                            }))
                          }
                          sx={{
                            textTransform: 'none',
                            color: option.isCorrect ? '#0f0f0f' : '#edf0f7',
                            background: option.isCorrect
                              ? 'linear-gradient(180deg, #ffd44e, #f2a616)'
                              : 'rgba(255,255,255,0.1)',
                          }}
                        >
                          {option.isCorrect ? 'Correct' : 'Set Correct'}
                        </Button>
                      </Stack>
                    ))}
                  </Stack>

                  <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                    <Button
                      startIcon={<Save />}
                      onClick={() => void handleSaveQuiz(false)}
                      sx={{
                        flex: 1,
                        textTransform: 'none',
                        color: '#edf0f7',
                        border: '1px solid rgba(255,255,255,0.18)',
                      }}
                    >
                      Save Draft
                    </Button>
                    <Button
                      startIcon={<Add />}
                      onClick={addQuestion}
                      sx={{
                        flex: 1,
                        textTransform: 'none',
                        color: '#0f0f0f',
                        background: 'linear-gradient(180deg, #ffd44e, #f2a616)',
                        fontWeight: 700,
                      }}
                    >
                      Add Question
                    </Button>
                  </Stack>
                </Box>
              )}

              <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)' }} />

              <Stack direction="row" spacing={1} sx={{ p: 1.1 }}>
                <Button
                  startIcon={<Add />}
                  onClick={addQuestion}
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
                  onClick={() => void handleSaveQuiz(false)}
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
                      setLocation('/academy/course-creator');
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

export default withUniversalIntegration(QuizManager, {
  componentId: 'academy-quiz-manager',
  componentName: 'Quiz Manager',
  componentType: 'manager',
  componentCategory: 'academy',
  featureIds: ['quiz-builder', 'assessment', 'analytics-academy'],
});
