/**
 * CreatorHub Academy Course Creator Tool
 * Advanced course creation and management interface
 */

import React, { useState, useCallback, useEffect, memo, useMemo } from 'react';
import { useAcademy } from '@/contexts/AcademyContext';
import CardContent from '@mui/material/CardContent';
import {
  Box,
  Card,
  Typography,
  Button,
  Grid,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  Stack,
  Divider,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tabs,
  Tab,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Switch,
  FormControlLabel,
  Slider,
  Paper,
  Avatar,
  Badge,
  Tooltip,
  Alert,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  useTheme,
  alpha,
  CircularProgress,
  Skeleton,
} from '@mui/material';
import { TabPanel, TabContext, TabList } from '@mui/lab';
import { Virtuoso } from 'react-virtuoso';
import { LazyMotion, domAnimation, m, AnimatePresence } from 'framer-motion';
import { springVariants, bounceVariants, elasticVariants, hoverLift } from '@/utils/animation-variants';
import ErrorBoundary from '@/components/common/ErrorBoundary';
import { LessonItemSkeleton, StudentProgressSkeleton } from '@/components/common/SkeletonLoaders';
import {
  Add,
  Save,
  Preview,
  Delete,
  Edit,
  PlayArrow,
  Pause,
  Upload,
  Download,
  Star,
  Person,
  Settings,
  ExpandMore,
  DragIndicator,
  ContentCopy,
  Visibility,
  VisibilityOff,
  CheckCircle,
  Warning,
  Info,
  Error as ErrorIcon,
  Image,
  TextFields,
  Publish,
  TrendingUp,
  BarChart,
  Timeline,
  Analytics,
  Close,
  Palette,
  AutoAwesome,
} from '@mui/icons-material';
import {
  CourseIcon,
  LessonIcon,
  VideoPlayerIcon,
  InstructorIcon,
  StudentIcon,
  QuizIcon,
  BookmarkIcon,
  NoteIcon,
  CertificateIcon,
  ChapterIcon,
  VideoProcessingIcon,
} from '../shared/CreatorHubIcons';
import { useEnhancedMasterIntegration } from '@/integration/EnhancedMasterIntegrationProvider';
import { withUniversalIntegration } from '@/integration/UniversalIntegrationHOC';
import { useTheming } from '../../utils/theming-helper';
import { useAutoSave } from '@/hooks/useAutoSave';
import { useProfessionConfigs } from '@/hooks/useProfessionConfigs';
import { useProfessionAdapter } from '@/hooks/useProfessionAdapter';
import { getProfessionIcon } from '@/utils/profession-icons';
import UniversalFileUpload from '../universal/UniversalFileUpload';
import { apiRequest } from '@/lib/queryClient';
import VideoProcessingService from '../../services/videoProcessingService';
import VideoAnnotationEditor from './VideoAnnotationEditor';
import VideoChapterManager from './VideoChapterManager';
import AcademyAssetBrowser from './AcademyAssetBrowser';
import AnimatedLowerThirds from './AnimatedLowerThirds';
import ModuleManager from './ModuleManager';
import CourseCreatorSidebar from './CourseCreatorSidebar';
import AcademyFloatingActionMenu from './AcademyFloatingActionMenu';
import CTAOverlayEditor from './CTAOverlayEditor';

// Memoized Lesson Item Component with Framer Motion
const LessonItem = memo(({
  lesson,
  index,
  onEdit,
  onDelete,
  theming
}: {
  lesson: any;
  index: number;
  onEdit: (lesson: any) => void;
  onDelete: (id: string) => void;
  theming: any;
}) => (
  <m.div
    variants={springVariants}
    initial="hidden"
    animate="visible"
    exit="exit"
    whileHover={hoverLift}
    transition={{ delay: index * 0.05 }}
  >
    <ListItem>
      <ListItemText
        primary={lesson.title}
        secondary={`Duration: ${Math.floor(lesson.duration / 60)}:${(lesson.duration % 60).toString().padStart(2, '0')}`}
      />
      <ListItemSecondaryAction>
        <Stack direction="row" spacing={1}>
          <IconButton size="small" onClick={() => onEdit(lesson)}>
            {theming.getThemedIcon('edit')}
          </IconButton>
          <IconButton size="small" onClick={() => onDelete(lesson.id)}>
            {theming.getThemedIcon('delete')}
          </IconButton>
        </Stack>
      </ListItemSecondaryAction>
    </ListItem>
  </m.div>
));

LessonItem.displayName = 'LessonItem';

// Memoized Student Progress Item Component
const StudentProgressItem = memo(({
  userId,
  progress
}: {
  userId: string;
  progress: any;
}) => (
  <m.div
    variants={bounceVariants}
    initial="hidden"
    animate="visible"
    exit="exit"
    whileHover={{ scale: 1.02 }}
  >
    <ListItem>
      <ListItemText
        primary={`User ${userId}`}
        secondary={
          <Stack direction="row" spacing={2}>
            <Typography variant="caption">
              Progress: {Math.round(progress.progress * 100)}%
            </Typography>
            <Typography variant="caption">
              Time Watched: {Math.floor(progress.timeWatched / 60)}m
            </Typography>
            <Typography variant="caption">
              Last Watched: {new Date(progress.lastWatched).toLocaleDateString()}
            </Typography>
          </Stack>
        }
      />
      <Stack direction="row" spacing={1}>
        <Chip
          label={`${Math.round(progress.progress * 100)}%`}
          color={
            progress.progress > 0.8
              ? 'success'
              : progress.progress > 0.5
                ? 'warning'
                : 'error'
          }
          size="small"
        />
        <Chip
          label={progress.completionRules.videoComplete ? 'Video ✓' : 'Video ✗'}
          color={progress.completionRules.videoComplete ? 'success' : 'default'}
          size="small"
        />
        <Chip
          label={progress.completionRules.quizzesComplete ? 'Quiz ✓' : 'Quiz ✗'}
          color={progress.completionRules.quizzesComplete ? 'success' : 'default'}
          size="small"
        />
      </Stack>
    </ListItem>
  </m.div>
));

StudentProgressItem.displayName = 'StudentProgressItem';

interface CourseCreatorProps {
  courseId?: string;
  onSave?: (course: any) => void;
  onCancel?: () => void;
}

function CourseCreator({ courseId, onSave, onCancel }: CourseCreatorProps) {
  const theme = useTheme();
  const { createCourse, updateCourse, getCourse, createLesson, updateLesson } = useAcademy();
  const { analytics, performance, debugging, features } = useEnhancedMasterIntegration();

  // Profession wiring (API configs + adapter)
  const { professionConfigs: apiProfessionConfigs } = useProfessionConfigs();
  const professionAdapter = useProfessionAdapter();
  const currentProfession = professionAdapter.profession || 'music_producer';
  const enhancedProfessionConfig = apiProfessionConfigs?.[currentProfession];
  const professionDisplayName =
    enhancedProfessionConfig?.displayName || enhancedProfessionConfig?.name || currentProfession;
  const professionColor = enhancedProfessionConfig?.color || '#ff8c00';
  const professionIcon = getProfessionIcon(currentProfession);

  // Theming system
  const theming = useTheming(currentProfession);

  // Wire up CreatorHub icons for course creation UI
  const courseCreatorIcons = {
    course: <CourseIcon />,
    lesson: <LessonIcon />,
    video: <VideoPlayerIcon />,
    instructor: <InstructorIcon />,
    student: <StudentIcon />,
    quiz: <QuizIcon />,
    bookmark: <BookmarkIcon />,
    note: <NoteIcon />,
    certificate: <CertificateIcon />,
    chapter: <ChapterIcon />,
    videoProcessing: <VideoProcessingIcon />,
  };
  
  // Log course creator initialization
  console.log('CourseCreator icons:', Object.keys(courseCreatorIcons).length, 'Profession:', professionDisplayName, 'Color:', professionColor, 'Icon:', !!professionIcon);

  // Comprehensive Feature System for Course Creator
  const courseCreationAccess = features.checkFeatureAccess('course-creation');
  const courseManagementAccess = features.checkFeatureAccess('course-management');
  const lessonCreationAccess = features.checkFeatureAccess('lesson-creation');
  const contentManagementAccess = features.checkFeatureAccess('content-management');
  const mediaUploadAccess = features.checkFeatureAccess('media-upload');
  const coursePublishingAccess = features.checkFeatureAccess('course-publishing');
	  const courseAnalyticsAccess = features.checkFeatureAccess('analytics-academy');
  const collaborationAccess = features.checkFeatureAccess('collaboration');

  // Auto-save configuration
  const autoSave = useAutoSave({
    config: {
      maxRetries: 3,
      retryDelay: 1000,
      conflictResolution: 'client' as any,
      // backupEnabled: true, // Not supported by AutoSaveConfig
      backupInterval: 30000,
    },
    onDataSaved: (data) => {
      console.log('Course auto-saved: ', data);
      analytics.trackEvent('course_auto_saved', {
        courseId: course.id,
        version: '1.0.0',
        timestamp: Date.now(),
      });
    },
    onError: (error) => {
      console.error('Auto-save error: ', error);
      analytics.trackEvent('course_auto_save_error', {
        courseId: course.id,
        error: String(error),
        timestamp: Date.now(),
      });
    },
    onConflictDetected: (conflict) => {
      console.warn('Auto-save conflict detected:', conflict);
      analytics.trackEvent('course_auto_save_conflict', {
        courseId: course.id,
        conflict,
        timestamp: Date.now(),
      });
    },
  });

  // State
  const [activeTab, setActiveTab] = useState(0);
  const [course, setCourse] = useState({
    id: courseId || `course_${Date.now()}`,
    title: '',
    description: '',
    instructor: {
      id: 'current-user',
      name: 'Daniel Qazi',
      avatar: '/avatars/daniel-qazi.jpg',
      bio: 'Award-winning photographer with 15+ years experience',
      profession: 'photographer' as 'photographer' | 'videographer' | 'music_producer' | 'vendor' | 'enterprise',
    },
    thumbnail: '',
    videoUrl: '',
    duration: 0,
    level: 'beginner' as 'beginner' | 'intermediate' | 'advanced',
    category: 'photography' as
      | 'photography'
      | 'videography'
      | 'music_production'
      | 'lighting'
      | 'wedding'
      | 'business'
      | 'techniques'
      | 'equipment',
    tags: [] as string[],
    price: 0,
    isFree: true,
    isPublished: false,
    rating: 0,
    studentCount: 0,
    modules: [] as any[],
    lessons: [] as any[],
    prerequisites: [] as string[],
    learningOutcomes: [] as string[],
    resources: [] as any[],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),

    // Pedagogical Features
    pedagogicalFeatures: {
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
    },
  });

  const [newTag, setNewTag] = useState('');
  const [newPrerequisite, setNewPrerequisite] = useState('');
  const [newOutcome, setNewOutcome] = useState('');
  const [showLessonDialog, setShowLessonDialog] = useState(false);
  const [editingLesson, setEditingLesson] = useState<any>(null);
  const [lesson, setLesson] = useState({
    id: `lesson_${Date.now()}`,
    title: '',
    description: '',
    videoUrl: '',
    duration: 0,
    order: 0,
    isPreview: false,
    resources: [] as any[],
    // Instructor Takeaways for viewers
    takeaways: {
      learningSummary: [] as string[],      // Key points from the video
      keyTakeaways: [] as string[],          // Most important concepts
      learningObjectives: [] as string[],    // What student should understand/do after
      lessonHighlights: [] as string[],      // Main ideas (informal)
      instructorNotes: '',                   // Free-form teacher commentary
      videoSummaryNotes: '',                 // Notes tied to video content
    },
  });

  // Video processing state
  const [showVideoProcessor, setShowVideoProcessor] = useState(false);
  const [currentVideoUrl, setCurrentVideoUrl] = useState<string>('');
  const [videoAnnotations, setVideoAnnotations] = useState<any[]>([]);
  const [videoChapters, setVideoChapters] = useState<any[]>([]);
  const [isProcessingVideo, setIsProcessingVideo] = useState(false);
  const [videoProcessingProgress, setVideoProcessingProgress] = useState(0);
  const [videoProcessorMode, setVideoProcessorMode] = useState<'annotations' | 'chapters'>('annotations',
  );

  // Asset browser state
  const [showAssetBrowser, setShowAssetBrowser] = useState(false);
  const [assetBrowserMode, setAssetBrowserMode] = useState<'thumbnail' | 'video' | 'browse'>('browse',
  );
  const [selectedAsset, setSelectedAsset] = useState<any>(null);

  // Thumbnail management state
  const [showThumbnailDialog, setShowThumbnailDialog] = useState(false);
  const [generatingThumbnail, setGeneratingThumbnail] = useState(false);
  const [thumbnailOptions, setThumbnailOptions] = useState<any[]>([]);

  // Lower thirds state
  const [showLowerThirds, setShowLowerThirds] = useState(false);
  const [selectedLowerThird, setSelectedLowerThird] = useState<any>(null);
  const [lowerThirds, setLowerThirds] = useState<any[]>([]);

  // Call-to-Action overlays state
  const [showCTAEditor, setShowCTAEditor] = useState(false);
  const [selectedCTA, setSelectedCTA] = useState<any>(null);
  const [ctaOverlays, setCtaOverlays] = useState<any[]>([]);

  // Instructor Takeaways state
  const [takeawayTab, setTakeawayTab] = useState('keyTakeaways');
  const [newTakeawayItem, setNewTakeawayItem] = useState('');
  const [showTakeawaysAccordion, setShowTakeawaysAccordion] = useState(false);

  // Module management state
  const [showModuleManager, setShowModuleManager] = useState(false);
  const [selectedModule, setSelectedModule] = useState<any>(null);
  // Sidebar state
  const [showSidebar, setShowSidebar] = useState(true);
  const [courseVersions, setCourseVersions] = useState<any[]>([]);
  const [courseStatus, setCourseStatus] = useState<'draft' | 'published' | 'archived'>('draft');

  // Versioning and Analytics state
  const [mediaVersions, setMediaVersions] = useState<Record<string, any[]>>({});
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [userProgress, setUserProgress] = useState<Record<string, any>>({});
  const [heatmapData, setHeatmapData] = useState<any>(null);

  // Load course if editing
  useEffect(() => {
    if (courseId) {
      const existingCourse = getCourse(courseId);
      if (existingCourse) {
        setCourse((prev) => ({
          ...prev,
          ...existingCourse,
          instructor: { ...prev.instructor, ...existingCourse.instructor },
        }));
      }
    }
  }, [courseId, getCourse]);

  // Auto-save course data
  useEffect(() => {
    if (course && autoSave.isEnabled) {
      autoSave.save('course', course, {
        version: '1.2.0',
        lastModified: new Date().toISOString(),
        modulesCount: course.modules?.length || 0,
        lessonsCount: course.lessons?.length || 0,
        resourcesCount: course.resources?.length || 0,
        status: courseStatus,
      });
    }
  }, [course, courseStatus, autoSave]);

  // Component registration
  useEffect(() => {
    const endTiming = performance.startTiming('course_creator_render');

    analytics.trackEvent('course_creator_mounted', {
      courseId,
      isEditing: !!courseId,
      timestamp: Date.now(),
    });

    // Track feature usage
    features.trackFeatureUsage('course-creation', 'opened', {
      timestamp: Date.now(),
      component: 'CourseCreator',
      courseId: courseId,
      isEditing: !!courseId,
    });

    debugging.logIntegration('info','CourseCreator component mounted', {
      courseId,
      isEditing: !!courseId,
    });

    return () => {
      endTiming();
      analytics.trackEvent('course_creator_unmounted', {
        courseId,
        timestamp: Date.now(),
      });
    };
  }, [courseId, analytics, performance, debugging]);

  // Handle course save
  const handleSave = useCallback(async () => {
    const endTiming = performance.startTiming('course_creator_save');

    try {
      if (courseId) {
        await updateCourse(course);
        analytics.trackEvent('course_updated', {
          courseId,
          courseTitle: course.title,
          lessonCount: course.lessons.length,
          timestamp: Date.now(),
        });
      } else {
        const newCourse = await createCourse(course);
        analytics.trackEvent('course_created', {
          courseId: newCourse.id,
          courseTitle: newCourse.title,
          lessonCount: newCourse.lessons.length,
          timestamp: Date.now(),
        });
      }

      debugging.logIntegration('info','Course saved successfully', {
        courseId,
        courseTitle: course.title,
      });

      onSave?.(course);
      endTiming();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      analytics.trackEvent('course_save_failed', {
        courseId,
        error: errorMessage,
        timestamp: Date.now(),
      });

      debugging.logIntegration('error','Failed to save course', {
        courseId,
        error: errorMessage,
      });

      endTiming();
      throw error;
    }
  }, [course, courseId, createCourse, updateCourse, onSave, analytics, performance, debugging]);

  // Handle lesson save
  const handleLessonSave = useCallback(async () => {
    const endTiming = performance.startTiming('course_creator_lesson_save');

    try {
      const lessonData = {
        ...lesson,
        courseId: courseId || 'temp',
        order: course.lessons.length,
      };

      if (editingLesson) {
        await updateLesson({ ...lessonData, id: editingLesson.id });
        setCourse((prev) => ({
          ...prev,
          lessons: prev.lessons.map((l) => (l.id === editingLesson.id ? lessonData : l)),
        }));
      } else {
        const newLesson = await createLesson(lessonData);
        setCourse((prev) => ({
          ...prev,
          lessons: [...prev.lessons, newLesson],
        }));
      }

      analytics.trackEvent('lesson_saved', {
        lessonId: editingLesson?.id || 'new',
        courseId,
        lessonTitle: lesson.title,
        timestamp: Date.now(),
      });

      debugging.logIntegration('info','Lesson saved successfully', {
        lessonId: editingLesson?.id || 'new',
        courseId,
        lessonTitle: lesson.title,
      });

      setShowLessonDialog(false);
      setEditingLesson(null);
      setLesson({
        id: `lesson_${Date.now()}`,
        title: '',
        description: '',
        videoUrl: '',
        duration: 0,
        order: 0,
        isPreview: false,
        resources: [],
        takeaways: {
          learningSummary: [],
          keyTakeaways: [],
          learningObjectives: [],
          lessonHighlights: [],
          instructorNotes: '',
          videoSummaryNotes: '',
        },
      });
      setNewTakeawayItem('');
      setShowTakeawaysAccordion(false);

      endTiming();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      analytics.trackEvent('lesson_save_failed', {
        courseId,
        error: errorMessage,
        timestamp: Date.now(),
      });

      debugging.logIntegration('error','Failed to save lesson', {
        courseId,
        error: errorMessage,
      });

      endTiming();
      throw error;
    }
  }, [
    lesson,
    editingLesson,
    courseId,
    course.lessons.length,
    createLesson,
    updateLesson,
    analytics,
    performance,
    debugging,
  ]);

  // Add tag
  const addTag = useCallback(() => {
    if (newTag.trim() && !course.tags.includes(newTag.trim())) {
      setCourse((prev) => ({
        ...prev,
        tags: [...prev.tags, newTag.trim()],
      }));
      setNewTag('');
    }
  }, [newTag, course.tags]);

  // Remove tag
  const removeTag = useCallback((tagToRemove: string) => {
    setCourse((prev) => ({
      ...prev,
      tags: prev.tags.filter((tag) => tag !== tagToRemove),
    }));
  }, []);

  // Add prerequisite
  const addPrerequisite = useCallback(() => {
    if (newPrerequisite.trim() && !course.prerequisites.includes(newPrerequisite.trim())) {
      setCourse((prev) => ({
        ...prev,
        prerequisites: [...prev.prerequisites, newPrerequisite.trim()],
      }));
      setNewPrerequisite('');
    }
  }, [newPrerequisite, course.prerequisites]);

  // Remove prerequisite
  const removePrerequisite = useCallback((prerequisiteToRemove: string) => {
    setCourse((prev) => ({
      ...prev,
      prerequisites: prev.prerequisites.filter((prereq) => prereq !== prerequisiteToRemove),
    }));
  }, []);

  // Add learning outcome
  const addOutcome = useCallback(() => {
    if (newOutcome.trim() && !course.learningOutcomes.includes(newOutcome.trim())) {
      setCourse((prev) => ({
        ...prev,
        learningOutcomes: [...prev.learningOutcomes, newOutcome.trim()],
      }));
      setNewOutcome('');
    }
  }, [newOutcome, course.learningOutcomes]);

  // Remove learning outcome
  const removeOutcome = useCallback((outcomeToRemove: string) => {
    setCourse((prev) => ({
      ...prev,
      learningOutcomes: prev.learningOutcomes.filter((outcome) => outcome !== outcomeToRemove),
    }));
  }, []);

  // Edit lesson
  const editLesson = useCallback((lessonToEdit: any) => {
    setEditingLesson(lessonToEdit);
    setLesson(lessonToEdit);
    setShowLessonDialog(true);
  }, []);

  // Delete lesson
  const deleteLesson = useCallback((lessonId: string) => {
    setCourse((prev) => ({
      ...prev,
      lessons: prev.lessons.filter((l) => l.id !== lessonId),
    }));
  }, []);

  // Video processing functions
  const handleProcessVideo = useCallback(async (videoUrl: string) => {
    setIsProcessingVideo(true);
    setVideoProcessingProgress(0);
    setCurrentVideoUrl(videoUrl);

    try {
      const videoProcessingService = VideoProcessingService.getInstance();

      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setVideoProcessingProgress((prev) => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return prev;
          }
          return prev + 10;
        });
      }, 200);

      const result = await videoProcessingService.processVideo(videoUrl, {
        enableChapterDetection: true,
        enableAnnotationProcessing: true,
        enableThumbnailGeneration: true,
        chapterDetectionSensitivity: 0.7,
      });

      clearInterval(progressInterval);
      setVideoProcessingProgress(100);

      setVideoChapters(result.chapters);
      setVideoAnnotations(result.annotations);

      // Show success message
      console.log('Video processing completed:', result);

      setTimeout(() => {
        setIsProcessingVideo(false);
        setVideoProcessingProgress(0);
      }, 1000);
    } catch (error) {
      console.error('Video processing failed:', error);
      setIsProcessingVideo(false);
      setVideoProcessingProgress(0);
    }
  }, []);

  const handleOpenVideoProcessor = useCallback(
    (videoUrl: string, mode: 'annotations' | 'chapters' = 'annotations') => {
      setCurrentVideoUrl(videoUrl);
      setVideoProcessorMode(mode);
      setShowVideoProcessor(true);
    },
    [],
  );

  const handleCloseVideoProcessor = useCallback(() => {
    setShowVideoProcessor(false);
    setCurrentVideoUrl('');
    setVideoAnnotations([]);
    setVideoChapters([]);
  }, []);

  const handleSaveAnnotations = useCallback((annotations: any[]) => {
    setVideoAnnotations(annotations);
    console.log('Annotations saved:', annotations);
  }, []);

  const handleSaveChapters = useCallback((chapters: any[]) => {
    setVideoChapters(chapters);
    console.log('Chapters saved:', chapters);
  }, []);

  // Asset browser handlers
  const handleOpenAssetBrowser = useCallback((mode: 'thumbnail' | 'video' | 'browse') => {
    setAssetBrowserMode(mode);
    setShowAssetBrowser(true);
  }, []);

  const handleCloseAssetBrowser = useCallback(() => {
    setShowAssetBrowser(false);
    setSelectedAsset(null);
  }, []);

  const handleAssetSelect = useCallback(
    (asset: any) => {
      setSelectedAsset(asset);

      if (assetBrowserMode === 'thumbnail') {
        setCourse((prev) => ({ ...prev, thumbnail: asset.url }));
      } else if (assetBrowserMode === 'video') {
        setLesson((prev) => ({ ...prev, videoUrl: asset.url }));
      }

      setShowAssetBrowser(false);
      setSelectedAsset(null);
    },
    [assetBrowserMode, setCourse, setLesson],
  );

  const handleAssetUpload = useCallback((assets: any[]) => {
    console.log('Assets uploaded:', assets);
    // Here you would handle the uploaded assets
    // They're automatically added to the asset browser
  }, []);

  // Lower thirds handlers
  const handleOpenLowerThirds = useCallback(() => {
    setShowLowerThirds(true);
  }, []);

  const handleCloseLowerThirds = useCallback(() => {
    setShowLowerThirds(false);
    setSelectedLowerThird(null);
  }, []);

  const handleLowerThirdSelect = useCallback(
    (lowerThird: any) => {
      setSelectedLowerThird(lowerThird);
      setShowLowerThirds(false);

      analytics.trackEvent('lower_third_selected', {
        lowerThirdId: lowerThird.id,
        lowerThirdName: lowerThird.name,
        courseId: course.id,
        lessonId: lesson.id,
        timestamp: Date.now(),
      });
    },
    [analytics, course.id, lesson.id],
  );

  const handleLowerThirdSave = useCallback(
    (lowerThird: any) => {
      setLowerThirds((prev) => {
        const existing = prev.find((lt) => lt.id === lowerThird.id);
        if (existing) {
          return prev.map((lt) => (lt.id === lowerThird.id ? lowerThird : lt));
        } else {
          return [...prev, lowerThird];
        }
      });

      analytics.trackEvent('lower_third_saved', {
        lowerThirdId: lowerThird.id,
        lowerThirdName: lowerThird.name,
        courseId: course.id,
        lessonId: lesson.id,
        timestamp: Date.now(),
      });
    },
    [analytics, course.id, lesson.id],
  );

  const handleLowerThirdDelete = useCallback(
    (lowerThirdId: string) => {
      setLowerThirds((prev) => prev.filter((lt) => lt.id !== lowerThirdId));

      analytics.trackEvent('lower_third_deleted', {
        lowerThirdId,
        courseId: course.id,
        lessonId: lesson.id,
        timestamp: Date.now(),
      });
    },
    [analytics, course.id, lesson.id],
  );

  // CTA Overlay handlers
  const handleOpenCTAEditor = useCallback(() => {
    setShowCTAEditor(true);
  }, []);

  const handleCloseCTAEditor = useCallback(() => {
    setShowCTAEditor(false);
    setSelectedCTA(null);
  }, []);

  const handleCTASelect = useCallback(
    (cta: any) => {
      setSelectedCTA(cta);
      setShowCTAEditor(false);

      analytics.trackEvent('cta_overlay_selected', {
        ctaId: cta.id,
        ctaName: cta.name,
        ctaType: cta.type,
        courseId: course.id,
        lessonId: lesson.id,
        timestamp: Date.now(),
      });
    },
    [analytics, course.id, lesson.id],
  );

  const handleCTASave = useCallback(
    (cta: any) => {
      setCtaOverlays((prev) => {
        const existing = prev.find((ctaItem) => ctaItem.id === cta.id);
        if (existing) {
          return prev.map((ctaItem) => (ctaItem.id === cta.id ? cta : ctaItem));
        } else {
          return [...prev, cta];
        }
      });

      analytics.trackEvent('cta_overlay_saved', {
        ctaId: cta.id,
        ctaName: cta.name,
        ctaType: cta.type,
        courseId: course.id,
        lessonId: lesson.id,
        timestamp: Date.now(),
      });
    },
    [analytics, course.id, lesson.id],
  );

  const handleCTADelete = useCallback(
    (ctaId: string) => {
      setCtaOverlays((prev) => prev.filter((cta) => cta.id !== ctaId));

      analytics.trackEvent('cta_overlay_deleted', {
        ctaId,
        courseId: course.id,
        lessonId: lesson.id,
        timestamp: Date.now(),
      });
    },
    [analytics, course.id, lesson.id],
  );

  // Module management handlers
  const handleOpenModuleManager = useCallback(() => {
    setShowModuleManager(true);
  }, []);

  const handleCloseModuleManager = useCallback(() => {
    setShowModuleManager(false);
    setSelectedModule(null);
  }, []);

  const handleModuleUpdate = useCallback(
    (modules: any[]) => {
      setCourse((prev) => ({ ...prev, modules }));

      analytics.trackEvent('modules_updated', {
        moduleCount: modules.length,
        courseId: course.id,
        timestamp: Date.now(),
      });
    },
    [analytics, course.id],
  );

  const handleModuleSelect = useCallback(
    (module: any) => {
      setSelectedModule(module);

      analytics.trackEvent('module_selected', {
        moduleId: module.id,
        moduleTitle: module.title,
        courseId: course.id,
        timestamp: Date.now(),
      });
    },
    [analytics, course.id],
  );

  // Sidebar handlers
  const handleSidebarClose = useCallback(() => {
    setShowSidebar(false);
  }, []);

  const handleCourseUpdate = useCallback((updatedCourse: any) => {
    setCourse(updatedCourse);
  }, []);

  const handlePublish = useCallback(
    (courseToPublish: any) => {
      setCourseStatus('published');
      setCourse((prev) => ({ ...prev, isPublished: true, status: 'published' }));

      analytics.trackEvent('course_published', {
        courseId: courseToPublish.id,
        courseTitle: courseToPublish.title,
        timestamp: Date.now(),
      });
    },
    [analytics],
  );

  const handleSaveDraft = useCallback(
    (courseToSave: any) => {
      setCourseStatus('draft');
      setCourse((prev) => ({ ...prev, isPublished: false, status: 'draft' }));

      analytics.trackEvent('course_draft_saved', {
        courseId: courseToSave.id,
        courseTitle: courseToSave.title,
        timestamp: Date.now(),
      });
    },
    [analytics],
  );

  const handlePreview = useCallback(
    (courseToPreview: any) => {
      analytics.trackEvent('course_previewed', {
        courseId: courseToPreview.id,
        courseTitle: courseToPreview.title,
        timestamp: Date.now(),
      });
    },
    [analytics],
  );

  const handleShare = useCallback(
    (courseToShare: any) => {
      analytics.trackEvent('course_shared', {
        courseId: courseToShare.id,
        courseTitle: courseToShare.title,
        timestamp: Date.now(),
      });
    },
    [analytics],
  );

  const handleExport = useCallback(
    (courseToExport: any) => {
      analytics.trackEvent('course_exported', {
        courseId: courseToExport.id,
        courseTitle: courseToExport.title,
        timestamp: Date.now(),
      });
    },
    [analytics],
  );

  const handleImport = useCallback(
    (courseToImport: any) => {
      analytics.trackEvent('course_imported', {
        courseId: courseToImport.id,
        courseTitle: courseToImport.title,
        timestamp: Date.now(),
      });
    },
    [analytics],
  );

  const handleDelete = useCallback(
    (courseToDelete: any) => {
      setCourseStatus('archived');
      setCourse((prev) => ({ ...prev, status: 'archived' }));

      analytics.trackEvent('course_deleted', {
        courseId: courseToDelete.id,
        courseTitle: courseToDelete.title,
        timestamp: Date.now(),
      });
    },
    [analytics],
  );

  const handleVersionRestore = useCallback(
    (version: any) => {
      setCourse(version.courseData);
      setCourseStatus(version.status);

      analytics.trackEvent('course_version_restored', {
        courseId: course.id,
        versionId: version.id,
        versionTitle: version.title,
        timestamp: Date.now(),
      });
    },
    [analytics, course.id],
  );

  const handleVersionCreate = useCallback(
    (version: any) => {
      setCourseVersions((prev) => [...prev, version]);

      analytics.trackEvent('course_version_created', {
        courseId: course.id,
        versionId: version.id,
        versionTitle: version.title,
        timestamp: Date.now(),
      });
    },
    [analytics, course.id],
  );

  // Media Versioning Functions
  const createMediaVersion = useCallback(
    async (mediaId: string, newMediaUrl: string, versionNotes: string) => {
      try {
        const versionData = {
          id: `v_${Date.now()}`,
          mediaId,
          newMediaUrl,
          versionNotes,
          timestamp: new Date().toISOString(),
          createdBy: 'current-user',
          analyticsContinuity: true,
          previousVersion: mediaVersions[mediaId]?.[0]?.id || null,
        };

        setMediaVersions((prev) => ({
          ...prev,
          [mediaId]: [versionData, ...(prev[mediaId] || [])],
        }));

        // Update course lessons with new media URL while preserving analytics
        setCourse((prev) => ({
          ...prev,
          lessons: prev.lessons.map((lesson) =>
            lesson.videoUrl === mediaId
              ? {
                  ...lesson,
                  videoUrl: newMediaUrl,
                  versionHistory: [...(lesson.versionHistory || []), versionData],
                }
              : lesson,
          ),
        }));

        analytics.trackEvent('media_version_created', {
          courseId: course.id,
          mediaId,
          versionId: versionData.id,
          timestamp: Date.now(),
        });

        return versionData;
      } catch (error) {
        console.error('Failed to create media version:', error);
        throw error;
      }
    },
    [course.id, mediaVersions, analytics],
  );

  const getMediaVersionHistory = useCallback(
    (mediaId: string) => {
      return mediaVersions[mediaId] || [];
    },
    [mediaVersions],
  );

  const restoreMediaVersion = useCallback(
    async (mediaId: string, versionId: string) => {
      try {
        const version = mediaVersions[mediaId]?.find((v) => v.id === versionId);
        if (!version) {
          throw new Error('Version not found');
        }

        // Update course with restored media URL
        setCourse((prev) => ({
          ...prev,
          lessons: prev.lessons.map((lesson) =>
            lesson.id === mediaId ? { ...lesson, videoUrl: version.newMediaUrl } : lesson,
          ),
        }));

        analytics.trackEvent('media_version_restored', {
          courseId: course.id,
          mediaId,
          versionId,
          timestamp: Date.now(),
        });

        return version;
      } catch (error) {
        console.error('Failed to restore media version:', error);
        throw error;
      }
    },
    [course.id, mediaVersions, analytics],
  );

  // Analytics Functions
  const loadAnalyticsData = useCallback(async () => {
    try {
      // Simulate API call for analytics data
      const mockAnalyticsData = {
        courseId: course.id,
        totalViews: 1250,
        completionRate: 0.78,
        averageWatchTime: 1450, // seconds
        totalStudents: 89,
        engagementScore: 8.2,
        dropOffPoints: [
          { timestamp: 120, dropOffRate: 0.15, reason: 'Introduction too long' },
          { timestamp: 480, dropOffRate: 0.22, reason: 'Technical content' },
          { timestamp: 720, dropOffRate: 0.18, reason: 'Pacing too fast' },
        ],
        rewatchZones: [
          { startTime: 300, endTime: 360, rewatchCount: 45, reason: 'Key concept explanation' },
          { startTime: 600, endTime: 660, rewatchCount: 38, reason: 'Practical demonstration' },
        ],
        quizAnalytics: {
          totalQuizzes: 12,
          averageScore: 0.82,
          questionAnalysis: [
            { questionId: 'q1', correctRate: 0.95, commonWrongAnswers: ['Option B'] },
            { questionId: 'q2', correctRate: 0.67, commonWrongAnswers: ['Option A','Option C'] },
          ],
        },
        userProgress: {
          user1: {
            progress: 0.85,
            timeWatched: 1240,
            lastWatched: '2024-01-15T10:30:00Z',
            quizScores: [0.9, 0.8, 0.95],
            completionRules: {
              videoComplete: true,
              quizzesComplete: false,
              assignmentsComplete: false,
            },
          },
          user2: {
            progress: 0.62,
            timeWatched: 890,
            lastWatched: '2024-01-14T15:45:00Z',
            quizScores: [0.7, 0.6, 0.8],
            completionRules: {
              videoComplete: false,
              quizzesComplete: false,
              assignmentsComplete: false,
            },
          },
        },
        heatmapData: {
          watchTimeDistribution: Array.from({ length: 60 }, (_, i) => ({
            minute: i,
            watchTime: Math.random() * 100,
            pauseCount: Math.floor(Math.random() * 5),
            seekCount: Math.floor(Math.random() * 3),
          })),
          engagementPatterns: {
            peakEngagement: [5, 15, 25, 35, 45],
            lowEngagement: [10, 20, 30, 40, 50],
            averageEngagement: 75,
          },
        },
      };

      setAnalyticsData(mockAnalyticsData);
      setUserProgress(mockAnalyticsData.userProgress);
      setHeatmapData(mockAnalyticsData.heatmapData);

      analytics.trackEvent('analytics_loaded', {
        courseId: course.id,
        dataPoints: Object.keys(mockAnalyticsData).length,
        timestamp: Date.now(),
      });

      return mockAnalyticsData;
    } catch (error) {
      console.error('Failed to load analytics:', error);
      throw error;
    }
  }, [course.id, analytics]);

  const updateUserProgress = useCallback(
    async (userId: string, progressData: any) => {
      try {
        setUserProgress((prev) => ({
          ...prev,
          [userId]: {
            ...prev[userId],
            ...progressData,
            lastUpdated: new Date().toISOString(),
          },
        }));

        analytics.trackEvent('user_progress_updated', {
          courseId: course.id,
          userId,
          progress: progressData.progress,
          timestamp: Date.now(),
        });
      } catch (error) {
        console.error('Failed to update user progress:', error);
        throw error;
      }
    },
    [course.id, analytics],
  );

  return (
    <ErrorBoundary showDetails={true}>
      <LazyMotion features={domAnimation} strict>
        <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Box>
            <Typography
              variant="h4"
              component="h1"
              gutterBottom
              sx={{ color: theming.colors.primary }}
            >
              {courseId ? 'Edit Course' : 'Create New Course'}
            </Typography>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                {React.cloneElement(professionIcon as any, {
                  sx: { color: professionColor, fontSize: 18 }
                })}
              </Box>
              <Typography variant="body2" color="text.secondary">
                {professionDisplayName} • {professionAdapter.adaptDashboardTitle()}
              </Typography>
            </Stack>
            <Typography variant="body2" color="text.secondary">
              Build engaging learning experiences for your students
            </Typography>

            {/* Feature Analytics Display */}
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                mt: 1}}
            >
              <Typography variant="caption" color="text.secondary">
                Features: {features.getFeatureAnalytics().enabledFeatures}/
                {features.getFeatureAnalytics().totalFeatures}
              </Typography>
              <Chip
                label={`${Math.round(features.getFeatureAnalytics().featureAdoptionRate * 100)}%`}
                size="small"
                variant="outlined"
                sx={{ fontSize: '10px', height: 18 }}
              />
            </Box>
          </Box>

          <Stack direction="row" spacing={1}>
            <Button
              variant="outlined"
              startIcon={theming.getThemedIcon('settings')}
              onClick={() => setShowSidebar(!showSidebar)}
              sx={{ borderColor: '#4caf50', color: '#4caf50' }}
            >
              {showSidebar ? 'Hide Sidebar' : 'Show Sidebar'}
            </Button>
            <Button
              variant="outlined"
              startIcon={<Preview />}
              onClick={() => handlePreview(course)}
            >
              Preview
            </Button>
            <Button
              variant="contained"
              startIcon={theming.getThemedIcon('save')}
              onClick={handleSave}
              sx={theming.getThemedButtonSx()}
            >
              {courseId ? 'Update Course' : 'Create Course'}
            </Button>
          </Stack>
        </Stack>
      </Box>

      {/* Main Content */}
      <Box sx={{ flex: 1, display: 'flex' }}>
        {/* Course Content */}
        <Box sx={{ flex: 1, p: 2, overflow: 'auto' }}>
          <TabContext value={activeTab.toString()}>
            <TabList
              value={activeTab.toString()}
              onChange={(_, newValue) => setActiveTab(parseInt(newValue))}
              {...({} as any)}
            >
              <Tab label="Basic Info" value="0" />
              <Tab label="Modules" value="1" />
              <Tab label="Content" value="2" />
              <Tab label="Pedagogical Features" value="3" />
              <Tab label="Analytics" value="4" />
              <Tab label="Versioning" value="5" />
              <Tab label="Settings" value="6" />
              <Tab label="Pricing" value="7" />
            </TabList>

            {/* Basic Info Tab */}
            <TabPanel value="0" sx={{ p: 0, mt: 2 }}>
              <Stack spacing={3}>
                {/* Course Title */}
                <TextField
                  label="Course Title"
                  value={course.title}
                  onChange={(e) => setCourse((prev) => ({ ...prev, title: e.target.value }))}
                  fullWidth
                  placeholder="Enter an engaging course title"
                />

                {/* Course Description */}
                <TextField
                  label="Course Description"
                  value={course.description}
                  onChange={(e) => setCourse((prev) => ({ ...prev, description: e.target.value }))}
                  multiline
                  rows={4}
                  fullWidth
                  placeholder="Describe what students will learn in this course"
                />

                {/* Course Thumbnail Section */}
                <Card
                  variant="outlined"
                  sx={{ p: 3, bgcolor: 'rgba(255,140,0,0.05)', border: '2px dashed #ff8c00' }}
                >
                  <Typography
                    variant="h6"
                    gutterBottom
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      color: theming.colors.primary}}
                  >
                    <Image sx={{ color: '#ff8c00' }} />
                    Kurs Thumbnail
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                    Velg et attraktivt bilde som representerer kurset ditt. Thumbnails vises i
                    kurskatalog og prisadministrasjon.
                  </Typography>

                  <Grid container spacing={3}>
                    {/* Thumbnail Preview */}
                    <Grid item xs={12} md={6}>
                      <Box
                        sx={{
                          height: 200,
                          borderRadius: 2,
                          background: course.thumbnail
                            ? `url(${course.thumbnail})`
                            : 'linear-gradient(135deg, #ff8c00 0%, #3b82f6 100%)',
                          backgroundSize: 'cover',
                          backgroundPosition: 'center',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          border: '2px solid #e0e0e0',
                          position: 'relative',
                          overflow: 'hidden'}}
                      >
                        {!course.thumbnail && (
                          <Stack alignItems="center" spacing={1}>
                            <Image sx={{ fontSize: 48, color: 'white', opacity: 0.8 }} />
                            <Typography variant="caption" sx={{ color: 'white', fontWeight: 600}}>
                              Ingen thumbnail
                            </Typography>
                          </Stack>
                        )}
                        {course.thumbnail && (
                          <Chip
                            label="Satt ✓"
                            size="small"
                            sx={{
                              position: 'absolute',
                              top: 12,
                              right: 12,
                              bgcolor: '#16a34a',
                              color: 'white',
                              fontWeight: 600}}
                          />
                        )}
                      </Box>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ display: 'block', mt: 1, textAlign: 'center' }}
                      >
                        Anbefalt størrelse: 1280x720px (16:9 format)
                      </Typography>
                    </Grid>

                    {/* Thumbnail Actions */}
                    <Grid item xs={12} md={6}>
                      <Stack spacing={2}>
                        {/* Manual Upload */}
                        <Button
                          variant="contained"
                          fullWidth
                          startIcon={<Upload />}
                          onClick={() => {
                            setAssetBrowserMode('thumbnail');
                            setShowAssetBrowser(true);
                          }}
                          sx={{
                            bgcolor: '#ff8c00', '&:hover': { bgcolor: '#f57c00' }}}
                        >
                          📤 Last opp thumbnail
                        </Button>

                        {/* Auto-Generate from Video */}
                        <Button
                          variant="outlined"
                          fullWidth
                          startIcon={
                            generatingThumbnail ? <CircularProgress size={20} /> : <AutoAwesome />
                          }
                          disabled={!course.videoUrl || generatingThumbnail}
                          onClick={async () => {
                            setGeneratingThumbnail(true);
                            try {
                              // Generate thumbnails at 10%, 25%, 50%, 75% of video
                              const response = await apiRequest(
                                '/api/intelligent-video/generate-thumbnails',
                                {
                                  method: 'POST',
                                  body: JSON.stringify({
                                    videoPath: course.videoUrl,
                                    userId: 'current-user',
                                    timestamps: [0.1, 0.25, 0.5, 0.75], // Percentages
                                  }),
                                },
                              );

                              setThumbnailOptions(response.thumbnails || []);
                              setShowThumbnailDialog(true);

                              analytics.trackEvent('course_thumbnail_auto_generated', {
                                courseId: course.id,
                                optionsGenerated: response.thumbnails?.length || 0,
                                timestamp: Date.now(),
                              });
                            } catch (error) {
                              console.error('Auto-generation failed:', error);
                            } finally {
                              setGeneratingThumbnail(false);
                            }
                          }}
                          sx={{ borderColor: '#3b82f6', color: '#3b82f6' }}
                        >
                          ✨ Auto-generer fra video
                        </Button>

                        {/* Use Gradient (Default) */}
                        <Button
                          variant="text"
                          fullWidth
                          startIcon={<Palette />}
                          onClick={() => {
                            setCourse((prev) => ({ ...prev, thumbnail: ', ' }));
                            analytics.trackEvent('course_thumbnail_removed', {
                              courseId: course.id,
                              useGradient: true,
                              timestamp: Date.now(),
                            });
                          }}
                          sx={{ color: '#6b7280' }}
                        >
                          🎨 Bruk gradient (standard)
                        </Button>

                        {/* Info Alert */}
                        <Alert severity="info" icon={<Info />}>
                          <Typography variant="caption">
                            <strong>Tips:</strong> Thumbnails kan lastes opp manuelt eller
                            auto-genereres fra første video i kurset. Gradient brukes som standard
                            hvis ingen thumbnail er satt.
                          </Typography>
                        </Alert>
                      </Stack>
                    </Grid>
                  </Grid>
                </Card>

                {/* Course Category and Level */}
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <FormControl fullWidth>
                      <InputLabel>Category</InputLabel>
                      <Select
                        value={course.category}
                        onChange={(e) =>
                          setCourse((prev) => ({ ...prev, category: e.target.value as any }))
                        }
                        label="Category"
                      >
                        <MenuItem value="photography">Photography</MenuItem>
                        <MenuItem value="videography">Videography</MenuItem>
                        <MenuItem value="music_production">Music Production</MenuItem>
                        <MenuItem value="lighting">Lighting</MenuItem>
                        <MenuItem value="wedding">Wedding</MenuItem>
                        <MenuItem value="business">Business</MenuItem>
                        <MenuItem value="techniques">Techniques</MenuItem>
                        <MenuItem value="equipment">Equipment</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <FormControl fullWidth>
                      <InputLabel>Level</InputLabel>
                      <Select
                        value={course.level}
                        onChange={(e) =>
                          setCourse((prev) => ({ ...prev, level: e.target.value as any }))
                        }
                        label="Level"
                      >
                        <MenuItem value="beginner">Beginner</MenuItem>
                        <MenuItem value="intermediate">Intermediate</MenuItem>
                        <MenuItem value="advanced">Advanced</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                </Grid>

                {/* Tags */}
                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    Tags
                  </Typography>
                  <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
                    <TextField
                      size="small"
                      placeholder="Add tag"
                      value={newTag}
                      onChange={(e) => setNewTag(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && addTag()}
                    />
                    <Button size="small" onClick={addTag}>
                      Add
                    </Button>
                  </Stack>
                  <Stack direction="row" spacing={1} flexWrap="wrap">
                    {course.tags.map((tag) => (
                      <Chip key={tag} label={tag} onDelete={() => removeTag(tag)} size="small" />
                    ))}
                  </Stack>
                </Box>

                {/* Prerequisites */}
                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    Prerequisites
                  </Typography>
                  <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
                    <TextField
                      size="small"
                      placeholder="Add prerequisite"
                      value={newPrerequisite}
                      onChange={(e) => setNewPrerequisite(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && addPrerequisite()}
                      fullWidth
                    />
                    <Button size="small" onClick={addPrerequisite}>
                      Add
                    </Button>
                  </Stack>
                  <List dense>
                    {course.prerequisites.map((prereq, index) => (
                      <ListItem key={index}>
                        <ListItemText primary={prereq} />
                        <ListItemSecondaryAction>
                          <IconButton size="small" onClick={() => removePrerequisite(prereq)}>
                            {theming.getThemedIcon('delete')}
                          </IconButton>
                        </ListItemSecondaryAction>
                      </ListItem>
                    ))}
                  </List>
                </Box>

                {/* Learning Outcomes */}
                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    Learning Outcomes
                  </Typography>
                  <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
                    <TextField
                      size="small"
                      placeholder="What will students learn?"
                      value={newOutcome}
                      onChange={(e) => setNewOutcome(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && addOutcome()}
                      fullWidth
                    />
                    <Button size="small" onClick={addOutcome}>
                      Add
                    </Button>
                  </Stack>
                  <List dense>
                    {course.learningOutcomes.map((outcome, index) => (
                      <ListItem key={index}>
                        <ListItemText primary={outcome} />
                        <ListItemSecondaryAction>
                          <IconButton size="small" onClick={() => removeOutcome(outcome)}>
                            {theming.getThemedIcon('delete')}
                          </IconButton>
                        </ListItemSecondaryAction>
                      </ListItem>
                    ))}
                  </List>
                </Box>
              </Stack>
            </TabPanel>

            {/* Modules Tab */}
            <TabPanel value="1" sx={{ p: 0, mt: 2 }}>
              <Stack spacing={3}>
                <Box>
                  <Stack
                    direction="row"
                    alignItems="center"
                    justifyContent="space-between"
                    sx={{ mb: 2 }}
                  >
                    <Typography variant="h6" sx={{ color: theming.colors.primary }}>
                      Course Modules ({course.modules.length})
                    </Typography>
                    <Button
                      variant="contained"
                      startIcon={theming.getThemedIcon('add')}
                      onClick={handleOpenModuleManager}
                      sx={theming.getThemedButtonSx()}
                    >
                      Manage Modules
                    </Button>
                  </Stack>

                  {course.modules.length > 0 ? (
                    <ModuleManager
                      courseId={course.id}
                      modules={course.modules}
                      onModuleUpdate={handleModuleUpdate}
                      onModuleSelect={handleModuleSelect}
                      selectedModule={selectedModule}
                      mode="browse"
                      showPreview={true}
                      height={400}
                    />
                  ) : (
                    <Paper sx={{ p: 4, textAlign: 'center', backgroundColor: 'grey.50' }}>
                      <Typography
                        variant="h6"
                        color="text.secondary"
                        gutterBottom
                        sx={{ color: theming.colors.primary }}
                      >
                        No modules created yet
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        Organize your course content into structured modules for better learning
                        flow
                      </Typography>
                      <Button
                        variant="contained"
                        startIcon={theming.getThemedIcon('add')}
                        onClick={handleOpenModuleManager}
                        sx={theming.getThemedButtonSx()}
                      >
                        Create First Module
                      </Button>
                    </Paper>
                  )}
                </Box>
              </Stack>
            </TabPanel>

            {/* Content Tab */}
            <TabPanel value="2" sx={{ p: 0, mt: 2 }}>
              <Stack spacing={3}>
                {/* Course Thumbnail */}
                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    Course Thumbnail
                  </Typography>
                  <Stack direction="row" spacing={2} alignItems="center">
                    <UniversalFileUpload
                      allowedTypes="images"
                      maxFiles={1}
                      onFilesSelected={(files) => {
                        if (files[0]) {
                          setCourse((prev) => ({
                            ...prev,
                            thumbnail: URL.createObjectURL(files[0]),
                          }));
                        }
                      }}
                      profession="photographer"
                    />
                    <Button
                      variant="outlined"
                      startIcon={<Image />}
                      onClick={() => handleOpenAssetBrowser('thumbnail')}
                    >
                      Browse Assets
                    </Button>
                  </Stack>
                </Box>

                {/* Lower Thirds */}
                <Box>
                  <Stack
                    direction="row"
                    spacing={2}
                    alignItems="center"
                    justifyContent="space-between"
                  >
                    <Typography variant="subtitle2">Lower Thirds ({lowerThirds.length})</Typography>
                    <Button
                      variant="outlined"
                      startIcon={<TextFields />}
                      onClick={handleOpenLowerThirds}
                    >
                      Manage Lower Thirds
                    </Button>
                  </Stack>

                  {lowerThirds.length > 0 && (
                    <Box sx={{ mt: 2 }}>
                      <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
                        {lowerThirds.map((lt) => (
                          <Chip
                            key={lt.id}
                            label={lt.name}
                            onDelete={() => handleLowerThirdDelete(lt.id)}
                            color="primary"
                            variant="outlined"
                          />
                        ))}
                      </Stack>
                    </Box>
                  )}
                </Box>

                {/* Call-to-Action Overlays */}
                <Box>
                  <Stack
                    direction="row"
                    spacing={2}
                    alignItems="center"
                    justifyContent="space-between"
                  >
                    <Typography variant="subtitle2">CTA Overlays ({ctaOverlays.length})</Typography>
                    <Button
                      variant="outlined"
                      startIcon={<Publish />}
                      onClick={handleOpenCTAEditor}
                      sx={{ borderColor: '#ff9800', color: '#ff9800' }}
                    >
                      Manage CTA Overlays
                    </Button>
                  </Stack>

                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ mb: 2, display: 'block' }}
                  >
                    Create interactive call-to-action overlays for subscriptions, downloads,
                    external links, and more
                  </Typography>

                  {ctaOverlays.length > 0 && (
                    <Box sx={{ mt: 2 }}>
                      <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
                        {ctaOverlays.map((cta) => (
                          <Chip
                            key={cta.id}
                            label={`${cta.name} (${cta.type})`}
                            onDelete={() => handleCTADelete(cta.id)}
                            color={
                              cta.type === 'subscribe'
                                ? 'success'
                                : cta.type === 'download'
                                  ? 'info'
                                  : cta.type === 'external'
                                    ? 'warning'
                                    : 'primary'
                            }
                            variant="outlined"
                          />
                        ))}
                      </Stack>
                    </Box>
                  )}
                </Box>

                {/* Lessons */}
                <Box>
                  <Stack
                    direction="row"
                    spacing={2}
                    alignItems="center"
                    justifyContent="space-between"
                  >
                    <Typography variant="subtitle2">Lessons ({course.lessons.length})</Typography>
                    <Button
                      variant="contained"
                      startIcon={theming.getThemedIcon('add')}
                      onClick={() => setShowLessonDialog(true)}
                      sx={theming.getThemedButtonSx()}
                    >
                      Add Lesson
                    </Button>
                  </Stack>

                  <Box sx={{ height: 400 }}>
                    {course.lessons.length === 0 ? (
                      <Box>
                        {[...Array(3)].map((_, i) => (
                          <LessonItemSkeleton key={i} />
                        ))}
                      </Box>
                    ) : (
                      <AnimatePresence>
                        <Virtuoso
                          style={{ height: '100%' }}
                          data={course.lessons}
                          itemContent={(index, lesson) => (
                            <LessonItem
                              key={lesson.id || index}
                              lesson={lesson}
                              index={index}
                              onEdit={editLesson}
                              onDelete={deleteLesson}
                              theming={theming}
                            />
                          )}
                        />
                      </AnimatePresence>
                    )}
                  </Box>
                </Box>
              </Stack>
            </TabPanel>

            {/* Pedagogical Features Tab */}
            <TabPanel value="3" sx={{ p: 0, mt: 2 }}>
              <Stack spacing={3}>
                <Typography variant="h6" sx={{ color: theming.colors.primary }}>
                  Configure Pedagogical Video Features
                </Typography>

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
                          checked={course.pedagogicalFeatures.enableInVideoQuizzes}
                          onChange={(e) =>
                            setCourse((prev) => ({
                              ...prev,
                              pedagogicalFeatures: {
                                ...prev.pedagogicalFeatures,
                                enableInVideoQuizzes: e.target.checked,
                              },
                            }))
                          }
                          color="primary"
                        />
                      }
                      label="Enable in-video quizzes (single/multi-choice, short answer)"
                    />
                    <FormControlLabel
                      control={
                        <Switch
                          checked={course.pedagogicalFeatures.enableConfidenceChecks}
                          onChange={(e) =>
                            setCourse((prev) => ({
                              ...prev,
                              pedagogicalFeatures: {
                                ...prev.pedagogicalFeatures,
                                enableConfidenceChecks: e.target.checked,
                              },
                            }))
                          }
                          color="primary"
                        />
                      }
                      label="Enable confidence checks (graded or formative)"
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
                    Checkpoints & Reflection
                  </Typography>
                  <Stack spacing={2}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={course.pedagogicalFeatures.enableCheckpoints}
                          onChange={(e) =>
                            setCourse((prev) => ({
                              ...prev,
                              pedagogicalFeatures: {
                                ...prev.pedagogicalFeatures,
                                enableCheckpoints: e.target.checked,
                              },
                            }))
                          }
                          color="primary"
                        />
                      }
                      label="Enable forced pauses for 'reflect' prompts"
                    />
                    <FormControlLabel
                      control={
                        <Switch
                          checked={course.pedagogicalFeatures.enableReflectionPrompts}
                          onChange={(e) =>
                            setCourse((prev) => ({
                              ...prev,
                              pedagogicalFeatures: {
                                ...prev.pedagogicalFeatures,
                                enableReflectionPrompts: e.target.checked,
                              },
                            }))
                          }
                          color="primary"
                        />
                      }
                      label="Enable reflection prompts at key moments"
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
                    Annotations & Callouts
                  </Typography>
                  <Stack spacing={2}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={course.pedagogicalFeatures.enableCallouts}
                          onChange={(e) =>
                            setCourse((prev) => ({
                              ...prev,
                              pedagogicalFeatures: {
                                ...prev.pedagogicalFeatures,
                                enableCallouts: e.target.checked,
                              },
                            }))
                          }
                          color="primary"
                        />
                      }
                      label="Enable instructor callouts at timestamps"
                    />
                    <FormControlLabel
                      control={
                        <Switch
                          checked={course.pedagogicalFeatures.enableInstructorAnnotations}
                          onChange={(e) =>
                            setCourse((prev) => ({
                              ...prev,
                              pedagogicalFeatures: {
                                ...prev.pedagogicalFeatures,
                                enableInstructorAnnotations: e.target.checked,
                              },
                            }))
                          }
                          color="primary"
                        />
                      }
                      label="Enable instructor annotations system"
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
                    Notes & Transcript
                  </Typography>
                  <Stack spacing={2}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={course.pedagogicalFeatures.enableNotesPanel}
                          onChange={(e) =>
                            setCourse((prev) => ({
                              ...prev,
                              pedagogicalFeatures: {
                                ...prev.pedagogicalFeatures,
                                enableNotesPanel: e.target.checked,
                              },
                            }))
                          }
                          color="primary"
                        />
                      }
                      label="Enable time-synced notes panel with PDF/Notion export"
                    />
                    <FormControlLabel
                      control={
                        <Switch
                          checked={course.pedagogicalFeatures.enableTranscriptPanel}
                          onChange={(e) =>
                            setCourse((prev) => ({
                              ...prev,
                              pedagogicalFeatures: {
                                ...prev.pedagogicalFeatures,
                                enableTranscriptPanel: e.target.checked,
                              },
                            }))
                          }
                          color="primary"
                        />
                      }
                      label="Enable searchable transcript panel"
                    />
                    <FormControlLabel
                      control={
                        <Switch
                          checked={course.pedagogicalFeatures.enableWordLevelHighlighting}
                          onChange={(e) =>
                            setCourse((prev) => ({
                              ...prev,
                              pedagogicalFeatures: {
                                ...prev.pedagogicalFeatures,
                                enableWordLevelHighlighting: e.target.checked,
                              },
                            }))
                          }
                          color="primary"
                        />
                      }
                      label="Enable word-level highlighting in transcript"
                    />
                    <FormControlLabel
                      control={
                        <Switch
                          checked={course.pedagogicalFeatures.enableClickToSeek}
                          onChange={(e) =>
                            setCourse((prev) => ({
                              ...prev,
                              pedagogicalFeatures: {
                                ...prev.pedagogicalFeatures,
                                enableClickToSeek: e.target.checked,
                              },
                            }))
                          }
                          color="primary"
                        />
                      }
                      label="Enable click-to-seek in transcript"
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
                    Assignments & Discussion
                  </Typography>
                  <Stack spacing={2}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={course.pedagogicalFeatures.enableAssignmentsFromVideo}
                          onChange={(e) =>
                            setCourse((prev) => ({
                              ...prev,
                              pedagogicalFeatures: {
                                ...prev.pedagogicalFeatures,
                                enableAssignmentsFromVideo: e.target.checked,
                              },
                            }))
                          }
                          color="primary"
                        />
                      }
                      label="Enable assignments linked from video moments"
                    />
                    <FormControlLabel
                      control={
                        <Switch
                          checked={course.pedagogicalFeatures.enableDiscussionThreads}
                          onChange={(e) =>
                            setCourse((prev) => ({
                              ...prev,
                              pedagogicalFeatures: {
                                ...prev.pedagogicalFeatures,
                                enableDiscussionThreads: e.target.checked,
                              },
                            }))
                          }
                          color="primary"
                        />
                      }
                      label="Enable discussion/Q&A threads tied to timestamps"
                    />
                    <FormControlLabel
                      control={
                        <Switch
                          checked={course.pedagogicalFeatures.enableInstructorPinResolve}
                          onChange={(e) =>
                            setCourse((prev) => ({
                              ...prev,
                              pedagogicalFeatures: {
                                ...prev.pedagogicalFeatures,
                                enableInstructorPinResolve: e.target.checked,
                              },
                            }))
                          }
                          color="primary"
                        />
                      }
                      label="Enable instructor pin/resolve functionality"
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
                    Learning Goals
                  </Typography>
                  <Stack spacing={2}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={course.pedagogicalFeatures.enableLearningGoals}
                          onChange={(e) =>
                            setCourse((prev) => ({
                              ...prev,
                              pedagogicalFeatures: {
                                ...prev.pedagogicalFeatures,
                                enableLearningGoals: e.target.checked,
                              },
                            }))
                          }
                          color="primary"
                        />
                      }
                      label="Enable learning goals & outcomes"
                    />
                    <FormControlLabel
                      control={
                        <Switch
                          checked={course.pedagogicalFeatures.enablePrePostVideoGoals}
                          onChange={(e) =>
                            setCourse((prev) => ({
                              ...prev,
                              pedagogicalFeatures: {
                                ...prev.pedagogicalFeatures,
                                enablePrePostVideoGoals: e.target.checked,
                              },
                            }))
                          }
                          color="primary"
                        />
                      }
                      label="Show learning goals before/after video"
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
                    Practice Mode
                  </Typography>
                  <Stack spacing={2}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={course.pedagogicalFeatures.enablePracticeMode}
                          onChange={(e) =>
                            setCourse((prev) => ({
                              ...prev,
                              pedagogicalFeatures: {
                                ...prev.pedagogicalFeatures,
                                enablePracticeMode: e.target.checked,
                              },
                            }))
                          }
                          color="primary"
                        />
                      }
                      label="Enable practice mode with enhanced controls"
                    />
                    <FormControlLabel
                      control={
                        <Switch
                          checked={course.pedagogicalFeatures.enableABLoop}
                          onChange={(e) =>
                            setCourse((prev) => ({
                              ...prev,
                              pedagogicalFeatures: {
                                ...prev.pedagogicalFeatures,
                                enableABLoop: e.target.checked,
                              },
                            }))
                          }
                          color="primary"
                        />
                      }
                      label="Enable A-B loop for practice/revision"
                    />
                    <FormControlLabel
                      control={
                        <Switch
                          checked={course.pedagogicalFeatures.enableSlowerSpeedPractice}
                          onChange={(e) =>
                            setCourse((prev) => ({
                              ...prev,
                              pedagogicalFeatures: {
                                ...prev.pedagogicalFeatures,
                                enableSlowerSpeedPractice: e.target.checked,
                              },
                            }))
                          }
                          color="primary"
                        />
                      }
                      label="Enable slower speed options for practice"
                    />
                    <FormControlLabel
                      control={
                        <Switch
                          checked={course.pedagogicalFeatures.enableKeyShortcuts}
                          onChange={(e) =>
                            setCourse((prev) => ({
                              ...prev,
                              pedagogicalFeatures: {
                                ...prev.pedagogicalFeatures,
                                enableKeyShortcuts: e.target.checked,
                              },
                            }))
                          }
                          color="primary"
                        />
                      }
                      label="Enable keyboard shortcuts (space, arrows, etc.)"
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
                    Advanced Features
                  </Typography>
                  <Stack spacing={2}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={course.pedagogicalFeatures.enableResourceDrawer}
                          onChange={(e) =>
                            setCourse((prev) => ({
                              ...prev,
                              pedagogicalFeatures: {
                                ...prev.pedagogicalFeatures,
                                enableResourceDrawer: e.target.checked,
                              },
                            }))
                          }
                          color="primary"
                        />
                      }
                      label="Enable resource drawer (slides, links, readings, downloads)"
                    />
                    <FormControlLabel
                      control={
                        <Switch
                          checked={course.pedagogicalFeatures.enableMultitrackAudio}
                          onChange={(e) =>
                            setCourse((prev) => ({
                              ...prev,
                              pedagogicalFeatures: {
                                ...prev.pedagogicalFeatures,
                                enableMultitrackAudio: e.target.checked,
                              },
                            }))
                          }
                          color="primary"
                        />
                      }
                      label="Enable multitrack audio (original, dubbed, descriptive)"
                    />
                    <FormControlLabel
                      control={
                        <Switch
                          checked={course.pedagogicalFeatures.enableMobileGestures}
                          onChange={(e) =>
                            setCourse((prev) => ({
                              ...prev,
                              pedagogicalFeatures: {
                                ...prev.pedagogicalFeatures,
                                enableMobileGestures: e.target.checked,
                              },
                            }))
                          }
                          color="primary"
                        />
                      }
                      label="Enable mobile gestures (double-tap seek, swipe volume/brightness)"
                    />
                  </Stack>
                </Box>
              </Stack>
            </TabPanel>

            {/* Analytics Tab */}
            <TabPanel value="4" sx={{ p: 0, mt: 2 }}>
              <Stack spacing={3}>
                <Box>
                  <Stack
                    direction="row"
                    alignItems="center"
                    justifyContent="space-between"
                    sx={{ mb: 2 }}
                  >
                    <Typography variant="h6" sx={{ color: theming.colors.primary }}>
                      Course Analytics & Progress Tracking
                    </Typography>
                    <Button
                      variant="contained"
                      onClick={loadAnalyticsData}
                      startIcon={<TrendingUp />}
                      sx={theming.getThemedButtonSx()}
                    >
                      Load Analytics
                    </Button>
                  </Stack>

                  {analyticsData && (
                    <Stack spacing={3}>
                      {/* Overview Stats */}
                      <Grid container spacing={2}>
                        <Grid item xs={12} sm={6} md={3}>
                          <Card sx={{ p: 2, textAlign: 'center' }}>
                            <Typography variant="h4" color="primary">
                              {analyticsData.totalViews}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              Total Views
                            </Typography>
                          </Card>
                        </Grid>
                        <Grid item xs={12} sm={6} md={3}>
                          <Card sx={{ p: 2, textAlign: 'center' }}>
                            <Typography variant="h4" color="primary">
                              {Math.round(analyticsData.completionRate * 100)}%
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              Completion Rate
                            </Typography>
                          </Card>
                        </Grid>
                        <Grid item xs={12} sm={6} md={3}>
                          <Card sx={{ p: 2, textAlign: 'center' }}>
                            <Typography variant="h4" color="primary">
                              {Math.floor(analyticsData.averageWatchTime / 60)}m
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              Avg Watch Time
                            </Typography>
                          </Card>
                        </Grid>
                        <Grid item xs={12} sm={6} md={3}>
                          <Card sx={{ p: 2, textAlign: 'center' }}>
                            <Typography variant="h4" color="primary">
                              {analyticsData.totalStudents}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              Total Students
                            </Typography>
                          </Card>
                        </Grid>
                      </Grid>

                      {/* Drop-off Points */}
                      <Box>
                        <Typography
                          variant="h6"
                          gutterBottom
                          sx={{ color: theming.colors.primary }}
                        >
                          Drop-off Analysis
                        </Typography>
                        <Box sx={{ height: 300 }}>
                          <Virtuoso
                            style={{ height: '100%' }}
                            data={analyticsData.dropOffPoints}
                            itemContent={(index, point: any) => (
                              <ListItem key={index}>
                                <ListItemText
                                  primary={`${Math.floor(point.timestamp / 60)}:${(point.timestamp % 60).toString().padStart(2, '0')} - ${Math.round(point.dropOffRate * 100)}% drop-off`}
                                  secondary={point.reason}
                                />
                                <Chip
                                  label={`${Math.round(point.dropOffRate * 100)}%`}
                                  color={
                                    point.dropOffRate > 0.2
                                      ? 'error'
                                      : point.dropOffRate > 0.15
                                        ? 'warning'
                                        : 'success'
                                  }
                                  size="small"
                                />
                              </ListItem>
                            )}
                          />
                        </Box>
                      </Box>

                      {/* Rewatch Zones */}
                      <Box>
                        <Typography
                          variant="h6"
                          gutterBottom
                          sx={{ color: theming.colors.primary }}
                        >
                          Rewatch Zones (High Engagement)
                        </Typography>
                        <Box sx={{ height: 300 }}>
                          <Virtuoso
                            style={{ height: '100%' }}
                            data={analyticsData.rewatchZones}
                            itemContent={(index, zone: any) => (
                              <ListItem key={index}>
                                <ListItemText
                                  primary={`${Math.floor(zone.startTime / 60)}:${(zone.startTime % 60).toString().padStart(2, '0')} - ${Math.floor(zone.endTime / 60)}:${(zone.endTime % 60).toString().padStart(2, '0')}`}
                                  secondary={`${zone.rewatchCount} rewatches - ${zone.reason}`}
                                />
                                <Chip
                                  label={`${zone.rewatchCount} rewatches`}
                                  color="primary"
                                  size="small"
                                />
                              </ListItem>
                            )}
                          />
                        </Box>
                      </Box>

                      {/* Quiz Analytics */}
                      <Box>
                        <Typography
                          variant="h6"
                          gutterBottom
                          sx={{ color: theming.colors.primary }}
                        >
                          Quiz Performance
                        </Typography>
                        <Grid container spacing={2}>
                          <Grid item xs={12} sm={4}>
                            <Card sx={{ p: 2, textAlign: 'center' }}>
                              <Typography variant="h4" color="primary">
                                {analyticsData.quizAnalytics.totalQuizzes}
                              </Typography>
                              <Typography variant="body2" color="text.secondary">
                                Total Quizzes
                              </Typography>
                            </Card>
                          </Grid>
                          <Grid item xs={12} sm={4}>
                            <Card sx={{ p: 2, textAlign: 'center' }}>
                              <Typography variant="h4" color="primary">
                                {Math.round(analyticsData.quizAnalytics.averageScore * 100)}%
                              </Typography>
                              <Typography variant="body2" color="text.secondary">
                                Average Score
                              </Typography>
                            </Card>
                          </Grid>
                          <Grid item xs={12} sm={4}>
                            <Card sx={{ p: 2, textAlign: 'center' }}>
                              <Typography variant="h4" color="primary">
                                {analyticsData.quizAnalytics.questionAnalysis.length}
                              </Typography>
                              <Typography variant="body2" color="text.secondary">
                                Questions Analyzed
                              </Typography>
                            </Card>
                          </Grid>
                        </Grid>
                      </Box>

                      {/* User Progress Table */}
                      <Box>
                        <Typography
                          variant="h6"
                          gutterBottom
                          sx={{ color: theming.colors.primary }}
                        >
                          Student Progress
                        </Typography>
                        <Paper sx={{ width: '100%', height: 500, overflow: 'hidden' }}>
                          <AnimatePresence>
                            <Virtuoso
                              style={{ height: '100%' }}
                              data={Object.entries(userProgress)}
                              itemContent={(index, [userId, progress]: [string, any]) => (
                                <StudentProgressItem
                                  key={userId}
                                  userId={userId}
                                  progress={progress}
                                />
                              )}
                            />
                          </AnimatePresence>
                        </Paper>
                      </Box>
                    </Stack>
                  )}
                </Box>
              </Stack>
            </TabPanel>

            {/* Versioning Tab */}
            <TabPanel value="5" sx={{ p: 0, mt: 2 }}>
              <Stack spacing={3}>
                <Typography variant="h6" sx={{ color: theming.colors.primary }}>
                  Media Versioning & Analytics Continuity
                </Typography>

                <Alert severity="info" sx={{ mb: 2 }}>
                  Replace media files without breaking existing links. Analytics data is preserved
                  across versions.
                </Alert>

                {/* Media Version History */}
                <Box>
                  <Typography variant="subtitle1" gutterBottom>
                    Media Version History
                  </Typography>
                  {Object.keys(mediaVersions).length > 0 ? (
                    <Box sx={{ height: 400 }}>
                      <Virtuoso
                        style={{ height: '100%' }}
                        data={Object.entries(mediaVersions)}
                        itemContent={(index, [mediaId, versions]: [string, any[]]) => (
                          <Card key={mediaId} sx={{ p: 2, mb: 2 }}>
                            <Typography variant="subtitle2" gutterBottom>
                              Media ID: {mediaId}
                            </Typography>
                            <Box sx={{ maxHeight: 200, overflow: 'auto' }}>
                              <Virtuoso
                                style={{ height: versions.length * 80 }}
                                data={versions}
                                itemContent={(vIndex, version: any) => (
                                  <ListItem key={version.id}>
                                    <ListItemText
                                      primary={`Version ${version.id} - ${new Date(version.timestamp).toLocaleString()}`}
                                      secondary={version.versionNotes}
                                    />
                                    <Stack direction="row" spacing={1}>
                                      <Chip
                                        label="Analytics Preserved"
                                        color="success"
                                        size="small"
                                        icon={<CheckCircle />}
                                      />
                                      <Button
                                        size="small"
                                        variant="outlined"
                                        onClick={() => restoreMediaVersion(mediaId, version.id)}
                                      >
                                        Restore
                                      </Button>
                                    </Stack>
                                  </ListItem>
                                )}
                              />
                            </Box>
                          </Card>
                        )}
                      />
                    </Box>
                  ) : (
                    <Paper sx={{ p: 4, textAlign: 'center' }}>
                      <Typography variant="body2" color="text.secondary">
                        No media versions created yet. Create a version when you replace media
                        files.
                      </Typography>
                    </Paper>
                  )}
                </Box>

                {/* Create New Version */}
                <Box>
                  <Typography variant="subtitle1" gutterBottom>
                    Create New Media Version
                  </Typography>
                  <Card sx={{ p: 2 }}>
                    <Stack spacing={2}>
                      <TextField
                        label="Media ID"
                        placeholder="Enter media ID to version"
                        fullWidth
                      />
                      <TextField
                        label="New Media URL"
                        placeholder="Enter new media URL"
                        fullWidth
                      />
                      <TextField
                        label="Version Notes"
                        placeholder="Describe what changed in this version"
                        multiline
                        rows={2}
                        fullWidth
                      />
                      <Button
                        variant="contained"
                        onClick={() => {
                          // This would be connected to actual form inputs
                          console.log('Creating media version...');
                        }}
                        sx={theming.getThemedButtonSx()}
                      >
                        Create Version
                      </Button>
                    </Stack>
                  </Card>
                </Box>
              </Stack>
            </TabPanel>

            {/* Settings Tab */}
            <TabPanel value="6" sx={{ p: 0, mt: 2 }}>
              <Stack spacing={3}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={course.isPublished}
                      onChange={(e) =>
                        setCourse((prev) => ({ ...prev, isPublished: e.target.checked }))
                      }
                    />
                  }
                  label="Publish Course"
                />

                <FormControlLabel
                  control={
                    <Switch
                      checked={course.isFree}
                      onChange={(e) => setCourse((prev) => ({ ...prev, isFree: e.target.checked }))}
                    />
                  }
                  label="Free Course"
                />
              </Stack>
            </TabPanel>

            {/* Pricing Tab */}
            <TabPanel value="7" sx={{ p: 0, mt: 2 }}>
              <Stack spacing={3}>
                <TextField
                  label="Course Price (NOK)"
                  type="number"
                  value={course.price}
                  onChange={(e) =>
                    setCourse((prev) => ({ ...prev, price: Number(e.target.value) }))
                  }
                  disabled={course.isFree}
                  fullWidth
                />
              </Stack>
            </TabPanel>
          </TabContext>
        </Box>
      </Box>

      {/* Video Processor Dialog */}
      <Dialog open={showVideoProcessor} onClose={handleCloseVideoProcessor} maxWidth="xl" fullWidth>
        <DialogTitle>
          <Stack direction="row" alignItems="center" spacing={2}>
            <Typography variant="h6" sx={{ color: theming.colors.primary }}>
              {videoProcessorMode === 'annotations'
                ? 'Video Annotation Editor'
                : 'Video Chapter Manager'}
            </Typography>
            <Chip
              label={videoProcessorMode === 'annotations' ? 'Annotations' : 'Chapters'}
              color="primary"
              size="small"
            />
          </Stack>
        </DialogTitle>
        <DialogContent sx={{ p: 0, height: '80vh' }}>
          {videoProcessorMode === 'annotations' ? (
            <VideoAnnotationEditor
              videoUrl={currentVideoUrl}
              duration={0} // Would be calculated from video metadata
              annotations={videoAnnotations}
              onAnnotationsChange={setVideoAnnotations}
              onSave={handleSaveAnnotations}
              onCancel={handleCloseVideoProcessor}
            />
          ) : (
            <VideoChapterManager
              videoUrl={currentVideoUrl}
              duration={0} // Would be calculated from video metadata
              chapters={videoChapters}
              onChaptersChange={setVideoChapters}
              onSave={handleSaveChapters}
              onCancel={handleCloseVideoProcessor}
              onAutoDetect={async (url) => {
                const service = VideoProcessingService.getInstance();
                return await service.autoDetectChapters(url, 0.7);
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Lesson Dialog */}
      <Dialog
        open={showLessonDialog}
        onClose={() => setShowLessonDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>{editingLesson ? 'Edit Lesson' : 'Add New Lesson'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Lesson Title"
              value={lesson.title}
              onChange={(e) => setLesson((prev) => ({ ...prev, title: e.target.value }))}
              fullWidth
            />

            <TextField
              label="Lesson Description"
              value={lesson.description}
              onChange={(e) => setLesson((prev) => ({ ...prev, description: e.target.value }))}
              multiline
              rows={3}
              fullWidth
            />

            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Video Upload
              </Typography>
              <Stack direction="row" spacing={2} alignItems="center">
                <UniversalFileUpload
                  allowedTypes="videos"
                  maxFiles={1}
                  onFilesSelected={(files) => {
                    if (files[0]) {
                      setLesson((prev) => ({ ...prev, videoUrl: URL.createObjectURL(files[0]) }));
                    }
                  }}
                  profession="videographer"
                />
                <Button
                  variant="outlined"
                  startIcon={theming.getThemedIcon('videoLibrary')}
                  onClick={() => handleOpenAssetBrowser('video')}
                >
                  Browse Videos
                </Button>
              </Stack>

              {lesson.videoUrl && (
                <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
                  <Button
                    variant="outlined"
                    startIcon={<VideoPlayerIcon />}
                    onClick={() => handleOpenVideoProcessor(lesson.videoUrl, 'annotations')}
                  >
                    Add Annotations
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={<ChapterIcon />}
                    onClick={() => handleOpenVideoProcessor(lesson.videoUrl, 'chapters')}
                  >
                    Manage Chapters
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={<TextFields />}
                    onClick={handleOpenLowerThirds}
                  >
                    Lower Thirds
                  </Button>
                  <Button
                    variant="contained"
                    startIcon={<VideoProcessingIcon />}
                    onClick={() => handleProcessVideo(lesson.videoUrl)}
                    disabled={isProcessingVideo}
                    sx={theming.getThemedButtonSx()}
                  >
                    {isProcessingVideo
                      ? `Processing... ${videoProcessingProgress}%`
                      : 'Auto-Process Video'}
                  </Button>
                </Stack>
              )}
            </Box>

            <TextField
              label="Duration (seconds)"
              type="number"
              value={lesson.duration}
              onChange={(e) => setLesson((prev) => ({ ...prev, duration: Number(e.target.value) }))}
              fullWidth
            />

            <FormControlLabel
              control={
                <Switch
                  checked={lesson.isPreview}
                  onChange={(e) => setLesson((prev) => ({ ...prev, isPreview: e.target.checked }))}
                />
              }
              label="Preview Lesson (free for all students)"
            />

            {/* Instructor Takeaways Section */}
            <Accordion
              expanded={showTakeawaysAccordion}
              onChange={() => setShowTakeawaysAccordion(!showTakeawaysAccordion)}
              sx={{ mt: 2 }}
            >
              <AccordionSummary expandIcon={<ExpandMore />}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <NoteIcon />
                  <Typography variant="subtitle1" fontWeight={600}>
                    Instructor Takeaways
                  </Typography>
                  <Chip
                    label={`${(lesson.takeaways?.keyTakeaways?.length || 0) + (lesson.takeaways?.learningObjectives?.length || 0) + (lesson.takeaways?.lessonHighlights?.length || 0) + (lesson.takeaways?.learningSummary?.length || 0)} items`}
                    size="small"
                    color="primary"
                    variant="outlined"
                  />
                </Stack>
              </AccordionSummary>
              <AccordionDetails>
                <TabContext value={takeawayTab}>
                  <TabList
                    onChange={(_, newValue) => setTakeawayTab(newValue)}
                    variant="scrollable"
                    scrollButtons="auto"
                    sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}
                  >
                    <Tab label="Key Takeaways" value="keyTakeaways" />
                    <Tab label="Learning Objectives" value="learningObjectives" />
                    <Tab label="Lesson Highlights" value="lessonHighlights" />
                    <Tab label="Learning Summary" value="learningSummary" />
                    <Tab label="Instructor Notes" value="instructorNotes" />
                    <Tab label="Video Summary" value="videoSummaryNotes" />
                  </TabList>

                  {/* Key Takeaways Tab */}
                  <TabPanel value="keyTakeaways" sx={{ p: 0 }}>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      The most important concepts students should remember from this lesson.
                    </Typography>
                    <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
                      <TextField
                        label="Add Key Takeaway"
                        value={newTakeawayItem}
                        onChange={(e) => setNewTakeawayItem(e.target.value)}
                        size="small"
                        fullWidth
                        onKeyPress={(e) => {
                          if (e.key === 'Enter' && newTakeawayItem.trim()) {
                            setLesson((prev) => ({
                              ...prev,
                              takeaways: {
                                ...prev.takeaways,
                                keyTakeaways: [...(prev.takeaways?.keyTakeaways || []), newTakeawayItem.trim()],
                              },
                            }));
                            setNewTakeawayItem('');
                          }
                        }}
                      />
                      <Button
                        variant="contained"
                        onClick={() => {
                          if (newTakeawayItem.trim()) {
                            setLesson((prev) => ({
                              ...prev,
                              takeaways: {
                                ...prev.takeaways,
                                keyTakeaways: [...(prev.takeaways?.keyTakeaways || []), newTakeawayItem.trim()],
                              },
                            }));
                            setNewTakeawayItem('');
                          }
                        }}
                        sx={theming.getThemedButtonSx()}
                      >
                        <Add />
                      </Button>
                    </Stack>
                    <Stack direction="row" flexWrap="wrap" gap={1}>
                      {lesson.takeaways?.keyTakeaways?.map((item, idx) => (
                        <Chip
                          key={idx}
                          label={item}
                          onDelete={() => {
                            setLesson((prev) => ({
                              ...prev,
                              takeaways: {
                                ...prev.takeaways,
                                keyTakeaways: prev.takeaways?.keyTakeaways?.filter((_, i) => i !== idx) || [],
                              },
                            }));
                          }}
                          color="primary"
                          variant="outlined"
                        />
                      ))}
                    </Stack>
                  </TabPanel>

                  {/* Learning Objectives Tab */}
                  <TabPanel value="learningObjectives" sx={{ p: 0 }}>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      What students should be able to understand or do after completing this lesson.
                    </Typography>
                    <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
                      <TextField
                        label="Add Learning Objective"
                        value={newTakeawayItem}
                        onChange={(e) => setNewTakeawayItem(e.target.value)}
                        size="small"
                        fullWidth
                        onKeyPress={(e) => {
                          if (e.key === 'Enter' && newTakeawayItem.trim()) {
                            setLesson((prev) => ({
                              ...prev,
                              takeaways: {
                                ...prev.takeaways,
                                learningObjectives: [...(prev.takeaways?.learningObjectives || []), newTakeawayItem.trim()],
                              },
                            }));
                            setNewTakeawayItem('');
                          }
                        }}
                      />
                      <Button
                        variant="contained"
                        onClick={() => {
                          if (newTakeawayItem.trim()) {
                            setLesson((prev) => ({
                              ...prev,
                              takeaways: {
                                ...prev.takeaways,
                                learningObjectives: [...(prev.takeaways?.learningObjectives || []), newTakeawayItem.trim()],
                              },
                            }));
                            setNewTakeawayItem('');
                          }
                        }}
                        sx={theming.getThemedButtonSx()}
                      >
                        <Add />
                      </Button>
                    </Stack>
                    <Stack direction="row" flexWrap="wrap" gap={1}>
                      {lesson.takeaways?.learningObjectives?.map((item, idx) => (
                        <Chip
                          key={idx}
                          label={item}
                          onDelete={() => {
                            setLesson((prev) => ({
                              ...prev,
                              takeaways: {
                                ...prev.takeaways,
                                learningObjectives: prev.takeaways?.learningObjectives?.filter((_, i) => i !== idx) || [],
                              },
                            }));
                          }}
                          color="success"
                          variant="outlined"
                        />
                      ))}
                    </Stack>
                  </TabPanel>

                  {/* Lesson Highlights Tab */}
                  <TabPanel value="lessonHighlights" sx={{ p: 0 }}>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      The main ideas and highlights from this lesson in an informal format.
                    </Typography>
                    <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
                      <TextField
                        label="Add Lesson Highlight"
                        value={newTakeawayItem}
                        onChange={(e) => setNewTakeawayItem(e.target.value)}
                        size="small"
                        fullWidth
                        onKeyPress={(e) => {
                          if (e.key === 'Enter' && newTakeawayItem.trim()) {
                            setLesson((prev) => ({
                              ...prev,
                              takeaways: {
                                ...prev.takeaways,
                                lessonHighlights: [...(prev.takeaways?.lessonHighlights || []), newTakeawayItem.trim()],
                              },
                            }));
                            setNewTakeawayItem('');
                          }
                        }}
                      />
                      <Button
                        variant="contained"
                        onClick={() => {
                          if (newTakeawayItem.trim()) {
                            setLesson((prev) => ({
                              ...prev,
                              takeaways: {
                                ...prev.takeaways,
                                lessonHighlights: [...(prev.takeaways?.lessonHighlights || []), newTakeawayItem.trim()],
                              },
                            }));
                            setNewTakeawayItem('');
                          }
                        }}
                        sx={theming.getThemedButtonSx()}
                      >
                        <Add />
                      </Button>
                    </Stack>
                    <Stack direction="row" flexWrap="wrap" gap={1}>
                      {lesson.takeaways?.lessonHighlights?.map((item, idx) => (
                        <Chip
                          key={idx}
                          label={item}
                          onDelete={() => {
                            setLesson((prev) => ({
                              ...prev,
                              takeaways: {
                                ...prev.takeaways,
                                lessonHighlights: prev.takeaways?.lessonHighlights?.filter((_, i) => i !== idx) || [],
                              },
                            }));
                          }}
                          color="warning"
                          variant="outlined"
                        />
                      ))}
                    </Stack>
                  </TabPanel>

                  {/* Learning Summary Tab */}
                  <TabPanel value="learningSummary" sx={{ p: 0 }}>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      A short list highlighting the key points from this video lesson.
                    </Typography>
                    <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
                      <TextField
                        label="Add Summary Point"
                        value={newTakeawayItem}
                        onChange={(e) => setNewTakeawayItem(e.target.value)}
                        size="small"
                        fullWidth
                        onKeyPress={(e) => {
                          if (e.key === 'Enter' && newTakeawayItem.trim()) {
                            setLesson((prev) => ({
                              ...prev,
                              takeaways: {
                                ...prev.takeaways,
                                learningSummary: [...(prev.takeaways?.learningSummary || []), newTakeawayItem.trim()],
                              },
                            }));
                            setNewTakeawayItem('');
                          }
                        }}
                      />
                      <Button
                        variant="contained"
                        onClick={() => {
                          if (newTakeawayItem.trim()) {
                            setLesson((prev) => ({
                              ...prev,
                              takeaways: {
                                ...prev.takeaways,
                                learningSummary: [...(prev.takeaways?.learningSummary || []), newTakeawayItem.trim()],
                              },
                            }));
                            setNewTakeawayItem('');
                          }
                        }}
                        sx={theming.getThemedButtonSx()}
                      >
                        <Add />
                      </Button>
                    </Stack>
                    <Stack direction="row" flexWrap="wrap" gap={1}>
                      {lesson.takeaways?.learningSummary?.map((item, idx) => (
                        <Chip
                          key={idx}
                          label={item}
                          onDelete={() => {
                            setLesson((prev) => ({
                              ...prev,
                              takeaways: {
                                ...prev.takeaways,
                                learningSummary: prev.takeaways?.learningSummary?.filter((_, i) => i !== idx) || [],
                              },
                            }));
                          }}
                          color="info"
                          variant="outlined"
                        />
                      ))}
                    </Stack>
                  </TabPanel>

                  {/* Instructor Notes Tab */}
                  <TabPanel value="instructorNotes" sx={{ p: 0 }}>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      Additional comments and notes from the instructor beyond the video content.
                    </Typography>
                    <TextField
                      label="Instructor Notes"
                      value={lesson.takeaways?.instructorNotes || ''}
                      onChange={(e) => setLesson((prev) => ({
                        ...prev,
                        takeaways: {
                          ...prev.takeaways,
                          instructorNotes: e.target.value,
                        },
                      }))}
                      multiline
                      rows={4}
                      fullWidth
                      placeholder="Add any additional notes, tips, or commentary for students..."
                    />
                  </TabPanel>

                  {/* Video Summary Notes Tab */}
                  <TabPanel value="videoSummaryNotes" sx={{ p: 0 }}>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      Notes tied directly to the content of the video.
                    </Typography>
                    <TextField
                      label="Video Summary Notes"
                      value={lesson.takeaways?.videoSummaryNotes || ''}
                      onChange={(e) => setLesson((prev) => ({
                        ...prev,
                        takeaways: {
                          ...prev.takeaways,
                          videoSummaryNotes: e.target.value,
                        },
                      }))}
                      multiline
                      rows={4}
                      fullWidth
                      placeholder="Summarize the key content covered in this video..."
                    />
                  </TabPanel>
                </TabContext>
              </AccordionDetails>
            </Accordion>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowLessonDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleLessonSave} sx={theming.getThemedButtonSx()}>
            {editingLesson ? 'Update Lesson' : 'Add Lesson'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Asset Browser Dialog */}
      <Dialog
        open={showAssetBrowser}
        onClose={handleCloseAssetBrowser}
        maxWidth="lg"
        fullWidth
        fullScreen
      >
        <DialogTitle>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Typography variant="h6" sx={{ color: theming.colors.primary }}>
              {assetBrowserMode === 'thumbnail'
                ? 'Select Course Thumbnail'
                : assetBrowserMode === 'video'
                  ? 'Select Lesson Video'
                  : 'Browse Assets'}
            </Typography>
            <IconButton onClick={handleCloseAssetBrowser}>
              {theming.getThemedIcon('close')}
            </IconButton>
          </Stack>
        </DialogTitle>
        <DialogContent sx={{ p: 0 }}>
          <AcademyAssetBrowser
            onAssetSelect={handleAssetSelect}
            onAssetUpload={handleAssetUpload}
            selectedAsset={selectedAsset}
            mode="select"
            allowedTypes={
              assetBrowserMode === 'thumbnail'
                ? ['image']
                : assetBrowserMode === 'video'
                  ? ['video']
                  : ['image','video','audio','document']
            }
            height={600}
          />
        </DialogContent>
      </Dialog>

      {/* Thumbnail Selection Dialog - Auto-generated options */}
      <Dialog
        open={showThumbnailDialog}
        onClose={() => {
          setShowThumbnailDialog(false);
          setThumbnailOptions([]);
        }}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ bgcolor: '#ff8c00', color: 'white' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <AutoAwesome />
            <Box>
              <Typography variant="h6">Velg Thumbnail</Typography>
              <Typography variant="caption" sx={{ opacity: 0.9 }}>
                {thumbnailOptions.length} auto-genererte alternativer fra video
              </Typography>
            </Box>
          </Box>
        </DialogTitle>

        <DialogContent dividers sx={{ p: 3 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            AI har generert {thumbnailOptions.length} thumbnail-forslag fra videoen din. Velg det
            som best representerer kurset.
          </Typography>

          <Grid container spacing={2}>
            {thumbnailOptions.map((option: any, index: number) => (
              <Grid item xs={6} key={index}>
                <Card
                  sx={{
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    border:
                      course.thumbnail === option.url ? '3px solid #ff8c00' : '2px solid #e0e0e0','&:hover': {
                      transform: 'scale(1.05)',
                      boxShadow: 4,
                      borderColor: '#ff8c00',
                    }}}
                  onClick={() => {
                    setCourse((prev) => ({ ...prev, thumbnail: option.url }));
                    analytics.trackEvent('course_thumbnail_selected', {
                      courseId: course.id,
                      thumbnailIndex: index,
                      timestamp: option.timestamp,
                      autoGenerated: true,
                    });
                  }}
                >
                  <Box
                    sx={{
                      height: 150,
                      background: `url(${option.url})`,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                      position: 'relative'}}
                  >
                    {course.thumbnail === option.url && (
                      <Chip
                        label="Valgt ✓"
                        size="small"
                        sx={{
                          position: 'absolute',
                          top: 8,
                          right: 8,
                          bgcolor: '#16a34a',
                          color: 'white',
                          fontWeight: 600}}
                      />
                    )}
                    <Chip
                      label={`${option.timestamp}s`}
                      size="small"
                      sx={{
                        position: 'absolute',
                        bottom: 8,
                        left: 8,
                        bgcolor: 'rgba(0,0,0,0.7)',
                        color: 'white'}}
                    />
                  </Box>
                  <CardContent sx={{ p: 1.5, textAlign: 'center' }}>
                    <Typography variant="caption" color="text.secondary">
                      Frame {index + 1} av {thumbnailOptions.length}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </DialogContent>

        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setShowThumbnailDialog(false)}>Avbryt</Button>
          <Button
            variant="contained"
            onClick={() => {
              setShowThumbnailDialog(false);
              setThumbnailOptions([]);
            }}
            disabled={!course.thumbnail}
            sx={{ bgcolor: '#ff8c00' }}
          >
            Bruk Valgt Thumbnail
          </Button>
        </DialogActions>
      </Dialog>

      {/* Lower Thirds Dialog */}
      <Dialog
        open={showLowerThirds}
        onClose={handleCloseLowerThirds}
        maxWidth="lg"
        fullWidth
        fullScreen
      >
        <DialogTitle>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Typography variant="h6" sx={{ color: theming.colors.primary }}>
              Animated Lower Thirds
            </Typography>
            <IconButton onClick={handleCloseLowerThirds}>
              {theming.getThemedIcon('close')}
            </IconButton>
          </Stack>
        </DialogTitle>
        <DialogContent sx={{ p: 0 }}>
          <AnimatedLowerThirds
            courseId={course.id}
            lessonId={lesson.id}
            onLowerThirdSelect={handleLowerThirdSelect}
            onLowerThirdSave={handleLowerThirdSave}
            onLowerThirdDelete={handleLowerThirdDelete}
            selectedLowerThird={selectedLowerThird}
            mode="browse"
            showPreview={true}
            height={600}
          />
        </DialogContent>
      </Dialog>

      {/* Module Manager Dialog */}
      <Dialog
        open={showModuleManager}
        onClose={handleCloseModuleManager}
        maxWidth="lg"
        fullWidth
        fullScreen
      >
        <DialogTitle>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Typography variant="h6" sx={{ color: theming.colors.primary }}>
              Module Manager
            </Typography>
            <IconButton onClick={handleCloseModuleManager}>
              <Close />
            </IconButton>
          </Stack>
        </DialogTitle>
        <DialogContent sx={{ p: 0 }}>
          <ModuleManager
            courseId={course.id}
            modules={course.modules}
            onModuleUpdate={handleModuleUpdate}
            onModuleSelect={handleModuleSelect}
            selectedModule={selectedModule}
            mode="browse"
            showPreview={true}
            height={600}
          />
        </DialogContent>
      </Dialog>

      {/* CTA Overlay Editor Dialog */}
      <Dialog
        open={showCTAEditor}
        onClose={handleCloseCTAEditor}
        maxWidth="lg"
        fullWidth
        fullScreen
      >
        <DialogTitle>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Typography variant="h6" sx={{ color: theming.colors.primary }}>
              Call-to-Action Overlay Editor
            </Typography>
            <IconButton onClick={handleCloseCTAEditor}>
              <Close />
            </IconButton>
          </Stack>
        </DialogTitle>
        <DialogContent sx={{ p: 2 }}>
          <CTAOverlayEditor
            courseId={course.id}
            lessonId={lesson.id}
            onCTASelect={handleCTASelect}
            onCTASave={handleCTASave}
            onCTADelete={handleCTADelete}
            selectedCTA={selectedCTA}
            mode="browse"
            showPreview={true}
            height={600}
          />
        </DialogContent>
      </Dialog>

      {/* Course Creator Sidebar */}
      <CourseCreatorSidebar
        open={showSidebar}
        onClose={handleSidebarClose}
        course={course}
        onCourseUpdate={handleCourseUpdate}
        onPublish={handlePublish}
        onSaveDraft={handleSaveDraft}
        onPreview={handlePreview}
        onShare={handleShare}
        onExport={handleExport}
        onImport={handleImport}
        onDelete={handleDelete}
        onVersionRestore={handleVersionRestore}
        onVersionCreate={handleVersionCreate}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        modules={course.modules || []}
        lessons={course.lessons || []}
        resources={course.resources || []}
        lowerThirds={lowerThirds}
        width={320}
      />

      {/* Floating Action Menu for Course Creator */}
      <AcademyFloatingActionMenu
        onCourseCreate={() => {
          /* Already in course creator */
        }}
        onModuleCreate={handleOpenModuleManager}
        onLessonCreate={() => setShowLessonDialog(true)}
        onAssetBrowserOpen={() => setShowAssetBrowser(true)}
        onLowerThirdsOpen={handleOpenLowerThirds}
        onSearchOpen={() => {
          /* Implement search */
        }}
        onSettingsOpen={() => {
          /* Implement settings */
        }}
        onHelpOpen={() => {
          /* Implement help */
        }}
        onQuickSave={handleSave}
        onQuickPreview={() => {
          /* Implement preview */
        }}
        onQuickShare={() => {
          /* Implement share */
        }}
        onQuickExport={() => {
          /* Implement export */
        }}
        position="bottom-left"
        variant="fab"
        showNotifications={false}
        showAutoSave={true}
        showQuickActions={true}
        customActions={[
          {
            id: 'save-course',
            label: 'Save Course',
            icon: theming.getThemedIcon('save'),
            onClick: handleSave,
            color: '#4caf50',
          },
          {
            id: 'preview-course',
            label: 'Preview Course',
            icon: theming.getThemedIcon('visibility'),
            onClick: () => {
              /* Implement preview */
            },
            color: '#2196f3',
          },
          {
            id: 'publish-course',
            label: 'Publish Course',
            icon: <Publish />,
            onClick: () => handlePublish(course),
            color: '#ff9800',
          },
        ]}
      />
        </Box>
      </LazyMotion>
    </ErrorBoundary>
  );
}

export default withUniversalIntegration(CourseCreator, {
  componentId: 'course-creator',
  componentName: 'Course Creator',
  componentType: 'editor',
  componentCategory: 'academy',
  featureIds: [
    'course-creation',
    'course-management',
    'lesson-creation',
    'content-management',
    'media-upload',
    'course-publishing',
    'analytics-academy',
  ],
});
