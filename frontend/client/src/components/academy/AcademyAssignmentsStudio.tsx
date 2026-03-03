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
  Assessment,
  Campaign,
  Download,
  Edit,
  MailOutline,
  MonetizationOn,
  MoreHoriz,
  NotificationsNone,
  Publish,
  Quiz,
  Save,
  Search,
  Subtitles,
  TrendingUp,
} from '@mui/icons-material';
import { useLocation } from 'wouter';
import { useAcademy, type Course } from '@/contexts/AcademyContext';
import { useEnhancedMasterIntegration } from '@/integration/EnhancedMasterIntegrationProvider';
import { withUniversalIntegration } from '@/integration/UniversalIntegrationHOC';

interface AcademyAssignmentsStudioProps {
  courseId?: string;
  onSave?: (payload: Record<string, unknown>) => void;
  onCancel?: () => void;
}

type AssignmentStatus = 'active' | 'in_review' | 'completed' | 'overdue' | 'draft';

type StatusFilter = 'all' | AssignmentStatus;

type RangeFilter = '7d' | '30d' | '90d';

interface AssignmentItem {
  id: string;
  courseId: string;
  title: string;
  subtitle: string;
  startDate: string;
  dueDate: string;
  submissions: number;
  targetSubmissions: number;
  completionRate: number;
  avgScore: number;
  status: AssignmentStatus;
  tags: string[];
  revenueImpact: number;
  imageTheme: number;
}

interface FeedbackItem {
  id: string;
  author: string;
  message: string;
  timestamp: string;
}

const panelSx = {
  borderRadius: 1.4,
  border: '1px solid rgba(255,255,255,0.08)',
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
    id: 'assignment-course-1',
    title: 'Directing Masterclass',
    description: 'Assignments and production-based learning workflows.',
    instructor: {
      id: 'assignment-instructor-1',
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
    tags: ['directing', 'assignment'],
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
  {
    id: 'assignment-course-2',
    title: 'Advanced Cinematography',
    description: 'Practical assignments for cinematic workflows.',
    instructor: {
      id: 'assignment-instructor-2',
      name: 'CreatorHub Academy',
      avatar: '',
      bio: 'Academy editorial team',
      profession: 'videographer',
    },
    thumbnail: '',
    videoUrl: '/assets/academy/intro-video.mp4',
    duration: 480,
    level: 'advanced',
    category: 'videography',
    tags: ['cinematography', 'assignment'],
    price: 28740,
    isFree: false,
    isPublished: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    rating: 4.7,
    studentCount: 145,
    lessons: [],
    prerequisites: [],
    learningOutcomes: [],
    resources: [],
  },
];

const defaultAssignments = (): AssignmentItem[] => [
  {
    id: 'assignment-1',
    courseId: 'assignment-course-1',
    title: 'Lighting Scenarios',
    subtitle: 'Digital Photography · Exposure secrets',
    startDate: '2026-03-14',
    dueDate: '2026-03-27',
    submissions: 128,
    targetSubmissions: 180,
    completionRate: 76,
    avgScore: 67,
    status: 'active',
    tags: ['Early Access', 'Core'],
    revenueImpact: 12500,
    imageTheme: 0,
  },
  {
    id: 'assignment-2',
    courseId: 'assignment-course-1',
    title: '10-Minute Short Film',
    subtitle: 'Cinematic Filmmaking · Story pacing',
    startDate: '2026-03-01',
    dueDate: '2026-03-13',
    submissions: 146,
    targetSubmissions: 190,
    completionRate: 77,
    avgScore: 89,
    status: 'in_review',
    tags: ['Invite Only'],
    revenueImpact: 17900,
    imageTheme: 1,
  },
  {
    id: 'assignment-3',
    courseId: 'assignment-course-2',
    title: 'Audio Mixing Techniques',
    subtitle: 'Mastering · Dialogue balancing',
    startDate: '2026-04-01',
    dueDate: '2026-04-15',
    submissions: 134,
    targetSubmissions: 205,
    completionRate: 65,
    avgScore: 90,
    status: 'active',
    tags: ['Drip Release'],
    revenueImpact: 9800,
    imageTheme: 2,
  },
  {
    id: 'assignment-4',
    courseId: 'assignment-course-2',
    title: 'Editing Challenge 2: Color Grade & Slice',
    subtitle: 'Cinematic post · Pacing transitions',
    startDate: '2026-04-10',
    dueDate: '2026-04-15',
    submissions: 58,
    targetSubmissions: 180,
    completionRate: 32,
    avgScore: 79,
    status: 'overdue',
    tags: ['Urgent'],
    revenueImpact: 5200,
    imageTheme: 3,
  },
  {
    id: 'assignment-5',
    courseId: 'assignment-course-1',
    title: 'Portrait Lighting Setup',
    subtitle: 'Portrait photography · Dynamic variety',
    startDate: '2026-04-10',
    dueDate: '2026-04-16',
    submissions: 87,
    targetSubmissions: 120,
    completionRate: 68,
    avgScore: 97,
    status: 'completed',
    tags: ['Completed'],
    revenueImpact: 14900,
    imageTheme: 0,
  },
  {
    id: 'assignment-6',
    courseId: 'assignment-course-1',
    title: 'Mood Board for Short Film',
    subtitle: 'Preproduction · Visual references',
    startDate: '2026-04-10',
    dueDate: '2026-04-15',
    submissions: 77,
    targetSubmissions: 150,
    completionRate: 54,
    avgScore: 91,
    status: 'draft',
    tags: ['Draft'],
    revenueImpact: 7100,
    imageTheme: 1,
  },
];

const defaultFeedback = (): FeedbackItem[] => [
  {
    id: 'feedback-1',
    author: 'David Edit',
    message: 'Lighting Scenarios: add framing notes in scene 6 for consistency.',
    timestamp: '2m ago',
  },
  {
    id: 'feedback-2',
    author: 'Adrion Berglund',
    message: 'Audio assignment review: strong setup, but trim room tone by 1.5s.',
    timestamp: '11m ago',
  },
  {
    id: 'feedback-3',
    author: 'Jannicke Lindberg',
    message: 'Creative camera challenge: excellent blocking and lens selection.',
    timestamp: '23m ago',
  },
];

const statusLabel = (status: AssignmentStatus): string => {
  if (status === 'in_review') return 'In Review';
  if (status === 'completed') return 'Completed';
  if (status === 'overdue') return 'Overdue';
  if (status === 'draft') return 'Draft';
  return 'Active';
};

const formatDateRange = (startDate: string, dueDate: string): string => {
  const format = (value: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(date);
  };

  return `${format(startDate)} - ${format(dueDate)}`;
};

const toNok = (value: number): string =>
  new Intl.NumberFormat('nb-NO', {
    style: 'currency',
    currency: 'NOK',
    maximumFractionDigits: 0,
  }).format(Math.max(0, value));

function AcademyAssignmentsStudio({ courseId, onSave, onCancel }: AcademyAssignmentsStudioProps) {
  const [, setLocation] = useLocation();
  const { state, getCourse, updateCourse } = useAcademy();
  const { analytics, debugging } = useEnhancedMasterIntegration();

  const [leftNav, setLeftNav] = useState('assignments');
  const [selectedCourseId, setSelectedCourseId] = useState(courseId || 'all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [rangeFilter, setRangeFilter] = useState<RangeFilter>('7d');
  const [searchValue, setSearchValue] = useState('');
  const [saveMessage, setSaveMessage] = useState('');
  const [analyticsFlags, setAnalyticsFlags] = useState({
    earlyAccess: true,
    invitationOnly: true,
    closed: false,
    dripRelease: false,
  });

  const [assignmentItems, setAssignmentItems] = useState<AssignmentItem[]>(defaultAssignments);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState('');
  const [feedbackItems, setFeedbackItems] = useState<FeedbackItem[]>(defaultFeedback);
  const [feedbackAuthor, setFeedbackAuthor] = useState('You');
  const [feedbackDraft, setFeedbackDraft] = useState('');

  const courseItems = useMemo(() => {
    if (Array.isArray(state.courses) && state.courses.length > 0) {
      return state.courses;
    }
    return fallbackCourses;
  }, [state.courses]);

  const activeCourse = useMemo(() => {
    if (selectedCourseId !== 'all') {
      const fromSelected = courseItems.find((course) => String(course.id) === String(selectedCourseId));
      if (fromSelected) return fromSelected;
    }

    const fromParam = courseId ? getCourse(courseId) : null;
    if (fromParam) return fromParam;

    return state.currentCourse || courseItems[0] || fallbackCourses[0];
  }, [courseId, courseItems, getCourse, selectedCourseId, state.currentCourse]);

  useEffect(() => {
    if (!selectedAssignmentId && assignmentItems.length > 0) {
      setSelectedAssignmentId(assignmentItems[0].id);
    }
  }, [assignmentItems, selectedAssignmentId]);

  useEffect(() => {
    analytics.trackEvent('academy_assignments_studio_opened', {
      courseId: activeCourse?.id || null,
      assignmentCount: assignmentItems.length,
      timestamp: Date.now(),
    });

    debugging.logIntegration('info', 'AcademyAssignmentsStudio opened', {
      courseId: activeCourse?.id || null,
      assignmentCount: assignmentItems.length,
    });
  }, [activeCourse?.id, analytics, assignmentItems.length, debugging]);

  const selectedAssignment = useMemo(() => {
    return assignmentItems.find((assignment) => assignment.id === selectedAssignmentId) || assignmentItems[0] || null;
  }, [assignmentItems, selectedAssignmentId]);

  const visibleAssignments = useMemo(() => {
    const query = searchValue.trim().toLowerCase();

    return assignmentItems.filter((assignment) => {
      const matchesCourse = selectedCourseId === 'all' ? true : String(assignment.courseId) === String(selectedCourseId);
      if (!matchesCourse) return false;

      const matchesStatus = statusFilter === 'all' ? true : assignment.status === statusFilter;
      if (!matchesStatus) return false;

      if (!query) return true;
      return (
        assignment.title.toLowerCase().includes(query) ||
        assignment.subtitle.toLowerCase().includes(query) ||
        assignment.tags.some((tag) => tag.toLowerCase().includes(query))
      );
    });
  }, [assignmentItems, searchValue, selectedCourseId, statusFilter]);

  const totals = useMemo(() => {
    const totalAssignments = assignmentItems.length;
    const submissions = assignmentItems.reduce((sum, assignment) => sum + assignment.submissions, 0);
    const completed = assignmentItems.filter((assignment) => assignment.status === 'completed').length;
    const avgScore =
      assignmentItems.length === 0
        ? 0
        : Math.round(assignmentItems.reduce((sum, assignment) => sum + assignment.avgScore, 0) / assignmentItems.length);

    return {
      totalAssignments,
      submissions,
      completed,
      avgScore,
    };
  }, [assignmentItems]);

  const distribution = useMemo(() => {
    const submitted = assignmentItems.filter((assignment) => assignment.status === 'active').length;
    const inReview = assignmentItems.filter((assignment) => assignment.status === 'in_review').length;
    const completed = assignmentItems.filter((assignment) => assignment.status === 'completed').length;
    const overdue = assignmentItems.filter((assignment) => assignment.status === 'overdue').length;

    const total = submitted + inReview + completed + overdue;

    return {
      total,
      submitted,
      inReview,
      completed,
      overdue,
      submittedPct: total === 0 ? 0 : Math.round((submitted / total) * 100),
      inReviewPct: total === 0 ? 0 : Math.round((inReview / total) * 100),
      completedPct: total === 0 ? 0 : Math.round((completed / total) * 100),
      overduePct: total === 0 ? 0 : Math.round((overdue / total) * 100),
    };
  }, [assignmentItems]);

  const leaderboard = useMemo(() => {
    return [...assignmentItems]
      .sort((a, b) => b.avgScore - a.avgScore)
      .slice(0, 3);
  }, [assignmentItems]);

  const upcomingAssignments = useMemo(() => {
    return [...assignmentItems]
      .filter((assignment) => assignment.status === 'active' || assignment.status === 'draft' || assignment.status === 'in_review')
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
      .slice(0, 4);
  }, [assignmentItems]);

  const donutStyle = useMemo(() => {
    const submittedDeg = distribution.submittedPct * 3.6;
    const inReviewDeg = distribution.inReviewPct * 3.6;
    const completedDeg = distribution.completedPct * 3.6;
    const overdueDeg = distribution.overduePct * 3.6;

    return `conic-gradient(#8ea6d6 0deg ${submittedDeg}deg, #f8b321 ${submittedDeg}deg ${submittedDeg + inReviewDeg}deg, #f5d47a ${submittedDeg + inReviewDeg}deg ${submittedDeg + inReviewDeg + completedDeg}deg, #d2754a ${submittedDeg + inReviewDeg + completedDeg}deg ${submittedDeg + inReviewDeg + completedDeg + overdueDeg}deg, rgba(255,255,255,0.1) ${submittedDeg + inReviewDeg + completedDeg + overdueDeg}deg 360deg)`;
  }, [distribution.completedPct, distribution.inReviewPct, distribution.overduePct, distribution.submittedPct]);

  const addAssignment = useCallback(() => {
    const index = assignmentItems.length + 1;
    const start = new Date();
    start.setDate(start.getDate() + index);

    const due = new Date(start);
    due.setDate(due.getDate() + 12);

    const courseForAssignment = selectedCourseId !== 'all' ? selectedCourseId : activeCourse?.id || fallbackCourses[0].id;

    const assignment: AssignmentItem = {
      id: `assignment-${Date.now()}`,
      courseId: String(courseForAssignment),
      title: `New Assignment ${index}`,
      subtitle: 'Creative filmmaking challenge',
      startDate: start.toISOString().slice(0, 10),
      dueDate: due.toISOString().slice(0, 10),
      submissions: 0,
      targetSubmissions: 120,
      completionRate: 0,
      avgScore: 0,
      status: 'draft',
      tags: ['Draft'],
      revenueImpact: 0,
      imageTheme: index % placeholderBackgrounds.length,
    };

    setAssignmentItems((prev) => [assignment, ...prev]);
    setSelectedAssignmentId(assignment.id);
  }, [activeCourse?.id, assignmentItems.length, selectedCourseId]);

  const toggleAnalyticsFlag = useCallback((key: keyof typeof analyticsFlags) => {
    setAnalyticsFlags((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const addFeedback = useCallback(() => {
    const message = feedbackDraft.trim();
    if (!message) {
      setSaveMessage('Write feedback before adding.');
      return;
    }

    const author = feedbackAuthor.trim() || 'You';
    setFeedbackItems((prev) => [
      {
        id: `feedback-${Date.now()}`,
        author,
        message,
        timestamp: 'now',
      },
      ...prev,
    ]);
    setFeedbackDraft('');
    setSaveMessage('Feedback added.');
  }, [feedbackAuthor, feedbackDraft]);

  const saveAssignments = useCallback(
    async (publish: boolean) => {
      const payload = {
        courseId: activeCourse?.id || null,
        assignmentCount: assignmentItems.length,
        assignments: assignmentItems,
        rangeFilter,
        statusFilter,
        analyticsFlags,
        publish,
        updatedAt: new Date().toISOString(),
      };

      try {
        if (activeCourse?.id && state.courses.some((course) => String(course.id) === String(activeCourse.id))) {
          const nextTags = Array.from(new Set([...(activeCourse.tags || []), 'assignments']));
          await updateCourse({
            ...activeCourse,
            tags: nextTags,
            isPublished: publish ? true : activeCourse.isPublished,
            updatedAt: new Date().toISOString(),
          });
        }

        setSaveMessage(publish ? 'Assignments published.' : 'Assignments saved.');
        onSave?.(payload);

        analytics.trackEvent(publish ? 'academy_assignments_publish' : 'academy_assignments_save', {
          courseId: activeCourse?.id || null,
          assignmentCount: assignmentItems.length,
          timestamp: Date.now(),
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to save assignments.';
        setSaveMessage(message);
        debugging.logIntegration('error', 'Academy assignments save failed', {
          courseId: activeCourse?.id || null,
          message,
        });
      }
    },
    [
      activeCourse,
      analytics,
      analyticsFlags,
      assignmentItems,
      debugging,
      onSave,
      rangeFilter,
      state.courses,
      statusFilter,
      updateCourse,
    ],
  );

  const leftNavItems = [
    { id: 'overview', label: 'Overview', route: '/academy-dashboard' },
    { id: 'curriculum', label: 'Curriculum', route: '/academy/curriculum' },
    { id: 'lessons', label: 'Lessons', route: '/academy/lesson-editor' },
    { id: 'media', label: 'Media', route: '/academy/media' },
    { id: 'assignments', label: 'Assignments', route: '/academy/assignments' },
    { id: 'enrollment', label: 'Enrollment', route: '/academy/enrollment' },
    { id: 'cohort', label: 'Cohort Settings', route: '/academy/cohort-settings' },
    { id: 'analytics', label: 'Analytics', route: '/academy/analytics' },
    { id: 'settings', label: 'Settings', route: '/academy/course-creator' },
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
            'radial-gradient(circle at 75% 13%, rgba(248,179,33,0.25), rgba(5,8,13,0) 43%), radial-gradient(circle at 15% 82%, rgba(82,121,204,0.14), rgba(6,8,14,0) 44%), linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0) 30%)',
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
              onClick={addAssignment}
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
              <Chip
                label={activeCourse?.isPublished ? 'Published' : 'Draft'}
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
                  Assignments
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
                    Export
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
                    Reports
                  </Button>
                  <Button
                    variant="contained"
                    startIcon={<Add />}
                    onClick={addAssignment}
                    sx={{
                      textTransform: 'none',
                      borderRadius: 1,
                      color: '#0f0f0f',
                      background: 'linear-gradient(180deg, #ffd44e, #f2a616)',
                      boxShadow: '0 10px 24px rgba(248,179,33,0.25)',
                    }}
                  >
                    Create Assignment
                  </Button>
                </Stack>
              </Stack>

              {!!saveMessage && (
                <Typography
                  sx={{
                    px: 1.2,
                    py: 0.85,
                    borderRadius: 1,
                    border: '1px solid rgba(248,179,33,0.34)',
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
                      value={selectedCourseId}
                      onChange={(event) => setSelectedCourseId(String(event.target.value))}
                      sx={{
                        minWidth: 180,
                        color: '#edf0f7',
                        bgcolor: 'rgba(255,255,255,0.05)',
                        '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.16)' },
                      }}
                    >
                      <MenuItem value="all">All Courses</MenuItem>
                      {courseItems.map((course) => (
                        <MenuItem key={course.id} value={course.id}>
                          {course.title}
                        </MenuItem>
                      ))}
                    </Select>
                    <Select
                      size="small"
                      value={statusFilter}
                      onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
                      sx={{
                        minWidth: 150,
                        color: '#edf0f7',
                        bgcolor: 'rgba(255,255,255,0.05)',
                        '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.16)' },
                      }}
                    >
                      <MenuItem value="all">All Status</MenuItem>
                      <MenuItem value="active">Active</MenuItem>
                      <MenuItem value="in_review">In Review</MenuItem>
                      <MenuItem value="completed">Completed</MenuItem>
                      <MenuItem value="overdue">Overdue</MenuItem>
                      <MenuItem value="draft">Draft</MenuItem>
                    </Select>
                    <Select
                      size="small"
                      value={rangeFilter}
                      onChange={(event) => setRangeFilter(event.target.value as RangeFilter)}
                      sx={{
                        minWidth: 130,
                        color: '#edf0f7',
                        bgcolor: 'rgba(255,255,255,0.05)',
                        '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.16)' },
                      }}
                    >
                      <MenuItem value="7d">Last 7 days</MenuItem>
                      <MenuItem value="30d">Last 30 days</MenuItem>
                      <MenuItem value="90d">Last 90 days</MenuItem>
                    </Select>
                  </Stack>

                  <Button
                    startIcon={<Add />}
                    onClick={addAssignment}
                    sx={{
                      textTransform: 'none',
                      color: '#0f0f0f',
                      background: 'linear-gradient(180deg, #ffd44e, #f2a616)',
                      fontWeight: 700,
                    }}
                  >
                    Create Assignment
                  </Button>
                </Stack>

                <TextField
                  value={searchValue}
                  onChange={(event) => setSearchValue(event.target.value)}
                  placeholder="Search assignments..."
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

                <Box
                  sx={{
                    mt: 1.1,
                    display: 'grid',
                    gridTemplateColumns: {
                      xs: '1fr',
                      sm: 'repeat(2, minmax(0, 1fr))',
                      lg: 'repeat(4, minmax(0, 1fr))',
                    },
                    gap: 1,
                  }}
                >
                  <Box sx={{ ...panelSx, p: 1, borderColor: 'rgba(255,255,255,0.1)' }}>
                    <Typography sx={{ fontSize: 42, fontWeight: 700, lineHeight: 1 }}>{totals.totalAssignments}</Typography>
                    <Typography sx={{ color: 'rgba(237,240,247,0.8)' }}>Total Assignments</Typography>
                    <Stack direction="row" spacing={0.5} alignItems="center" sx={{ color: '#95d57e' }}>
                      <TrendingUp sx={{ fontSize: 15 }} />
                      <Typography sx={{ fontSize: 12 }}>+8.6% past 30 days</Typography>
                    </Stack>
                  </Box>
                  <Box sx={{ ...panelSx, p: 1, borderColor: 'rgba(255,255,255,0.1)' }}>
                    <Typography sx={{ fontSize: 42, fontWeight: 700, lineHeight: 1 }}>{totals.submissions}</Typography>
                    <Typography sx={{ color: 'rgba(237,240,247,0.8)' }}>Submissions</Typography>
                    <Typography sx={{ fontSize: 12, color: 'rgba(237,240,247,0.6)' }}>Across {rangeFilter}</Typography>
                  </Box>
                  <Box sx={{ ...panelSx, p: 1, borderColor: 'rgba(255,255,255,0.1)' }}>
                    <Typography sx={{ fontSize: 42, fontWeight: 700, lineHeight: 1 }}>{totals.completed}</Typography>
                    <Typography sx={{ color: 'rgba(237,240,247,0.8)' }}>Completed</Typography>
                    <Typography sx={{ fontSize: 12, color: 'rgba(237,240,247,0.6)' }}>Team participants</Typography>
                  </Box>
                  <Box sx={{ ...panelSx, p: 1, borderColor: 'rgba(255,255,255,0.1)' }}>
                    <Typography sx={{ fontSize: 42, fontWeight: 700, lineHeight: 1 }}>{totals.avgScore}%</Typography>
                    <Typography sx={{ color: 'rgba(237,240,247,0.8)' }}>Avg Score</Typography>
                    <Typography sx={{ fontSize: 12, color: '#95d57e' }}>Quality benchmark</Typography>
                  </Box>
                </Box>

                <Box
                  sx={{
                    mt: 1.1,
                    borderRadius: 1,
                    overflowX: 'auto',
                    overflowY: 'hidden',
                    border: '1px solid rgba(255,255,255,0.09)',
                  }}
                >
                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: 'minmax(240px, 1.6fr) 1fr 0.5fr 0.5fr',
                      minWidth: 780,
                      px: 1,
                      py: 0.8,
                      background: 'rgba(255,255,255,0.04)',
                      borderBottom: '1px solid rgba(255,255,255,0.1)',
                    }}
                  >
                    <Typography sx={{ fontSize: 13, color: 'rgba(237,240,247,0.7)' }}>Assignment</Typography>
                    <Typography sx={{ fontSize: 13, color: 'rgba(237,240,247,0.7)' }}>Progress</Typography>
                    <Typography sx={{ fontSize: 13, color: 'rgba(237,240,247,0.7)' }}>Avg Score</Typography>
                    <Typography sx={{ fontSize: 13, color: 'rgba(237,240,247,0.7)', textAlign: 'right' }}>Actions</Typography>
                  </Box>

                  <Stack spacing={0}>
                    {visibleAssignments.map((assignment) => {
                      const isSelected = selectedAssignment?.id === assignment.id;
                      const progress = Math.round((assignment.submissions / Math.max(assignment.targetSubmissions, 1)) * 100);

                      return (
                        <Box
                          key={assignment.id}
                          onClick={() => setSelectedAssignmentId(assignment.id)}
                          sx={{
                            display: 'grid',
                            gridTemplateColumns: 'minmax(240px, 1.6fr) 1fr 0.5fr 0.5fr',
                            minWidth: 780,
                            px: 1,
                            py: 1,
                            gap: 1,
                            cursor: 'pointer',
                            background: isSelected
                              ? 'linear-gradient(90deg, rgba(248,179,33,0.12), rgba(255,255,255,0.02))'
                              : 'rgba(8,11,18,0.6)',
                            borderBottom: '1px solid rgba(255,255,255,0.08)',
                            '&:hover': {
                              background: 'linear-gradient(90deg, rgba(248,179,33,0.12), rgba(255,255,255,0.02))',
                            },
                          }}
                        >
                          <Stack direction="row" spacing={1} alignItems="center" minWidth={0}>
                            <Box
                              sx={{
                                width: 82,
                                height: 48,
                                borderRadius: 1,
                                border: '1px solid rgba(255,255,255,0.1)',
                                background: placeholderBackgrounds[assignment.imageTheme % placeholderBackgrounds.length],
                                flexShrink: 0,
                              }}
                            />
                            <Box minWidth={0}>
                              <Typography sx={{ fontWeight: 600 }} noWrap>
                                {assignment.title}
                              </Typography>
                              <Typography sx={{ fontSize: 12, color: 'rgba(237,240,247,0.66)' }} noWrap>
                                {assignment.subtitle}
                              </Typography>
                              <Stack direction="row" spacing={0.6} sx={{ mt: 0.4 }} flexWrap="wrap" useFlexGap>
                                {assignment.tags.map((tag) => (
                                  <Chip
                                    key={`${assignment.id}-${tag}`}
                                    label={tag}
                                    size="small"
                                    sx={{
                                      height: 20,
                                      color: '#edf0f7',
                                      bgcolor: 'rgba(255,255,255,0.1)',
                                      fontSize: 11,
                                    }}
                                  />
                                ))}
                              </Stack>
                            </Box>
                          </Stack>

                          <Box>
                            <Typography sx={{ fontSize: 13, color: 'rgba(237,240,247,0.74)' }}>
                              {formatDateRange(assignment.startDate, assignment.dueDate)}
                            </Typography>
                            <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: 0.4 }}>
                              <Typography sx={{ minWidth: 44, fontWeight: 700 }}>{progress}%</Typography>
                              <LinearProgress
                                variant="determinate"
                                value={progress}
                                sx={{
                                  flex: 1,
                                  height: 5,
                                  borderRadius: 999,
                                  bgcolor: 'rgba(255,255,255,0.14)',
                                  '& .MuiLinearProgress-bar': {
                                    borderRadius: 999,
                                    background: 'linear-gradient(90deg, #7fb4ff 0%, #f8b321 100%)',
                                  },
                                }}
                              />
                            </Stack>
                            <Typography sx={{ fontSize: 12, color: 'rgba(237,240,247,0.62)', mt: 0.35 }}>
                              {assignment.submissions}/{assignment.targetSubmissions} submissions
                            </Typography>
                          </Box>

                          <Box>
                            <Typography sx={{ color: '#f8d56f', fontWeight: 700 }}>{assignment.avgScore}%</Typography>
                            <Typography sx={{ fontSize: 12, color: 'rgba(237,240,247,0.62)' }}>
                              {statusLabel(assignment.status)}
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

                <Typography sx={{ mt: 1.3, fontSize: 32, fontWeight: 600 }}>Upcoming Assignments</Typography>

                <Box
                  sx={{
                    mt: 1,
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
                    gap: 1,
                  }}
                >
                  {upcomingAssignments.map((assignment, index) => (
                    <Box
                      key={`upcoming-${assignment.id}`}
                      sx={{
                        ...panelSx,
                        p: 1,
                        borderColor: 'rgba(255,255,255,0.1)',
                      }}
                    >
                      <Stack direction="row" spacing={1}>
                        <Box
                          sx={{
                            width: 120,
                            height: 72,
                            borderRadius: 1,
                            border: '1px solid rgba(255,255,255,0.1)',
                            background: placeholderBackgrounds[(assignment.imageTheme + index) % placeholderBackgrounds.length],
                            flexShrink: 0,
                          }}
                        />
                        <Box sx={{ minWidth: 0, flex: 1 }}>
                          <Typography sx={{ fontWeight: 600 }} noWrap>
                            {assignment.title}
                          </Typography>
                          <Typography sx={{ fontSize: 12, color: 'rgba(237,240,247,0.64)' }} noWrap>
                            {assignment.subtitle}
                          </Typography>
                          <Typography sx={{ fontSize: 12, color: 'rgba(237,240,247,0.64)', mt: 0.4 }}>
                            {formatDateRange(assignment.startDate, assignment.dueDate)}
                          </Typography>
                          <Stack direction="row" spacing={0.8} sx={{ mt: 0.8 }}>
                            <Button
                              size="small"
                              sx={{ textTransform: 'none', color: '#edf0f7', border: '1px solid rgba(255,255,255,0.16)' }}
                            >
                              Manage
                            </Button>
                            <Button
                              size="small"
                              sx={{ textTransform: 'none', color: '#edf0f7', border: '1px solid rgba(255,255,255,0.16)' }}
                            >
                              Track
                            </Button>
                          </Stack>
                        </Box>
                      </Stack>
                    </Box>
                  ))}
                </Box>
              </Box>
            </Box>

            <Box sx={{ ...panelSx, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
              <Box sx={{ p: 1.2, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                <Typography sx={{ fontSize: 34, fontWeight: 600 }}>Assignment Analytics</Typography>

                <Stack direction="row" spacing={0.8} sx={{ mt: 1 }} flexWrap="wrap" useFlexGap>
                  <Chip
                    label="Early Access"
                    onClick={() => toggleAnalyticsFlag('earlyAccess')}
                    color={analyticsFlags.earlyAccess ? 'warning' : 'default'}
                    sx={{ color: '#edf0f7' }}
                  />
                  <Chip
                    label="Invitation Only"
                    onClick={() => toggleAnalyticsFlag('invitationOnly')}
                    color={analyticsFlags.invitationOnly ? 'warning' : 'default'}
                    sx={{ color: '#edf0f7' }}
                  />
                  <Chip
                    label="Closed"
                    onClick={() => toggleAnalyticsFlag('closed')}
                    color={analyticsFlags.closed ? 'warning' : 'default'}
                    sx={{ color: '#edf0f7' }}
                  />
                  <Chip
                    label="Drip Release"
                    onClick={() => toggleAnalyticsFlag('dripRelease')}
                    color={analyticsFlags.dripRelease ? 'warning' : 'default'}
                    sx={{ color: '#edf0f7' }}
                  />
                </Stack>
              </Box>

              <Box sx={{ p: 1.2, display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Box sx={{ ...panelSx, p: 1 }}>
                  <Typography sx={{ fontSize: 28, fontWeight: 600, mb: 0.8 }}>Average Score Distribution</Typography>

                  <Stack direction="row" spacing={1.2} alignItems="center">
                    <Box
                      sx={{
                        width: 122,
                        height: 122,
                        borderRadius: '50%',
                        background: donutStyle,
                        display: 'grid',
                        placeItems: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <Box
                        sx={{
                          width: 84,
                          height: 84,
                          borderRadius: '50%',
                          bgcolor: '#0f1420',
                          display: 'grid',
                          placeItems: 'center',
                          textAlign: 'center',
                        }}
                      >
                        <Typography sx={{ fontSize: 24, fontWeight: 700 }}>{totals.submissions}</Typography>
                        <Typography sx={{ fontSize: 11, color: 'rgba(237,240,247,0.62)' }}>Submissions</Typography>
                      </Box>
                    </Box>

                    <Stack spacing={0.5} sx={{ flex: 1 }}>
                      <Stack direction="row" justifyContent="space-between">
                        <Typography sx={{ color: 'rgba(237,240,247,0.72)' }}>Submitted</Typography>
                        <Typography>{distribution.submittedPct}%</Typography>
                      </Stack>
                      <LinearProgress
                        variant="determinate"
                        value={distribution.submittedPct}
                        sx={{
                          height: 6,
                          borderRadius: 999,
                          bgcolor: 'rgba(255,255,255,0.1)',
                          '& .MuiLinearProgress-bar': { background: '#8ea6d6' },
                        }}
                      />

                      <Stack direction="row" justifyContent="space-between">
                        <Typography sx={{ color: 'rgba(237,240,247,0.72)' }}>In Review</Typography>
                        <Typography>{distribution.inReviewPct}%</Typography>
                      </Stack>
                      <LinearProgress
                        variant="determinate"
                        value={distribution.inReviewPct}
                        sx={{
                          height: 6,
                          borderRadius: 999,
                          bgcolor: 'rgba(255,255,255,0.1)',
                          '& .MuiLinearProgress-bar': { background: '#f8b321' },
                        }}
                      />

                      <Stack direction="row" justifyContent="space-between">
                        <Typography sx={{ color: 'rgba(237,240,247,0.72)' }}>Completed</Typography>
                        <Typography>{distribution.completedPct}%</Typography>
                      </Stack>
                      <LinearProgress
                        variant="determinate"
                        value={distribution.completedPct}
                        sx={{
                          height: 6,
                          borderRadius: 999,
                          bgcolor: 'rgba(255,255,255,0.1)',
                          '& .MuiLinearProgress-bar': { background: '#f5d47a' },
                        }}
                      />

                      <Stack direction="row" justifyContent="space-between">
                        <Typography sx={{ color: 'rgba(237,240,247,0.72)' }}>Overdue</Typography>
                        <Typography>{distribution.overduePct}%</Typography>
                      </Stack>
                      <LinearProgress
                        variant="determinate"
                        value={distribution.overduePct}
                        sx={{
                          height: 6,
                          borderRadius: 999,
                          bgcolor: 'rgba(255,255,255,0.1)',
                          '& .MuiLinearProgress-bar': { background: '#d2754a' },
                        }}
                      />
                    </Stack>
                  </Stack>
                </Box>

                <Box sx={{ ...panelSx, p: 1 }}>
                  <Typography sx={{ fontSize: 30, fontWeight: 600, mb: 0.8 }}>Assignment Leaderboard</Typography>

                  <Stack spacing={0.8}>
                    {leaderboard.map((assignment) => (
                      <Stack
                        key={`leader-${assignment.id}`}
                        direction="row"
                        spacing={0.8}
                        alignItems="center"
                        sx={{
                          px: 0.8,
                          py: 0.8,
                          borderRadius: 1,
                          border: '1px solid rgba(255,255,255,0.1)',
                          bgcolor: 'rgba(10,14,22,0.7)',
                        }}
                      >
                        <Box
                          sx={{
                            width: 44,
                            height: 44,
                            borderRadius: 1,
                            border: '1px solid rgba(255,255,255,0.1)',
                            background: placeholderBackgrounds[assignment.imageTheme % placeholderBackgrounds.length],
                            flexShrink: 0,
                          }}
                        />
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography noWrap sx={{ fontWeight: 600 }}>{assignment.title}</Typography>
                          <Typography sx={{ fontSize: 12, color: 'rgba(237,240,247,0.64)' }} noWrap>
                            {assignment.subtitle}
                          </Typography>
                        </Box>
                        <Typography sx={{ color: '#f8d56f', fontWeight: 700 }}>{assignment.avgScore}%</Typography>
                      </Stack>
                    ))}
                  </Stack>
                </Box>

                <Box sx={{ ...panelSx, p: 1 }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography sx={{ fontSize: 30, fontWeight: 600 }}>Assignment Feedback</Typography>
                    <Button
                      size="small"
                      onClick={addFeedback}
                      sx={{ textTransform: 'none', color: '#edf0f7', border: '1px solid rgba(255,255,255,0.16)' }}
                    >
                      Add
                    </Button>
                  </Stack>

                  <Stack direction="row" spacing={0.8} sx={{ mt: 0.8 }}>
                    <TextField
                      value={feedbackAuthor}
                      onChange={(event) => setFeedbackAuthor(event.target.value)}
                      size="small"
                      label="Author"
                      sx={{
                        width: 130,
                        '& .MuiInputBase-root': { color: '#edf0f7', bgcolor: 'rgba(255,255,255,0.03)' },
                      }}
                    />
                    <TextField
                      value={feedbackDraft}
                      onChange={(event) => setFeedbackDraft(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' && !event.shiftKey) {
                          event.preventDefault();
                          addFeedback();
                        }
                      }}
                      size="small"
                      label="Feedback"
                      placeholder="Add assignment feedback"
                      sx={{
                        flex: 1,
                        '& .MuiInputBase-root': { color: '#edf0f7', bgcolor: 'rgba(255,255,255,0.03)' },
                      }}
                    />
                    <Button
                      size="small"
                      onClick={addFeedback}
                      sx={{
                        textTransform: 'none',
                        color: '#edf0f7',
                        border: '1px solid rgba(255,255,255,0.2)',
                        minWidth: 70,
                      }}
                    >
                      Post
                    </Button>
                  </Stack>

                  <Stack spacing={0.8} sx={{ mt: 0.8 }}>
                    {feedbackItems.map((item, index) => (
                      <Stack
                        key={item.id}
                        direction="row"
                        spacing={0.8}
                        alignItems="flex-start"
                        sx={{
                          px: 0.8,
                          py: 0.8,
                          borderRadius: 1,
                          border: '1px solid rgba(255,255,255,0.1)',
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

                {selectedAssignment && (
                  <Box sx={{ ...panelSx, p: 1 }}>
                    <Typography sx={{ fontSize: 18, fontWeight: 700, mb: 0.6 }}>Selected Assignment</Typography>
                    <Typography sx={{ fontWeight: 600 }}>{selectedAssignment.title}</Typography>
                    <Typography sx={{ color: 'rgba(237,240,247,0.72)', fontSize: 13 }}>
                      {formatDateRange(selectedAssignment.startDate, selectedAssignment.dueDate)}
                    </Typography>
                    <Typography sx={{ color: '#f8d56f', mt: 0.4, fontWeight: 700 }}>
                      Revenue impact: {toNok(selectedAssignment.revenueImpact)}
                    </Typography>
                  </Box>
                )}
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
                    border: '1px solid rgba(255,255,255,0.18)',
                  }}
                >
                  CTA
                </Button>
                <Button
                  startIcon={<Subtitles />}
                  onClick={() => setLocation('/academy/lower-thirds')}
                  sx={{
                    flex: 1,
                    textTransform: 'none',
                    color: '#edf0f7',
                    border: '1px solid rgba(255,255,255,0.18)',
                  }}
                >
                  LowerThirds
                </Button>
              </Stack>

              <Stack direction="row" spacing={1} sx={{ p: 1.1, pt: 0 }}>
                <Button
                  startIcon={<Quiz />}
                  onClick={() => setLocation('/academy/quiz-manager')}
                  sx={{
                    flex: 1,
                    textTransform: 'none',
                    color: '#edf0f7',
                    border: '1px solid rgba(255,255,255,0.16)',
                  }}
                >
                  Quiz Manager
                </Button>
                <Button
                  startIcon={<MonetizationOn />}
                  onClick={() => setLocation('/academy/monetization')}
                  sx={{
                    flex: 1,
                    textTransform: 'none',
                    color: '#edf0f7',
                    border: '1px solid rgba(255,255,255,0.16)',
                  }}
                >
                  Monetization
                </Button>
              </Stack>

              <Stack direction="row" spacing={1} sx={{ p: 1.1, pt: 0 }}>
                <Button
                  startIcon={<Save />}
                  onClick={() => void saveAssignments(false)}
                  sx={{
                    flex: 1,
                    textTransform: 'none',
                    color: '#edf0f7',
                    border: '1px solid rgba(255,255,255,0.16)',
                  }}
                >
                  Save
                </Button>
                <Button
                  startIcon={<Publish />}
                  onClick={() => void saveAssignments(true)}
                  sx={{
                    minWidth: 118,
                    textTransform: 'none',
                    color: '#0f0f0f',
                    background: 'linear-gradient(180deg, #ffd44e, #f2a616)',
                    fontWeight: 700,
                  }}
                >
                  Publish
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

export default withUniversalIntegration(AcademyAssignmentsStudio, {
  componentId: 'academy-assignments-studio',
  componentName: 'Academy Assignments Studio',
  componentType: 'manager',
  componentCategory: 'academy',
  featureIds: ['assignments', 'assignment-analytics', 'assignment-workflows', 'academy-assessment'],
});
