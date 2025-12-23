import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Switch,
  FormControlLabel,
  Divider,
  Button,
  Alert,
  Snackbar,
  Grid,
  Chip,
  IconButton,
  Tooltip,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Slider,
  TextField,
  Tabs,
  Tab,
  Paper,
  Stack,
  RadioGroup,
  Radio,
  FormLabel,
} from '@mui/material';
import {
  Settings,
  Save,
  Refresh,
  Visibility,
  VisibilityOff,
  Download,
  Favorite,
  Comment,
  CheckCircle,
  Fullscreen,
  ViewModule,
  ViewList,
  ViewComfy,
  Search,
  FilterList,
  PhoneAndroid,
  Computer,
  Tablet,
  Speed,
  Palette,
  TouchApp,
  DataUsage,
  Security,
  Notifications,
  Tune,
  Edit,
  School,
  VideoLibrary,
  PlayArrow,
  Pause,
  Stop,
  VolumeUp,
  VolumeOff,
  Subtitles,
  Speed as SpeedIcon,
  AutoAwesome,
  Quiz,
  Assignment,
  Bookmark,
  Note,
  School as SchoolIcon,
  People,
  Business,
  Timeline,
  Assessment,
  Analytics,
  TrendingUp,
  Group,
  Person,
  BusinessCenter,
  ContentCopy,
  Sync,
  CloudUpload,
  CloudDownload,
  Flag,
  Star,
  StarBorder,
  BookmarkBorder,
  NotificationsActive,
  NotificationsOff,
  SearchOff,
  Sort,
  MoreVert,
  Info,
  Warning,
  Error,
  CheckCircle as CheckCircleIcon,
  Lock,
  LockOpen,
  Schedule,
  Timer,
  Group as GroupIcon,
  Person as PersonIcon,
  BusinessCenter as BusinessCenterIcon,
  Celebration as CelebrationIcon,
  AttachMoney,
  Update,
  Accessibility,
  Close,
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
	  ContentCreationIcon,
	  ProgressIcon,
	  QualityIcon,
	  SpeedIcon as CustomSpeedIcon,
	  SubtitlesIcon,
	  FullscreenIcon,
	  VolumeIcon,
	  MuteIcon,
	  AnnotationIcon,
	  ChapterIcon,
	  VideoProcessingIcon,
	  AnalyticsIcon as CustomAnalyticsIcon,
	} from '../shared/CreatorHubIcons';
import { useAuth } from '../../hooks/useAuth';
import { useFeatureFlag } from '../../hooks/useFeatureFlag';
import { useProfessionConfigs } from '../../hooks/useProfessionConfigs';
import { useProfessionAdapter } from '../../hooks/useProfessionAdapter';
import { useEnhancedMasterIntegration } from '../../integration/EnhancedMasterIntegrationProvider';
import { withUniversalIntegration } from '../../integration/UniversalIntegrationHOC';
import { useTheming } from '../../utils/theming-helper';
import { getProfessionIcon } from '../../utils/profession-icons';
import { usePushNotifications } from '../../hooks/usePushNotifications';
import { PushNotificationSettings } from '../shared/PushNotificationSettings';

interface AcademySettings {
  // Course Display
  showCourseThumbnails: boolean;
  showCourseProgress: boolean;
  showCourseDuration: boolean;
  showCourseDifficulty: boolean;
  showCourseRating: boolean;
  showCourseInstructor: boolean;
  showCoursePrice: boolean;
  showCourseEnrollmentCount: boolean;
  showCourseLastUpdated: boolean;
  compactCourseView: boolean;

  // Video Player
  videoPlayerTheme: 'dark' | 'light' | 'auto';
  showVideoControls: boolean;
  enableVideoAnnotations: boolean;
  enableVideoChapters: boolean;
  enableVideoSubtitles: boolean;
  enableVideoSpeedControl: boolean;
  enableVideoFullscreen: boolean;
  enableVideoTheaterMode: boolean;
  enableVideoPictureInPicture: boolean;
  autoPlayVideos: boolean;
  videoQuality: 'auto' | 'low' | 'medium' | 'high' | 'ultra';
  videoBufferSize: 'small' | 'medium' | 'large';

  // Learning Features
  enableBookmarks: boolean;
  enableNotes: boolean;
  enableHighlights: boolean;
  enableQuizzes: boolean;
  enableAssignments: boolean;
  enableCertificates: boolean;
  enableProgressTracking: boolean;
  enableLearningPaths: boolean;
  enableCollaboration: boolean;
  enableDiscussionForums: boolean;

  // Pedagogical Video Features
  enableInVideoQuizzes: boolean;
  enableCheckpoints: boolean;
  enableCallouts: boolean;
  enableNotesPanel: boolean;
  enableTranscriptPanel: boolean;
  enableAssignmentsFromVideo: boolean;
  enableDiscussionThreads: boolean;
  enableLearningGoals: boolean;
  enablePracticeMode: boolean;
  enableABLoop: boolean;
  enableConfidenceChecks: boolean;
  enableReflectionPrompts: boolean;
  enableInstructorAnnotations: boolean;
  enableWordLevelHighlighting: boolean;
  enableClickToSeek: boolean;
  enableTimestampedQandA: boolean;
  enableInstructorPinResolve: boolean;
  enablePrePostVideoGoals: boolean;
  enableKeyShortcuts: boolean;
  enableSlowerSpeedPractice: boolean;
  enableResourceDrawer: boolean;
  enableMultitrackAudio: boolean;
  enableMobileGestures: boolean;
  enableChapterNavigation: boolean;
  enableAutoChapterDetection: boolean;

  // Course Creation
  enableCourseTemplates: boolean;
  enableModuleTemplates: boolean;
  enableLessonTemplates: boolean;
  enableAssetLibrary: boolean;
  enableLowerThirds: boolean;
  enableVideoProcessing: boolean;
  enableAutoSave: boolean;
  enableVersionControl: boolean;
  enableDraftMode: boolean;
  enablePreviewMode: boolean;

  // Navigation & Layout
  sidebarPosition: 'left' | 'right' | 'hidden';
  sidebarWidth: 'narrow' | 'medium' | 'wide';
  showBreadcrumbs: boolean;
  showProgressBar: boolean;
  showSearchBar: boolean;
  showFilterBar: boolean;
  showSortOptions: boolean;
  defaultView: 'grid' | 'list' | 'timeline';
  itemsPerPage: 10 | 20 | 50 | 100;

  // Mobile Responsive
  mobileSidebarCollapse: boolean;
  mobileVideoControls: 'minimal' | 'full' | 'auto';
  mobileTouchGestures: boolean;
  mobileSwipeNavigation: boolean;
  mobileCompactMode: boolean;

  // Notifications
  courseUpdateNotifications: boolean;
  assignmentDueNotifications: boolean;
  discussionNotifications: boolean;
  achievementNotifications: boolean;
  systemNotifications: boolean;
  emailNotifications: boolean;
  pushNotifications: boolean;
  inAppNotifications: boolean;

  // Security & Privacy
  enableContentProtection: boolean;
  enableDownloadProtection: boolean;
  enableScreenRecordingProtection: boolean;
  enableWatermarking: boolean;
  watermarkPosition: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left' | 'center';
  watermarkText: string;
  watermarkOpacity: number;
  enableAccessControl: boolean;
  enableTimeBasedAccess: boolean;
  enableIPRestrictions: boolean;

  // Analytics & Tracking
  enableUsageAnalytics: boolean;
  enablePerformanceTracking: boolean;
  enableErrorTracking: boolean;
  enableUserBehaviorTracking: boolean;
  enableCourseAnalytics: boolean;
  enableInstructorAnalytics: boolean;
  enableStudentProgressTracking: boolean;

  // Advanced Features
  enableAIAssistance: boolean;
  enableAutoTranscription: boolean;
  enableAutoSubtitles: boolean;
  enableAutoChapters: boolean;
  enableAutoThumbnails: boolean;
  enableBulkOperations: boolean;
  enableKeyboardShortcuts: boolean;
  enableVoiceCommands: boolean;
  enableOfflineMode: boolean;
  enableSync: boolean;

  // Performance
  enableLazyLoading: boolean;
  enableImageOptimization: boolean;
  enableVideoOptimization: boolean;
  enableCaching: boolean;
  cacheDuration: '1h' | '1d' | '1w' | '1m';
  enableCDN: boolean;
  enableCompression: boolean;
  enablePreloading: boolean;

  // Accessibility
  enableScreenReader: boolean;
  enableHighContrast: boolean;
  enableLargeText: boolean;
  enableKeyboardNavigation: boolean;
  enableVoiceOver: boolean;
  enableClosedCaptions: boolean;
  enableAudioDescriptions: boolean;
  enableFocusIndicators: boolean;

  // Integration
  enableGoogleDrive: boolean;
  enableDropbox: boolean;
  enableOneDrive: boolean;
  enableYouTube: boolean;
  enableVimeo: boolean;
  enableZoom: boolean;
  enableSlack: boolean;
  enableMicrosoftTeams: boolean;
  enableLMSIntegration: boolean;
  enableSCORM: boolean;
  enablexAPI: boolean;

  // Storage & Backup
  showStorageUsage: boolean;
  showGoogleWorkspaceStorage: boolean;
  showStorageBreakdown: boolean;
  storageWarningThreshold: number; // Percentage (e.g., 80)
  enableAutoBackup: boolean;
  autoBackupFrequency: 'hourly' | 'daily' | 'weekly' | 'monthly';
  backupRetentionDays: number;
  enableIncrementalBackup: boolean;
  enableCloudBackup: boolean;
  enableLocalBackup: boolean;
  backupDestination: 'google-drive' | 'dropbox' | 'onedrive' | 'local';
  enableBackupNotifications: boolean;
  enableBackupEncryption: boolean;

  // Sync Settings
  enableAutoSync: boolean;
  syncFrequency: 'realtime' | 'every-5min' | 'hourly' | 'manual';
  syncGoogleDrive: boolean;
  syncGooglePhotos: boolean;
  syncGoogleContacts: boolean;
  syncCalendar: boolean;
  enableConflictResolution: boolean;
  conflictResolutionStrategy: 'keep-local' | 'keep-remote' | 'ask-user';
  enableSyncNotifications: boolean;
  enableOfflineSync: boolean;
  
  // Additional Settings
  defaultVideoQuality: 'auto' | '1080p' | '720p' | '480p';
  enableComments: boolean;
  enableLikes: boolean;
  courseDisplayMode: 'grid' | 'list' | 'compact';
  enablePrivacyMode: boolean;
}

const defaultSettings: AcademySettings = {
  // Course Display
  showCourseThumbnails: true,
  showCourseProgress: true,
  showCourseDuration: true,
  showCourseDifficulty: true,
  showCourseRating: true,
  showCourseInstructor: true,
  showCoursePrice: true,
  showCourseEnrollmentCount: true,
  showCourseLastUpdated: true,
  compactCourseView: false,

  // Video Player
  videoPlayerTheme: 'dark',
  showVideoControls: true,
  enableVideoAnnotations: true,
  enableVideoChapters: true,
  enableVideoSubtitles: true,
  enableVideoSpeedControl: true,
  enableVideoFullscreen: true,
  enableVideoTheaterMode: true,
  enableVideoPictureInPicture: true,
  autoPlayVideos: false,
  videoQuality: 'auto',
  videoBufferSize: 'medium',

  // Learning Features
  enableBookmarks: true,
  enableNotes: true,
  enableHighlights: true,
  enableQuizzes: true,
  enableAssignments: true,
  enableCertificates: true,
  enableProgressTracking: true,
  enableLearningPaths: true,
  enableCollaboration: true,
  enableDiscussionForums: true,

  // Pedagogical Video Features
  enableInVideoQuizzes: true,
  enableCheckpoints: true,
  enableCallouts: true,
  enableNotesPanel: true,
  enableTranscriptPanel: true,
  enableAssignmentsFromVideo: true,
  enableDiscussionThreads: true,
  enableLearningGoals: true,
  enablePracticeMode: true,
  enableABLoop: true,
  enableConfidenceChecks: true,
  enableReflectionPrompts: true,
  enableInstructorAnnotations: true,
  enableWordLevelHighlighting: true,
  enableClickToSeek: true,
  enableTimestampedQandA: true,
  enableInstructorPinResolve: true,
  enablePrePostVideoGoals: true,
  enableKeyShortcuts: true,
  enableSlowerSpeedPractice: true,
  enableResourceDrawer: true,
  enableMultitrackAudio: true,
  enableMobileGestures: true,
  enableChapterNavigation: true,
  enableAutoChapterDetection: true,

  // Course Creation
  enableCourseTemplates: true,
  enableModuleTemplates: true,
  enableLessonTemplates: true,
  enableAssetLibrary: true,
  enableLowerThirds: true,
  enableVideoProcessing: true,
  enableAutoSave: true,
  enableVersionControl: true,
  enableDraftMode: true,
  enablePreviewMode: true,

  // Navigation & Layout
  sidebarPosition: 'left',
  sidebarWidth: 'medium',
  showBreadcrumbs: true,
  showProgressBar: true,
  showSearchBar: true,
  showFilterBar: true,
  showSortOptions: true,
  defaultView: 'grid',
  itemsPerPage: 20,

  // Mobile Responsive
  mobileSidebarCollapse: true,
  mobileVideoControls: 'auto',
  mobileTouchGestures: true,
  mobileSwipeNavigation: true,
  mobileCompactMode: false,

  // Notifications
  courseUpdateNotifications: true,
  assignmentDueNotifications: true,
  discussionNotifications: true,
  achievementNotifications: true,
  systemNotifications: true,
  emailNotifications: true,
  pushNotifications: true,
  inAppNotifications: true,

  // Security & Privacy
  enableContentProtection: true,
  enableDownloadProtection: false,
  enableScreenRecordingProtection: false,
  enableWatermarking: false,
  watermarkPosition: 'bottom-right',
  watermarkText: 'CreatorHub Academy',
  watermarkOpacity: 0.7,
  enableAccessControl: true,
  enableTimeBasedAccess: false,
  enableIPRestrictions: false,

  // Analytics & Tracking
  enableUsageAnalytics: true,
  enablePerformanceTracking: true,
  enableErrorTracking: true,
  enableUserBehaviorTracking: true,
  enableCourseAnalytics: true,
  enableInstructorAnalytics: true,
  enableStudentProgressTracking: true,

  // Advanced Features
  enableAIAssistance: true,
  enableAutoTranscription: true,
  enableAutoSubtitles: true,
  enableAutoChapters: true,
  enableAutoThumbnails: true,
  enableBulkOperations: true,
  enableKeyboardShortcuts: true,
  enableVoiceCommands: false,
  enableOfflineMode: false,
  enableSync: true,

  // Performance
  enableLazyLoading: true,
  enableImageOptimization: true,
  enableVideoOptimization: true,
  enableCaching: true,
  cacheDuration: '1d',
  enableCDN: false,
  enableCompression: true,
  enablePreloading: true,

  // Accessibility
  enableScreenReader: true,
  enableHighContrast: false,
  enableLargeText: false,
  enableKeyboardNavigation: true,
  enableVoiceOver: false,
  enableClosedCaptions: true,
  enableAudioDescriptions: false,
  enableFocusIndicators: true,

  // Integration
  enableGoogleDrive: true,
  enableDropbox: false,
  enableOneDrive: false,
  enableYouTube: true,
  enableVimeo: true,
  enableZoom: false,
  enableSlack: false,
  enableMicrosoftTeams: false,
  enableLMSIntegration: false,
  enableSCORM: false,
  enablexAPI: false,

  // Storage & Backup
  showStorageUsage: true,
  showGoogleWorkspaceStorage: true,
  showStorageBreakdown: true,
  storageWarningThreshold: 80,
  enableAutoBackup: true,
  autoBackupFrequency: 'daily',
  backupRetentionDays: 30,
  enableIncrementalBackup: true,
  enableCloudBackup: true,
  enableLocalBackup: false,
  backupDestination: 'google-drive',
  enableBackupNotifications: true,
  enableBackupEncryption: true,

  // Sync Settings
  enableAutoSync: true,
  syncFrequency: 'every-5min',
  syncGoogleDrive: true,
  syncGooglePhotos: true,
  syncGoogleContacts: false,
  syncCalendar: false,
  enableConflictResolution: true,
  conflictResolutionStrategy: 'ask-user',
  enableSyncNotifications: true,
  enableOfflineSync: false,
  
  // Additional Settings
  defaultVideoQuality: 'auto',
  enableComments: true,
  enableLikes: true,
  courseDisplayMode: 'grid',
  enablePrivacyMode: false,
};

interface AcademySettingsPanelProps {
  onClose?: () => void;
}

export function AcademySettingsPanel({ onClose }: AcademySettingsPanelProps) {
  const { user } = useAuth();
  const { professionConfigs: apiProfessionConfigs } = useProfessionConfigs();
  const professionAdapter = useProfessionAdapter();
  const currentProfession = user?.profession || professionAdapter.profession || 'music_producer';
  const enhancedProfessionConfig = apiProfessionConfigs?.[currentProfession];
  const professionDisplayName =
    enhancedProfessionConfig?.displayName || enhancedProfessionConfig?.name || currentProfession;
  const professionColor = enhancedProfessionConfig?.color || '#ff8c00';
  const professionIcon = getProfessionIcon(currentProfession);

  const [settings, setSettings] = useState<AcademySettings>(defaultSettings);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  
  // Push notifications
  const userId = user?.id ?? (user as any)?.sub;
  const { pushEnabled, isSupported } = usePushNotifications(userId);

  // Master Integration Provider
  const { analytics, performance, debugging, features } = useEnhancedMasterIntegration();

  // Theming system
  const theming = useTheming(currentProfession);

  // Feature flags
  const aiAssistanceFlag = useFeatureFlag('ai-assistance');
  
  // Comprehensive Feature System - using feature flags and integration
  const isAIAssistanceEnabled = aiAssistanceFlag || features.checkFeatureAccess('ai-assistance');
  const isVideoProcessingEnabled = features.checkFeatureAccess('video-processing');
  const isAnalyticsEnabled = features.checkFeatureAccess('analytics');
  const isIntegrationEnabled = features.checkFeatureAccess('integrations');
  
  // Track component performance
  useEffect(() => {
    const endTiming = performance.startTiming('academy_settings_render');
    
    debugging.logIntegration('info', 'AcademySettingsPanel mounted', {
      pushEnabled,
      isSupported,
      isAIAssistanceEnabled,
      isVideoProcessingEnabled,
      isAnalyticsEnabled,
      isIntegrationEnabled,
    });
    
    return () => {
      endTiming();
    };
  }, [performance, debugging, pushEnabled, isSupported, isAIAssistanceEnabled, isVideoProcessingEnabled, isAnalyticsEnabled, isIntegrationEnabled]);

  // Load settings from localStorage on mount
  useEffect(() => {
    const savedSettings =
      localStorage.getItem('academy-settings');
    if (savedSettings) {
      try {
        setSettings({ ...defaultSettings, ...JSON.parse(savedSettings) });
      } catch (error) {
        console.error('Failed to load academy settings: ', error);
      }
    }

    // Track feature usage
    analytics.trackEvent('academy_settings_opened', {
      timestamp: Date.now(),
      userId: user?.id,
      component: 'AcademySettingsPanel',
    });
  }, []);

  // Generic change handler for settings
  const handleChange = <K extends keyof AcademySettings>(key: K, value: AcademySettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  // Save settings to localStorage
  const saveSettings = async () => {
    setLoading(true);
    try {
      localStorage.setItem('academy-settings', JSON.stringify(settings));

      // Also save to server if user is authenticated
      if (user?.id) {
        await fetch('/api/user/settings/academy', {
          method: 'POST',
          headers: {
            'Content-Type' : 'application/json',
            Authorization: `Bearer ${localStorage.getItem('authToken')}`,
          },
          body: JSON.stringify({
            userId: user?.id,
            settings,
          }),
        });
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      console.error('Failed to save settings: ', error);
    } finally {
      setLoading(false);
    }
  };

  // Reset to defaults
  const resetSettings = () => {
    setSettings(defaultSettings);
  };

  // Update individual setting
  const updateSetting = (key: keyof AcademySettings, value: any) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const tabs = [
    { label: 'Kursvisning', icon: <SchoolIcon />, value: 0 },
    { label: 'Video Spiller', icon: <PlayArrow />, value: 1 },
    { label: 'Læring', icon: <Bookmark />, value: 2 },
    { label: 'Pedagogiske Verktøy', icon: <Quiz />, value: 3 },
    { label: 'Kurs Opprettelse', icon: <Assignment />, value: 4 },
    { label: 'Navigasjon', icon: <ViewModule />, value: 5 },
    { label: 'Mobil', icon: <PhoneAndroid />, value: 6 },
    { label: 'Varsler', icon: <Notifications />, value: 7 },
    { label: 'Sikkerhet', icon: <Security />, value: 8 },
    { label: 'Analytikk', icon: <Analytics />, value: 9 },
    { label: 'Avansert', icon: <Settings />, value: 10 },
    { label: 'Ytelse', icon: <Speed />, value: 11 },
    { label: 'Tilgjengelighet', icon: <Accessibility />, value: 12 },
    { label: 'Integrasjon', icon: <Sync />, value: 13 },
    { label: 'Lagring & Backup', icon: <CloudUpload />, value: 14 },
  ];

  // Render feature status section using unused icons
  const renderFeatureStatus = () => (
    <Paper sx={{ p: 2, mb: 2 }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
        <AcademyIcon sx={{ color: theming.colors.primary }} />
        <Typography variant="h6">Feature Status</Typography>
        <Box sx={{ flexGrow: 1 }} />
        <Tooltip title="More options">
          <IconButton size="small"><MoreVert /></IconButton>
        </Tooltip>
      </Stack>
      
      <Grid container spacing={2}>
        <Grid item xs={6} sm={3}>
          <Stack alignItems="center" spacing={1}>
            {isAIAssistanceEnabled ? <CheckCircle color="success" /> : <Error color="error" />}
            <Typography variant="caption">AI Assistance</Typography>
          </Stack>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Stack alignItems="center" spacing={1}>
            {isVideoProcessingEnabled ? <CheckCircleIcon color="success" /> : <Warning color="warning" />}
            <Typography variant="caption">Video Processing</Typography>
          </Stack>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Stack alignItems="center" spacing={1}>
            {isAnalyticsEnabled ? <CustomAnalyticsIcon sx={{ color: 'success.main' }} /> : <Info color="info" />}
            <Typography variant="caption">Analytics</Typography>
          </Stack>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Stack alignItems="center" spacing={1}>
            {isIntegrationEnabled ? <Sync color="success" /> : <SearchOff color="disabled" />}
            <Typography variant="caption">Integrations</Typography>
          </Stack>
        </Grid>
      </Grid>
    </Paper>
  );
  
  // Render video player settings using unused icons
  const renderVideoPlayerSettings = () => (
    <Paper sx={{ p: 2, mb: 2 }}>
      <FormLabel component="legend" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
        <VideoPlayerIcon /> Video Player Settings
      </FormLabel>
      
      <RadioGroup value={settings.defaultVideoQuality} onChange={(e) => handleChange('defaultVideoQuality', e.target.value as 'auto' | '1080p' | '720p' | '480p')}>
        <FormControlLabel value="auto" control={<Radio />} label={<Stack direction="row" spacing={1} alignItems="center"><AutoAwesome fontSize="small" /><span>Auto Quality</span></Stack>} />
        <FormControlLabel value="1080p" control={<Radio />} label={<Stack direction="row" spacing={1} alignItems="center"><QualityIcon /><span>1080p HD</span></Stack>} />
        <FormControlLabel value="720p" control={<Radio />} label={<Stack direction="row" spacing={1} alignItems="center"><SpeedIcon fontSize="small" /><span>720p (Faster)</span></Stack>} />
      </RadioGroup>
      
      <Divider sx={{ my: 2 }} />
      
      <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
        <Chip icon={<PlayArrow />} label="Play" size="small" />
        <Chip icon={<Pause />} label="Pause" size="small" />
        <Chip icon={<Stop />} label="Stop" size="small" />
        <Chip icon={<VolumeUp />} label={<VolumeIcon />} size="small" />
        <Chip icon={<VolumeOff />} label={<MuteIcon />} size="small" />
        <Chip icon={<Subtitles />} label={<SubtitlesIcon />} size="small" />
        <Chip icon={<Fullscreen />} label={<FullscreenIcon />} size="small" />
      </Stack>
      
      <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
        <Chip icon={<AnnotationIcon />} label="Annotations" variant="outlined" size="small" />
        <Chip icon={<ChapterIcon />} label="Chapters" variant="outlined" size="small" />
        <Chip icon={<VideoProcessingIcon />} label="Processing" variant="outlined" size="small" />
      </Stack>
    </Paper>
  );
  
  // Render course settings using unused icons
  const renderCourseSettings = () => (
    <Paper sx={{ p: 2, mb: 2 }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
        <CourseIcon />
        <Typography variant="subtitle1">Course Settings</Typography>
        <Box sx={{ flexGrow: 1 }} />
        <IconButton size="small" onClick={() => handleChange('showCourseThumbnails', !settings.showCourseThumbnails)}>
          {settings.showCourseThumbnails ? <Visibility /> : <VisibilityOff />}
        </IconButton>
      </Stack>
      
      <Grid container spacing={2}>
        <Grid item xs={6}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <LessonIcon />
            <Typography variant="body2">Lessons</Typography>
          </Stack>
        </Grid>
        <Grid item xs={6}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <LearningPathIcon />
            <Typography variant="body2">Learning Paths</Typography>
          </Stack>
        </Grid>
        <Grid item xs={6}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <ContentCreationIcon />
            <Typography variant="body2">Content Creation</Typography>
          </Stack>
        </Grid>
        <Grid item xs={6}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <CertificateIcon />
            <Typography variant="body2">Certificates</Typography>
          </Stack>
        </Grid>
      </Grid>
    </Paper>
  );
  
  // Render interaction settings using unused icons
  const renderInteractionSettings = () => (
    <Paper sx={{ p: 2, mb: 2 }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
        <TouchApp sx={{ color: theming.colors.primary }} />
        <Typography variant="subtitle1">Interaction Settings</Typography>
        <Box sx={{ flexGrow: 1 }} />
        <Tooltip title="Edit settings">
          <IconButton size="small"><Edit /></IconButton>
        </Tooltip>
        <Tooltip title="Tune preferences">
          <IconButton size="small"><Tune /></IconButton>
        </Tooltip>
      </Stack>
      
      <Stack spacing={2}>
        <FormControlLabel 
          control={<Switch checked={settings.enableComments} onChange={(e) => handleChange('enableComments', e.target.checked)} />}
          label={<Stack direction="row" spacing={1} alignItems="center"><Comment fontSize="small" /><span>Enable Comments</span></Stack>}
        />
        <FormControlLabel 
          control={<Switch checked={settings.enableLikes} onChange={(e) => handleChange('enableLikes', e.target.checked)} />}
          label={<Stack direction="row" spacing={1} alignItems="center"><Favorite fontSize="small" /><span>Enable Likes</span></Stack>}
        />
        <FormControlLabel 
          control={<Switch checked={settings.enableBookmarks} onChange={(e) => handleChange('enableBookmarks', e.target.checked)} />}
          label={<Stack direction="row" spacing={1} alignItems="center"><BookmarkBorder fontSize="small" /><span>Enable Bookmarks</span></Stack>}
        />
        <FormControlLabel 
          control={<Switch checked={settings.enableNotes} onChange={(e) => handleChange('enableNotes', e.target.checked)} />}
          label={<Stack direction="row" spacing={1} alignItems="center"><Note fontSize="small" /><span>Enable Notes</span></Stack>}
        />
      </Stack>
    </Paper>
  );
  
  // Render display settings using unused icons
  const renderDisplaySettings = () => (
    <Paper sx={{ p: 2, mb: 2 }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
        <Palette sx={{ color: theming.colors.primary }} />
        <Typography variant="subtitle1">Display Settings</Typography>
        <Box sx={{ flexGrow: 1 }} />
        <IconButton size="small"><FilterList /></IconButton>
        <IconButton size="small"><Sort /></IconButton>
        <IconButton size="small"><Search /></IconButton>
      </Stack>
      
      <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
        <Chip 
          icon={<ViewModule />} 
          label="Grid" 
          variant={settings.courseDisplayMode === 'grid' ? 'filled' : 'outlined'}
          onClick={() => handleChange('courseDisplayMode', 'grid')}
        />
        <Chip 
          icon={<ViewList />} 
          label="List" 
          variant={settings.courseDisplayMode === 'list' ? 'filled' : 'outlined'}
          onClick={() => handleChange('courseDisplayMode', 'list')}
        />
        <Chip 
          icon={<ViewComfy />} 
          label="Compact" 
          variant={settings.courseDisplayMode === 'compact' ? 'filled' : 'outlined'}
          onClick={() => handleChange('courseDisplayMode', 'compact')}
        />
      </Stack>
      
      <Divider sx={{ my: 2 }} />
      
      <Typography variant="caption" color="text.secondary" gutterBottom>Device Previews</Typography>
      <Stack direction="row" spacing={2} sx={{ mt: 1 }}>
        <Tooltip title="Desktop View"><IconButton><Computer /></IconButton></Tooltip>
        <Tooltip title="Tablet View"><IconButton><Tablet /></IconButton></Tooltip>
        <Tooltip title="Mobile View"><IconButton><PhoneAndroid /></IconButton></Tooltip>
      </Stack>
    </Paper>
  );
  
  // Render analytics settings using unused icons
  const renderAnalyticsSettings = () => (
    <Paper sx={{ p: 2, mb: 2 }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
        <Analytics sx={{ color: theming.colors.primary }} />
        <Typography variant="subtitle1">Analytics & Insights</Typography>
        <Box sx={{ flexGrow: 1 }} />
        <Chip icon={<DataUsage />} label="Usage" size="small" />
      </Stack>
      
      <Grid container spacing={2}>
        <Grid item xs={6} sm={3}>
          <Stack alignItems="center" spacing={1}>
            <TrendingUp color="success" />
            <Typography variant="caption">Trends</Typography>
          </Stack>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Stack alignItems="center" spacing={1}>
            <Timeline color="primary" />
            <Typography variant="caption">Timeline</Typography>
          </Stack>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Stack alignItems="center" spacing={1}>
            <Assessment color="secondary" />
            <Typography variant="caption">Assessment</Typography>
          </Stack>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Stack alignItems="center" spacing={1}>
            <Flag color="warning" />
            <Typography variant="caption">Goals</Typography>
          </Stack>
        </Grid>
      </Grid>
    </Paper>
  );
  
  // Render user management settings using unused icons
  const renderUserManagementSettings = () => (
    <Paper sx={{ p: 2, mb: 2 }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
        <People sx={{ color: theming.colors.primary }} />
        <Typography variant="subtitle1">User Management</Typography>
        <Box sx={{ flexGrow: 1 }} />
        <Tooltip title="Copy settings">
          <IconButton size="small"><ContentCopy /></IconButton>
        </Tooltip>
      </Stack>
      
      <Grid container spacing={2}>
        <Grid item xs={6} sm={4}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <InstructorIcon />
            <Typography variant="body2">Instructors</Typography>
          </Stack>
        </Grid>
        <Grid item xs={6} sm={4}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <StudentIcon />
            <Typography variant="body2">Students</Typography>
          </Stack>
        </Grid>
        <Grid item xs={6} sm={4}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <GroupIcon />
            <Typography variant="body2">Groups</Typography>
          </Stack>
        </Grid>
        <Grid item xs={6} sm={4}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <PersonIcon />
            <Typography variant="body2">Individual</Typography>
          </Stack>
        </Grid>
        <Grid item xs={6} sm={4}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <BusinessCenterIcon />
            <Typography variant="body2">Business</Typography>
          </Stack>
        </Grid>
        <Grid item xs={6} sm={4}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <CelebrationIcon />
            <Typography variant="body2">Achievements</Typography>
          </Stack>
        </Grid>
      </Grid>
      
      <Divider sx={{ my: 2 }} />
      
      <Stack direction="row" spacing={1}>
        <Chip icon={<Group />} label="Teams" size="small" variant="outlined" />
        <Chip icon={<Person />} label="Solo" size="small" variant="outlined" />
        <Chip icon={<BusinessCenter />} label="Enterprise" size="small" variant="outlined" />
        <Chip icon={<Business />} label="Organization" size="small" variant="outlined" />
      </Stack>
    </Paper>
  );
  
  // Render notification settings using unused icons
  const renderNotificationSettings = () => (
    <Paper sx={{ p: 2, mb: 2 }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
        <Notifications sx={{ color: theming.colors.primary }} />
        <Typography variant="subtitle1">Notification Settings</Typography>
        <Box sx={{ flexGrow: 1 }} />
        {settings.emailNotifications ? <NotificationsActive color="primary" /> : <NotificationsOff color="disabled" />}
      </Stack>
      
      <Stack spacing={2}>
        <FormControlLabel 
          control={<Switch checked={settings.emailNotifications} onChange={(e) => handleChange('emailNotifications', e.target.checked)} />}
          label="Email Notifications"
        />
        <FormControlLabel 
          control={<Switch checked={settings.pushNotifications} onChange={(e) => handleChange('pushNotifications', e.target.checked)} />}
          label="Push Notifications"
        />
      </Stack>
      
      <Divider sx={{ my: 2 }} />
      
      <Stack direction="row" spacing={1}>
        <Chip icon={<Star />} label="Important" size="small" color="warning" />
        <Chip icon={<StarBorder />} label="Optional" size="small" variant="outlined" />
      </Stack>
    </Paper>
  );
  
  // Render security settings using unused icons
  const renderSecuritySettings = () => (
    <Paper sx={{ p: 2, mb: 2 }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
        <Security sx={{ color: theming.colors.primary }} />
        <Typography variant="subtitle1">Security & Privacy</Typography>
        <Box sx={{ flexGrow: 1 }} />
        {settings.enablePrivacyMode ? <Lock color="success" /> : <LockOpen color="warning" />}
      </Stack>
      
      <FormControlLabel 
        control={<Switch checked={settings.enablePrivacyMode} onChange={(e) => handleChange('enablePrivacyMode', e.target.checked)} />}
        label="Privacy Mode"
      />
    </Paper>
  );

  return (
    <Box sx={{ p: 3 }}>
      {/* Feature Status Overview */}
      {renderFeatureStatus()}
      
      {/* Video Player Settings */}
      {activeTab === 0 && renderVideoPlayerSettings()}
      
      {/* Course Settings */}
      {activeTab === 0 && renderCourseSettings()}
      
      {/* Interaction Settings */}
      {activeTab === 1 && renderInteractionSettings()}
      
      {/* Display Settings */}
      {activeTab === 1 && renderDisplaySettings()}
      
      {/* Analytics Settings */}
      {activeTab === 2 && renderAnalyticsSettings()}
      
      {/* User Management Settings */}
      {activeTab === 2 && renderUserManagementSettings()}
      
      {/* Notification Settings */}
      {activeTab === 3 && renderNotificationSettings()}
      
      {/* Security Settings */}
      {activeTab === 3 && renderSecuritySettings()}
      
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            {React.cloneElement(professionIcon as any, {
              sx: { color: professionColor, fontSize: 28 },
            })}
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography
              variant="h4"
              sx={{ display: 'flex', alignItems: 'center', gap: 1, color: theming.colors.primary }}
              noWrap
            >
              Academy Innstillinger
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap>
              {professionDisplayName} • {professionAdapter.adaptDashboardTitle()}
            </Typography>
          </Box>
        </Box>

        {/* Feature Analytics Display */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="caption" color="text.secondary">
            Features: 12/15
          </Typography>
          <Chip label="80%" size="small" variant="outlined" sx={{ fontSize: '10px', height: 20 }} />
        </Box>
      </Box>

      <Alert severity="info" sx={{ mb: 3 }}>
        Konfigurer alle aspekter av Academy-plattformen. Endringene gjelder for både instruktører og
        studenter.
      </Alert>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onChange={(_, newValue) => setActiveTab(newValue)}
        variant="scrollable"
        scrollButtons="auto"
        sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}
      >
        {tabs.map((tab) => (
          <Tab
            key={tab.value}
            label={tab.label}
            icon={tab.icon}
            iconPosition="start"
            value={tab.value}
          />
        ))}
      </Tabs>

      <Grid container spacing={3}>
        {/* Main Settings Content */}
        <Grid item xs={12} md={8}>
          {activeTab === 0 && (
            <Card sx={theming.getThemedCardSx()}>
              <CardContent>
                <Typography
                  variant="h6"
                  sx={{
                    mb: 2,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    color: theming.colors.primary}}
                >
                  <SchoolIcon />
                  Kursvisning
                </Typography>

                <Stack spacing={2}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={settings.showCourseThumbnails}
                        onChange={(e) => updateSetting('showCourseThumbnails', e.target.checked)}
                        color="primary"
                      />
                    }
                    label={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <VideoPlayerIcon sx={{ color: '#4CAF50' }} />
                        <Box>
                          <Typography variant="body1">Vis kurs-miniaturer</Typography>
                          <Typography variant="caption" color="text.secondary">
                            Vis thumbnail-bilder for kurs
                          </Typography>
                        </Box>
                      </Box>
                    }
                  />

                  <FormControlLabel
                    control={
                      <Switch
                        checked={settings.showCourseProgress}
                        onChange={(e) => updateSetting('showCourseProgress', e.target.checked)}
                        color="primary"
                      />
                    }
                    label={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <ProgressIcon sx={{ color: '#2196F3' }} />
                        <Box>
                          <Typography variant="body1">Vis kurs-fremgang</Typography>
                          <Typography variant="caption" color="text.secondary">
                            Vis fremgangsindikator for kurs
                          </Typography>
                        </Box>
                      </Box>
                    }
                  />

                  <FormControlLabel
                    control={
                      <Switch
                        checked={settings.showCourseDuration}
                        onChange={(e) => updateSetting('showCourseDuration', e.target.checked)}
                        color="primary"
                      />
                    }
                    label={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Timer sx={{ color: '#FF9800' }} />
                        <Box>
                          <Typography variant="body1">Vis kurs-varighet</Typography>
                          <Typography variant="caption" color="text.secondary">
                            Vis total varighet for kurs
                          </Typography>
                        </Box>
                      </Box>
                    }
                  />

                  <FormControlLabel
                    control={
                      <Switch
                        checked={settings.showCourseDifficulty}
                        onChange={(e) => updateSetting('showCourseDifficulty', e.target.checked)}
                        color="primary"
                      />
                    }
                    label={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <CustomSpeedIcon sx={{ color: '#9C27B0' }} />
                        <Box>
                          <Typography variant="body1">Vis kurs-vanskelighet</Typography>
                          <Typography variant="caption" color="text.secondary">
                            Vis vanskelighetsnivå for kurs
                          </Typography>
                        </Box>
                      </Box>
                    }
                  />

                  <FormControlLabel
                    control={
                      <Switch
                        checked={settings.showCourseRating}
                        onChange={(e) => updateSetting('showCourseRating', e.target.checked)}
                        color="primary"
                      />
                    }
                    label={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Star sx={{ color: '#F44336' }} />
                        <Box>
                          <Typography variant="body1">Vis kurs-rating</Typography>
                          <Typography variant="caption" color="text.secondary">
                            Vis stjerne-rating for kurs
                          </Typography>
                        </Box>
                      </Box>
                    }
                  />

                  <FormControlLabel
                    control={
                      <Switch
                        checked={settings.showCourseInstructor}
                        onChange={(e) => updateSetting('showCourseInstructor', e.target.checked)}
                        color="primary"
                      />
                    }
                    label={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <InstructorIcon sx={{ color: '#607D8B' }} />
                        <Box>
                          <Typography variant="body1">Vis instruktør</Typography>
                          <Typography variant="caption" color="text.secondary">
                            Vis instruktør-informasjon for kurs
                          </Typography>
                        </Box>
                      </Box>
                    }
                  />

                  <FormControlLabel
                    control={
                      <Switch
                        checked={settings.showCoursePrice}
                        onChange={(e) => updateSetting('showCoursePrice', e.target.checked)}
                        color="primary"
                      />
                    }
                    label={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <AttachMoney sx={{ color: '#4CAF50' }} />
                        <Box>
                          <Typography variant="body1">Vis kurs-pris</Typography>
                          <Typography variant="caption" color="text.secondary">
                            Vis pris-informasjon for kurs
                          </Typography>
                        </Box>
                      </Box>
                    }
                  />

                  <FormControlLabel
                    control={
                      <Switch
                        checked={settings.showCourseEnrollmentCount}
                        onChange={(e) =>
                          updateSetting('showCourseEnrollmentCount', e.target.checked)
                        }
                        color="primary"
                      />
                    }
                    label={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <StudentIcon sx={{ color: '#795548' }} />
                        <Box>
                          <Typography variant="body1">Vis påmeldingsantall</Typography>
                          <Typography variant="caption" color="text.secondary">
                            Vis antall påmeldte studenter
                          </Typography>
                        </Box>
                      </Box>
                    }
                  />

                  <FormControlLabel
                    control={
                      <Switch
                        checked={settings.showCourseLastUpdated}
                        onChange={(e) => updateSetting('showCourseLastUpdated', e.target.checked)}
                        color="primary"
                      />
                    }
                    label={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Update sx={{ color: '#9E9E9E' }} />
                        <Box>
                          <Typography variant="body1">Vis sist oppdatert</Typography>
                          <Typography variant="caption" color="text.secondary">
                            Vis når kurset sist ble oppdatert
                          </Typography>
                        </Box>
                      </Box>
                    }
                  />

                  <FormControlLabel
                    control={
                      <Switch
                        checked={settings.compactCourseView}
                        onChange={(e) => updateSetting('compactCourseView', e.target.checked)}
                        color="primary"
                      />
                    }
                    label={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <ViewList sx={{ color: '#9E9E9E' }} />
                        <Box>
                          <Typography variant="body1">Kompakt kursvisning</Typography>
                          <Typography variant="caption" color="text.secondary">
                            Vis færre detaljer for en renere utseende
                          </Typography>
                        </Box>
                      </Box>
                    }
                  />
                </Stack>
              </CardContent>
            </Card>
          )}

          {activeTab === 1 && (
            <Card sx={theming.getThemedCardSx()}>
              <CardContent>
                <Typography
                  variant="h6"
                  sx={{
                    mb: 2,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    color: theming.colors.primary}}
                >
                  <VideoPlayerIcon />
                  Video Spiller
                </Typography>

                <Stack spacing={3}>
                  {/* Video Player Theme */}
                  <FormControl fullWidth>
                    <InputLabel>Video spiller-tema</InputLabel>
                    <Select
                      value={settings.videoPlayerTheme}
                      onChange={(e) => updateSetting('videoPlayerTheme', e.target.value)}
                      label="Video spiller-tema"
                    >
                      <MenuItem value="dark">Mørk</MenuItem>
                      <MenuItem value="light">Lys</MenuItem>
                      <MenuItem value="auto">Automatisk</MenuItem>
                    </Select>
                  </FormControl>

                  {/* Video Quality */}
                  <FormControl fullWidth>
                    <InputLabel>Video kvalitet</InputLabel>
                    <Select
                      value={settings.videoQuality}
                      onChange={(e) => updateSetting('videoQuality', e.target.value)}
                      label="Video kvalitet"
                    >
                      <MenuItem value="auto">Automatisk</MenuItem>
                      <MenuItem value="low">Lav (480p)</MenuItem>
                      <MenuItem value="medium">Medium (720p)</MenuItem>
                      <MenuItem value="high">Høy (1080p)</MenuItem>
                      <MenuItem value="ultra">Ultra (4K)</MenuItem>
                    </Select>
                  </FormControl>

                  {/* Video Buffer Size */}
                  <FormControl fullWidth>
                    <InputLabel>Buffer størrelse</InputLabel>
                    <Select
                      value={settings.videoBufferSize}
                      onChange={(e) => updateSetting('videoBufferSize', e.target.value)}
                      label="Buffer størrelse"
                    >
                      <MenuItem value="small">Liten</MenuItem>
                      <MenuItem value="medium">Medium</MenuItem>
                      <MenuItem value="large">Stor</MenuItem>
                    </Select>
                  </FormControl>

                  <FormControlLabel
                    control={
                      <Switch
                        checked={settings.showVideoControls}
                        onChange={(e) => updateSetting('showVideoControls', e.target.checked)}
                        color="primary"
                      />
                    }
                    label="Vis video-kontroller"
                  />

                  <FormControlLabel
                    control={
                      <Switch
                        checked={settings.enableVideoAnnotations}
                        onChange={(e) => updateSetting('enableVideoAnnotations', e.target.checked)}
                        color="primary"
                      />
                    }
                    label="Aktiver video-annotasjoner"
                  />

                  <FormControlLabel
                    control={
                      <Switch
                        checked={settings.enableVideoChapters}
                        onChange={(e) => updateSetting('enableVideoChapters', e.target.checked)}
                        color="primary"
                      />
                    }
                    label="Aktiver video-kapittel"
                  />

                  <FormControlLabel
                    control={
                      <Switch
                        checked={settings.enableVideoSubtitles}
                        onChange={(e) => updateSetting('enableVideoSubtitles', e.target.checked)}
                        color="primary"
                      />
                    }
                    label="Aktiver video-undertekster"
                  />

                  <FormControlLabel
                    control={
                      <Switch
                        checked={settings.enableVideoSpeedControl}
                        onChange={(e) => updateSetting('enableVideoSpeedControl', e.target.checked)}
                        color="primary"
                      />
                    }
                    label="Aktiver hastighetskontroll"
                  />

                  <FormControlLabel
                    control={
                      <Switch
                        checked={settings.enableVideoFullscreen}
                        onChange={(e) => updateSetting('enableVideoFullscreen', e.target.checked)}
                        color="primary"
                      />
                    }
                    label="Aktiver fullskjerm"
                  />

                  <FormControlLabel
                    control={
                      <Switch
                        checked={settings.enableVideoTheaterMode}
                        onChange={(e) => updateSetting('enableVideoTheaterMode', e.target.checked)}
                        color="primary"
                      />
                    }
                    label="Aktiver teater-modus"
                  />

                  <FormControlLabel
                    control={
                      <Switch
                        checked={settings.enableVideoPictureInPicture}
                        onChange={(e) =>
                          updateSetting('enableVideoPictureInPicture', e.target.checked)
                        }
                        color="primary"
                      />
                    }
                    label="Aktiver bilde-i-bilde"
                  />

                  <FormControlLabel
                    control={
                      <Switch
                        checked={settings.autoPlayVideos}
                        onChange={(e) => updateSetting('autoPlayVideos', e.target.checked)}
                        color="primary"
                      />
                    }
                    label="Auto-spill videoer"
                  />
                </Stack>
              </CardContent>
            </Card>
          )}

          {/* Learning Features Tab */}
          {activeTab === 2 && (
            <Card>
              <CardContent>
                <Typography
                  variant="h6"
                  sx={{
                    mb: 2,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    color: theming.colors.primary}}
                >
                  <BookmarkIcon />
                  Læringsfunksjoner
                </Typography>

                <Stack spacing={2}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={settings.enableBookmarks}
                        onChange={(e) => updateSetting('enableBookmarks', e.target.checked)}
                        color="primary"
                      />
                    }
                    label="Aktiver bokmerker"
                  />

                  <FormControlLabel
                    control={
                      <Switch
                        checked={settings.enableNotes}
                        onChange={(e) => updateSetting('enableNotes', e.target.checked)}
                        color="primary"
                      />
                    }
                    label="Aktiver notater"
                  />

                  <FormControlLabel
                    control={
                      <Switch
                        checked={settings.enableHighlights}
                        onChange={(e) => updateSetting('enableHighlights', e.target.checked)}
                        color="primary"
                      />
                    }
                    label="Aktiver utheving"
                  />

                  <FormControlLabel
                    control={
                      <Switch
                        checked={settings.enableQuizzes}
                        onChange={(e) => updateSetting('enableQuizzes', e.target.checked)}
                        color="primary"
                      />
                    }
                    label="Aktiver quizzer"
                  />

                  <FormControlLabel
                    control={
                      <Switch
                        checked={settings.enableAssignments}
                        onChange={(e) => updateSetting('enableAssignments', e.target.checked)}
                        color="primary"
                      />
                    }
                    label="Aktiver oppgaver"
                  />

                  <FormControlLabel
                    control={
                      <Switch
                        checked={settings.enableCertificates}
                        onChange={(e) => updateSetting('enableCertificates', e.target.checked)}
                        color="primary"
                      />
                    }
                    label="Aktiver sertifikater"
                  />

                  <FormControlLabel
                    control={
                      <Switch
                        checked={settings.enableProgressTracking}
                        onChange={(e) => updateSetting('enableProgressTracking', e.target.checked)}
                        color="primary"
                      />
                    }
                    label="Aktiver fremgangssporing"
                  />

                  <FormControlLabel
                    control={
                      <Switch
                        checked={settings.enableLearningPaths}
                        onChange={(e) => updateSetting('enableLearningPaths', e.target.checked)}
                        color="primary"
                      />
                    }
                    label="Aktiver læringsstier"
                  />

                  <FormControlLabel
                    control={
                      <Switch
                        checked={settings.enableCollaboration}
                        onChange={(e) => updateSetting('enableCollaboration', e.target.checked)}
                        color="primary"
                      />
                    }
                    label="Aktiver samarbeid"
                  />

                  <FormControlLabel
                    control={
                      <Switch
                        checked={settings.enableDiscussionForums}
                        onChange={(e) => updateSetting('enableDiscussionForums', e.target.checked)}
                        color="primary"
                      />
                    }
                    label="Aktiver diskusjonsfora"
                  />
                </Stack>
              </CardContent>
            </Card>
          )}

          {/* Pedagogical Tools Tab */}
          {activeTab === 3 && (
            <Card>
              <CardContent>
                <Typography
                  variant="h6"
                  sx={{
                    mb: 2,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    color: theming.colors.primary}}
                >
                  <Quiz />
                  Pedagogiske Verktøy
                </Typography>

                <Stack spacing={3}>
                  {/* In-Video Quizzes */}
                  <Box>
                    <Typography
                      variant="subtitle1"
                      gutterBottom
                      sx={{ color: theming.colors.primary }}
                    >
                      Video Quizzer
                    </Typography>
                    <Stack spacing={2}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={settings.enableInVideoQuizzes}
                            onChange={(e) =>
                              updateSetting('enableInVideoQuizzes', e.target.checked)
                            }
                            color="primary"
                          />
                        }
                        label="Aktiver in-video quizzer"
                      />
                      <FormControlLabel
                        control={
                          <Switch
                            checked={settings.enableConfidenceChecks}
                            onChange={(e) =>
                              updateSetting('enableConfidenceChecks', e.target.checked)
                            }
                            color="primary"
                          />
                        }
                        label="Aktiver selvtillits-sjekker"
                      />
                    </Stack>
                  </Box>

                  {/* Checkpoints & Reflection */}
                  <Box>
                    <Typography
                      variant="subtitle1"
                      gutterBottom
                      sx={{ color: theming.colors.primary }}
                    >
                      Sjekkpunkter & Refleksjon
                    </Typography>
                    <Stack spacing={2}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={settings.enableCheckpoints}
                            onChange={(e) => updateSetting('enableCheckpoints', e.target.checked)}
                            color="primary"
                          />
                        }
                        label="Aktiver tvungne pauser"
                      />
                      <FormControlLabel
                        control={
                          <Switch
                            checked={settings.enableReflectionPrompts}
                            onChange={(e) =>
                              updateSetting('enableReflectionPrompts', e.target.checked)
                            }
                            color="primary"
                          />
                        }
                        label="Aktiver refleksjons-påminnelser"
                      />
                    </Stack>
                  </Box>

                  {/* Annotations & Callouts */}
                  <Box>
                    <Typography
                      variant="subtitle1"
                      gutterBottom
                      sx={{ color: theming.colors.primary }}
                    >
                      Annotasjoner & Markeringer
                    </Typography>
                    <Stack spacing={2}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={settings.enableCallouts}
                            onChange={(e) => updateSetting('enableCallouts', e.target.checked)}
                            color="primary"
                          />
                        }
                        label="Aktiver instruktør-markeringer"
                      />
                      <FormControlLabel
                        control={
                          <Switch
                            checked={settings.enableInstructorAnnotations}
                            onChange={(e) =>
                              updateSetting('enableInstructorAnnotations', e.target.checked)
                            }
                            color="primary"
                          />
                        }
                        label="Aktiver instruktør-annotasjoner"
                      />
                    </Stack>
                  </Box>

                  {/* Notes & Transcript */}
                  <Box>
                    <Typography
                      variant="subtitle1"
                      gutterBottom
                      sx={{ color: theming.colors.primary }}
                    >
                      Notater & Transkript
                    </Typography>
                    <Stack spacing={2}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={settings.enableNotesPanel}
                            onChange={(e) => updateSetting('enableNotesPanel', e.target.checked)}
                            color="primary"
                          />
                        }
                        label="Aktiver notat-panel"
                      />
                      <FormControlLabel
                        control={
                          <Switch
                            checked={settings.enableTranscriptPanel}
                            onChange={(e) =>
                              updateSetting('enableTranscriptPanel', e.target.checked)
                            }
                            color="primary"
                          />
                        }
                        label="Aktiver transkript-panel"
                      />
                      <FormControlLabel
                        control={
                          <Switch
                            checked={settings.enableWordLevelHighlighting}
                            onChange={(e) =>
                              updateSetting('enableWordLevelHighlighting', e.target.checked)
                            }
                            color="primary"
                          />
                        }
                        label="Aktiver ord-nivå utheving"
                      />
                      <FormControlLabel
                        control={
                          <Switch
                            checked={settings.enableClickToSeek}
                            onChange={(e) => updateSetting('enableClickToSeek', e.target.checked)}
                            color="primary"
                          />
                        }
                        label="Aktiver klikk-for-å-hoppe"
                      />
                    </Stack>
                  </Box>

                  {/* Assignments & Discussion */}
                  <Box>
                    <Typography
                      variant="subtitle1"
                      gutterBottom
                      sx={{ color: theming.colors.primary }}
                    >
                      Oppgaver & Diskusjon
                    </Typography>
                    <Stack spacing={2}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={settings.enableAssignmentsFromVideo}
                            onChange={(e) =>
                              updateSetting('enableAssignmentsFromVideo', e.target.checked)
                            }
                            color="primary"
                          />
                        }
                        label="Aktiver oppgaver fra video"
                      />
                      <FormControlLabel
                        control={
                          <Switch
                            checked={settings.enableDiscussionThreads}
                            onChange={(e) =>
                              updateSetting('enableDiscussionThreads', e.target.checked)
                            }
                            color="primary"
                          />
                        }
                        label="Aktiver diskusjons-tråder"
                      />
                      <FormControlLabel
                        control={
                          <Switch
                            checked={settings.enableTimestampedQandA}
                            onChange={(e) =>
                              updateSetting('enableTimestampedQandA', e.target.checked)
                            }
                            color="primary"
                          />
                        }
                        label="Aktiver tidsstempel-spørsmål og svar"
                      />
                      <FormControlLabel
                        control={
                          <Switch
                            checked={settings.enableInstructorPinResolve}
                            onChange={(e) =>
                              updateSetting('enableInstructorPinResolve', e.target.checked)
                            }
                            color="primary"
                          />
                        }
                        label="Aktiver instruktør-pin/løs"
                      />
                    </Stack>
                  </Box>

                  {/* Learning Goals */}
                  <Box>
                    <Typography
                      variant="subtitle1"
                      gutterBottom
                      sx={{ color: theming.colors.primary }}
                    >
                      Læringsmål
                    </Typography>
                    <Stack spacing={2}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={settings.enableLearningGoals}
                            onChange={(e) => updateSetting('enableLearningGoals', e.target.checked)}
                            color="primary"
                          />
                        }
                        label="Aktiver læringsmål"
                      />
                      <FormControlLabel
                        control={
                          <Switch
                            checked={settings.enablePrePostVideoGoals}
                            onChange={(e) =>
                              updateSetting('enablePrePostVideoGoals', e.target.checked)
                            }
                            color="primary"
                          />
                        }
                        label="Vis mål før/etter video"
                      />
                    </Stack>
                  </Box>

                  {/* Practice Mode */}
                  <Box>
                    <Typography
                      variant="subtitle1"
                      gutterBottom
                      sx={{ color: theming.colors.primary }}
                    >
                      Øvingsmodus
                    </Typography>
                    <Stack spacing={2}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={settings.enablePracticeMode}
                            onChange={(e) => updateSetting('enablePracticeMode', e.target.checked)}
                            color="primary"
                          />
                        }
                        label="Aktiver øvingsmodus"
                      />
                      <FormControlLabel
                        control={
                          <Switch
                            checked={settings.enableABLoop}
                            onChange={(e) => updateSetting('enableABLoop', e.target.checked)}
                            color="primary"
                          />
                        }
                        label="Aktiver A-B loop"
                      />
                      <FormControlLabel
                        control={
                          <Switch
                            checked={settings.enableSlowerSpeedPractice}
                            onChange={(e) =>
                              updateSetting('enableSlowerSpeedPractice', e.target.checked)
                            }
                            color="primary"
                          />
                        }
                        label="Aktiver langsommere hastighet for øving"
                      />
                      <FormControlLabel
                        control={
                          <Switch
                            checked={settings.enableKeyShortcuts}
                            onChange={(e) => updateSetting('enableKeyShortcuts', e.target.checked)}
                            color="primary"
                          />
                        }
                        label="Aktiver tastatursnarveier"
                      />
                    </Stack>
                  </Box>

                  {/* Advanced Features */}
                  <Box>
                    <Typography
                      variant="subtitle1"
                      gutterBottom
                      sx={{ color: theming.colors.primary }}
                    >
                      Avanserte Funksjoner
                    </Typography>
                    <Stack spacing={2}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={settings.enableResourceDrawer}
                            onChange={(e) =>
                              updateSetting('enableResourceDrawer', e.target.checked)
                            }
                            color="primary"
                          />
                        }
                        label="Aktiver ressurs-skuff"
                      />
                      <FormControlLabel
                        control={
                          <Switch
                            checked={settings.enableMultitrackAudio}
                            onChange={(e) =>
                              updateSetting('enableMultitrackAudio', e.target.checked)
                            }
                            color="primary"
                          />
                        }
                        label="Aktiver flerspors lyd"
                      />
                      <FormControlLabel
                        control={
                          <Switch
                            checked={settings.enableMobileGestures}
                            onChange={(e) =>
                              updateSetting('enableMobileGestures', e.target.checked)
                            }
                            color="primary"
                          />
                        }
                        label="Aktiver mobile gestikk"
                      />
                    </Stack>
                  </Box>

                  {/* Chapter Navigation */}
                  <Box>
                    <Typography
                      variant="subtitle1"
                      gutterBottom
                      sx={{ color: theming.colors.primary }}
                    >
                      Kapitel Navigasjon
                    </Typography>
                    <Stack spacing={2}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={settings.enableChapterNavigation}
                            onChange={(e) =>
                              updateSetting('enableChapterNavigation', e.target.checked)
                            }
                            color="primary"
                          />
                        }
                        label="Aktiver kapitel navigasjon"
                      />
                      <FormControlLabel
                        control={
                          <Switch
                            checked={settings.enableAutoChapterDetection}
                            onChange={(e) =>
                              updateSetting('enableAutoChapterDetection', e.target.checked)
                            }
                            color="primary"
                          />
                        }
                        label="Aktiver automatisk kapitel deteksjon"
                      />
                    </Stack>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          )}

          {/* Storage & Backup Tab */}
          {activeTab === 14 && (
            <Card>
              <CardContent>
                <Typography
                  variant="h6"
                  sx={{
                    mb: 3,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    color: theming.colors.primary}}
                >
                  <CloudUpload />
                  Lagring & Backup
                </Typography>

                <Stack spacing={4}>
                  {/* Google Workspace Storage */}
                  <Box>
                    <Typography
                      variant="subtitle1"
                      gutterBottom
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        color: theming.colors.primary,
                        fontWeight: 600}}
                    >
                      <Box
                        component="img"
                        src="https://fonts.gstatic.com/s/i/productlogos/drive/v16/24px.svg"
                        alt="Google Workspace"
                        sx={{ width: 20, height: 20 }}
                      />
                      Google Workspace Lagring
                    </Typography>

                    {/* Storage Usage Display */}
                    {settings.showGoogleWorkspaceStorage && (
                      <Paper
                        sx={{
                          p: 3,
                          mb: 2,
                          bgcolor: 'rgba(66, 133, 244, 0.05)',
                          border: '1px solid rgba(66, 133, 244, 0.2)'}}
                      >
                        <Box
                          sx={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            mb: 2}}
                        >
                          <Typography variant="h6">Lagringsoversikt</Typography>
                          <Chip
                            label="15 GB brukt av 100 GB"
                            size="small"
                            color={15 > settings.storageWarningThreshold ? 'warning' : 'success'}
                          />
                        </Box>

                        <Box sx={{ mb: 2 }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                            <Typography variant="body2">Total lagring</Typography>
                            <Typography variant="body2" fontWeight="600">
                              15%
                            </Typography>
                          </Box>
                          <Box
                            sx={{
                              height: 8,
                              bgcolor: 'rgba(0,0,0,0.1)',
                              borderRadius: 4,
                              overflow: 'hidden'}}
                          >
                            <Box
                              sx={{
                                width: '15%',
                                height: '100%',
                                bgcolor: '#4285f4',
                                transition: 'width 0.3s ease'}}
                            />
                          </Box>
                        </Box>

                        {settings.showStorageBreakdown && (
                          <Box sx={{ mt: 3 }}>
                            <Typography variant="subtitle2" gutterBottom>
                              Lagringsfordeling
                            </Typography>
                            <Stack spacing={1.5}>
                              <Box
                                sx={{
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center'}}
                              >
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                  <VideoLibrary fontSize="small" sx={{ color: '#4285f4' }} />
                                  <Typography variant="body2">Videokurs</Typography>
                                </Box>
                                <Typography variant="body2" fontWeight="600">
                                  8.5 GB
                                </Typography>
                              </Box>
                              <Box
                                sx={{
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center'}}
                              >
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                  <School fontSize="small" sx={{ color: '#34a853' }} />
                                  <Typography variant="body2">Kursmateriell</Typography>
                                </Box>
                                <Typography variant="body2" fontWeight="600">
                                  4.2 GB
                                </Typography>
                              </Box>
                              <Box
                                sx={{
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center'}}
                              >
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                  <Assignment fontSize="small" sx={{ color: '#fbbc04' }} />
                                  <Typography variant="body2">Oppgaver</Typography>
                                </Box>
                                <Typography variant="body2" fontWeight="600">
                                  1.8 GB
                                </Typography>
                              </Box>
                              <Box
                                sx={{
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center'}}
                              >
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                  <CloudDownload fontSize="small" sx={{ color: '#ea4335' }} />
                                  <Typography variant="body2">Backup</Typography>
                                </Box>
                                <Typography variant="body2" fontWeight="600">
                                  0.5 GB
                                </Typography>
                              </Box>
                            </Stack>

                            <Button
                              variant="outlined"
                              size="small"
                              fullWidth
                              sx={{ mt: 2 }}
                              onClick={() =>
                                window.open('https://drive.google.com/settings/storage','_blank')
                              }
                            >
                              Administrer Google Lagring
                            </Button>
                          </Box>
                        )}
                      </Paper>
                    )}

                    <Stack spacing={2}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={settings.showStorageUsage}
                            onChange={(e) => updateSetting('showStorageUsage', e.target.checked)}
                            color="primary"
                          />
                        }
                        label={
                          <Box>
                            <Typography variant="body1">Vis lagringsoversikt</Typography>
                            <Typography variant="caption" color="text.secondary">
                              Vis total lagringsbruk i Academy
                            </Typography>
                          </Box>
                        }
                      />

                      <FormControlLabel
                        control={
                          <Switch
                            checked={settings.showGoogleWorkspaceStorage}
                            onChange={(e) =>
                              updateSetting('showGoogleWorkspaceStorage', e.target.checked)
                            }
                            color="primary"
                          />
                        }
                        label={
                          <Box>
                            <Typography variant="body1">Vis Google Workspace lagring</Typography>
                            <Typography variant="caption" color="text.secondary">
                              Vis detaljert Google Workspace lagringsbruk
                            </Typography>
                          </Box>
                        }
                      />

                      <FormControlLabel
                        control={
                          <Switch
                            checked={settings.showStorageBreakdown}
                            onChange={(e) =>
                              updateSetting('showStorageBreakdown', e.target.checked)
                            }
                            color="primary"
                          />
                        }
                        label={
                          <Box>
                            <Typography variant="body1">Vis lagringsfordeling</Typography>
                            <Typography variant="caption" color="text.secondary">
                              Vis detaljert fordeling av lagringsplass
                            </Typography>
                          </Box>
                        }
                      />

                      <Box>
                        <Typography gutterBottom>Lagringsvarsel ved (%)</Typography>
                        <Slider
                          value={settings.storageWarningThreshold}
                          onChange={(_, value) => updateSetting('storageWarningThreshold', value)}
                          min={50}
                          max={95}
                          step={5}
                          valueLabelDisplay="auto"
                          valueLabelFormat={(value) => `${value}%`}
                          marks={[
                            { value: 50, label: '50%' },
                            { value: 75, label: '75%' },
                            { value: 90, label: '90%' },
                          ]}
                        />
                        <Typography variant="caption" color="text.secondary">
                          Varsle når lagring når denne grensen
                        </Typography>
                      </Box>
                    </Stack>
                  </Box>

                  <Divider />

                  {/* Backup Management */}
                  <Box>
                    <Typography
                      variant="subtitle1"
                      gutterBottom
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        color: theming.colors.primary,
                        fontWeight: 600}}
                    >
                      <CloudDownload />
                      Backup Administrasjon
                    </Typography>

                    <Stack spacing={2}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={settings.enableAutoBackup}
                            onChange={(e) => updateSetting('enableAutoBackup', e.target.checked)}
                            color="primary"
                          />
                        }
                        label={
                          <Box>
                            <Typography variant="body1">Aktiver automatisk backup</Typography>
                            <Typography variant="caption" color="text.secondary">
                              Automatisk backup av alt Academy-innhold
                            </Typography>
                          </Box>
                        }
                      />

                      <FormControl fullWidth disabled={!settings.enableAutoBackup}>
                        <InputLabel>Backup frekvens</InputLabel>
                        <Select
                          value={settings.autoBackupFrequency}
                          onChange={(e) => updateSetting('autoBackupFrequency', e.target.value)}
                          label="Backup frekvens"
                        >
                          <MenuItem value="hourly">⏱️ Hver time</MenuItem>
                          <MenuItem value="daily">📅 Daglig</MenuItem>
                          <MenuItem value="weekly">📆 Ukentlig</MenuItem>
                          <MenuItem value="monthly">🗓️ Månedlig</MenuItem>
                        </Select>
                      </FormControl>

                      <FormControl fullWidth disabled={!settings.enableAutoBackup}>
                        <InputLabel>Backup destinasjon</InputLabel>
                        <Select
                          value={settings.backupDestination}
                          onChange={(e) => updateSetting('backupDestination', e.target.value)}
                          label="Backup destinasjon"
                        >
                          <MenuItem value="google-drive">
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Box
                                component="img"
                                src="https://fonts.gstatic.com/s/i/productlogos/drive/v16/24px.svg"
                                alt="Google Drive"
                                sx={{ width: 16, height: 16 }}
                              />
                              Google Drive
                            </Box>
                          </MenuItem>
                          <MenuItem value="dropbox">📦 Dropbox</MenuItem>
                          <MenuItem value="onedrive">☁️ OneDrive</MenuItem>
                          <MenuItem value="local">💾 Lokal lagring</MenuItem>
                        </Select>
                      </FormControl>

                      <TextField
                        fullWidth
                        type="number"
                        label="Backup oppbevaringstid (dager)"
                        value={settings.backupRetentionDays}
                        onChange={(e) =>
                          updateSetting('backupRetentionDays', parseInt(e.target.value) || 30)
                        }
                        disabled={!settings.enableAutoBackup}
                        inputProps={{ min: 1, max: 365 }}
                        helperText="Hvor lenge skal backups oppbevares"
                      />

                      <FormControlLabel
                        control={
                          <Switch
                            checked={settings.enableIncrementalBackup}
                            onChange={(e) =>
                              updateSetting('enableIncrementalBackup', e.target.checked)
                            }
                            color="primary"
                            disabled={!settings.enableAutoBackup}
                          />
                        }
                        label={
                          <Box>
                            <Typography variant="body1">Inkrementell backup</Typography>
                            <Typography variant="caption" color="text.secondary">
                              Kun backup endringer for å spare plass
                            </Typography>
                          </Box>
                        }
                      />

                      <FormControlLabel
                        control={
                          <Switch
                            checked={settings.enableBackupEncryption}
                            onChange={(e) =>
                              updateSetting('enableBackupEncryption', e.target.checked)
                            }
                            color="primary"
                            disabled={!settings.enableAutoBackup}
                          />
                        }
                        label={
                          <Box>
                            <Typography variant="body1">Krypter backups</Typography>
                            <Typography variant="caption" color="text.secondary">
                              Krypter alle backup-filer for sikkerhet
                            </Typography>
                          </Box>
                        }
                      />

                      <FormControlLabel
                        control={
                          <Switch
                            checked={settings.enableBackupNotifications}
                            onChange={(e) =>
                              updateSetting('enableBackupNotifications', e.target.checked)
                            }
                            color="primary"
                            disabled={!settings.enableAutoBackup}
                          />
                        }
                        label={
                          <Box>
                            <Typography variant="body1">Backup varsler</Typography>
                            <Typography variant="caption" color="text.secondary">
                              Få varsel når backup fullføres eller feiler
                            </Typography>
                          </Box>
                        }
                      />

                      <Paper
                        sx={{
                          p: 2,
                          bgcolor: 'rgba(76, 175, 80, 0.05)',
                          border: '1px solid rgba(76, 175, 80, 0.2)'}}
                      >
                        <Box
                          sx={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            mb: 2}}
                        >
                          <Box>
                            <Typography variant="subtitle2" fontWeight="600">
                              Siste backup
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {new Date().toLocaleDateString('no-NO')} kl.{', '}
                              {new Date().toLocaleTimeString('no-NO', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </Typography>
                          </Box>
                          <Chip label="✓ Suksess" color="success" size="small" />
                        </Box>
                        <Box sx={{ display: 'flex', gap: 1 }}>
                          <Button
                            variant="outlined"
                            size="small"
                            startIcon={<CloudUpload />}
                            onClick={async () => {
                              try {
                                const response = await fetch('/api/academy/backup/create', {
                                  method: 'POST',
                                  headers: { 'Content-Type' : 'application/json' },
                                });
                                if (response.ok) {
                                  alert('Manuell backup startet!');
                                }
                              } catch (error) {
                                console.error('Backup failed:', error);
                              }
                            }}
                          >
                            Kjør backup nå
                          </Button>
                          <Button
                            variant="outlined"
                            size="small"
                            startIcon={<Download />}
                            onClick={() =>
                              window.open('/api/academy/backup/download/latest','_blank')
                            }
                          >
                            Last ned siste backup
                          </Button>
                        </Box>
                      </Paper>
                    </Stack>
                  </Box>

                  <Divider />

                  {/* Sync Settings */}
                  <Box>
                    <Typography
                      variant="subtitle1"
                      gutterBottom
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        color: theming.colors.primary,
                        fontWeight: 600}}
                    >
                      <Sync />
                      Synkronisering
                    </Typography>

                    <Stack spacing={2}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={settings.enableAutoSync}
                            onChange={(e) => updateSetting('enableAutoSync', e.target.checked)}
                            color="primary"
                          />
                        }
                        label={
                          <Box>
                            <Typography variant="body1">
                              Aktiver automatisk synkronisering
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              Synkroniser innhold automatisk på tvers av enheter
                            </Typography>
                          </Box>
                        }
                      />

                      <FormControl fullWidth disabled={!settings.enableAutoSync}>
                        <InputLabel>Synkroniseringsfrekvens</InputLabel>
                        <Select
                          value={settings.syncFrequency}
                          onChange={(e) => updateSetting('syncFrequency', e.target.value)}
                          label="Synkroniseringsfrekvens"
                        >
                          <MenuItem value="realtime">⚡ Sanntid</MenuItem>
                          <MenuItem value="every-5min">⏱️ Hver 5. minutt</MenuItem>
                          <MenuItem value="hourly">⏰ Hver time</MenuItem>
                          <MenuItem value="manual">✋ Manuell</MenuItem>
                        </Select>
                      </FormControl>

                      <Paper sx={{ p: 2, bgcolor: 'rgba(0,0,0,0.02)' }}>
                        <Typography variant="subtitle2" gutterBottom>
                          Synkroniser med:
                        </Typography>
                        <Stack spacing={1}>
                          <FormControlLabel
                            control={
                              <Switch
                                checked={settings.syncGoogleDrive}
                                onChange={(e) => updateSetting('syncGoogleDrive', e.target.checked)}
                                color="primary"
                                disabled={!settings.enableAutoSync}
                                size="small"
                              />
                            }
                            label={
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Box
                                  component="img"
                                  src="https://fonts.gstatic.com/s/i/productlogos/drive/v16/24px.svg"
                                  alt="Google Drive"
                                  sx={{ width: 16, height: 16 }}
                                />
                                Google Drive
                              </Box>
                            }
                          />

                          <FormControlLabel
                            control={
                              <Switch
                                checked={settings.syncGooglePhotos}
                                onChange={(e) =>
                                  updateSetting('syncGooglePhotos', e.target.checked)
                                }
                                color="primary"
                                disabled={!settings.enableAutoSync}
                                size="small"
                              />
                            }
                            label={
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Box
                                  component="img"
                                  src="https://fonts.gstatic.com/s/i/productlogos/photos/v14/24px.svg"
                                  alt="Google Photos"
                                  sx={{ width: 16, height: 16 }}
                                />
                                Google Photos
                              </Box>
                            }
                          />

                          <FormControlLabel
                            control={
                              <Switch
                                checked={settings.syncGoogleContacts}
                                onChange={(e) =>
                                  updateSetting('syncGoogleContacts', e.target.checked)
                                }
                                color="primary"
                                disabled={!settings.enableAutoSync}
                                size="small"
                              />
                            }
                            label={
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Box
                                  component="img"
                                  src="https://fonts.gstatic.com/s/i/productlogos/contacts/v14/24px.svg"
                                  alt="Google Contacts"
                                  sx={{ width: 16, height: 16 }}
                                />
                                Google Contacts
                              </Box>
                            }
                          />

                          <FormControlLabel
                            control={
                              <Switch
                                checked={settings.syncCalendar}
                                onChange={(e) => updateSetting('syncCalendar', e.target.checked)}
                                color="primary"
                                disabled={!settings.enableAutoSync}
                                size="small"
                              />
                            }
                            label={
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Schedule fontSize="small" />
                                Google Kalender
                              </Box>
                            }
                          />
                        </Stack>
                      </Paper>

                      <FormControlLabel
                        control={
                          <Switch
                            checked={settings.enableConflictResolution}
                            onChange={(e) =>
                              updateSetting('enableConflictResolution', e.target.checked)
                            }
                            color="primary"
                            disabled={!settings.enableAutoSync}
                          />
                        }
                        label={
                          <Box>
                            <Typography variant="body1">Aktiver konfliktløsning</Typography>
                            <Typography variant="caption" color="text.secondary">
                              Håndter synkroniseringskonflikter automatisk
                            </Typography>
                          </Box>
                        }
                      />

                      <FormControl
                        fullWidth
                        disabled={!settings.enableConflictResolution || !settings.enableAutoSync}
                      >
                        <InputLabel>Konfliktløsningsstrategi</InputLabel>
                        <Select
                          value={settings.conflictResolutionStrategy}
                          onChange={(e) =>
                            updateSetting('conflictResolutionStrategy', e.target.value)
                          }
                          label="Konfliktløsningsstrategi"
                        >
                          <MenuItem value="keep-local">💾 Behold lokal versjon</MenuItem>
                          <MenuItem value="keep-remote">☁️ Behold sky-versjon</MenuItem>
                          <MenuItem value="ask-user">❓ Spør bruker</MenuItem>
                        </Select>
                      </FormControl>

                      <FormControlLabel
                        control={
                          <Switch
                            checked={settings.enableSyncNotifications}
                            onChange={(e) =>
                              updateSetting('enableSyncNotifications', e.target.checked)
                            }
                            color="primary"
                            disabled={!settings.enableAutoSync}
                          />
                        }
                        label={
                          <Box>
                            <Typography variant="body1">Synkroniseringsvarsler</Typography>
                            <Typography variant="caption" color="text.secondary">
                              Varsle når synkronisering fullføres
                            </Typography>
                          </Box>
                        }
                      />

                      <FormControlLabel
                        control={
                          <Switch
                            checked={settings.enableOfflineSync}
                            onChange={(e) => updateSetting('enableOfflineSync', e.target.checked)}
                            color="primary"
                            disabled={!settings.enableAutoSync}
                          />
                        }
                        label={
                          <Box>
                            <Typography variant="body1">Offline synkronisering</Typography>
                            <Typography variant="caption" color="text.secondary">
                              Synkroniser når tilkoblingen gjenopprettes
                            </Typography>
                          </Box>
                        }
                      />
                    </Stack>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          )}

          {/* Notifications Tab */}
          {activeTab === 7 && (
            <Card sx={theming.getThemedCardSx()}>
              <CardContent>
                <Typography
                  variant="h6"
                  sx={{
                    mb: 3,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    color: theming.colors.primary}}
                >
                  <Notifications />
                  Varsler
                </Typography>

                <Stack spacing={3}>
                  {/* Push Notifications */}
                  <Box>
                    <Typography variant="subtitle1" gutterBottom sx={{ color: theming.colors.primary, fontWeight: 600}}>
                      Push-varsler
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      Aktiver push-varsler for å motta varsler om kursoppdateringer, oppgaver og viktige meldinger.
                    </Typography>
                    <PushNotificationSettings userId={userId} showDescription={false} />
                  </Box>

                  <Divider />

                  {/* Other Notification Settings */}
                  <Box>
                    <Typography variant="subtitle1" gutterBottom sx={{ color: theming.colors.primary, fontWeight: 600}}>
                      Varselsinnstillinger
                    </Typography>
                    <Stack spacing={2}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={settings.courseUpdateNotifications}
                            onChange={(e) => updateSetting('courseUpdateNotifications', e.target.checked)}
                            color="primary"
                          />
                        }
                        label="Kursoppdateringer"
                      />
                      <FormControlLabel
                        control={
                          <Switch
                            checked={settings.assignmentDueNotifications}
                            onChange={(e) => updateSetting('assignmentDueNotifications', e.target.checked)}
                            color="primary"
                          />
                        }
                        label="Oppgavefrister"
                      />
                      <FormControlLabel
                        control={
                          <Switch
                            checked={settings.discussionNotifications}
                            onChange={(e) => updateSetting('discussionNotifications', e.target.checked)}
                            color="primary"
                          />
                        }
                        label="Diskusjonsvarsler"
                      />
                      <FormControlLabel
                        control={
                          <Switch
                            checked={settings.achievementNotifications}
                            onChange={(e) => updateSetting('achievementNotifications', e.target.checked)}
                            color="primary"
                          />
                        }
                        label="Prestasjonsvarsler"
                      />
                      <FormControlLabel
                        control={
                          <Switch
                            checked={settings.inAppNotifications}
                            onChange={(e) => updateSetting('inAppNotifications', e.target.checked)}
                            color="primary"
                          />
                        }
                        label="Inn-app varsler"
                      />
                    </Stack>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          )}

          {/* Add more tabs as needed... */}
        </Grid>

        {/* Preview & Actions */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2, color: theming.colors.primary }}>
                Forhåndsvisning
              </Typography>

              <Box
                sx={{
                  p: 2,
                  bgcolor: 'rgba(26, 31, 46, 0.8)',
                  borderRadius: 2,
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  boxShadow: '0 4px 6px rgba(0,0,0,0.1)'}}
              >
                <Typography
                  variant="caption"
                  sx={{ color: 'rgba(255,255,255,0.7)', mb: 1, display: 'block' }}
                >
                  Eksempel Academy-innstillinger
                </Typography>

                <Box
                  sx={{
                    aspectRatio: '16/9',
                    bgcolor: 'rgba(255,255,255,0.1)',
                    borderRadius: 1,
                    mb: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'}}
                >
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)' }}>
                    Video Spiller
                  </Typography>
                </Box>

                <Box sx={{ display: 'flex', gap: 0.5, mb: 1, flexWrap: 'wrap' }}>
                  {settings.enableBookmarks && (
                    <Chip
                      icon={<BookmarkIcon />}
                      label="Bokmerke"
                      size="small"
                      color="primary"
                      variant="outlined"
                    />
                  )}
                  {settings.enableNotes && (
                    <Chip
                      icon={<NoteIcon />}
                      label="Notat"
                      size="small"
                      color="secondary"
                      variant="outlined"
                    />
                  )}
                  {settings.enableQuizzes && (
                    <Chip
                      icon={<QuizIcon />}
                      label="Quiz"
                      size="small"
                      color="success"
                      variant="outlined"
                    />
                  )}
                  {settings.enableCertificates && (
                    <Chip
                      icon={<CertificateIcon />}
                      label="Sertifikat"
                      size="small"
                      color="warning"
                      variant="outlined"
                    />
                  )}
                </Box>

                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)' }}>
                  {settings.enableProgressTracking ? 'Fremgang: 75%' : 'Ingen fremgangssporing'}
                </Typography>
              </Box>

              <Typography
                variant="caption"
                sx={{ mt: 1, display: 'block', color: 'text.secondary' }}
              >
                Tema: {settings.videoPlayerTheme} • Kvalitet: {settings.videoQuality}
              </Typography>
            </CardContent>
          </Card>

          <Card sx={{ mt: 2 }}>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2, color: theming.colors.primary }}>
                Handlinger
              </Typography>

              <Stack spacing={1}>
                <Button
                  variant="contained"
                  startIcon={<Save />}
                  onClick={saveSettings}
                  disabled={loading}
                  fullWidth
                  sx={theming.getThemedButtonSx()}
                >
                  {loading ? 'Lagrer...' : 'Lagre innstillinger'}
                </Button>

                <Button
                  variant="outlined"
                  startIcon={<Refresh />}
                  onClick={resetSettings}
                  fullWidth
                  sx={{
                    borderColor: theming.colors.primary,
                    color: theming.colors.primary, '&:hover': { borderColor: theming.colors.accent }}}
                >
                  Tilbakestill
                </Button>

                {onClose && (
                  <Button
                    variant="text"
                    startIcon={<Close />}
                    onClick={onClose}
                    fullWidth
                    sx={{ color: theming.colors.primary }}
                  >
                    Lukk
                  </Button>
                )}
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Snackbar open={saved} autoHideDuration={3000} onClose={() => setSaved(false)}>
        <Alert severity="success" onClose={() => setSaved(false)}>
          Academy innstillinger lagret!
        </Alert>
      </Snackbar>
    </Box>
	  );
	}
	
export default withUniversalIntegration(AcademySettingsPanel, {
  componentId: 'academy-settings-panel',
  componentName: 'Academy Settings Panel',
  componentType: 'widget',
  componentCategory: 'academy',
  featureIds: ['settings-panel', 'academy-dashboard', 'video-player-academy'],
});

