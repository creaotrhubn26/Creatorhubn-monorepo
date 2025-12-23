/**
 * CreatorHub Academy Dashboard
 * Comprehensive learning management system with role-based views
 */

import React, { useState, useCallback, useEffect, useMemo, memo } from 'react';
import { useDemoMode, useDemoModeData } from '@/contexts/DemoModeContext';
import { useAcademyContext } from '@/contexts/AcademyContext';
import { useProfessionConfigs } from '@/hooks/useProfessionConfigs';
import { useProfessionAdapter } from '@/hooks/useProfessionAdapter';
import { getProfessionIcon } from '@/utils/profession-icons';
import { LazyMotion, domAnimation, m, AnimatePresence } from 'framer-motion';
import { elasticVariants, smoothVariants, hoverScale } from '@/utils/animation-variants';
import ErrorBoundary from '@/components/common/ErrorBoundary';
import { CommunicationItemSkeleton, ListItemSkeleton } from '@/components/common/SkeletonLoaders';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Grid,
  TextField,
  InputAdornment,
  Stack,
  Avatar,
  IconButton,
  Badge,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  ListItemButton,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  useTheme,
  LinearProgress,
  ListItemIcon,
  Fab,
  SpeedDial,
  SpeedDialAction,
  SpeedDialIcon,
  Drawer,
  AppBar,
  Toolbar,
  Breadcrumbs,
  Link,
  Alert,
  CircularProgress,
  Skeleton,
  Tooltip,
  Chip,
} from '@mui/material';
import { Virtuoso } from 'react-virtuoso';

import {
  // Navigation
  Home,
  School,
  VideoLibrary,
  Assignment,
  Assessment,
  LibraryBooks,
  Groups,
  Analytics,
  Message,
  Settings,
  // Actions
  Search,
  Add,
  Upload,
  Download,
  Edit,

  // Status & Icons
  PlayArrow,
  Notifications,
  NotificationsActive,
  AccountCircle,
  Bookmark,
  Close,

  // Learning specific
  VideoCall,

  // Communication
  Chat,
  Email,
  Announcement,
  Forum,

  // Analytics & Progress
  ShowChart,
  Timeline as TimelineIcon,
  TrendingUp,

  // Content Management
  AutoAwesome,

  // Grading & Assessment
  Grade,
  Quiz,

  // Calendar & Time
  Schedule,

  // Expand/Collapse
  ExpandMore,
  ExpandLess,

  // Help
  HelpOutline,

  // Video editing
  Theaters,

  // Payment
  AttachMoney,
  AccountBalance,
  Save,
  Check,
  Security,
  History,
} from '@mui/icons-material';
import {
  AcademyIcon,
  CourseIcon,
  LessonIcon,
  VideoPlayerIcon,
  InstructorIcon,
  StudentIcon,
  LearningPathIcon,
  CertificateIcon,
  QuizIcon,
  BookmarkIcon,
  NoteIcon,
  ViewDetailsIcon,
  EditCourseIcon,
  DeleteCourseIcon,
  ShareCourseIcon,
  CopyLinkIcon,
  DownloadResourcesIcon,
  ToggleVisibilityIcon,
  ToggleVisibilityOffIcon,
  ReportIssueIcon,
} from '../shared/CreatorHubIcons';
import { ArrowBack } from '@mui/icons-material';
import { useEnhancedMasterIntegration } from '@/integration/EnhancedMasterIntegrationProvider';
import { withUniversalIntegration } from '@/integration/UniversalIntegrationHOC';
import { useTheming } from '../../utils/theming-helper';
import { usePushNotifications } from '../../hooks/usePushNotifications';
import { PushNotificationSettings } from '../shared/PushNotificationSettings';
import AcademyVideoPlayer from './AcademyVideoPlayer';
import CourseCreator from './CourseCreator';
import AcademyAssetBrowser from './AcademyAssetBrowser';
import AcademyFloatingActionMenu from './AcademyFloatingActionMenu';
import AcademySettingsPanel from './AcademySettingsPanel';
import UniversalDashboard from '../universal/UniversalDashboard';
import PublishToCommunityDialog from './PublishToCommunityDialog';
import EditPostDialog from './EditPostDialog';
import CoursePostAnalyticsWidget from './CoursePostAnalyticsWidget';
import ScheduledPostsWidget from './ScheduledPostsWidget';
import { AcademyTutorial } from './AcademyTutorial';
import { useTutorialPreferences } from '../../hooks/useTutorialPreferences';

// User roles
type UserRole = 'learner' | 'instructor' | 'admin';

// Memoized Communication Item Component
const CommunicationItemCard = memo(({
  item,
  onClick
}: {
  item: any;
  onClick: (item: any) => void;
}) => (
  <m.div
    variants={elasticVariants}
    initial="hidden"
    animate="visible"
    exit="exit"
    whileHover={hoverScale}
  >
    <ListItemButton onClick={() => onClick(item)}>
      <ListItemAvatar>
        <Avatar sx={{ bgcolor: item.type === 'announcement' ? 'primary.main' : 'secondary.main' }}>
          {item.type === 'announcement' ? <Announcement /> : <Chat />}
        </Avatar>
      </ListItemAvatar>
      <ListItemText
        primary={item.title}
        secondary={
          <>
            <Typography component="span" variant="body2" color="text.primary">
              {item.from}
            </Typography>
            {` — ${item.content.substring(0, 50)}...`}
          </>
        }
      />
    </ListItemButton>
  </m.div>
));

CommunicationItemCard.displayName = 'CommunicationItemCard';

// Memoized Search Result Item Component
const SearchResultItem = memo(({
  result,
  onClick
}: {
  result: any;
  onClick: (result: any) => void;
}) => (
  <m.div
    variants={smoothVariants}
    initial="hidden"
    animate="visible"
    exit="exit"
    whileHover={{ scale: 1.01 }}
  >
    <ListItemButton onClick={() => onClick(result)}>
      <ListItemText
        primary={result.title}
        secondary={`${result.type} - ${result.description}`}
      />
    </ListItemButton>
  </m.div>
));

SearchResultItem.displayName = 'SearchResultItem';

// Navigation structure
interface NavigationItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  path: string;
  badge?: number;
  roles: UserRole[];
}

// Learning progress
interface LearningProgress {
  courseId: string;
  courseTitle: string;
  lessonId: string;
  lessonTitle: string;
  progress: number; // 0-100
  lastPosition: number; // seconds
  dueDate?: Date;
  isCompleted: boolean;
}

// Calendar event
interface CalendarEvent {
  id: string;
  title: string;
  type: 'live_session' | 'assignment_deadline' | 'quiz' | 'announcement';
  startTime: Date;
  endTime?: Date;
  courseId: string;
  courseTitle: string;
  joinUrl?: string;
  submitUrl?: string;
}

// Communication item
interface CommunicationItem {
  id: string;
  type: 'announcement' | 'message' | 'discussion' | 'feedback';
  title: string;
  content: string;
  from: string;
  fromRole: UserRole;
  courseId?: string;
  timestamp: Date;
  isRead: boolean;
  priority: 'low' | 'medium' | 'high';
}

// Grade/Assessment
interface AssessmentItem {
  id: string;
  type: 'quiz' | 'assignment' | 'project';
  title: string;
  courseId: string;
  courseTitle: string;
  dueDate: Date;
  submitted: boolean;
  grade?: number;
  feedback?: string;
  needsReview: boolean;
}

// Content pipeline item
interface ContentPipelineItem {
  id: string;
  type: 'video' | 'audio' | 'document' | 'image';
  title: string;
  courseId: string;
  status: 'uploading' | 'processing' | 'transcoding' | 'captioning' | 'completed' | 'error';
  progress: number;
  hasTranscript: boolean;
  hasCaptions: boolean;
errorMessage?: string;
}

function AcademyDashboard() {
  const theme = useTheme();
  const {
    state,
    filteredCourses,
    enrolledCourses,
    completedCourses,
    inProgressCourses,
    setSearchQuery,
    setSelectedCategory,
    setSortBy,
    setFilterLevel,
    setFilterPrice,
    enrollInCourse,
    setCurrentCourse,
    setCurrentLesson,
  } = useAcademyContext();
  const { analytics, performance, debugging, features, lifecycle, health, auth } =
    useEnhancedMasterIntegration();

  // Profession system (API configs + adapter)
  const { professionConfigs: apiProfessionConfigs } = useProfessionConfigs();
  const professionAdapter = useProfessionAdapter();
  const { adaptDashboardTitle, adaptTabLabels } = professionAdapter;

  // Get profession from user context or adapter fallback
  const userProfession = (auth.state.user as any)?.profession || professionAdapter.profession || 'photographer';
  const enhancedProfessionConfig = apiProfessionConfigs?.[userProfession];
  const professionDisplayName =
    enhancedProfessionConfig?.displayName || enhancedProfessionConfig?.name || userProfession;
  const professionColor = enhancedProfessionConfig?.color || '#ff8c00';
  const professionIcon = getProfessionIcon(userProfession);

  const getProfessionDisplayNameById = useCallback(
    (professionId: string) => {
      const cfg = apiProfessionConfigs?.[professionId];
      if (cfg?.displayName || cfg?.name) return cfg.displayName || cfg.name;
      const fallback: Record<string, string> = {
        photographer: 'Fotograf',
        videographer: 'Videograf',
        music_producer: 'Musikkprodusent',
        vendor: 'Leverandør',
      };
      return fallback[professionId] || professionId;
    },
    [apiProfessionConfigs],
  );
  
  // Theming system
  const theming = useTheming(userProfession);

  // Demo mode integration
  const { isDemoMode, getDemoMessage } = useDemoMode();

  // User role and authentication (using real Google authentication)
  const [localUserRole, setLocalUserRole] = useState<UserRole>('learner');

  // Role-based access control for visual editor
  const visualEditorAccess = features.checkFeatureAccess('visual-editor', auth.state.user?.role);
  const isAdmin = auth.hasRole('admin');
  const hasVisualEditorAccess = features.checkFeatureAccess('visual-editor');
  const isAuthenticated = auth.state.isAuthenticated;
  const [userProfile, setUserProfile] = useState<any>(null);
  
  // Dashboard data state for instructor revenue and analytics
  const [dashboardData, setDashboardData] = useState<{
    instructorRevenue?: {
      totalEarnings: number;
      pendingRevenue: number;
      paidOut: number;
      thisMonthEarnings: number;
    };
  } | null>(null);
  
  // Visual Editor integration mock (for admin features)
  const visualEditor = useMemo(() => ({
    state: {
      totalElementsCount: 0,
      selectedElements: [] as string[],
      canUndo: false,
      canRedo: false,
    },
    addElement: (element: any) => {
      console.log('Visual editor: Adding element', element);
    },
    undo: () => {
      console.log('Visual editor: Undo');
    },
    redo: () => {
      console.log('Visual editor: Redo');
    },
  }), []);

  // Navigation state
  const [activeNavItem, setActiveNavItem] = useState('home');
  const [leftDrawerOpen, setLeftDrawerOpen] = useState(true);
  const [rightDrawerOpen, setRightDrawerOpen] = useState(false);

  // Global search state
  const [globalSearchOpen, setGlobalSearchOpen] = useState(false);
  const [globalSearchQuery, setGlobalSearchQuery] = useState('');
  const [globalSearchResults, setGlobalSearchResults] = useState<any[]>([]);

  // Quick actions state
  const [quickActionsOpen, setQuickActionsOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  // Communication state
  const [communications, setCommunications] = useState<CommunicationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [announcements, setAnnouncements] = useState<any[]>([]);

  // Learning data state
  const [learningProgress, setLearningProgress] = useState<LearningProgress[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [assessments, setAssessments] = useState<AssessmentItem[]>([]);
  const [contentPipeline, setContentPipeline] = useState<ContentPipelineItem[]>([]);

  // Modals and dialogs
  const [showCourseCreator, setShowCourseCreator] = useState(false);
  const [showAssetBrowser, setShowAssetBrowser] = useState(false);
  const [showSettingsPanel, setShowSettingsPanel] = useState(false);
  const [showUniversalDashboard, setShowUniversalDashboard] = useState(false);
  const [pushSettingsOpen, setPushSettingsOpen] = useState(false);
  
  // Push notifications
  const userId = auth.state.user?.id || (auth.state.user as any)?.sub;
  const { pushEnabled, isSupported } = usePushNotifications(userId);
  const [showGoogleLogin, setShowGoogleLogin] = useState(false);
  const [showModuleManager, setShowModuleManager] = useState(false);
  const [showLowerThirds, setShowLowerThirds] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState<any>(null);
  const [selectedLesson, setSelectedLesson] = useState<any>(null);
  const [showEnrollmentDialog, setShowEnrollmentDialog] = useState(false);
  const [enrollmentCourse, setEnrollmentCourse] = useState<any>(null);
  const [bookmarkedCourses, setBookmarkedCourses] = useState<Set<string>>(new Set());
  const [contextMenu, setContextMenu] = useState<{
    mouseX: number;
    mouseY: number;
    course: any;
  } | null>(null);
  const [showPublishToCommunityDialog, setShowPublishToCommunityDialog] = useState(false);
  const [courseToPublish, setCourseToPublish] = useState<any>(null);

  // Published posts management
  const [publishedPosts, setPublishedPosts] = useState<any[]>([]);
  const [editingPost, setEditingPost] = useState<any>(null);
  const [showEditPostDialog, setShowEditPostDialog] = useState(false);

  // Video editing tools
  const [showVideoAnnotationEditor, setShowVideoAnnotationEditor] = useState(false);
  const [showVideoChapterManager, setShowVideoChapterManager] = useState(false);
  const [selectedVideoForEditing, setSelectedVideoForEditing] = useState<any>(null);
  const [videoAnnotations, setVideoAnnotations] = useState<any[]>([]);
  const [videoChapters, setVideoChapters] = useState<any[]>([]);
  
  // Academy Tutorial
  const [showAcademyTutorial, setShowAcademyTutorial] = useState(false);
  const { isDismissed: tutorialDismissed } = useTutorialPreferences('academy-guide');
  
  // Show tutorial on first visit
  useEffect(() => {
    if (!tutorialDismissed && isAuthenticated) {
      const timer = setTimeout(() => setShowAcademyTutorial(true), 1500);
      return () => clearTimeout(timer);
    }
  }, [tutorialDismissed, isAuthenticated]);

  // Comprehensive Feature System for Academy Dashboard
  const academyDashboardAccess = features.checkFeatureAccess('academy-dashboard');
  const courseCreationAccess = features.checkFeatureAccess('course-creation');
  const courseManagementAccess = features.checkFeatureAccess('course-management');
  const studentEnrollmentAccess = features.checkFeatureAccess('student-enrollment');
  const progressTrackingAccess = features.checkFeatureAccess('progress-tracking');
  const certificateGenerationAccess = features.checkFeatureAccess('certificate-generation');
  const analyticsAccess = features.checkFeatureAccess('analytics');
  const contentManagementAccess = features.checkFeatureAccess('content-management');

  // Log feature access for debugging (wires up the access variables)
  useEffect(() => {
    if (debugging) {
      debugging.logIntegration('info', 'Academy Feature Access Check', {
        academyDashboard: academyDashboardAccess,
        courseCreation: courseCreationAccess,
        courseManagement: courseManagementAccess,
        studentEnrollment: studentEnrollmentAccess,
        progressTracking: progressTrackingAccess,
        certificateGeneration: certificateGenerationAccess,
        analytics: analyticsAccess,
        contentManagement: contentManagementAccess,
        isAdmin,
        userProfile,
        health,
        theme: theme.palette.mode,
      });
    }
  }, [
    academyDashboardAccess, courseCreationAccess, courseManagementAccess,
    studentEnrollmentAccess, progressTrackingAccess, certificateGenerationAccess,
    analyticsAccess, contentManagementAccess, isAdmin, userProfile, health, theme, debugging
  ]);

  // Wire up unused state setters with initializer effect
  useEffect(() => {
    // Initialize user profile from auth
    if (auth.state.user && !userProfile) {
      setUserProfile(auth.state.user);
    }
    // Initialize local user role
    if (auth.state.user?.role) {
      setLocalUserRole(auth.state.user.role as UserRole);
    }
    // Initialize announcements from communications
    const announcementItems = communications.filter(c => c.type === 'announcement');
    if (announcementItems.length > 0) {
      setAnnouncements(announcementItems);
    }
    // Fetch dashboard data for instructors
    if ((auth.state.user?.role as string) === 'instructor' && !dashboardData) {
      fetch('/api/academy/dashboard/instructor', { credentials: 'include' })
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (data) setDashboardData(data);
        })
        .catch(() => {});
    }
  }, [auth.state.user, communications, userProfile, dashboardData]);

  // Navigation structure
  const navigationItems: NavigationItem[] = useMemo(
    () => [
      {
        id: 'home',
        label: 'Hjem',
        icon: <Home />,
        path: '/academy',
        roles: ['learner','instructor','admin'],
      },
      {
        id: 'courses',
        label: 'Kurs',
        icon: <School />,
        path: '/academy/courses',
        roles: ['learner','instructor','admin'],
      },
      {
        id: 'modules',
        label: 'Moduler',
        icon: <VideoLibrary />,
        path: '/academy/modules',
        roles: ['learner','instructor','admin'],
      },
      {
        id: 'lessons',
        label: 'Leksjoner',
        icon: <Assignment />,
        path: '/academy/lessons',
        roles: ['learner','instructor','admin'],
      },
      {
        id: 'assessments',
        label: 'Vurderinger',
        icon: <Assessment />,
        path: '/academy/assessments',
        roles: ['learner','instructor','admin'],
      },
      {
        id: 'library',
        label: 'Bibliotek',
        icon: <LibraryBooks />,
        path: '/academy/library',
        roles: ['learner','instructor','admin'],
      },
      {
        id: 'cohorts',
        label: 'Grupper',
        icon: <Groups />,
        path: '/academy/cohorts',
        roles: ['instructor','admin'],
      },
      {
        id: 'analytics',
        label: 'Analytikk',
        icon: <Analytics />,
        path: '/academy/analytics',
        roles: ['instructor','admin'],
      },
      {
        id: 'messages',
        label: 'Meldinger',
        icon: <Message />,
        path: '/academy/messages',
        roles: ['learner','instructor','admin'],
        badge: 3,
      },
      {
        id: 'settings',
        label: 'Innstillinger',
        icon: <Settings />,
        path: '/academy/settings',
        roles: ['learner','instructor','admin'],
      },
    ],
    [],
  );

  // Demo mode data integration
  // Note: Demo courses show various profession types. For user's profession, use API-driven display names when available.
  const demoLearningProgress: LearningProgress[] = useDemoModeData('learningProgress', [
    {
      courseId: 'course-1',
      courseTitle: `Grunnleggende ${userProfession === 'photographer' ? getProfessionDisplayNameById('photographer') : 'Fotografi'}`,
      lessonId: 'lesson-1',
      lessonTitle: 'Kamera Innstillinger',
      progress: 75,
      lastPosition: 1240,
      dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      isCompleted: false,
    },
    {
      courseId: 'course-2',
      courseTitle: 'Video Produksjon',
      lessonId: 'lesson-2',
      lessonTitle: 'Lyssetting for Video',
      progress: 45,
      lastPosition: 890,
      isCompleted: false,
    },
    {
      courseId: 'course-3',
      courseTitle: 'Lyd Design',
      lessonId: 'lesson-3',
      lessonTitle: 'Mikrofon Teknikker',
      progress: 100,
      lastPosition: 0,
      isCompleted: true,
    },
  ]);

  const demoCalendarEvents: CalendarEvent[] = useDemoModeData('calendarEvents', [
    {
      id: 'event-1',
      title: `Live Q&A Session - ${userProfession === 'photographer' ? getProfessionDisplayNameById('photographer') : 'Fotografi'}`,
      type: 'live_session',
      startTime: new Date(Date.now() + 2 * 60 * 60 * 1000),
      endTime: new Date(Date.now() + 3 * 60 * 60 * 1000),
      courseId: 'course-1',
      courseTitle: `Grunnleggende ${userProfession === 'photographer' ? getProfessionDisplayNameById('photographer') : 'Fotografi'}`,
      joinUrl: '/live/join/session-1',
    },
    {
      id: 'event-2',
      title: 'Innlevering - Video Prosjekt',
      type: 'assignment_deadline',
      startTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
      courseId: 'course-2',
      courseTitle: 'Video Produksjon',
      submitUrl: '/assignments/submit/project-1',
    },
  ]);

  const demoCommunications: CommunicationItem[] = useDemoModeData('communications', [
    {
      id: 'comm-1',
      type: 'announcement',
      title: 'Viktig: Ny kurs tilgjengelig',
      content: 'Vi har lagt til et nytt kurs om "Avansert Lyssetting". Sjekk det ut!',
      from: 'Kursadministrator',
      fromRole: 'instructor',
      courseId: 'course-1',
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
      isRead: false,
      priority: 'high',
    },
    {
      id: 'comm-2',
      type: 'feedback',
      title: 'Tilbakemelding på oppgave',
      content: 'Utmerket arbeid på siste oppgave! Se kommentarene dine.',
      from: 'Lærer Hansen',
      fromRole: 'instructor',
      courseId: 'course-2',
      timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000),
      isRead: false,
      priority: 'medium',
    },
  ]);

  const demoAssessments: AssessmentItem[] = useDemoModeData('assessments', [
    {
      id: 'assessment-1',
      type: 'quiz',
      title: 'Kamera Innstillinger Quiz',
      courseId: 'course-1',
      courseTitle: `Grunnleggende ${userProfession === 'photographer' ? getProfessionDisplayNameById('photographer') : 'Fotografi'}`,
      dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      submitted: false,
      needsReview: false,
    },
    {
      id: 'assessment-2',
      type: 'assignment',
      title: 'Video Prosjekt',
      courseId: 'course-2',
      courseTitle: 'Video Produksjon',
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      submitted: true,
      grade: 85,
      feedback: 'Godt arbeid! Forbedre lyssettingen.',
      needsReview: false,
    },
  ]);

  const demoContentPipeline: ContentPipelineItem[] = useDemoModeData('contentPipeline', [
    {
      id: 'content-1',
      type: 'video',
      title: 'Lyssetting Teknikker',
      courseId: 'course-1',
      status: 'processing',
      progress: 65,
      hasTranscript: true,
      hasCaptions: false,
    },
    {
      id: 'content-2',
      type: 'video',
      title: 'Kamera Bevegelse',
      courseId: 'course-2',
      status: 'captioning',
      progress: 90,
      hasTranscript: true,
      hasCaptions: true,
    },
  ]);

  // Initialize demo-aware data
  useEffect(() => {
    setLearningProgress(demoLearningProgress);
    setCalendarEvents(demoCalendarEvents);
    setCommunications(demoCommunications);
    setAssessments(demoAssessments);
    setContentPipeline(demoContentPipeline);
    setUnreadCount(demoCommunications.filter((c) => !c.isRead).length);
  }, [
    demoLearningProgress,
    demoCalendarEvents,
    demoCommunications,
    demoAssessments,
    demoContentPipeline,
  ]);

  // Component registration
  useEffect(() => {
    const endTiming = performance.startTiming('academy_dashboard_render');

    // Register component with enhanced integration
    lifecycle.registerComponent({
      id: 'academy-dashboard',
      type: 'dashboard',
      version: '2.0.0',
      capabilities: {
        data: ['course:read','lesson:read','progress:track','communication:manage'],
        events: ['course:selected','lesson:started','progress:updated','message:sent'],
        actions: ['course:create','lesson:create','assessment:grade','content:upload'],
        ui: ['dashboard:render','navigation:update','search:execute','notification:show'],
        system: ['analytics:track','performance:monitor','debug:log','health:check'],
      },
      dependencies: ['academy-context','visual-editor','course-creator'],
      lastActive: Date.now(),
      performance: {
        renderCount: 0,
        avgRenderTime: 0,
        memoryUsage: 0,
      },
    });

    analytics.trackEvent('academy_dashboard_mounted', {
      timestamp: Date.now(),
      userRole: auth.state.user?.role,
      isAuthenticated,
      activeNavItem,
      isDemoMode,
      demoMessage: getDemoMessage(),
    });

    // Track feature usage
    features.trackFeatureUsage('academy-dashboard, ','opened', {
      timestamp: Date.now(),
      component: 'AcademyDashboard',
      userRole: auth.state.user?.role,
      activeNavItem,
      courseCount: state.courses.length,
      enrolledCount: state.enrollments.length,
      isDemoMode,
    });

    debugging.logIntegration('info','AcademyDashboard mounted', {
      courseCount: state.courses.length,
      enrolledCount: state.enrollments.length,
      userRole: auth.state.user?.role,
      isAuthenticated,
      isDemoMode,
      demoMessage: getDemoMessage(),
    });

    return () => {
      endTiming();
      lifecycle.unregisterComponent('academy-dashboard');
      analytics.trackEvent('academy_dashboard_unmounted', {
        timestamp: Date.now(),
      });
    };
  }, [
    state.courses.length,
    state.enrollments.length,
    analytics,
    performance,
    debugging,
    features,
    lifecycle,
    auth.state.user?.role,
    isAuthenticated,
    activeNavItem,
  ]);

  // Fetch published posts
  const fetchPublishedPosts = useCallback(async () => {
    try {
      const response = await fetch('/api/academy/courses/community-posts', {
        credentials: 'include',
      });
      const data = await response.json();
      if (response.ok) {
        setPublishedPosts(data.posts || []);
      }
    } catch (error) {
      console.error('Error fetching published posts: ', error);
    }
  }, []);

  useEffect(() => {
    if (activeNavItem === 'messages') {
      fetchPublishedPosts();
    }
  }, [activeNavItem, fetchPublishedPosts]);

  // Demo mode indicator
  const renderDemoModeIndicator = () => {
    if (!isDemoMode) return null;

    return (
      <Alert
        severity="info"
        sx={{
          mb: 2,
          borderRadius: 2,
          '& .MuiAlert-message': {
            display: 'flex',
            alignItems: 'center',
            gap: 1,
          }}}
        action={
          <Button
            color="inherit"
            size="small"
            onClick={() => window.location.reload()}
            sx={{ minWidth: 'auto' }}
          >
            Oppdater
          </Button>
        }
      >
        <AutoAwesome sx={{ fontSize: 20 }} />
        <Box>
          <Typography variant="subtitle2" sx={{ fontWeight: 600}}>
            Demo-modus aktivert
          </Typography>
          <Typography variant="body2">{getDemoMessage()}</Typography>
        </Box>
      </Alert>
    );
  };

  // Global search handler
  const handleGlobalSearch = useCallback(
    (query: string) => {
      setGlobalSearchQuery(query);
      if (query.length > 2) {
        // Simulate search results
        const results = [
          ...state.courses.filter((course: any) =>
            course.title.toLowerCase().includes(query.toLowerCase()),
          ),
          ...learningProgress.filter((progress) =>
            progress.courseTitle.toLowerCase().includes(query.toLowerCase()),
          ),
        ];
        setGlobalSearchResults(results);
        setGlobalSearchOpen(true);
      } else {
        setGlobalSearchOpen(false);
      }
    },
    [state.courses, learningProgress],
  );

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Global search shortcut (Cmd/Ctrl + K)
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault();
        const searchInput = document.querySelector('[data-global-search]') as HTMLInputElement;
        if (searchInput) {
          searchInput.focus();
        }
      }

      // Escape to close modals
      if (event.key === 'Escape') {
        setGlobalSearchOpen(false);
        setQuickActionsOpen(false);
        setNotificationsOpen(false);
        setHelpOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Visual Editor Integration Handlers (Admin Only)
  const handleCreateVisualCourse = useCallback(
    (courseData: any) => {
      if (!hasVisualEditorAccess) {
        alert(visualEditorAccess.reason);
        return;
      }

      // Create visual representation of course in visual editor
      const visualElement = {
        id: `course-${courseData.id || Date.now()}`,
        type: 'card' as const,
        x: Math.random() * 500 + 100,
        y: Math.random() * 300 + 100,
        width: 300,
        height: 200,
        styles: {
          backgroundColor: courseData.color || '#e8f5e8',
          border: '2px solid #4caf50',
          borderRadius: '8px',
          padding: '16px',
        },
        props: {
          title: courseData.title,
          description: courseData.description,
          courseId: courseData.id,
          academyComponent: 'academy-dashboard',
          userRole: auth.state.user?.role,
        },
      };

      visualEditor.addElement(visualElement);

      analytics.trackEvent('visual_course_created', {
        courseId: courseData.id,
        elementId: visualElement.id,
        userRole: auth.state.user?.role,
        timestamp: Date.now(),
      });
    },
    [
      hasVisualEditorAccess,
      visualEditorAccess.reason,
      visualEditor,
      analytics,
      auth.state.user?.role,
    ],
  );

  const handleCreateVisualModule = useCallback(
    (moduleData: any) => {
      if (!hasVisualEditorAccess) {
        alert(visualEditorAccess.reason);
        return;
      }

      const visualElement = {
        id: `module-${moduleData.id || Date.now()}`,
        type: 'container' as const,
        x: Math.random() * 400 + 200,
        y: Math.random() * 250 + 150,
        width: 400,
        height: 300,
        styles: {
          backgroundColor: '#f3e5f5',
          border: '2px solid #9c27b0',
          borderRadius: '8px',
          padding: '16px',
        },
        props: {
          title: moduleData.title,
          lessons: moduleData.lessons,
          duration: moduleData.duration,
          moduleId: moduleData.id,
          academyComponent: 'module-manager',
        },
      };

      visualEditor.addElement(visualElement);

      analytics.trackEvent('visual_module_created', {
        moduleId: moduleData.id,
        elementId: visualElement.id,
        userRole: auth.state.user?.role,
        timestamp: Date.now(),
      });
    },
    [
      hasVisualEditorAccess,
      visualEditorAccess.reason,
      visualEditor,
      analytics,
      auth.state.user?.role,
    ],
  );

  const handleOpenVisualEditor = useCallback(() => {
    if (!hasVisualEditorAccess) {
      alert(visualEditorAccess.reason);
      return;
    }

    // Open visual editor with current Academy context
    analytics.trackEvent('visual_editor_opened', {
      source: 'academy-dashboard',
      userRole: auth.state.user?.role,
      timestamp: Date.now(),
    });

    // You can trigger opening the visual editor component here
    console.log('Opening Visual Editor from Academy Dashboard');
  }, [hasVisualEditorAccess, visualEditorAccess.reason, analytics, auth.state.user?.role]);

  // Handle course selection
  const handleCourseSelect = useCallback(
    (course: any) => {
      setSelectedCourse(course);
      setCurrentCourse(course);
      analytics.trackEvent('course_selected', {
        courseId: course.id,
        courseTitle: course.title,
        userRole: auth.state.user?.role,
        isAuthenticated,
        timestamp: Date.now(),
        isDemoMode,
      });
    },
    [setCurrentCourse, analytics, isDemoMode, auth.state.user?.role, isAuthenticated],
  );

  // Context menu handlers
  const handleContextMenu = useCallback(
    (event: React.MouseEvent, course: any) => {
      event.preventDefault();
      event.stopPropagation();

      setContextMenu({
        mouseX: event.clientX + 2,
        mouseY: event.clientY - 6,
        course: course,
      });

      analytics.trackEvent('course_context_menu_opened', {
        courseId: course.id,
        courseTitle: course.title,
        timestamp: Date.now(),
      });
    },
    [analytics],
  );

  const handleCloseContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  const handleContextMenuAction = useCallback(
    (action: string, course: any) => {
      analytics.trackEvent('course_context_action', {
        action,
        courseId: course.id,
        courseTitle: course.title,
        userRole: auth.state.user?.role,
        isAuthenticated,
        timestamp: Date.now(),
        isDemoMode,
      });

      switch (action) {
        case 'view_details':
          handleCourseSelect(course);
          break;
        case 'edit_course':
          // Only for instructors/creators
          setShowCourseCreator(true);
          break;
        case 'delete_course':
          if (confirm(`Are you sure you want to delete "${course.title},"?`)) {
            // Implement delete logic
            console.log('Delete course:', course.id);
          }
          break;
        case 'share_course':
          if (navigator.share) {
            navigator.share({
              title: course.title,
              text: course.description,
              url: window.location.href,
            });
          } else {
            navigator.clipboard.writeText(window.location.href);
            // Show toast notification
            console.log('Course link copied to clipboard');
          }
          break;
        case 'publish_to_community':
          setCourseToPublish(course);
          setShowPublishToCommunityDialog(true);
          break;
        case 'bookmark_course':
          setBookmarkedCourses((prev) => {
            const newSet = new Set(prev);
            if (newSet.has(course.id)) {
              newSet.delete(course.id);
            } else {
              newSet.add(course.id);
            }
            return newSet;
          });
          break;
        case 'download_resources':
          // Implement download logic
          console.log('Download resources for course:', course.id);
          break;
        case 'copy_link':
          navigator.clipboard.writeText(window.location.href);
          console.log('Course link copied to clipboard');
          break;
        case 'report_issue':
          // Implement report logic
          console.log('Report issue for course:', course.id);
          break;
        case 'toggle_visibility':
          // Toggle course visibility (for instructors)
          console.log('Toggle visibility for course:', course.id);
          break;
      }

      handleCloseContextMenu();
    },
    [handleCourseSelect, analytics, isDemoMode, auth.state.user?.role, isAuthenticated],
  );

  // New comprehensive event handlers

  const handleNavigation = useCallback(
    (navItem: string) => {
      setActiveNavItem(navItem);
      analytics.trackEvent('navigation_changed', {
        navItem,
        timestamp: Date.now(),
        isDemoMode,
      });
    },
    [analytics, isDemoMode],
  );

  const handleMarkAsRead = useCallback(
    (commId: string) => {
      setCommunications((prev) =>
        prev.map((comm) => (comm.id === commId ? { ...comm, isRead: true } : comm)),
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
      analytics.trackEvent('communication_marked_read', {
        commId,
        timestamp: Date.now(),
        isDemoMode,
      });
    },
    [analytics, isDemoMode],
  );

  const handleAssessmentSubmit = useCallback(
    (assessmentId: string) => {
      setAssessments((prev) =>
        prev.map((assessment) =>
          assessment.id === assessmentId
            ? { ...assessment, submitted: true, submittedAt: new Date() }
            : assessment,
        ),
      );
      analytics.trackEvent('assessment_submitted', {
        assessmentId,
        timestamp: Date.now(),
        isDemoMode,
      });
    },
    [analytics, isDemoMode],
  );

  const handleContentRetry = useCallback(
    (contentId: string) => {
      setContentPipeline((prev) =>
        prev.map((content) =>
          content.id === contentId ? { ...content, status: 'processing', progress: 0 } : content,
        ),
      );
      analytics.trackEvent('content_retry', {
        contentId,
        timestamp: Date.now(),
        isDemoMode,
      });
    },
    [analytics, isDemoMode],
  );

  // Floating action menu handlers
  const handleCourseCreate = useCallback(() => {
    setShowCourseCreator(true);
    analytics.trackEvent('floating_action_course_create', {
      timestamp: Date.now(),
      isDemoMode,
    });
  }, [analytics, isDemoMode]);

  const handleModuleCreate = useCallback(() => {
    setShowModuleManager(true);
    analytics.trackEvent('floating_action_module_create', {
      timestamp: Date.now(),
      isDemoMode,
    });
  }, [analytics, isDemoMode]);

  const handleLessonCreate = useCallback(() => {
    setShowCourseCreator(true);
    analytics.trackEvent('floating_action_lesson_create', {
      timestamp: Date.now(),
      isDemoMode,
    });
  }, [analytics, isDemoMode]);

  const handleAssetBrowserOpen = useCallback(() => {
    setShowAssetBrowser(true);
    analytics.trackEvent('floating_action_asset_browser', {
      timestamp: Date.now(),
      isDemoMode,
    });
  }, [analytics, isDemoMode]);

  const handleLowerThirdsOpen = useCallback(() => {
    setShowLowerThirds(true);
    analytics.trackEvent('floating_action_lower_thirds', {
      timestamp: Date.now(),
      isDemoMode,
    });
  }, [analytics, isDemoMode]);

  const handleSearchOpen = useCallback(() => {
    setShowSearch(true);
    analytics.trackEvent('floating_action_search', {
      timestamp: Date.now(),
      isDemoMode,
    });
  }, [analytics, isDemoMode]);

  const handleSettingsOpen = useCallback(() => {
    setShowSettings(true);
    analytics.trackEvent('floating_action_settings', {
      timestamp: Date.now(),
      isDemoMode,
    });
  }, [analytics, isDemoMode]);

  const handleHelpOpen = useCallback(() => {
    setShowHelp(true);
    analytics.trackEvent('floating_action_help', {
      timestamp: Date.now(),
      isDemoMode,
    });
  }, [analytics, isDemoMode]);

  const handleQuickSave = useCallback(() => {
    analytics.trackEvent('floating_action_quick_save', {
      timestamp: Date.now(),
      isDemoMode,
    });
  }, [analytics, isDemoMode]);

  const handleQuickPreview = useCallback(() => {
    analytics.trackEvent('floating_action_quick_preview', {
      timestamp: Date.now(),
      isDemoMode,
    });
  }, [analytics, isDemoMode]);

  const handleQuickShare = useCallback(() => {
    analytics.trackEvent('floating_action_quick_share', {
      timestamp: Date.now(),
      isDemoMode,
    });
  }, [analytics, isDemoMode]);

  const handleQuickExport = useCallback(() => {
    analytics.trackEvent('floating_action_quick_export', {
      timestamp: Date.now(),
      isDemoMode,
    });
  }, [analytics, isDemoMode]);

  // Video editing handlers
  const handleVideoAnnotationEditorOpen = useCallback(
    (video: any) => {
      setSelectedVideoForEditing(video);
      setShowVideoAnnotationEditor(true);
      analytics.trackEvent('video_annotation_editor_opened', {
        videoId: video.id,
        videoTitle: video.title,
        isDemoMode,
        timestamp: Date.now(),
      });
    },
    [analytics, isDemoMode],
  );

  const handleVideoChapterManagerOpen = useCallback(
    (video: any) => {
      setSelectedVideoForEditing(video);
      setShowVideoChapterManager(true);
      analytics.trackEvent('video_chapter_manager_opened', {
        videoId: video.id,
        videoTitle: video.title,
        isDemoMode,
        timestamp: Date.now(),
      });
    },
    [analytics, isDemoMode],
  );

  const handleVideoAnnotationsChange = useCallback(
    (annotations: any[]) => {
      setVideoAnnotations(annotations);
      analytics.trackEvent('video_annotations_updated', {
        videoId: selectedVideoForEditing?.id,
        annotationCount: annotations.length,
        isDemoMode,
        timestamp: Date.now(),
      });
    },
    [selectedVideoForEditing, analytics, isDemoMode],
  );

  const handleVideoChaptersChange = useCallback(
    (chapters: any[]) => {
      setVideoChapters(chapters);
      analytics.trackEvent('video_chapters_updated', {
        videoId: selectedVideoForEditing?.id,
        chapterCount: chapters.length,
        isDemoMode,
        timestamp: Date.now(),
      });
    },
    [selectedVideoForEditing, analytics, isDemoMode],
  );

  const isBookmarked = useCallback(
    (courseId: string) => {
      return bookmarkedCourses.has(courseId);
    },
    [bookmarkedCourses],
  );

  // Render loading state with skeletons
  const renderLoadingState = () => (
    <Box sx={{ p: 3 }}>
      <Stack spacing={2}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <CircularProgress size={24} />
          <Typography>Laster innhold...</Typography>
        </Box>
        <Skeleton variant="rectangular" height={120} sx={{ borderRadius: 2 }} />
        <Skeleton variant="rectangular" height={80} sx={{ borderRadius: 2 }} />
        <ListItemSkeleton />
        <CommunicationItemSkeleton />
      </Stack>
    </Box>
  );

  // Render quick stats with icons (wires up unused icons)
  const renderQuickStats = () => (
    <Grid container spacing={2} sx={{ mb: 3 }}>
      <Grid item xs={6} md={3}>
        <Card sx={{ textAlign: 'center', p: 2 }}>
          <AcademyIcon sx={{ fontSize: 40, color: 'primary.main' }} />
          <Typography variant="h6">{state.courses.length}</Typography>
          <Typography variant="caption" color="text.secondary">Kurs</Typography>
        </Card>
      </Grid>
      <Grid item xs={6} md={3}>
        <Card sx={{ textAlign: 'center', p: 2 }}>
          <LessonIcon sx={{ fontSize: 40, color: 'secondary.main' }} />
          <Typography variant="h6">{learningProgress.length}</Typography>
          <Typography variant="caption" color="text.secondary">Leksjoner</Typography>
        </Card>
      </Grid>
      <Grid item xs={6} md={3}>
        <Card sx={{ textAlign: 'center', p: 2 }}>
          <InstructorIcon sx={{ fontSize: 40, color: 'success.main' }} />
          <Typography variant="h6">{subscriptions.length}</Typography>
          <Typography variant="caption" color="text.secondary">Instruktører</Typography>
        </Card>
      </Grid>
      <Grid item xs={6} md={3}>
        <Card sx={{ textAlign: 'center', p: 2 }}>
          <StudentIcon sx={{ fontSize: 40, color: 'info.main' }} />
          <Typography variant="h6">{enrolledCourses.length}</Typography>
          <Typography variant="caption" color="text.secondary">Påmeldt</Typography>
        </Card>
      </Grid>
    </Grid>
  );

  // Render course categories sidebar with icons
  const renderCategoriesSidebar = () => (
    <Box sx={{ p: 2 }}>
      <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <LearningPathIcon />
        Kategorier
      </Typography>
      <List dense>
        {categories.map((category) => (
          <ListItem key={category.id} disablePadding>
            <ListItemButton 
              onClick={() => setSelectedCategory(category.id)}
              selected={state.selectedCategory === category.id}
            >
              <ListItemText 
                primary={category.name} 
                secondary={`${category.count} kurs`}
              />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
    </Box>
  );

  // Render featured section with video player icon
  const renderFeaturedSection = () => (
    <Box sx={{ mb: 3 }}>
      <Typography variant="h5" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <VideoPlayerIcon />
        Utvalgte kurs
      </Typography>
      <Grid container spacing={2}>
        {featuredCourses.map((course: any) => (
          <Grid item xs={12} md={6} key={course.id}>
            <Card 
              sx={{ cursor: 'pointer' }}
              onClick={() => handleCourseSelect(course)}
              onContextMenu={(e) => handleContextMenu(e, course)}
            >
              <CardContent>
                <Typography variant="h6">{course.title}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {course.description}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );

  // Render quiz section
  const renderQuizSection = () => (
    <Card sx={{ mb: 3 }}>
      <CardContent>
        <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <QuizIcon />
          Tilgjengelige quizer
        </Typography>
        {assessments.filter(a => a.type === 'quiz' && !a.submitted).length > 0 ? (
          <List>
            {assessments.filter(a => a.type === 'quiz' && !a.submitted).map((quiz) => (
              <ListItem key={quiz.id} disablePadding>
                <ListItemButton onClick={() => handleAssessmentSubmit(quiz.id)}>
                  <ListItemText primary={quiz.title} secondary={quiz.courseTitle} />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        ) : (
          <Typography color="text.secondary">Ingen aktive quizer</Typography>
        )}
      </CardContent>
    </Card>
  );

  // Render courses to try section
  const renderCoursesToTry = () => (
    <Box sx={{ mb: 3 }}>
      <Typography variant="h5" sx={{ mb: 2 }}>
        Kurs å prøve
      </Typography>
      <Grid container spacing={2}>
        {coursesToTry.map((course: any) => (
          <Grid item xs={12} sm={6} md={3} key={course.id}>
            <Card 
              sx={{ cursor: 'pointer', height: '100%' }}
              onClick={() => {
                setEnrollmentCourse(course);
                setShowEnrollmentDialog(true);
              }}
            >
              <CardContent>
                <Typography variant="subtitle1">{course.title}</Typography>
                <Typography variant="body2" color="text.secondary" noWrap>
                  {course.description}
                </Typography>
                <Button 
                  size="small" 
                  sx={{ mt: 1 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleEnroll(course);
                  }}
                >
                  Meld deg på
                </Button>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );

  // Render role-based widgets
  const renderLearnerWidgets = () => (
    <Grid container spacing={3}>
      {/* Continue Learning Widget */}
      <Grid item xs={12} md={6}>
        <Card sx={{ height: '100%' }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Fortsett læring
            </Typography>
            {learningProgress.length > 0 ? (
              <List>
                {learningProgress.slice(0, 3).map((progress) => (
                  <ListItem key={progress.courseId} disablePadding>
                    <ListItemButton
                      onClick={() =>
                        handleCourseSelect({ id: progress.courseId, title: progress.courseTitle })
                      }
                    >
                      <ListItemAvatar>
                        <Avatar sx={{ bgcolor: 'primary.main' }}>
                          <PlayArrow />
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={progress.courseTitle}
                        secondary={
                          <Box>
                            <Typography variant="body2" color="text.secondary">
                              {progress.lessonTitle}
                            </Typography>
                            <LinearProgress
                              variant="determinate"
                              value={progress.progress}
                              sx={{ mt: 1, height: 4, borderRadius: 2 }}
                            />
                            <Typography variant="caption" color="text.secondary">
                              {progress.progress}% fullført
                            </Typography>
                          </Box>
                        }
                      />
                    </ListItemButton>
                  </ListItem>
                ))}
              </List>
            ) : (
              <Typography color="text.secondary">Ingen pågående kurs</Typography>
            )}
          </CardContent>
        </Card>
      </Grid>

      {/* Calendar Widget */}
      <Grid item xs={12} md={6}>
        <Card sx={{ height: '100%' }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Kalender
            </Typography>
            {calendarEvents.length > 0 ? (
              <List>
                {calendarEvents.slice(0, 3).map((event) => (
                  <ListItem key={event.id} disablePadding>
                    <ListItemButton>
                      <ListItemAvatar>
                        <Avatar
                          sx={{
                            bgcolor:
                              event.type === 'live_session' ? 'success.main' : 'warning.main'}}
                        >
                          {event.type === 'live_session' ? <VideoCall /> : <Assignment />}
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={event.title}
                        secondary={
                          <Typography variant="body2" color="text.secondary">
                            {event.startTime.toLocaleDateString('no-NO')} kl.{', '}
                            {event.startTime.toLocaleTimeString('no-NO', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </Typography>
                        }
                      />
                    </ListItemButton>
                  </ListItem>
                ))}
              </List>
            ) : (
              <Typography color="text.secondary">Ingen kommende arrangementer</Typography>
            )}
          </CardContent>
        </Card>
      </Grid>

      {/* To-dos & Feedback Widget */}
      <Grid item xs={12} md={6}>
        <Card sx={{ height: '100%' }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Oppgaver & Tilbakemelding
            </Typography>
            {assessments.length > 0 ? (
              <List>
                {assessments.slice(0, 3).map((assessment) => (
                  <ListItem key={assessment.id} disablePadding>
                    <ListItemButton>
                      <ListItemAvatar>
                        <Avatar
                          sx={{ bgcolor: assessment.submitted ? 'success.main' : 'warning.main' }}
                        >
                          {assessment.type === 'quiz' ? <Quiz /> : <Assignment />}
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={assessment.title}
                        secondary={
                          <Box>
                            <Typography variant="body2" color="text.secondary">
                              {assessment.courseTitle}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              Frist: {assessment.dueDate.toLocaleDateString('no-NO')}
                            </Typography>
                          </Box>
                        }
                      />
                    </ListItemButton>
                  </ListItem>
                ))}
              </List>
            ) : (
              <Typography color="text.secondary">Ingen oppgaver</Typography>
            )}
          </CardContent>
        </Card>
      </Grid>

      {/* Notes & Bookmarks Widget */}
      <Grid item xs={12} md={6}>
        <Card sx={{ height: '100%' }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Notater & Bokmerker
            </Typography>
            <Stack spacing={2}>
              <Button
                variant="outlined"
                startIcon={<Bookmark />}
                onClick={() => setShowSearch(true)}
                fullWidth
              >
                Vis alle bokmerker
              </Button>
              <Button
                variant="outlined"
                startIcon={<NoteIcon />}
                onClick={() => setShowSearch(true)}
                fullWidth
              >
                Vis alle notater
              </Button>
            </Stack>
          </CardContent>
        </Card>
      </Grid>

      {/* Certificates Widget */}
      <Grid item xs={12}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Sertifikater
            </Typography>
            <Stack direction="row" spacing={2}>
              <Button
                variant="outlined"
                startIcon={<CertificateIcon />}
                onClick={() => setShowSearch(true)}
              >
                Vis alle sertifikater
              </Button>
              <Button
                variant="outlined"
                startIcon={<Download />}
                onClick={() => setShowSearch(true)}
              >
                Last ned som PDF
              </Button>
            </Stack>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );

  // Instructor revenue state
  const [showPayoutDialog, setShowPayoutDialog] = useState(false);
  const [showPaymentSettingsDialog, setShowPaymentSettingsDialog] = useState(false);
  const [showFikenInvoiceDialog, setShowFikenInvoiceDialog] = useState(false);
  const [payoutAmount, setPayoutAmount] = useState(0);
  const [paymentSettingsForm, setPaymentSettingsForm] = useState({
    bankName: '',
    bankAccountNumber: '',
    bankAccountName: ', ',
    organizationNumber: ', ',
    preferredPayoutMethod: 'bank_transfer',
    minimumPayoutThreshold: 50000, // 500 NOK in øre
    autoPayoutEnabled: false,
  });

  // Check if instructor has Fiken integration
  const [hasFiken, setHasFiken] = useState(false);
  useEffect(() => {
    const checkFiken = async () => {
      try {
        const response = await fetch('/api/academy/revenue/fiken-status');
        if (response.ok) {
          const data = await response.json();
          setHasFiken(data.hasFiken);
        }
      } catch (error) {
        console.error('Error checking Fiken status:', error);
      }
    };
    checkFiken();
  }, []);

  const renderInstructorWidgets = () => (
    <Grid container spacing={3}>
      {/* 💰 Instructor Revenue Widget - NEW */}
      <Grid item xs={12} md={6}>
        <Card
          sx={{
            height: '100%',
            background: 'linear-gradient(135deg, #4caf50 0%, #2e7d32 100%)',
            color: 'white'}}
        >
          <CardContent>
            <Typography
              variant="h6"
              gutterBottom
              sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
            >
              <AttachMoney />
              Dine Inntekter
            </Typography>

            <Grid container spacing={2} sx={{ mb: 2 }}>
              <Grid item xs={6}>
                <Typography variant="body2" sx={{ opacity: 0.9 }}>
                  Total Tjent
                </Typography>
                <Typography variant="h4" sx={{ fontWeight: 700}}>
                  {((dashboardData?.instructorRevenue?.totalEarnings || 0) / 100).toLocaleString(
                    'nb-NO',
                  )}
                </Typography>
                <Typography variant="caption">NOK</Typography>
              </Grid>

              <Grid item xs={6}>
                <Typography variant="body2" sx={{ opacity: 0.9 }}>
                  Tilgjengelig
                </Typography>
                <Typography variant="h4" sx={{ fontWeight: 70, color: '#fff59d' }}>
                  {((dashboardData?.instructorRevenue?.pendingRevenue || 0) / 100).toLocaleString(
                    'nb-NO',
                  )}
                </Typography>
                <Typography variant="caption">NOK</Typography>
              </Grid>

              <Grid item xs={6}>
                <Typography variant="body2" sx={{ opacity: 0.9 }}>
                  Utbetalt
                </Typography>
                <Typography variant="h5">
                  {((dashboardData?.instructorRevenue?.paidOut || 0) / 100).toLocaleString('nb-NO')}{', '}
                  NOK
                </Typography>
              </Grid>

              <Grid item xs={6}>
                <Typography variant="body2" sx={{ opacity: 0.9 }}>
                  Denne Måned
                </Typography>
                <Typography variant="h5">
                  <TrendingUp sx={{ fontSize: 16, verticalAlign: 'middle', mr: 0.5 }} />
                  {(
                    (dashboardData?.instructorRevenue?.thisMonthEarnings || 0) / 100
                  ).toLocaleString('nb-NO')}{', '}
                  NOK
                </Typography>
              </Grid>
            </Grid>

            <Box sx={{ display: 'flex', gap: 1, flexDirection: 'column' }}>
              {/* Fiken Invoice Button (if instructor has Fiken) */}
              {hasFiken ? (
                <>
                  <Button
                    variant="contained"
                    fullWidth
                    disabled={(dashboardData?.instructorRevenue?.pendingRevenue || 0) < 50000}
                    onClick={() => {
                      setPayoutAmount(
                        (dashboardData?.instructorRevenue?.pendingRevenue || 0) / 100,
                      );
                      setShowFikenInvoiceDialog(true);
                    }}
                    sx={{
                      bgcolor: 'white',
                      color: '#2e7d32', '&:hover': { bgcolor: '#f1f1f1' }, '&:disabled': {
                        bgcolor: 'rgba(255,255,255,0.3)',
                        color: 'rgba(255,255,255,0.5)',
                      }}}
                  >
                    📄 Opprett Fiken Faktura
                  </Button>
                  <Chip
                    label="✅ Fiken Integrert - Profesjonell Fakturering"
                    size="small"
                    sx={{ bgcolor: 'rgba(255,255,255,0.3)', color: 'white', fontWeight: 600}}
                  />
                </>
              ) : (
                <Button
                  variant="contained"
                  fullWidth
                  disabled={(dashboardData?.instructorRevenue?.pendingRevenue || 0) < 50000}
                  onClick={() => {
                    setPayoutAmount((dashboardData?.instructorRevenue?.pendingRevenue || 0) / 100);
                    setShowPayoutDialog(true);
                  }}
                  sx={{
                    bgcolor: 'white',
                    color: '#2e7d32','&:hover': { bgcolor: '#f1f1f1' }, '&:disabled': {
                      bgcolor: 'rgba(255,255,255,0.3)',
                      color: 'rgba(255,255,255,0.5)',
                    }}}
                >
                  💸 Be om utbetaling
                </Button>
              )}

              <Button
                variant="outlined"
                fullWidth
                startIcon={<AccountBalance />}
                onClick={() => setShowPaymentSettingsDialog(true)}
                sx={{ borderColor: 'white', color: 'white' }}
              >
                Betalingsinnstillinger
              </Button>
            </Box>

            {(dashboardData?.instructorRevenue?.pendingRevenue || 0) < 50000 && (
              <Alert
                severity="info"
                sx={{ mt: 2, bgcolor: 'rgba(255,255,255,0.2)', color: 'white' }}
              >
                Minimum: 500 NOK
              </Alert>
            )}
          </CardContent>
        </Card>
      </Grid>

      {/* Teaching Overview Widget */}
      <Grid item xs={12} md={6}>
        <Card sx={{ height: '100%' }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Undervisningsoversikt
            </Typography>
            <Stack spacing={2}>
              <Box>
                <Typography variant="body2" color="text.secondary">
                  Aktive kurs
                </Typography>
                <Typography variant="h4">
                  {state.courses.filter((course: any) => course.status === 'active').length}
                </Typography>
              </Box>
              <Box>
                <Typography variant="body2" color="text.secondary">
                  Totalt antall studenter
                </Typography>
                <Typography variant="h4">{state.enrollments.length}</Typography>
              </Box>
              <Box>
                <Typography variant="body2" color="text.secondary">
                  Gjennomsnittlig vurdering
                </Typography>
                <Typography variant="h4">4.8/5.0</Typography>
              </Box>
              <Divider sx={{ my: 2 }} />
              <Button
                variant="outlined"
                fullWidth
                startIcon={<Groups />}
                onClick={() => {
                  // Get all published courses
                  const publishedCourses = state.courses.filter((c: any) => c.status === 'active' || c.isPublished);
                  if (publishedCourses.length > 0) {
                    // Don't pre-select a course - let user choose
                    setCourseToPublish(null);
                    setShowPublishToCommunityDialog(true);
                  } else {
                    alert('Du må ha minst ett publisert kurs for å dele til community');
                  }
                }}
              >
                Del Kurs til Community
              </Button>
            </Stack>
          </CardContent>
        </Card>
      </Grid>

      {/* Grading Queue Widget */}
      <Grid item xs={12} md={6}>
        <Card sx={{ height: '100%' }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Vurderingskø
            </Typography>
            {assessments.filter((a) => a.needsReview).length > 0 ? (
              <List>
                {assessments
                  .filter((a) => a.needsReview)
                  .slice(0, 3)
                  .map((assessment) => (
                    <ListItem key={assessment.id} disablePadding>
                      <ListItemButton>
                        <ListItemAvatar>
                          <Avatar sx={{ bgcolor: 'warning.main' }}>
                            <Grade />
                          </Avatar>
                        </ListItemAvatar>
                        <ListItemText
                          primary={assessment.title}
                          secondary={
                            <Typography variant="body2" color="text.secondary">
                              {assessment.courseTitle}
                            </Typography>
                          }
                        />
                      </ListItemButton>
                    </ListItem>
                  ))}
              </List>
            ) : (
              <Typography color="text.secondary">Ingen oppgaver som trenger vurdering</Typography>
            )}
          </CardContent>
        </Card>
      </Grid>

      {/* Q&A Widget */}
      <Grid item xs={12} md={6}>
        <Card sx={{ height: '100%' }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Spørsmål & Svar
            </Typography>
            <Stack spacing={2}>
              <Button
                variant="outlined"
                startIcon={<Chat />}
                onClick={() => setShowSearch(true)}
                fullWidth
              >
                Svar på spørsmål
              </Button>
              <Button
                variant="outlined"
                startIcon={<Forum />}
                onClick={() => setShowSearch(true)}
                fullWidth
              >
                Vis alle diskusjoner
              </Button>
            </Stack>
          </CardContent>
        </Card>
      </Grid>

      {/* Content Pipeline Widget */}
      <Grid item xs={12} md={6}>
        <Card sx={{ height: '100%' }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Innholdspipeline
            </Typography>
            {contentPipeline.length > 0 ? (
              <List>
                {contentPipeline.slice(0, 3).map((content) => (
                  <ListItem 
                    key={content.id} 
                    disablePadding
                    secondaryAction={
                      content.status === 'error' && (
                        <Tooltip title="Prøv igjen">
                          <IconButton 
                            edge="end" 
                            onClick={() => handleContentRetry(content.id)}
                            color="warning"
                          >
                            <History />
                          </IconButton>
                        </Tooltip>
                      )
                    }
                  >
                    <ListItemButton
                      onClick={() => {
                        if (content.type === 'video') {
                          handleVideoAnnotationEditorOpen(content);
                        }
                      }}
                    >
                      <ListItemAvatar>
                        <Avatar
                          sx={{
                            bgcolor:
                              content.status === 'completed' ? 'success.main' : 
                              content.status === 'error' ? 'error.main' : 'warning.main'}}
                        >
                          {content.type === 'video' ? <VideoLibrary /> : <Assignment />}
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={content.title}
                        secondary={
                          <Box>
                            <Typography variant="body2" color="text.secondary">
                              Status: {content.status}
                            </Typography>
                            <LinearProgress
                              variant={content.status === 'error' ? 'determinate' : 'determinate'}
                              value={content.progress}
                              color={content.status === 'error' ? 'error' : 'primary'}
                              sx={{ mt: 1, height: 4, borderRadius: 2 }}
                            />
                            {content.status === 'error' && content.errorMessage && (
                              <Typography variant="caption" color="error">
                                {content.errorMessage}
                              </Typography>
                            )}
                          </Box>
                        }
                      />
                    </ListItemButton>
                  </ListItem>
                ))}
              </List>
            ) : (
              <Typography color="text.secondary">Ingen innhold i pipeline</Typography>
            )}
          </CardContent>
        </Card>
      </Grid>

      {/* Course Post Analytics Widget */}
      <Grid item xs={12}>
        <CoursePostAnalyticsWidget />
      </Grid>

      {/* Engagement Radar Widget */}
      <Grid item xs={12}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Engasjementsradar
            </Typography>
            <Stack direction="row" spacing={2}>
              <Button
                variant="outlined"
                startIcon={<Analytics />}
                onClick={() => setShowSearch(true)}
              >
                Vis detaljert analytikk
              </Button>
              <Button
                variant="outlined"
                startIcon={<ShowChart />}
                onClick={() => setShowSearch(true)}
              >
                Vis engasjementsgrafer
              </Button>
            </Stack>
          </CardContent>
        </Card>
      </Grid>

      {/* Video Editing Tools Widget */}
      <Grid item xs={12} md={6}>
        <Card sx={{ height: '100%' }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Video Redigeringsverktøy
            </Typography>
            <Stack spacing={2}>
              <Button
                variant="outlined"
                startIcon={<Edit />}
                onClick={() =>
                  handleVideoAnnotationEditorOpen(
                    selectedVideoForEditing || { id: 'demo', title: 'Demo Video' },
                  )
                }
                fullWidth
                sx={{ justifyContent: 'flex-start' }}
              >
                Video Annotasjoner
              </Button>
              <Button
                variant="outlined"
                startIcon={<VideoLibrary />}
                onClick={() =>
                  handleVideoChapterManagerOpen(
                    selectedVideoForEditing || { id: 'demo', title: 'Demo Video' },
                  )
                }
                fullWidth
                sx={{ justifyContent: 'flex-start' }}
              >
                Kapitel Manager
              </Button>
              <Button
                variant="outlined"
                startIcon={<Theaters />}
                onClick={() => setShowLowerThirds(true)}
                fullWidth
                sx={{ justifyContent: 'flex-start' }}
              >
                Lower Thirds
              </Button>
              <Button
                variant="outlined"
                startIcon={<Add />}
                onClick={() => setShowCourseCreator(true)}
                fullWidth
                sx={{ justifyContent: 'flex-start' }}
              >
                CTA Overlays
              </Button>
            </Stack>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );

  // Handle lesson selection
  const handleLessonSelect = useCallback(
    (lesson: any) => {
      setSelectedLesson(lesson);
      setCurrentLesson(lesson);
      analytics.trackEvent('lesson_selected', {
        courseId: selectedCourse?.id,
        lessonId: lesson.id,
        lessonTitle: lesson.title,
        timestamp: Date.now(),
      });
    },
    [selectedCourse?.id, setCurrentLesson, analytics],
  );

  // Handle enrollment
  const handleEnroll = useCallback(
    async (course: any) => {
      try {
        await enrollInCourse(course.id);
        setShowEnrollmentDialog(false);
        setEnrollmentCourse(null);
        analytics.trackEvent('course_enrolled', {
          courseId: course.id,
          courseTitle: course.title,
          timestamp: Date.now(),
        });
      } catch (error) {
        console.error('Failed to enroll in course:', error);
      }
    },
    [enrollInCourse, analytics],
  );

  // Course categories
  const categories = [
    { id: 'all', name: 'All Courses', count: filteredCourses.length },
    {
      id: 'photography',
      name: 'Photography',
      count: filteredCourses.filter((c: any) => c.category === 'photography').length,
    },
    {
      id: 'videography',
      name: 'Videography',
      count: filteredCourses.filter((c: any) => c.category === 'videography').length,
    },
    {
      id: 'music_production',
      name: 'Music Production',
      count: filteredCourses.filter((c: any) => c.category === 'music_production').length,
    },
    {
      id: 'lighting',
      name: 'Lighting',
      count: filteredCourses.filter((c: any) => c.category === 'lighting').length,
    },
    {
      id: 'wedding',
      name: 'Wedding',
      count: filteredCourses.filter((c: any) => c.category === 'wedding').length,
    },
    {
      id: 'business',
      name: 'Business',
      count: filteredCourses.filter((c: any) => c.category === 'business').length,
    },
    {
      id: 'techniques',
      name: 'Techniques',
      count: filteredCourses.filter((c: any) => c.category === 'techniques').length,
    },
    {
      id: 'equipment',
      name: 'Equipment',
      count: filteredCourses.filter((c: any) => c.category === 'equipment').length,
    },
  ];

  // Subscriptions (instructors) - Demo data showing different professions
  const subscriptions = [
    {
      id: '1',
      name: 'Daniel Qazi Photography',
      avatar: '/avatars/daniel-qazi.jpg',
      profession: 'photographer',
    },
    {
      id: '2',
      name: 'CreatorHub Academy',
      avatar: '/avatars/creatorhub-academy.jpg',
      profession: 'videographer',
    },
    {
      id: '3',
      name: 'Michael Peters Music',
      avatar: '/avatars/michael-peters.jpg',
      profession: 'music_producer',
    },
    {
      id: '4',
      name: 'Arild Bergseth Lighting',
      avatar: '/avatars/arild-bergseth.jpg',
      profession: 'photographer',
    },
    {
      id: '5',
      name: 'Wedding Specialists',
      avatar: '/avatars/wedding-specialists.jpg',
      profession: 'videographer',
    },
  ];

  // Featured courses
  const featuredCourses = filteredCourses.slice(0, 2);

  // Courses to try
  const coursesToTry = filteredCourses.slice(2, 6);

  if (selectedCourse && selectedLesson) {
    return (
      <AcademyVideoPlayer
        course={selectedCourse}
        lesson={selectedLesson}
        onLessonComplete={() => {
          // Handle lesson completion
          analytics.trackEvent('lesson_completed', {
            courseId: selectedCourse.id,
            lessonId: selectedLesson.id,
            timestamp: Date.now(),
          });
        }}
        onNextLesson={() => {
          const currentIndex = selectedCourse.lessons.findIndex(
            (l: any) => l.id === selectedLesson.id,
          );
          if (currentIndex < selectedCourse.lessons.length - 1) {
            handleLessonSelect(selectedCourse.lessons[currentIndex + 1]);
          }
        }}
        onPreviousLesson={() => {
          const currentIndex = selectedCourse.lessons.findIndex(
            (l: any) => l.id === selectedLesson.id,
          );
          if (currentIndex > 0) {
            handleLessonSelect(selectedCourse.lessons[currentIndex - 1]);
          }
        }}
      />
    );
  }

  if (showCourseCreator) {
    return (
      <CourseCreator
        onSave={() => {
          setShowCourseCreator(false);
          analytics.trackEvent('course_creator_saved', {
            timestamp: Date.now(),
          });
        }}
        onCancel={() => setShowCourseCreator(false)}
      />
    );
  }

  return (
    <ErrorBoundary showDetails={true}>
      <LazyMotion features={domAnimation} strict>
        <Box sx={{ height: '100vh', display: 'flex', bgcolor: '#fafafa' }}>
      {/* Demo Mode Indicator */}
      {renderDemoModeIndicator()}

      {/* Authentication Status */}
      <Box
        sx={{
          position: 'fixed',
          top: 10,
          right: 10,
          zIndex: 100,
          bgcolor: 'background.paper',
          p: 1,
          borderRadius: 1,
          boxShadow: 2,
          border: 1,
          borderColor: 'divider'}}
      >
        <Typography variant="caption" sx={{ display: 'block', mb: 1, fontWeight: 'bold' }}>
          Google Auth Status:
        </Typography>
        <Typography
          variant="caption"
          sx={{ display: 'block', color: isAuthenticated ? 'success.main' : 'error.main' }}
        >
          {isAuthenticated ? '✅ Authenticated' : '❌ Not Authenticated'}
        </Typography>
        {auth.state.isLoading && (
          <Typography variant="caption" sx={{ display: 'block', color: 'warning.main' }}>
            🔄 Loading...
          </Typography>
        )}
        {auth.state.user && (
          <>
            <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary' }}>
              User: {auth.state.user.name}
            </Typography>
            <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary' }}>
              Role: {auth.state.user.role}
            </Typography>
            <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary' }}>
              Email: {auth.state.user.email}
            </Typography>
            {auth.state.user.role === 'admin' && (
              <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary' }}>
                Visual Editor: {hasVisualEditorAccess ? '✅' : '❌'}
              </Typography>
            )}
          </>
        )}
        {auth.state.error && (
          <Typography variant="caption" sx={{ display: 'block', color: 'error.main' }}>
            Error: {auth.state.error}
          </Typography>
        )}
        <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
          <Button
            size="small"
            variant="outlined"
            onClick={auth.login}
            disabled={auth.state.isLoading}
          >
            Login
          </Button>
          <Button
            size="small"
            variant="outlined"
            onClick={auth.logout}
            disabled={auth.state.isLoading}
          >
            Logout
          </Button>
        </Stack>
      </Box>

      {/* Left Navigation Drawer */}
      <Drawer
        variant="persistent"
        anchor="left"
        open={leftDrawerOpen}
        sx={{
          width: 280,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: 280,
            boxSizing: 'border-box',
            bgcolor: 'background.paper',
            borderRight: 1,
            borderColor: 'divider',
          }}}
      >
        <Toolbar>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, flexGrow: 1, minWidth: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              {React.cloneElement(professionIcon as any, {
                sx: { color: professionColor, fontSize: 22 }
              })}
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="subtitle1" component="div" sx={{ fontWeight: 800, lineHeight: 1.1 }} noWrap>
                CreatorHub Academy
              </Typography>
              <Typography variant="caption" color="text.secondary" noWrap>
                {professionDisplayName} • {adaptDashboardTitle()}
              </Typography>
            </Box>
          </Box>
          <IconButton onClick={() => setLeftDrawerOpen(!leftDrawerOpen)}>
            <ExpandLess />
          </IconButton>
        </Toolbar>
        <Divider />

        {/* Navigation Items */}
        <List>
          {navigationItems
            .filter((item) => item.roles.includes(auth.state.user?.role as UserRole))
            .map((item) => (
              <ListItem key={item.id} disablePadding>
                <ListItemButton
                  selected={activeNavItem === item.id}
                  onClick={() => handleNavigation(item.id)}
                  sx={{
                    '&.Mui-selected': {
                      bgcolor: 'primary.main',
                      color: 'primary.contrastText','&:hover': {
                        bgcolor: 'primary.dark',
                      },
                    }}}
                >
                  <ListItemIcon
                    sx={{ color: activeNavItem === item.id ? 'inherit' : 'text.primary' }}
                  >
                    {item.icon}
                  </ListItemIcon>
                  <ListItemText primary={item.label} />
                  {item.badge && <Badge badgeContent={item.badge} color="error" />}
                </ListItemButton>
              </ListItem>
            ))}
        </List>
        
        <Divider />
        
        {/* Categories Sidebar */}
        {renderCategoriesSidebar()}
      </Drawer>

      {/* Main Content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          display: 'flex',
          flexDirection: 'column',
          bgcolor: 'background.default',
          minHeight: '100vh'}}
      >
        {/* Top App Bar */}
        <AppBar
          position="static"
          elevation={0}
          sx={{ bgcolor: 'background.paper', borderBottom: 1, borderColor: 'divider' }}
        >
          <Toolbar>
            <IconButton
              edge="start"
              color="inherit"
              aria-label="toggle drawer"
              onClick={() => setLeftDrawerOpen(!leftDrawerOpen)}
              sx={{ mr: 2, color: 'text.primary' }}
            >
              <ExpandMore />
            </IconButton>

            {/* Global Search */}
            <TextField
              data-global-search
              placeholder="Søk i kurs, leksjoner, oppgaver..."
              variant="outlined"
              size="small"
              value={globalSearchQuery}
              onChange={(e) => handleGlobalSearch(e.target.value)}
              sx={{
                flexGrow: 1,
                maxWidth: 600,
                mr: 2,
                '& .MuiOutlinedInput-root': {
                  borderRadius: 2,
                }}}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search />
                  </InputAdornment>
                ),
                endAdornment: globalSearchQuery && (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => setGlobalSearchQuery('')}>
                      <Close />
                    </IconButton>
                  </InputAdornment>
                )}}
            />

            {/* Quick Actions */}
            <IconButton
              color="inherit"
              onClick={() => setQuickActionsOpen(true)}
              sx={{ mr: 1, color: 'text.primary' }}
            >
              <Add />
            </IconButton>

            {/* Notifications */}
            <IconButton
              color="inherit"
              onClick={() => setNotificationsOpen(true)}
              sx={{ mr: 1, color: 'text.primary' }}
            >
              <Badge badgeContent={unreadCount} color="error">
                <Notifications />
              </Badge>
            </IconButton>

            {/* Help / Tutorial */}
            <Tooltip title="Åpne Academy-guide">
              <IconButton
                color="inherit"
                onClick={() => setShowAcademyTutorial(true)}
                sx={{ mr: 1, color: 'text.primary' }}
              >
                <HelpOutline />
              </IconButton>
            </Tooltip>

            {/* Push Notifications */}
            {isSupported && (
              <Tooltip title="Push-varsler innstillinger">
                <IconButton
                  color="inherit"
                  onClick={() => setPushSettingsOpen(true)}
                  sx={{ color: pushEnabled ? 'primary.main' : 'text.primary' }}
                >
                  {pushEnabled ? <NotificationsActive /> : <Notifications />}
                </IconButton>
              </Tooltip>
            )}
            
            {/* User Profile */}
            <IconButton
              color="inherit"
              onClick={() => setShowGoogleLogin(true)}
              sx={{ color: 'text.primary' }}
            >
              <AccountCircle />
            </IconButton>
          </Toolbar>
        </AppBar>

        {/* Breadcrumbs */}
        <Box
          sx={{
            px: 3,
            py: 1,
            bgcolor: 'background.paper',
            borderBottom: 1,
            borderColor: 'divider'}}
        >
          <Breadcrumbs>
            <Link
              color="inherit"
              href="/academy"
              onClick={(e) => {
                e.preventDefault();
                handleNavigation('home');
              }}
            >
              Hjem
            </Link>
            {activeNavItem !== 'home' && (
              <Typography color="text.primary">
                {navigationItems.find((item) => item.id === activeNavItem)?.label}
              </Typography>
            )}
          </Breadcrumbs>
        </Box>

        {/* Main Content Area */}
        <Box sx={{ flexGrow: 1, p: 3, overflow: 'auto' }}>
          {activeNavItem === 'home' && (
            <Box>
              {/* Loading State */}
              {state.isLoading && renderLoadingState()}
              
              {/* Announcements Banner */}
              {announcements.length > 0 && (
                <Alert 
                  severity="info" 
                  sx={{ mb: 3 }}
                  icon={<Announcement />}
                >
                  <Typography variant="subtitle2">{announcements[0]?.title}</Typography>
                  <Typography variant="body2">{announcements[0]?.content}</Typography>
                </Alert>
              )}

              {/* Quick Stats Overview */}
              {!state.isLoading && renderQuickStats()}
              
              {/* Featured Courses */}
              {!state.isLoading && renderFeaturedSection()}
              
              {/* Courses to Try */}
              {!state.isLoading && renderCoursesToTry()}
              
              {/* Quiz Section */}
              {!state.isLoading && renderQuizSection()}

              {/* Role-based Dashboard */}
              {(auth.state.user?.role as string) === 'learner' && renderLearnerWidgets()}
              {(auth.state.user?.role as string) === 'instructor' && renderInstructorWidgets()}
              {auth.state.user?.role === 'admin' && (
                <Grid container spacing={3}>
                  {/* Admin Visual Editor Integration Panel */}
                  <Grid item xs={12}>
                    <Card
                      sx={{
                        bgcolor: hasVisualEditorAccess ? 'success.light' : 'warning.light',
                        border: 1,
                        borderColor: hasVisualEditorAccess ? 'success.main' : 'warning.main'}}
                    >
                      <CardContent>
                        <Box
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between'}}
                        >
                          <Box>
                            <Typography
                              variant="h6"
                              sx={{
                                color: hasVisualEditorAccess ? 'success.dark' : 'warning.dark',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 1}}
                            >
                              {hasVisualEditorAccess ? '✅' : '⚠️'}
                              Admin Tools - Visual Editor Integration
                            </Typography>
                            <Typography
                              variant="body2"
                              sx={{
                                color: hasVisualEditorAccess ? 'success.dark' : 'warning.dark',
                                mt: 1}}
                            >
                              {hasVisualEditorAccess
                                ? 'Full access to visual editor features. Create visual representations of Academy content.'
                                : visualEditorAccess.reason}
                            </Typography>
                          </Box>

                          {hasVisualEditorAccess && (
                            <Stack direction="row" spacing={1}>
                              <Button
                                variant="contained"
                                size="small"
                                onClick={handleOpenVisualEditor}
                                sx={{ bgcolor: 'primary.main' }}
                              >
                                Open Visual Editor
                              </Button>
                              <Button
                                variant="outlined"
                                size="small"
                                onClick={() =>
                                  handleCreateVisualCourse({
                                    id: 'demo-course',
                                    title: 'Demo Course',
                                    description: 'Created from Academy Dashboard',
                                    color: '#4caf50',
                                  })
                                }
                              >
                                Create Visual Course
                              </Button>
                            </Stack>
                          )}
                        </Box>

                        {hasVisualEditorAccess && (
                          <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
                            <Typography variant="body2">
                              Visual Elements: {visualEditor.state.totalElementsCount}
                            </Typography>
                            <Typography variant="body2">
                              Selected: {visualEditor.state.selectedElements.length}
                            </Typography>
                            <Button
                              size="small"
                              onClick={() => visualEditor.undo()}
                              disabled={!visualEditor.state.canUndo}
                            >
                              Undo
                            </Button>
                            <Button
                              size="small"
                              onClick={() => visualEditor.redo()}
                              disabled={!visualEditor.state.canRedo}
                            >
                              Redo
                            </Button>
                          </Box>
                        )}
                      </CardContent>
                    </Card>
                  </Grid>

                  <Grid item xs={12}>
                    <Typography variant="h4" gutterBottom>
                      Administrator Dashboard
                    </Typography>
                    <Typography variant="body1" color="text.secondary">
                      Administrasjonsverktøy og systemoversikt
                    </Typography>
                  </Grid>
                </Grid>
              )}
            </Box>
          )}

          {activeNavItem === 'courses' && (
            <Box>
              <Typography variant="h4" gutterBottom>
                Kurs
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                Utforsk og administrer kurs
              </Typography>
              {/* Course grid would go here */}
            </Box>
          )}

          {activeNavItem === 'modules' && (
            <Box>
              <Typography variant="h4" gutterBottom>
                Moduler
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                Organiser og administrer moduler
              </Typography>
              {/* Module management would go here */}
            </Box>
          )}

          {activeNavItem === 'lessons' && (
            <Box>
              <Typography variant="h4" gutterBottom>
                Leksjoner
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                Opprett og rediger leksjoner
              </Typography>
              {/* Lesson management would go here */}
            </Box>
          )}

          {activeNavItem === 'assessments' && (
            <Box>
              <Typography variant="h4" gutterBottom>
                Vurderinger
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                Administrer oppgaver og vurderinger
              </Typography>
              {/* Assessment management would go here */}
            </Box>
          )}

          {activeNavItem === 'library' && (
            <Box>
              <Typography variant="h4" gutterBottom>
                Bibliotek
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                Administrer ressurser og mediefiler
              </Typography>
              {/* Library management would go here */}
            </Box>
          )}

          {activeNavItem === 'cohorts' && (
            <Box>
              <Typography variant="h4" gutterBottom>
                Grupper
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                Administrer studentgrupper og kohorter
              </Typography>
              {/* Cohort management would go here */}
            </Box>
          )}

          {activeNavItem === 'analytics' && (
            <Box>
              <Typography variant="h4" gutterBottom>
                Analytikk
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                Se detaljert analytikk og rapporter
              </Typography>
              {/* Analytics dashboard would go here */}
            </Box>
          )}

          {activeNavItem === 'messages' && (
            <Box>
              <Typography variant="h4" gutterBottom>
                Publiserte Kursinnlegg
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                Administrer dine kursinnlegg i community
              </Typography>

              {publishedPosts.length === 0 ? (
                <Alert severity="info">
                  <Typography variant="body2">
                    Du har ikke publisert noen kurs til community ennå.
                  </Typography>
                  <Button
                    variant="outlined"
                    size="small"
                    sx={{ mt: 2 }}
                    onClick={() => {
                      const publishedCourses = state.courses.filter((c: any) => c.status === 'active' || c.isPublished);
                      if (publishedCourses.length > 0) {
                        setCourseToPublish(null);
                        setShowPublishToCommunityDialog(true);
                      } else {
                        alert('Du må publisere et kurs først');
                      }
                    }}
                  >
                    Publiser kurs nå
                  </Button>
                </Alert>
              ) : (
                <Grid container spacing={2}>
                  {publishedPosts.map((post) => (
                    <Grid item xs={12} md={6} key={post.id}>
                      <Card>
                        <CardContent>
                          <Stack spacing={2}>
                            <Box display="flex" alignItems="center" gap={2}>
                              {post.course_thumbnail && (
                                <Avatar
                                  src={post.course_thumbnail}
                                  variant="rounded"
                                  sx={{ width: 60, height: 60 }}
                                />
                              )}
                              <Box flex={1}>
                                <Typography variant="h6" gutterBottom>
                                  {post.course_title}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {post.channel_name}
                                </Typography>
                              </Box>
                            </Box>

                            <Typography variant="body2" color="text.secondary" noWrap>
                              {post.instructor_message}
                            </Typography>

                            <Box display="flex" gap={1} alignItems="center">
                              <Chip
                                label={`Publisert ${new Date(post.published_at).toLocaleDateString('nb-NO')}`}
                                size="small"
                              />
                              {post.edit_count > 0 && (
                                <Chip
                                  label={`Redigert ${post.edit_count}x`}
                                  size="small"
                                  color="warning"
                                />
                              )}
                              {post.views_count > 0 && (
                                <Chip
                                  label={`${post.views_count} visninger`}
                                  size="small"
                                  color="info"
                                />
                              )}
                            </Box>

                            <Box display="flex" gap={1}>
                              <Button
                                variant="outlined"
                                size="small"
                                startIcon={<Edit />}
                                onClick={() => {
                                  setEditingPost(post);
                                  setShowEditPostDialog(true);
                                }}
                              >
                                Rediger
                              </Button>
                              <Button
                                variant="text"
                                size="small"
                                onClick={() => {
                                  window.open(`/community?channel=${post.channel_id}`, '_blank');
                                }}
                              >
                                Vis i community
                              </Button>
                            </Box>
                          </Stack>
                        </CardContent>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              )}

              {/* Scheduled Posts Widget */}
              <Box mt={4}>
                <ScheduledPostsWidget />
              </Box>
            </Box>
          )}

          {activeNavItem === 'settings' && (
            <Box>
              <Typography variant="h4" gutterBottom>
                Innstillinger
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                Konfigurer systeminnstillinger
              </Typography>
              {/* Settings panel would go here */}
            </Box>
          )}
        </Box>
      </Box>

      {/* Right Drawer for additional tools */}
      <Drawer
        variant="persistent"
        anchor="right"
        open={rightDrawerOpen}
        sx={{
          width: 320,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: 320,
            boxSizing: 'border-box',
            bgcolor: 'background.paper',
            borderLeft: 1,
            borderColor: 'divider',
          }}}
      >
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Verktøy
          </Typography>
          <IconButton onClick={() => setRightDrawerOpen(!rightDrawerOpen)}>
            <ExpandLess />
          </IconButton>
        </Toolbar>
        <Divider />

        {/* Quick Tools */}
        <List>
          <ListItem disablePadding>
            <ListItemButton onClick={() => setShowAssetBrowser(true)}>
              <ListItemIcon>
                <VideoLibrary />
              </ListItemIcon>
              <ListItemText primary="Ressursbibliotek" />
            </ListItemButton>
          </ListItem>
          <ListItem disablePadding>
            <ListItemButton onClick={() => setShowSettingsPanel(true)}>
              <ListItemIcon>
                <Settings />
              </ListItemIcon>
              <ListItemText primary="Innstillinger" />
            </ListItemButton>
          </ListItem>
          <ListItem disablePadding>
            <ListItemButton onClick={() => setShowUniversalDashboard(true)}>
              <ListItemIcon>
                <Analytics />
              </ListItemIcon>
              <ListItemText primary="Universell Dashboard" />
            </ListItemButton>
          </ListItem>
        </List>
      </Drawer>

      {/* Floating Action Button */}
      <Fab
        color="primary"
        aria-label="add"
        sx={{
          position: 'fixed',
          bottom: 16,
          right: 16,
          zIndex: 100}}
        onClick={() => setQuickActionsOpen(true)}
      >
        <Add />
      </Fab>

      {/* Speed Dial for Quick Actions */}
      <SpeedDial
        ariaLabel="Quick Actions"
        sx={{ position: 'fixed', bottom: 16, right: 16, zIndex: 1001}}
        icon={<SpeedDialIcon />}
        open={quickActionsOpen}
        onClose={() => setQuickActionsOpen(false)}
        onOpen={() => setQuickActionsOpen(true)}
      >
        <SpeedDialAction
          icon={<School />}
          tooltipTitle="Opprett kurs"
          onClick={() => {
            setShowCourseCreator(true);
            setQuickActionsOpen(false);
          }}
        />
        <SpeedDialAction
          icon={<VideoLibrary />}
          tooltipTitle="Opprett modul"
          onClick={() => {
            setShowModuleManager(true);
            setQuickActionsOpen(false);
          }}
        />
        <SpeedDialAction
          icon={<Assignment />}
          tooltipTitle="Opprett leksjon"
          onClick={() => {
            setShowCourseCreator(true);
            setQuickActionsOpen(false);
          }}
        />
        <SpeedDialAction
          icon={<Upload />}
          tooltipTitle="Last opp ressurser"
          onClick={() => {
            setShowAssetBrowser(true);
            setQuickActionsOpen(false);
          }}
        />
        <SpeedDialAction
          icon={<Schedule />}
          tooltipTitle="Planlegg innhold"
          onClick={() => {
            handleNavigation('messages');
            setQuickActionsOpen(false);
          }}
        />
        <SpeedDialAction
          icon={<Check />}
          tooltipTitle="Marker som fullført"
          onClick={() => {
            if (selectedCourse) {
              handleAssessmentSubmit(selectedCourse.id);
            }
            setQuickActionsOpen(false);
          }}
        />
        <SpeedDialAction
          icon={<History />}
          tooltipTitle="Historikk"
          onClick={() => {
            handleNavigation('library');
            setQuickActionsOpen(false);
          }}
        />
        <SpeedDialAction
          icon={<TimelineIcon />}
          tooltipTitle="Tidslinje"
          onClick={() => {
            handleNavigation('analytics');
            setQuickActionsOpen(false);
          }}
        />
      </SpeedDial>

      {/* Course Context Menu */}
      {contextMenu && (
        <Dialog
          open={Boolean(contextMenu)}
          onClose={handleCloseContextMenu}
          maxWidth="xs"
          fullWidth
        >
          <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CourseIcon />
            {contextMenu.course?.title || 'Kursalternativer'}
          </DialogTitle>
          <DialogContent>
            <List>
              <ListItem disablePadding>
                <ListItemButton onClick={() => handleContextMenuAction('view_details', contextMenu.course)}>
                  <ListItemIcon><ViewDetailsIcon /></ListItemIcon>
                  <ListItemText primary="Vis detaljer" />
                </ListItemButton>
              </ListItem>
              <ListItem disablePadding>
                <ListItemButton onClick={() => handleContextMenuAction('edit_course', contextMenu.course)}>
                  <ListItemIcon><EditCourseIcon /></ListItemIcon>
                  <ListItemText primary="Rediger kurs" />
                </ListItemButton>
              </ListItem>
              <ListItem disablePadding>
                <ListItemButton onClick={() => handleContextMenuAction('share_course', contextMenu.course)}>
                  <ListItemIcon><ShareCourseIcon /></ListItemIcon>
                  <ListItemText primary="Del kurs" />
                </ListItemButton>
              </ListItem>
              <ListItem disablePadding>
                <ListItemButton onClick={() => handleContextMenuAction('copy_link', contextMenu.course)}>
                  <ListItemIcon><CopyLinkIcon /></ListItemIcon>
                  <ListItemText primary="Kopier lenke" />
                </ListItemButton>
              </ListItem>
              <ListItem disablePadding>
                <ListItemButton onClick={() => handleContextMenuAction('download_resources', contextMenu.course)}>
                  <ListItemIcon><DownloadResourcesIcon /></ListItemIcon>
                  <ListItemText primary="Last ned ressurser" />
                </ListItemButton>
              </ListItem>
              <ListItem disablePadding>
                <ListItemButton onClick={() => handleContextMenuAction('bookmark_course', contextMenu.course)}>
                  <ListItemIcon><BookmarkIcon /></ListItemIcon>
                  <ListItemText primary={isBookmarked(contextMenu.course?.id) ? 'Fjern bokmerke' : 'Legg til bokmerke'} />
                </ListItemButton>
              </ListItem>
              <Divider />
              <ListItem disablePadding>
                <ListItemButton onClick={() => handleContextMenuAction('toggle_visibility', contextMenu.course)}>
                  <ListItemIcon>{contextMenu.course?.isVisible ? <ToggleVisibilityOffIcon /> : <ToggleVisibilityIcon />}</ListItemIcon>
                  <ListItemText primary={contextMenu.course?.isVisible ? 'Skjul kurs' : 'Vis kurs'} />
                </ListItemButton>
              </ListItem>
              <ListItem disablePadding>
                <ListItemButton onClick={() => handleContextMenuAction('report_issue', contextMenu.course)}>
                  <ListItemIcon><ReportIssueIcon /></ListItemIcon>
                  <ListItemText primary="Rapporter problem" />
                </ListItemButton>
              </ListItem>
              <ListItem disablePadding>
                <ListItemButton onClick={() => handleContextMenuAction('delete_course', contextMenu.course)} sx={{ color: 'error.main' }}>
                  <ListItemIcon><DeleteCourseIcon sx={{ color: 'error.main' }} /></ListItemIcon>
                  <ListItemText primary="Slett kurs" />
                </ListItemButton>
              </ListItem>
            </List>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseContextMenu}>Lukk</Button>
          </DialogActions>
        </Dialog>
      )}

      {/* Enrollment Dialog */}
      <Dialog
        open={showEnrollmentDialog}
        onClose={() => {
          setShowEnrollmentDialog(false);
          setEnrollmentCourse(null);
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <StudentIcon />
          Meld deg på kurs
        </DialogTitle>
        <DialogContent>
          {enrollmentCourse ? (
            <Stack spacing={2}>
              <Typography variant="h6">{enrollmentCourse.title}</Typography>
              <Typography variant="body2" color="text.secondary">
                {enrollmentCourse.description}
              </Typography>
              <Alert severity="info">
                Ved å melde deg på dette kurset får du tilgang til alle leksjoner og ressurser.
              </Alert>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Chip label={enrollmentCourse.level || 'Alle nivåer'} size="small" />
                <Chip label={`${enrollmentCourse.lessons?.length || 0} leksjoner`} size="small" />
              </Box>
            </Stack>
          ) : (
            <Typography color="text.secondary">Velg et kurs for å melde deg på</Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setShowEnrollmentDialog(false);
            setEnrollmentCourse(null);
          }}>
            Avbryt
          </Button>
          <Button 
            variant="contained" 
            onClick={() => enrollmentCourse && handleEnroll(enrollmentCourse)}
            disabled={!enrollmentCourse}
          >
            Meld meg på
          </Button>
        </DialogActions>
      </Dialog>

      {/* Module Manager Dialog */}
      <Dialog
        open={showModuleManager}
        onClose={() => setShowModuleManager(false)}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <LessonIcon />
          Modulbehandling
        </DialogTitle>
        <DialogContent>
          <Typography variant="body1" color="text.secondary">
            Her kan du administrere moduler for dine kurs.
          </Typography>
          {completedCourses.length > 0 && (
            <Alert severity="success" sx={{ mt: 2 }}>
              Du har fullført {completedCourses.length} kurs!
            </Alert>
          )}
          {inProgressCourses.length > 0 && (
            <Alert severity="info" sx={{ mt: 2 }}>
              Du har {inProgressCourses.length} kurs under arbeid.
            </Alert>
          )}
          <Button 
            variant="outlined" 
            startIcon={<Add />}
            onClick={() => handleCreateVisualModule({ id: Date.now(), title: 'Ny modul', lessons: [] })}
            sx={{ mt: 2 }}
          >
            Opprett ny modul
          </Button>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowModuleManager(false)}>Lukk</Button>
        </DialogActions>
      </Dialog>

      {/* Lower Thirds Dialog */}
      <Dialog
        open={showLowerThirds}
        onClose={() => setShowLowerThirds(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Theaters />
          Lower Thirds & Grafikk
        </DialogTitle>
        <DialogContent>
          <Typography variant="body1" color="text.secondary">
            Legg til tekst-overlays og grafikk til dine videoer.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowLowerThirds(false)}>Lukk</Button>
        </DialogActions>
      </Dialog>

      {/* Search Dialog */}
      <Dialog
        open={showSearch}
        onClose={() => setShowSearch(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Search />
          Avansert søk
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2}>
            <TextField
              placeholder="Søk..."
              fullWidth
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search />
                  </InputAdornment>
                ),
              }}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <Chip label="Alle" onClick={() => setSortBy('newest')} />
              <Chip label="Nyeste" onClick={() => setSortBy('newest')} />
              <Chip label="Populære" onClick={() => setSortBy('popular')} />
              <Chip label="Gratis" onClick={() => setFilterPrice('free')} />
              <Chip label="Nybegynner" onClick={() => setFilterLevel('beginner')} />
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowSearch(false)}>Lukk</Button>
        </DialogActions>
      </Dialog>

      {/* Settings Dialog */}
      <Dialog
        open={showSettings}
        onClose={() => setShowSettings(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Settings />
          Innstillinger
        </DialogTitle>
        <DialogContent>
          <Typography variant="body1" color="text.secondary" gutterBottom>
            Tilpass dine preferanser for Academy.
          </Typography>
          <Typography variant="body2">
            Brukerprofesjon: {adaptDashboardTitle ? adaptDashboardTitle() || professionDisplayName : professionDisplayName}
          </Typography>
          <Typography variant="body2">
            Tabs: {adaptTabLabels ? Object.values(adaptTabLabels() || {}).slice(0, 3).join(', ') : 'Kurs, Moduler, Leksjoner'}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowSettings(false)}>Lukk</Button>
        </DialogActions>
      </Dialog>

      {/* Help Dialog (showHelp state) */}
      <Dialog
        open={showHelp}
        onClose={() => setShowHelp(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <HelpOutline />
          Hjelp
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2}>
            <Alert severity="info">
              Velkommen til CreatorHub Academy! Her finner du kurs og leksjoner for å utvikle dine ferdigheter.
            </Alert>
            <Typography variant="body2">
              • Bruk Cmd/Ctrl + K for hurtigsøk
            </Typography>
            <Typography variant="body2">
              • Høyreklikk på et kurs for flere alternativer
            </Typography>
            <Typography variant="body2">
              • Bruk + knappen for raske handlinger
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowHelp(false)}>Lukk</Button>
        </DialogActions>
      </Dialog>

      {/* Global Search Results Dialog */}
      <Dialog
        open={globalSearchOpen}
        onClose={() => setGlobalSearchOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Søkeresultater for "{globalSearchQuery}"</DialogTitle>
        <DialogContent>
          {globalSearchResults.length > 0 ? (
            <Box sx={{ height: 400 }}>
              <AnimatePresence>
                <Virtuoso
                  style={{ height: '100%' }}
                  data={globalSearchResults}
                  itemContent={(index, result) => (
                    <SearchResultItem
                      key={index}
                      result={{
                        ...result,
                        title: result.title || result.courseTitle,
                        description: result.description || result.courseTitle,
                        type: result.type || 'course'
                      }}
                      onClick={() => {}}
                    />
                  )}
                />
              </AnimatePresence>
            </Box>
          ) : (
            <Typography color="text.secondary">Ingen resultater funnet</Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setGlobalSearchOpen(false)}>Lukk</Button>
        </DialogActions>
      </Dialog>

      {/* Notifications Dialog */}
      <Dialog
        open={notificationsOpen}
        onClose={() => setNotificationsOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Meldinger</DialogTitle>
        <DialogContent>
          {communications.length > 0 ? (
            <Box sx={{ height: 400 }}>
              {state.isLoading ? (
                <Box>
                  {[...Array(5)].map((_, i) => (
                    <CommunicationItemSkeleton key={i} />
                  ))}
                </Box>
              ) : (
                <AnimatePresence>
                  <Virtuoso
                    style={{ height: '100%' }}
                    data={communications}
                    itemContent={(index, comm) => (
                      <CommunicationItemCard
                        key={comm.id}
                        item={comm}
                        onClick={() => handleMarkAsRead(comm.id)}
                      />
                    )}
                  />
                </AnimatePresence>
              )}
            </Box>
          ) : (
            <Typography color="text.secondary">Ingen nye meldinger</Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNotificationsOpen(false)}>Lukk</Button>
        </DialogActions>
      </Dialog>

      {/* Help Dialog */}
      <Dialog open={helpOpen} onClose={() => setHelpOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Hjelp & Støtte</DialogTitle>
        <DialogContent>
          <Stack spacing={2}>
            <Button 
              variant="outlined" 
              startIcon={<HelpOutline />} 
              fullWidth
              onClick={() => {
                setHelpOpen(false);
                setShowAcademyTutorial(true);
              }}
            >
              Vis Academy-guide
            </Button>
            <Button variant="outlined" startIcon={<Email />} fullWidth>
              Kontakt støtte
            </Button>
            <Button variant="outlined" startIcon={<Forum />} fullWidth>
              Felles forum
            </Button>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setHelpOpen(false)}>Lukk</Button>
        </DialogActions>
      </Dialog>

      {/* Google Login Dialog */}
      <Dialog
        open={showGoogleLogin}
        onClose={() => setShowGoogleLogin(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Logg inn med Google</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ py: 2 }}>
            <Button variant="outlined" startIcon={<AccountCircle />} fullWidth size="large">
              Logg inn med Google
            </Button>
            <Typography variant="body2" color="text.secondary" textAlign="center">
              Eller fortsett som gjest
            </Typography>
            <Button
              variant="text"
              fullWidth
              onClick={() => {
                // This would trigger the real authentication flow
                auth.login();
                setUserProfile({ name: 'Gjest', email: 'guest@example.com' });
                setShowGoogleLogin(false);
              }}
            >
              Fortsett som gjest
            </Button>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowGoogleLogin(false)}>Lukk</Button>
        </DialogActions>
      </Dialog>

      {/* Modals */}
      {showCourseCreator && (
        <CourseCreator
          onSave={() => {
            setShowCourseCreator(false);
            analytics.trackEvent('course_creator_saved', {
              timestamp: Date.now(),
              isDemoMode,
            });
          }}
          onCancel={() => setShowCourseCreator(false)}
        />
      )}

      {showAssetBrowser && <AcademyAssetBrowser onClose={() => setShowAssetBrowser(false)} />}

      {showSettingsPanel && <AcademySettingsPanel onClose={() => setShowSettingsPanel(false)} />}

      {showUniversalDashboard && (
        <Box
          sx={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 999,
            bgcolor: 'background.default'}}
        >
          <Box sx={{ position: 'absolute', top: 16, right: 16, zIndex: 10000}}>
            <Button
              variant="contained"
              startIcon={<ArrowBack />}
              onClick={() => setShowUniversalDashboard(false)}
              sx={{
                bgcolor: '#ff9800','&:hover': {
                  bgcolor: '#f57c00',
                }}}
            >
              TILBAKE TIL ACADEMY
            </Button>
          </Box>
          <UniversalDashboard profession={userProfession} />
        </Box>
      )}

      {/* Video Annotation Editor Dialog */}
      {showVideoAnnotationEditor && selectedVideoForEditing && (
        <Dialog
          open={showVideoAnnotationEditor}
          onClose={() => setShowVideoAnnotationEditor(false)}
          maxWidth="lg"
          fullWidth
          fullScreen
        >
          <DialogTitle>
            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <Typography variant="h6" sx={{ color: theming.colors.primary }}>
                Video Annotasjon Editor
              </Typography>
              <IconButton onClick={() => setShowVideoAnnotationEditor(false)}>
                <Close />
              </IconButton>
            </Stack>
          </DialogTitle>
          <DialogContent sx={{ p: 0 }}>
            {/* VideoAnnotationEditor component would go here */}
            <Box sx={{ p: 2 }}>
              <Typography variant="h6" gutterBottom>
                Video Annotation Editor
              </Typography>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Video: {selectedVideoForEditing.title}
              </Typography>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Annotations: {videoAnnotations.length}
              </Typography>
              <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
                <Button 
                  variant="outlined" 
                  startIcon={<Add />}
                  onClick={() => handleVideoAnnotationsChange([
                    ...videoAnnotations,
                    { id: Date.now(), text: 'Ny annotasjon', timestamp: 0 }
                  ])}
                >
                  Legg til annotasjon
                </Button>
                <Button 
                  variant="outlined" 
                  color="secondary"
                  onClick={() => handleVideoAnnotationsChange([])}
                >
                  Fjern alle
                </Button>
              </Stack>
              {videoAnnotations.length > 0 && (
                <List sx={{ mt: 2 }}>
                  {videoAnnotations.map((annotation, index) => (
                    <ListItem key={annotation.id || index}>
                      <ListItemText 
                        primary={annotation.text || `Annotasjon ${index + 1}`}
                        secondary={`Tidspunkt: ${annotation.timestamp || 0}s`}
                      />
                    </ListItem>
                  ))}
                </List>
              )}
            </Box>
          </DialogContent>
        </Dialog>
      )}

      {/* Video Chapter Manager Dialog */}
      {showVideoChapterManager && selectedVideoForEditing && (
        <Dialog
          open={showVideoChapterManager}
          onClose={() => setShowVideoChapterManager(false)}
          maxWidth="lg"
          fullWidth
          fullScreen
        >
          <DialogTitle>
            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <Typography variant="h6" sx={{ color: theming.colors.primary }}>
                Video Kapitel Manager
              </Typography>
              <IconButton onClick={() => setShowVideoChapterManager(false)}>
                <Close />
              </IconButton>
            </Stack>
          </DialogTitle>
          <DialogContent sx={{ p: 0 }}>
            {/* VideoChapterManager component would go here */}
            <Box sx={{ p: 2 }}>
              <Typography variant="h6" gutterBottom>
                Video Chapter Manager
              </Typography>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Video: {selectedVideoForEditing.title}
              </Typography>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Chapters: {videoChapters.length}
              </Typography>
              <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
                <Button 
                  variant="outlined" 
                  startIcon={<Add />}
                  onClick={() => handleVideoChaptersChange([
                    ...videoChapters,
                    { id: Date.now(), title: 'Nytt kapittel', startTime: 0 }
                  ])}
                >
                  Legg til kapittel
                </Button>
                <Button 
                  variant="outlined" 
                  color="secondary"
                  onClick={() => handleVideoChaptersChange([])}
                >
                  Fjern alle
                </Button>
              </Stack>
              {videoChapters.length > 0 && (
                <List sx={{ mt: 2 }}>
                  {videoChapters.map((chapter, index) => (
                    <ListItem key={chapter.id || index}>
                      <ListItemText 
                        primary={chapter.title || `Kapittel ${index + 1}`}
                        secondary={`Start: ${chapter.startTime || 0}s`}
                      />
                    </ListItem>
                  ))}
                </List>
              )}
            </Box>
          </DialogContent>
        </Dialog>
      )}

      {/* Floating Action Menu */}
      <AcademyFloatingActionMenu
        onCourseCreate={handleCourseCreate}
        onModuleCreate={handleModuleCreate}
        onLessonCreate={handleLessonCreate}
        onAssetBrowserOpen={handleAssetBrowserOpen}
        onLowerThirdsOpen={handleLowerThirdsOpen}
        onSearchOpen={handleSearchOpen}
        onSettingsOpen={handleSettingsOpen}
        onHelpOpen={handleHelpOpen}
        onQuickSave={handleQuickSave}
        onQuickPreview={handleQuickPreview}
        onQuickShare={handleQuickShare}
        onQuickExport={handleQuickExport}
      />

      {/* 📄 Fiken Invoice Dialog (Professional B2B invoicing) */}
      <Dialog
        open={showFikenInvoiceDialog}
        onClose={() => setShowFikenInvoiceDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>📄 Opprett Fiken Faktura til CreatorHub Norge</DialogTitle>
        <DialogContent>
          <Alert severity="success" sx={{ mb: 3 }}>
            <strong>✅ Fiken Integrert</strong> - Du kan opprette profesjonelle fakturaer
          </Alert>

          <Alert severity="info" sx={{ mb: 3 }}>
            Tilgjengelig saldo:{' '}
            <strong>
              {((dashboardData?.instructorRevenue?.pendingRevenue || 0) / 100).toLocaleString(
                'nb-NO',
              )}{' '}
              NOK
            </strong>
          </Alert>

          <TextField
            label="Beløp (NOK)"
            type="number"
            value={payoutAmount}
            onChange={(e) => setPayoutAmount(parseFloat(e.target.value))}
            fullWidth
            inputProps={{
              min: 500,
              max: (dashboardData?.instructorRevenue?.pendingRevenue || 0) / 100,
              step: 100}}
            helperText={`Minimum: 500 NOK, Maksimum: ${((dashboardData?.instructorRevenue?.pendingRevenue || 0) / 100).toLocaleString('nb-NO')} NOK`}
            sx={{ mb: 2 }}
          />

          <Alert severity="info" sx={{ mt: 2 }}>
            <strong>Hva skjer nå:</strong>
            <br />
            1. Faktura opprettes i din Fiken konto
            <br />
            2. Sendes automatisk til CreatorHub Norge AS
            <br />
            3. Betalingsfrist: 30 dager
            <br />
            4. Du får betaling direkte til din registrerte bankkonto i Fiken
          </Alert>

          <Box sx={{ mt: 2, p: 2, bgcolor: 'rgba(76,175,80,0.1)', borderRadius: 2 }}>
            <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
              Mottaker:
            </Typography>
            <Typography variant="body2">CreatorHub Norge AS</Typography>
            <Typography variant="body2">daniel@creatorhubn.com</Typography>
            <Typography variant="body2">Oslo, Norge</Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowFikenInvoiceDialog(false)}>Avbryt</Button>
          <Button
            variant="contained"
            onClick={async () => {
              try {
                // Create Fiken invoice via API
                const response = await fetch('/api/academy/revenue/request-payout-fiken', {
                  method: 'POST',
                  headers: { 'Content-Type' : 'application/json' },
                  body: JSON.stringify({
                    amount: payoutAmount * 100, // Convert to øre
                  }),
                });

                if (response.ok) {
                  const result = await response.json();
                  alert(
                    `✅ Fiken faktura opprettet!\n\nFakturanummer: ${result.fikenInvoice.invoiceNumber}\nBeløp: ${result.fikenInvoice.amount} NOK\n\nFakturaen er sendt til CreatorHub Norge. Betaling innen 30 dager.`,
                  );
                  setShowFikenInvoiceDialog(false);
                  setPayoutAmount(0);
                } else {
                  const errorData = await response.json();
                  alert(`❌ Feil: ${errorData.message || 'Kunne ikke opprette faktura'}`);
                }
              } catch {
                alert('❌ Nettverksfeil. Prøv igjen senere.');
              }
            }}
            disabled={
              payoutAmount < 500 ||
              payoutAmount > (dashboardData?.instructorRevenue?.pendingRevenue || 0) / 100
            }
            sx={{ bgcolor: '#4caf50', '&:hover': { bgcolor: '#2e7d32' } }}
          >
            📄 Opprett Faktura i Fiken
          </Button>
        </DialogActions>
      </Dialog>

      {/* 💸 Payout Request Dialog */}
      <Dialog
        open={showPayoutDialog}
        onClose={() => setShowPayoutDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>💸 Be om utbetaling</DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 3 }}>
            Tilgjengelig saldo:{', '}
            <strong>
              {((dashboardData?.instructorRevenue?.pendingRevenue || 0) / 100).toLocaleString(
                'nb-NO',
              )}{', '}
              NOK
            </strong>
          </Alert>

          <TextField
            label="Beløp (NOK)"
            type="number"
            value={payoutAmount}
            onChange={(e) => setPayoutAmount(parseFloat(e.target.value))}
            fullWidth
            inputProps={{
              min: 500,
              max: (dashboardData?.instructorRevenue?.pendingRevenue || 0) / 100,
              step: 100}}
            helperText={`Minimum: 500 NOK, Maksimum: ${((dashboardData?.instructorRevenue?.pendingRevenue || 0) / 100).toLocaleString('nb-NO')} NOK`}
            sx={{ mb: 2 }}
          />

          <Alert severity="warning" sx={{ mt: 2 }}>
            Forespørselen må godkjennes av administrator (daniel@creatorhubn.com) før utbetaling.
            Behandlingstid: 1-3 virkedager.
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowPayoutDialog(false)}>Avbryt</Button>
          <Button
            variant="contained"
            onClick={async () => {
              try {
                // Request payout via API
                const response = await fetch('/api/academy/revenue/request-payout', {
                  method: 'POST',
                  headers: { 'Content-Type' : 'application/json' },
                  body: JSON.stringify({
                    amount: payoutAmount * 100, // Convert to øre
                    method: 'bank_transfer',
                  }),
                });

                if (response.ok) {
                  alert('✅ Utbetalingsforespørsel sendt! Admin vil behandle den snart.');
                  setShowPayoutDialog(false);
                  setPayoutAmount(0);
                } else {
                  const errorData = await response.json();
                  alert(`❌ Feil: ${errorData.message || 'Kunne ikke sende forespørsel'}`);
                }
              } catch {
                alert('❌ Nettverksfeil. Prøv igjen senere.');
              }
            }}
            disabled={
              payoutAmount < 500 ||
              payoutAmount > (dashboardData?.instructorRevenue?.pendingRevenue || 0) / 100
            }
          >
            Send forespørsel
          </Button>
        </DialogActions>
      </Dialog>

      {/* ⚙️ Payment Settings Dialog */}
      <Dialog
        open={showPaymentSettingsDialog}
        onClose={() => setShowPaymentSettingsDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>⚙️ Betalingsinnstillinger</DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 3 }}>
            <Security sx={{ fontSize: 18, mr: 1, verticalAlign: 'middle' }} />
            Dine bankopplysninger krypteres og lagres sikkert. Kun administrasjonen kan godkjenne
            utbetalinger.
          </Alert>

          <Stack spacing={2} sx={{ mt: 2 }}>
            <TextField
              label="Bank"
              value={paymentSettingsForm.bankName}
              onChange={(e) =>
                setPaymentSettingsForm((prev) => ({ ...prev, bankName: e.target.value }))
              }
              placeholder="DNB, Nordea, Sparebank 1..."
              fullWidth
            />

            <TextField
              label="Kontonummer (11 siffer)"
              value={paymentSettingsForm.bankAccountNumber}
              onChange={(e) =>
                setPaymentSettingsForm((prev) => ({
                  ...prev,
                  bankAccountNumber: e.target.value,
                }))
              }
              placeholder="1234.56.78901"
              fullWidth
              helperText="Format: XXXX.XX.XXXXX (krypteres automatisk)"
            />

            <TextField
              label="Kontoinnehaver"
              value={paymentSettingsForm.bankAccountName}
              onChange={(e) =>
                setPaymentSettingsForm((prev) => ({
                  ...prev,
                  bankAccountName: e.target.value,
                }))
              }
              placeholder="Ditt Navn / Firmanavn AS"
              fullWidth
            />

            <TextField
              label="Organisasjonsnummer (valgfritt)"
              value={paymentSettingsForm.organizationNumber}
              onChange={(e) =>
                setPaymentSettingsForm((prev) => ({
                  ...prev,
                  organizationNumber: e.target.value,
                }))
              }
              placeholder="123456789"
              fullWidth
              helperText="Norsk organisasjonsnummer (9 siffer)"
            />

            <TextField
              label="Minimum utbetalingsbeløp (NOK)"
              type="number"
              value={paymentSettingsForm.minimumPayoutThreshold / 100}
              onChange={(e) =>
                setPaymentSettingsForm((prev) => ({
                  ...prev,
                  minimumPayoutThreshold: parseFloat(e.target.value) * 100,
                }))
              }
              fullWidth
              helperText="Du kan kun be om utbetaling når saldo overstiger dette beløpet"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowPaymentSettingsDialog(false)}>Avbryt</Button>
          <Button
            variant="contained"
            startIcon={<Save />}
            onClick={async () => {
              try {
                const response = await fetch('/api/academy/payment-settings', {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(paymentSettingsForm),
                });

                if (response.ok) {
                  alert('✅ Betalingsinnstillinger lagret!');
                  setShowPaymentSettingsDialog(false);
                } else {
                  const errorData = await response.json();
                  alert(`❌ Feil: ${errorData.message || 'Kunne ikke lagre innstillinger'}`);
                }
              } catch {
                alert('❌ Nettverksfeil. Prøv igjen senere.');
              }
            }}
          >
            Lagre innstillinger
          </Button>
        </DialogActions>
      </Dialog>

      {/* Publish to Community Dialog */}
      <PublishToCommunityDialog
        open={showPublishToCommunityDialog}
        onClose={() => {
          setShowPublishToCommunityDialog(false);
          setCourseToPublish(null);
        }}
        course={courseToPublish}
        allCourses={state.courses.filter((c: any) => c.status === 'active' || c.isPublished)}
        onSuccess={() => {
          // Refresh dashboard data or show success message
          console.log('Course published to community successfully');
          fetchPublishedPosts();
        }}
      />

      {/* Edit Post Dialog */}
      <EditPostDialog
        open={showEditPostDialog}
        onClose={() => {
          setShowEditPostDialog(false);
          setEditingPost(null);
        }}
        post={editingPost}
        onSuccess={() => {
          fetchPublishedPosts();
        }}
      />

      {/* Push Notification Settings Dialog */}
      {isSupported && (
        <Dialog open={pushSettingsOpen} onClose={() => setPushSettingsOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Push-varsler innstillinger</DialogTitle>
          <DialogContent>
            <Box sx={{ mt: 2 }}>
              <PushNotificationSettings userId={userId} showDescription={false} />
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setPushSettingsOpen(false)}>Lukk</Button>
          </DialogActions>
        </Dialog>
      )}

      {/* Academy Tutorial Modal */}
      <AcademyTutorial
        open={showAcademyTutorial}
        onClose={() => setShowAcademyTutorial(false)}
        profession={userProfession}
        professionName={professionDisplayName}
        defaultRole={localUserRole === 'instructor' ? 'instructor' : 'student'}
        onDismiss={() => setShowAcademyTutorial(false)}
      />
        </Box>
      </LazyMotion>
    </ErrorBoundary>
  );
}

export default withUniversalIntegration(AcademyDashboard, {
  componentId: 'academy-dashboard',
  componentName: 'Academy Dashboard',
  componentType: 'dashboard',
  componentCategory:'academy',
	  featureIds: ['academy-dashboard', 'analytics-academy'],
});
