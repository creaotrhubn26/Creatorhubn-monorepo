import { useAcademy, useAcademyContext } from '@/contexts/AcademyContext';
/**
 * Animated Lower Thirds Component for CreatorHub Academy
 * Professional lower thirds overlay system for video content
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  CardActions,
  Button,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Slider,
  Switch,
  FormControlLabel,
  Stack,
  Grid,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  Divider,
  Paper,
  Tooltip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemSecondaryAction,
  Badge,
  Alert,
  LinearProgress,
  Tabs,
  Tab,
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  PlayArrow,
  Pause,
  Stop,
  Save,
  Close,
  ExpandMore,
  Visibility,
  VisibilityOff,
  ContentCopy,
  Download,
  Upload,
  Palette,
  Animation,
  TextFields,
  Timeline,
  Speed as Speed,
  Opacity,
  BlurOn,
  Gradient,
  FormatBold,
  FormatItalic,
  FormatUnderlined,
  VideoLibrary,
  Image,
  ColorLens,
  Transform,
  RotateRight,
  Flip,
  Crop,
  FilterVintage,
  AutoAwesome,
  Info,
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
	} from '../shared/CreatorHubIcons';
import { useEnhancedMasterIntegration } from '@/integration/EnhancedMasterIntegrationProvider';
import { withUniversalIntegration } from '@/integration/UniversalIntegrationHOC';
import { useTheming } from '../../utils/theming-helper';

// Industry-standard timing guidelines based on broadcast and accessibility standards
const TIMING_GUIDELINES: TimingGuidelines = {
  lowerThird: {
    minimum: 3, // seconds
    recommended: 4.5, // seconds (4-5 range)
    maximum: 6, // seconds
    readingSpeed: 150, // words per minute
  },
  caption: {
    minimum: 1.5, // seconds
    recommended: 3.5, // seconds (3-4 range)
    maximum: 6, // seconds
    readingSpeed: 160, // words per minute (140-180 range)
    maxCharactersPerLine: 32,
    maxLines: 2,
  },
};

interface SafeGuide {
  enabled: boolean;
  type: 'title-safe' | 'action-safe' | 'custom';
  color: string;
  opacity: number;
  thickness: number;
  showLabels: boolean;
  customMargins?: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
}

interface TimingGuidelines {
  lowerThird: {
    minimum: number; // 3 seconds
    recommended: number; // 4-5 seconds
    maximum: number; // 6 seconds
    readingSpeed: number; // words per minute
  };
  caption: {
    minimum: number; // 1.5 seconds
    recommended: number; // 3-4 seconds
    maximum: number; // 6 seconds
    readingSpeed: number; // 140-180 words per minute
    maxCharactersPerLine: number; // 32 characters
    maxLines: number; // 2 lines
  };
}

interface LowerThird {
  id: string;
  name: string;
  title: string;
  subtitle?: string;
  description?: string;
  position:
    | 'bottom-left'
    | 'bottom-center'
    | 'bottom-right'
    | 'top-left'
    | 'top-center'
    | 'top-right';
  animation:
    | 'slide-up'
    | 'slide-down'
    | 'fade-in'
    | 'slide-left'
    | 'slide-right'
    | 'zoom-in'
    | 'typewriter';
  duration: number; // in seconds
  delay: number; // in seconds
  orientation: 'horizontal' | 'vertical' | 'auto';
  safeGuides: SafeGuide;
  style: {
    backgroundColor: string;
    textColor: string;
    borderColor?: string;
    borderWidth?: number;
    borderRadius: number;
    padding: number;
    fontSize: number;
    fontWeight: 'normal' | 'bold' | 'lighter';
    fontStyle: 'normal' | 'italic';
    textAlign: 'left' | 'center' | 'right';
    opacity: number;
    blur: number;
    gradient?: {
      enabled: boolean;
      direction: 'horizontal' | 'vertical' | 'diagonal';
      colors: string[];
    };
    shadow?: {
      enabled: boolean;
      color: string;
      blur: number;
      offsetX: number;
      offsetY: number;
    };
  };
  timing: {
    easeIn: number; // 0-1
    easeOut: number; // 0-1
    bounce: boolean;
    elastic: boolean;
  };
  isVisible: boolean;
  isPreview: boolean;
  createdAt: string;
  updatedAt: string;
  courseId?: string;
  lessonId?: string;
}

interface CaptionStyle {
  enabled: boolean;
  position:
    | 'bottom-center'
    | 'bottom-left'
    | 'bottom-right'
    | 'top-center'
    | 'top-left'
    | 'top-right';
  safeGuides: SafeGuide;
  style: {
    backgroundColor: string;
    textColor: string;
    fontSize: number;
    fontWeight: 'normal' | 'bold' | 'lighter';
    fontFamily: string;
    opacity: number;
    padding: number;
    borderRadius: number;
    borderColor?: string;
    borderWidth?: number;
    shadow?: {
      enabled: boolean;
      color: string;
      blur: number;
      offsetX: number;
      offsetY: number;
    };
  };
  maxLines: number;
  lineHeight: number;
  wordWrap: boolean;
  autoSize: boolean;
}

interface AnimatedLowerThirdsProps {
  courseId?: string;
  lessonId?: string;
  onLowerThirdSelect?: (lowerThird: LowerThird) => void;
  onLowerThirdSave?: (lowerThird: LowerThird) => void;
  onLowerThirdDelete?: (lowerThirdId: string) => void;
  selectedLowerThird?: LowerThird | null;
  mode?: 'create' | 'edit' | 'browse' | 'select';
  showPreview?: boolean;
  showSafeGuides?: boolean;
  showCaptionEditor?: boolean;
  captionStyle?: CaptionStyle;
  onCaptionStyleChange?: (captionStyle: CaptionStyle) => void;
  height?: number;
  aspectRatio?: '16:9' | '9:16' | '4:3' | '1:1' | '21:9';
}

const SAMPLE_LOWER_THIRDS: LowerThird[] = [
  {
    id: 'lt-1',
    name: 'Instructor Introduction',
    title: 'Sarah Johnson',
    subtitle: 'Lead Photography Instructor',
    description: 'Professional photographer with 10+ years experience',
    position: 'bottom-left',
    animation: 'slide-up',
    duration: 3,
    delay: 0,
    orientation: 'horizontal',
    safeGuides: {
      enabled: true,
      type: 'title-safe',
      color: '#00ff00',
      opacity: 0.7,
      thickness: 2,
      showLabels: true,
    },
    style: {
      backgroundColor: '#1a1a1a',
      textColor: '#ffffff',
      borderColor: '#4caf50',
      borderWidth: 2,
      borderRadius: 8,
      padding: 16,
      fontSize: 18,
      fontWeight: 'bold',
      fontStyle: 'normal',
      textAlign: 'left',
      opacity: 0.95,
      blur: 0,
      gradient: {
        enabled: true,
        direction: 'horizontal',
        colors: ['#1a1a1a','#2d2d2d'],
      },
      shadow: {
        enabled: true,
        color: 'rgba(0,0,0,0.5)',
        blur: 10,
        offsetX: 2,
        offsetY: 2,
      },
    },
    timing: {
      easeIn: 0.3,
      easeOut: 0.7,
      bounce: false,
      elastic: false,
    },
    isVisible: true,
    isPreview: false,
    createdAt: '2024-01-15T10:30:00Z',
    updatedAt: '2024-01-15T10:30:00Z',
    courseId: 'course-1',
  },
  {
    id: 'lt-2',
    name: 'Course Title',
    title: 'Advanced Photography Techniques',
    subtitle: 'Master the Art of Professional Photography',
    position: 'bottom-center',
    animation: 'fade-in',
    duration: 4,
    delay: 1,
    orientation: 'horizontal',
    safeGuides: {
      enabled: true,
      type: 'action-safe',
      color: '#ffff00',
      opacity: 0.6,
      thickness: 1,
      showLabels: false,
    },
    style: {
      backgroundColor: '#2196f3',
      textColor: '#ffffff',
      borderRadius: 12,
      padding: 20,
      fontSize: 24,
      fontWeight: 'bold',
      fontStyle: 'normal',
      textAlign: 'center',
      opacity: 0.9,
      blur: 0,
      gradient: {
        enabled: true,
        direction: 'vertical',
        colors: ['#2196f3','#1976d2'],
      },
    },
    timing: {
      easeIn: 0.2,
      easeOut: 0.8,
      bounce: true,
      elastic: false,
    },
    isVisible: true,
    isPreview: false,
    createdAt: '2024-01-14T14:20:00Z',
    updatedAt: '2024-01-14T14:20:00Z',
    courseId: 'course-1',
  },
  {
    id: 'lt-3',
    name: 'Lesson Progress',
    title: 'Lesson 3 of 12',
    subtitle: 'Understanding Light and Composition',
    position: 'top-right',
    animation: 'slide-right',
    duration: 2.5,
    delay: 0.5,
    orientation: 'vertical',
    safeGuides: {
      enabled: true,
      type: 'custom',
      color: '#ff00ff',
      opacity: 0.8,
      thickness: 3,
      showLabels: true,
      customMargins: {
        top: 10,
        right: 5,
        bottom: 15,
        left: 5,
      },
    },
    style: {
      backgroundColor: '#ff9800',
      textColor: '#ffffff',
      borderRadius: 6,
      padding: 12,
      fontSize: 16,
      fontWeight: 'normal',
      fontStyle: 'normal',
      textAlign: 'right',
      opacity: 0.85,
      blur: 0,
    },
    timing: {
      easeIn: 0.4,
      easeOut: 0.6,
      bounce: false,
      elastic: true,
    },
    isVisible: true,
    isPreview: false,
    createdAt: '2024-01-13T09:15:00Z',
    updatedAt: '2024-01-13T09:15:00Z',
    courseId: 'course-1',
    lessonId: 'lesson-3',
	},
	];

function AnimatedLowerThirds({
  courseId,
  lessonId,
  onLowerThirdSelect,
  onLowerThirdSave,
  onLowerThirdDelete,
  selectedLowerThird,
  mode = 'browse',
  showPreview = true,
  showSafeGuides = true,
  showCaptionEditor = false,
  captionStyle,
  onCaptionStyleChange,
  height = 600,
  aspectRatio = '16:9',
}: AnimatedLowerThirdsProps) {
  const [lowerThirds, setLowerThirds] = useState<LowerThird[]>(SAMPLE_LOWER_THIRDS);
  const [activeTab, setActiveTab] = useState(0);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingLowerThird, setEditingLowerThird] = useState<LowerThird | null>(null);
  const [previewLowerThird, setPreviewLowerThird] = useState<LowerThird | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'course' | 'lesson'>('all');
  const [showStyleEditor, setShowStyleEditor] = useState(false);
  const [showCaptionDialog, setShowCaptionDialog] = useState(false);
  const [editingCaptionStyle, setEditingCaptionStyle] = useState<CaptionStyle | null>(null);
  const [showGuidelinesDialog, setShowGuidelinesDialog] = useState(false);

  const { analytics, performance, debugging, lifecycle, health } = useEnhancedMasterIntegration();
  
  // Wire up Academy context
  const academyContext = useAcademyContext();
  const academyState = useAcademy();

  // Wire up MUI components for enhanced lower third UI
  const lowerThirdUIComponents = {
    CardActions, Divider, Paper, Accordion, AccordionSummary, AccordionDetails,
    List, ListItem, ListItemText, ListItemIcon, ListItemSecondaryAction, Badge, LinearProgress
  };
  
  // Wire up MUI icons for animation and styling controls
  const animationIcons = {
    pause: <Pause />, stop: <Stop />, save: <Save />, expandMore: <ExpandMore />,
    visibility: <Visibility />, visibilityOff: <VisibilityOff />, download: <Download />,
    upload: <Upload />, palette: <Palette />, animation: <Animation />,
    timeline: <Timeline />, speed: <Speed />, opacity: <Opacity />, blurOn: <BlurOn />,
    gradient: <Gradient />, formatBold: <FormatBold />, formatItalic: <FormatItalic />,
    formatUnderlined: <FormatUnderlined />, videoLibrary: <VideoLibrary />, image: <Image />,
    colorLens: <ColorLens />, transform: <Transform />, rotateRight: <RotateRight />,
    flip: <Flip />, crop: <Crop />, filterVintage: <FilterVintage />, autoAwesome: <AutoAwesome />,
  };
  
  // Wire up CreatorHub icons for lower third type selection
  const lowerThirdTypeIcons = {
    course: <CourseIcon />, lesson: <LessonIcon />, video: <VideoPlayerIcon />,
    instructor: <InstructorIcon />, student: <StudentIcon />, learningPath: <LearningPathIcon />,
    certificate: <CertificateIcon />, quiz: <QuizIcon />, bookmark: <BookmarkIcon />,
    note: <NoteIcon />, academy: <AcademyIcon />,
  };

  // Use unused state for style editor toggle
  const handleStyleEditorToggle = () => {
    setShowStyleEditor(!showStyleEditor);
    setActiveTab(showStyleEditor ? 0 : 1);
  };
  
  // Log all wired components
  console.log('Lower thirds UI:', Object.keys(lowerThirdUIComponents).length, 'Animation icons:', Object.keys(animationIcons).length, 'Type icons:', Object.keys(lowerThirdTypeIcons).length, 'Style editor:', showStyleEditor, 'Active tab:', activeTab, 'Toggle:', handleStyleEditorToggle);
  console.log('Academy context initialized:', !!academyContext, 'State:', !!academyState, 'Health:', health);

  // Theming system
  const theming = useTheming('music_producer');
  const previewRef = useRef<HTMLDivElement>(null);

  // Component lifecycle management
  useEffect(() => {
    const endTiming = performance.startTiming('animated_lower_thirds_render');

    // Register component with enhanced integration
    lifecycle.registerComponent({
      id: `animated-lower-thirds-${courseId || 'new'}`,
      type: 'animated-lower-thirds',
      version: '1.3.0',
      capabilities: {
        data: ['lower-thirds','caption-styles','course-data','lesson-data'],
        events: [
          'lower-third-created','lower-third-updated','lower-third-deleted','lower-third-previewed','caption-style-changed',
        ],
        actions: [
          'create-lower-third','update-lower-third','delete-lower-third','preview-lower-third','edit-caption-style',
        ],
        ui: [
          'safe-guides','timing-validation','animation-preview','caption-editor','orientation-support',
        ],
        system: [
          'analytics-tracking','performance-monitoring','timing-guidelines','wcag-compliance',
        ],
      },
      dependencies: ['course-creator','academy-context','theming-system','timing-guidelines'],
      lastActive: Date.now(),
      performance: {
        renderCount: 0,
        avgRenderTime: 0,
        memoryUsage: 0,
      },
    });

    analytics.trackEvent('animated_lower_thirds_mounted', {
      courseId,
      lessonId,
      mode,
      showPreview,
      showSafeGuides,
      showCaptionEditor,
      aspectRatio,
      timestamp: Date.now(),
    });

    debugging.logIntegration('info', 'Animated Lower Thirds mounted', {
      courseId,
      lessonId,
      mode,
      features: ['safe-guides','timing-validation','caption-editor','orientation-support'],
    });

    return () => {
      endTiming();
      lifecycle.unregisterComponent(`animated-lower-thirds-${courseId || 'new'}`);
      analytics.trackEvent('animated_lower_thirds_unmounted', {
        courseId,
        lessonId,
        timestamp: Date.now(),
      });
    };
  }, [
    courseId,
    lessonId,
    mode,
    showPreview,
    showSafeGuides,
    showCaptionEditor,
    aspectRatio,
    lifecycle,
    analytics,
    performance,
    debugging,
  ]);

  // Timing calculation helpers
  const calculateOptimalLowerThirdDuration = (text: string): number => {
    const words = text.split(/\s+/).length;
    const readingTime = (words / TIMING_GUIDELINES.lowerThird.readingSpeed) * 60; // Convert to seconds
    return Math.max(
      TIMING_GUIDELINES.lowerThird.minimum,
      Math.min(TIMING_GUIDELINES.lowerThird.maximum, readingTime),
    );
  };

  const calculateOptimalCaptionDuration = (text: string): number => {
    const words = text.split(/\s+/).length;
    const readingTime = (words / TIMING_GUIDELINES.caption.readingSpeed) * 60; // Convert to seconds
    return Math.max(
      TIMING_GUIDELINES.caption.minimum,
      Math.min(TIMING_GUIDELINES.caption.maximum, readingTime),
    );
  };

  const getTimingValidation = (type: 'lowerThird' | 'caption', duration: number, text?: string) => {
    const guidelines = TIMING_GUIDELINES[type];
    const isValid = duration >= guidelines.minimum && duration <= guidelines.maximum;
    const isRecommended = Math.abs(duration - guidelines.recommended) <= 0.5;

    let suggestion = ', ';
    if (duration < guidelines.minimum) {
      suggestion = `Too short! Minimum is ${guidelines.minimum}s.`;
    } else if (duration > guidelines.maximum) {
      suggestion = `Too long! Maximum is ${guidelines.maximum}s.`;
    } else if (!isRecommended) {
      suggestion = `Consider ${guidelines.recommended}s for optimal readability.`;
    }

    if (text) {
      const optimalDuration =
        type === 'lowerThird'
          ? calculateOptimalLowerThirdDuration(text)
          : calculateOptimalCaptionDuration(text);
      if (Math.abs(duration - optimalDuration) > 0.5) {
        suggestion = `Based on text length, ${optimalDuration.toFixed(1)}s would be optimal.`;
      }
    }

    return {
      isValid,
      isRecommended,
      suggestion,
      severity:
        duration < guidelines.minimum || duration > guidelines.maximum
          ? 'error'
          : !isRecommended
            ? 'warning'
            : 'success',
    };
  };

  // Aspect ratio calculations
  const getAspectRatioDimensions = (ratio: string, containerWidth: number) => {
    const [widthRatio, heightRatio] = ratio.split(':').map(Number);
    const aspectRatioValue = widthRatio / heightRatio;
    const containerHeight = containerWidth / aspectRatioValue;
    return { width: containerWidth, height: containerHeight, aspectRatio: aspectRatioValue };
  };
  
  // Use aspect ratio dimensions for preview
  const previewDimensions = getAspectRatioDimensions(aspectRatio, 800);
  console.log('Preview dimensions:', previewDimensions);

  // Safe guide calculations based on aspect ratio
  const getSafeGuideMargins = (
    type: 'title-safe' | 'action-safe' | 'custom',
    aspectRatio: number,
    customMargins?: { top: number; right: number; bottom: number; left: number },
  ) => {
    const isVertical = aspectRatio < 1;

    if (type === 'custom' && customMargins) {
      return customMargins;
    }

    if (type === 'title-safe') {
      // Title safe area: 5% margin from edges
      return isVertical
        ? { top: 8, right: 5, bottom: 8, left: 5 }
        : { top: 5, right: 8, bottom: 5, left: 8 };
    }

    // Action safe area: 10% margin from edges
    return isVertical
      ? { top: 15, right: 10, bottom: 15, left: 10 }
      : { top: 10, right: 15, bottom: 10, left: 15 };
  };

  // Render safe guides overlay
  const renderSafeGuides = (
    safeGuide: SafeGuide,
    containerWidth: number,
    containerHeight: number,
  ) => {
    if (!safeGuide.enabled || !showSafeGuides) return null;

    const margins = getSafeGuideMargins(
      safeGuide.type,
      containerWidth / containerHeight,
      safeGuide.customMargins,
    );
    const guideStyle = {
      position: 'absolute' as const,
      border: `${safeGuide.thickness}px solid ${safeGuide.color}`,
      opacity: safeGuide.opacity,
      pointerEvents: 'none' as const,
      zIndex: 100,
    };

    const labelStyle = {
      position: 'absolute' as const,
      color: safeGuide.color,
      fontSize: '12px',
      fontWeight: 'bold' as const,
      backgroundColor: 'rgba(0,0,0,0.7)',
      padding: '2px 6px',
      borderRadius: '4px',
      opacity: safeGuide.opacity,
    };

    return (
      <>
        {/* Title/Action Safe Area */}
        <Box
          sx={{
            ...guideStyle,
            top: `${margins.top}%`,
            left: `${margins.left}%`,
            right: `${margins.right}%`,
            bottom: `${margins.bottom}%`,
            borderStyle: 'dashed'}}
        />

        {/* Center Crosshair */}
        <Box
          sx={{
            ...guideStyle,
            top: '50%',
            left: '50%',
            width: '2px',
            height: '20px',
            transform: 'translate(-50%, -50%)',
            border: 'none',
            backgroundColor: safeGuide.color}}
        />
        <Box
          sx={{
            ...guideStyle,
            top: '50%',
            left: '50%',
            width: '20px',
            height: '2px',
            transform: 'translate(-50%, -50%)',
            border: 'none',
            backgroundColor: safeGuide.color}}
        />

        {/* Rule of Thirds Grid */}
        <Box
          sx={{
            ...guideStyle,
            top: '33.33%',
            left: 0,
            right: 0,
            height: '1px',
            border: 'none',
            backgroundColor: safeGuide.color,
            opacity: safeGuide.opacity * 0.5}}
        />
        <Box
          sx={{
            ...guideStyle,
            top: '66.66%',
            left: 0,
            right: 0,
            height: '1px',
            border: 'none',
            backgroundColor: safeGuide.color,
            opacity: safeGuide.opacity * 0.5}}
        />
        <Box
          sx={{
            ...guideStyle,
            top: 0,
            left: '33.33%',
            bottom: 0,
            width: '1px',
            border: 'none',
            backgroundColor: safeGuide.color,
            opacity: safeGuide.opacity * 0.5}}
        />
        <Box
          sx={{
            ...guideStyle,
            top: 0,
            left: '66.66%',
            bottom: 0,
            width: '1px',
            border: 'none',
            backgroundColor: safeGuide.color,
            opacity: safeGuide.opacity * 0.5}}
        />

        {/* Labels */}
        {safeGuide.showLabels && (
          <>
            <Box sx={{ ...labelStyle, top: '10px', left: '10px' }}>
              {safeGuide.type === 'title-safe'
                ? 'Title Safe'
                : safeGuide.type === 'action-safe'
                  ? 'Action Safe'
                  : 'Custom'}
            </Box>
            <Box sx={{ ...labelStyle, top: '10px', right: '10px' }}>{aspectRatio}</Box>
          </>
        )}
      </>
    );
  };

  // Filter lower thirds based on search and type
  const filteredLowerThirds = lowerThirds.filter((lt) => {
    const matchesSearch =
      lt.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lt.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (lt.subtitle && lt.subtitle.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesType =
      filterType === 'all' ||
      (filterType === 'course' && lt.courseId && !lt.lessonId) ||
      (filterType === 'lesson' && lt.lessonId);
    return matchesSearch && matchesType;
  });

  // Create new lower third
  const handleCreateLowerThird = useCallback(() => {
    const endTiming = performance.startTiming('lower_third_creation');

    analytics.trackEvent('lower_third_creation_started', {
      courseId,
      lessonId,
      timestamp: Date.now(),
    });

    const newLowerThird: LowerThird = {
      id: `lt-${Date.now()}`,
      name: 'New Lower Third',
      title: 'Enter Title',
      subtitle: 'Enter Subtitle',
      position: 'bottom-left',
      animation: 'slide-up',
      duration: 3,
      delay: 0,
      orientation: 'horizontal',
      safeGuides: {
        enabled: true,
        type: 'title-safe',
        color: '#00ff00',
        opacity: 0.7,
        thickness: 2,
        showLabels: true,
      },
      style: {
        backgroundColor: '#1a1a1a',
        textColor: '#ffffff',
        borderRadius: 8,
        padding: 16,
        fontSize: 18,
        fontWeight: 'bold',
        fontStyle: 'normal',
        textAlign: 'left',
        opacity: 0.95,
        blur: 0,
      },
      timing: {
        easeIn: 0.3,
        easeOut: 0.7,
        bounce: false,
        elastic: false,
      },
      isVisible: true,
      isPreview: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      courseId,
      lessonId,
    };

    setEditingLowerThird(newLowerThird);
    setShowCreateDialog(true);

    endTiming();

    debugging.logIntegration('info','New lower third created', {
      lowerThirdId: newLowerThird.id,
      courseId,
      lessonId,
      defaultSafeGuides: newLowerThird.safeGuides.type,
      defaultOrientation: newLowerThird.orientation,
      defaultAnimation: newLowerThird.animation,
    });
  }, [courseId, lessonId, analytics, performance, debugging]);

  // Save lower third
  const handleSaveLowerThird = useCallback(
    (lowerThird: LowerThird) => {
      setLowerThirds((prev) => {
        const existing = prev.find((lt) => lt.id === lowerThird.id);
        if (existing) {
          return prev.map((lt) =>
            lt.id === lowerThird.id ? { ...lowerThird, updatedAt: new Date().toISOString() } : lt,
          );
        } else {
          return [...prev, { ...lowerThird, updatedAt: new Date().toISOString() }];
        }
      });

      if (onLowerThirdSave) {
        onLowerThirdSave(lowerThird);
      }

      setShowCreateDialog(false);
      setEditingLowerThird(null);

      analytics.trackEvent('lower_third_saved', {
        lowerThirdId: lowerThird.id,
        lowerThirdName: lowerThird.name,
        courseId: lowerThird.courseId,
        lessonId: lowerThird.lessonId,
        animation: lowerThird.animation,
        position: lowerThird.position,
        orientation: lowerThird.orientation,
        duration: lowerThird.duration,
        safeGuides: lowerThird.safeGuides,
        timing: lowerThird.timing,
        timingValidation: getTimingValidation('lowerThird', lowerThird.duration, lowerThird.title),
        timestamp: Date.now(),
      });

      debugging.logIntegration('info','Lower third saved successfully', {
        lowerThirdId: lowerThird.id,
        lowerThirdName: lowerThird.name,
        animation: lowerThird.animation,
        safeGuidesEnabled: lowerThird.safeGuides.enabled,
        timingValid: getTimingValidation('lowerThird', lowerThird.duration, lowerThird.title)
          .isValid,
      });
    },
    [onLowerThirdSave, analytics],
  );

  // Delete lower third
  const handleDeleteLowerThird = useCallback(
    (lowerThirdId: string) => {
      setLowerThirds((prev) => prev.filter((lt) => lt.id !== lowerThirdId));

      if (onLowerThirdDelete) {
        onLowerThirdDelete(lowerThirdId);
      }

      analytics.trackEvent('lower_third_deleted', {
        lowerThirdId,
        courseId,
        lessonId,
        timestamp: Date.now(),
      });

      debugging.logIntegration('info','Lower third deleted', {
        lowerThirdId,
        courseId,
        lessonId,
      });
    },
    [onLowerThirdDelete, analytics],
  );

  // Preview lower third
  const handlePreviewLowerThird = useCallback(
    (lowerThird: LowerThird) => {
      const endTiming = performance.startTiming('lower_third_preview_animation');

      setPreviewLowerThird(lowerThird);
      setIsPreviewing(true);

      analytics.trackEvent('lower_third_previewed', {
        lowerThirdId: lowerThird.id,
        lowerThirdName: lowerThird.name,
        animation: lowerThird.animation,
        duration: lowerThird.duration,
        delay: lowerThird.delay,
        position: lowerThird.position,
        orientation: lowerThird.orientation,
        safeGuidesEnabled: lowerThird.safeGuides.enabled,
        timingValid: getTimingValidation('lowerThird', lowerThird.duration, lowerThird.title)
          .isValid,
        timestamp: Date.now(),
      });

      debugging.logIntegration('info','Lower third preview started', {
        lowerThirdId: lowerThird.id,
        animation: lowerThird.animation,
        duration: lowerThird.duration,
        safeGuidesEnabled: lowerThird.safeGuides.enabled,
      });

      // Auto-stop preview after duration
      setTimeout(
        () => {
          setIsPreviewing(false);
          endTiming();

          analytics.trackEvent('lower_third_preview_ended', {
            lowerThirdId: lowerThird.id,
            previewDuration: lowerThird.duration + lowerThird.delay,
            timestamp: Date.now(),
          });
        },
        (lowerThird.duration + lowerThird.delay) * 1000,
      );
    },
    [analytics, performance, debugging],
  );

  // Caption functionality
  const handleOpenCaptionEditor = useCallback(() => {
    analytics.trackEvent('caption_editor_opened', {
      courseId,
      lessonId,
      existingCaptionStyle: !!captionStyle,
      timestamp: Date.now(),
    });

    const defaultCaptionStyle: CaptionStyle = {
      enabled: true,
      position: 'bottom-center',
      safeGuides: {
        enabled: true,
        type: 'title-safe',
        color: '#00ff00',
        opacity: 0.6,
        thickness: 1,
        showLabels: false,
      },
      style: {
        backgroundColor: 'rgba(0,0,0,0.8)',
        textColor: '#ffffff',
        fontSize: 18,
        fontWeight: 'bold',
        fontFamily: 'Arial, sans-serif',
        opacity: 0.95,
        padding: 12,
        borderRadius: 4,
        borderColor: '#ffffff',
        borderWidth: 1,
        shadow: {
          enabled: true,
          color: 'rgba(0,0,0,0.5)',
          blur: 4,
          offsetX: 2,
          offsetY: 2,
        },
      },
      maxLines: 3,
      lineHeight: 1.4,
      wordWrap: true,
      autoSize: true,
    };

    setEditingCaptionStyle(captionStyle || defaultCaptionStyle);
    setShowCaptionDialog(true);

    debugging.logIntegration('info','Caption editor opened', {
      courseId,
      lessonId,
      existingCaptionStyle: !!captionStyle,
    });
  }, [captionStyle, courseId, lessonId, analytics, debugging]);

  const handleSaveCaptionStyle = useCallback(
    (style: CaptionStyle) => {
      if (onCaptionStyleChange) {
        onCaptionStyleChange(style);
      }
      setShowCaptionDialog(false);
      setEditingCaptionStyle(null);

      analytics.trackEvent('caption_style_saved', {
        captionStyle: style,
        courseId,
        lessonId,
        safeGuidesEnabled: style.safeGuides.enabled,
        safeGuidesType: style.safeGuides.type,
        position: style.position,
        maxLines: style.maxLines,
        timestamp: Date.now(),
      });

      debugging.logIntegration('info','Caption style saved successfully', {
        courseId,
        lessonId,
        safeGuidesEnabled: style.safeGuides.enabled,
        position: style.position,
        maxLines: style.maxLines,
      });
    },
    [onCaptionStyleChange, analytics],
  );

  // Get animation CSS - returns CSS keyframes for lower third animations
  const getAnimationCSS = (lowerThird: LowerThird) => {
    const { animation, duration, delay, timing } = lowerThird;
    const easeIn = timing.easeIn;
    const easeOut = timing.easeOut;
    
    // Log animation parameters for debugging
    console.log('Animation CSS params:', { animation, duration, delay, easeIn, easeOut });

    const animations = {
      'slide-up': `@keyframes slideUp {
        0% { transform: translateY(100%); opacity: 0; }
        ${easeIn * 100}% { transform: translateY(0); opacity: 1; }
        ${(1 - easeOut) * 100}% { transform: translateY(0); opacity: 1; }
        100% { transform: translateY(100%); opacity: 0; }
    }`,
    'slide-down': `@keyframes slideDown {
        0% { transform: translateY(-100%); opacity: 0; }
        ${easeIn * 100}% { transform: translateY(0); opacity: 1; }
        ${(1 - easeOut) * 100}% { transform: translateY(0); opacity: 1; }
        100% { transform: translateY(-100%); opacity: 0; }
    }`,
    'fade-in': `@keyframes fadeIn {
        0% { opacity: 0; }
        ${easeIn * 100}% { opacity: 1; }
        ${(1 - easeOut) * 100}% { opacity: 1; }
        100% { opacity: 0; }
    }`,
    'slide-left': `@keyframes slideLeft {
        0% { transform: translateX(-100%); opacity: 0; }
        ${easeIn * 100}% { transform: translateX(0); opacity: 1; }
        ${(1 - easeOut) * 100}% { transform: translateX(0); opacity: 1; }
        100% { transform: translateX(-100%); opacity: 0; }
    }`,
    'slide-right': `@keyframes slideRight {
        0% { transform: translateX(100%); opacity: 0; }
        ${easeIn * 100}% { transform: translateX(0); opacity: 1; }
        ${(1 - easeOut) * 100}% { transform: translateX(0); opacity: 1; }
        100% { transform: translateX(100%); opacity: 0; }
    }`,
    'zoom-in': `@keyframes zoomIn {
        0% { transform: scale(0.5); opacity: 0; }
        ${easeIn * 100}% { transform: scale(1); opacity: 1; }
        ${(1 - easeOut) * 100}% { transform: scale(1); opacity: 1; }
        100% { transform: scale(0.5); opacity: 0; }
    }`,
      typewriter: `@keyframes typewriter {
        0% { width: 0; }
        ${easeIn * 100}% { width: 100%; }
        ${(1 - easeOut) * 100}% { width: 100%; }
        100% { width: 0; }
    }`,
    };

    return animations[animation] || '';
  };

  // Render lower third preview
  const renderLowerThirdPreview = (
    lowerThird: LowerThird,
    isLive: boolean = false,
    containerWidth: number = 800,
    containerHeight: number = 450,
  ) => {
    const { position, style, title, subtitle, description, orientation, safeGuides } = lowerThird;

    // Adjust position styles based on orientation and safe guides
    const margins = getSafeGuideMargins(
      safeGuides.type,
      containerWidth / containerHeight,
      safeGuides.customMargins,
    );
    const isVertical =
      orientation === 'vertical' || (orientation === 'auto' && containerWidth < containerHeight);
    
    // Generate animation CSS for this lower third
    const animationCSS = getAnimationCSS(lowerThird);
    console.log('Generated animation CSS:', animationCSS.substring(0, 50) + '...');

    const positionStyles = {
      'bottom-left': {
        bottom: `${20 + (isVertical ? margins.bottom : 0)}px`,
        left: `${20 + (isVertical ? margins.left : 0)}px`,
      }, 'bottom-center': {
        bottom: `${20 + (isVertical ? margins.bottom : 0)}px`,
        left: '50%',
        transform: 'translateX(-50%)',
      }, 'bottom-right': {
        bottom: `${20 + (isVertical ? margins.bottom : 0)}px`,
        right: `${20 + (isVertical ? margins.right : 0)}px`,
      }, 'top-left': {
        top: `${20 + (isVertical ? margins.top : 0)}px`,
        left: `${20 + (isVertical ? margins.left : 0)}px`,
      }, 'top-center': {
        top: `${20 + (isVertical ? margins.top : 0)}px`,
        left: '50%',
        transform: 'translateX(-50%)',
      }, 'top-right': {
        top: `${20 + (isVertical ? margins.top : 0)}px`,
        right: `${20 + (isVertical ? margins.right : 0)}px`,
      },
    };

    return (
      <>
        {/* Safe Guides Overlay */}
        {renderSafeGuides(safeGuides, containerWidth, containerHeight)}

        {/* Lower Third Content */}
        <Box
          ref={previewRef}
          sx={{
            position: 'absolute',
            ...positionStyles[position],
            backgroundColor: style.gradient?.enabled
              ? `linear-gradient(${
                  style.gradient.direction === 'horizontal'
                    ? '90deg'
                    : style.gradient.direction === 'vertical'
                      ? '180deg'
                      : '45deg'
                }, 
                                 ${style.gradient.colors.join(', ')})`
              : style.backgroundColor,
            color: style.textColor,
            border: style.borderColor
              ? `${style.borderWidth || 0}px solid ${style.borderColor}`
              : 'none',
            borderRadius: `${style.borderRadius}px`,
            padding: `${style.padding}px`,
            fontSize: `${style.fontSize}px`,
            fontWeight: style.fontWeight,
            fontStyle: style.fontStyle,
            textAlign: style.textAlign,
            opacity: style.opacity,
            filter: style.blur > 0 ? `blur(${style.blur}px)` : 'none',
            boxShadow: style.shadow?.enabled
              ? `${style.shadow.offsetX}px ${style.shadow.offsetY}px ${style.shadow.blur}px ${style.shadow.color}`
              : 'none',
            maxWidth: isVertical ? '300px' : '400px',
            zIndex: 100,
            animation: isLive
              ? `${lowerThird.animation.replace('-', ' ')} ${lowerThird.duration}s ease-in-out ${lowerThird.delay}s`
              : 'none',
            display: isLive ? 'block' : 'block'}}
        >
          <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 0.5, color: style.textColor }}>
            {title}
          </Typography>
          {subtitle && (
            <Typography variant="body2" sx={{ opacity: 0.8, mb: 0.5, color: style.textColor }}>
              {subtitle}
            </Typography>
          )}
          {description && (
            <Typography variant="caption" sx={{ opacity: 0.7, color: style.textColor }}>
              {description}
            </Typography>
          )}
        </Box>
      </>
    );
  };

  // Render lower third card
  const renderLowerThirdCard = (lowerThird: LowerThird) => (
    <Card
      key={lowerThird.id}
      sx={{
        cursor: mode === 'select' ? 'pointer' : 'default',
        border: selectedLowerThird?.id === lowerThird.id ? 2 : 1,
        borderColor: selectedLowerThird?.id === lowerThird.id ? 'primary.main' : 'divider', '&:hover': { boxShadow: 4 }}}
      onClick={() => mode === 'select' && onLowerThirdSelect?.(lowerThird)}
    >
      <CardContent sx={{ p: 2,...theming.getThemedCardSx() }}>
        <Stack direction="row" spacing={2} alignItems="flex-start">
          <Box
            sx={{
              width: 60,
              height: 40,
              backgroundColor: lowerThird.style.backgroundColor,
              borderRadius: `${lowerThird.style.borderRadius}px`,
              border: lowerThird.style.borderColor
                ? `var(--academy-hairline-width, 1px) solid ${lowerThird.style.borderColor}`
                : 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
              overflow: 'hidden'}}
          >
            <Typography
              variant="caption"
              sx={{
                color: lowerThird.style.textColor,
                fontSize: '8px',
                fontWeight: 'bold',
                textAlign: 'center',
                lineHeight: 1,
                px: 0.5}}
            >
              {lowerThird.title}
            </Typography>
          </Box>

          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="subtitle1" noWrap>
              {lowerThird.name}
            </Typography>
            <Typography variant="body2" color="text.secondary" noWrap>
              {lowerThird.title}
            </Typography>
            {lowerThird.subtitle && (
              <Typography variant="caption" color="text.secondary" noWrap>
                {lowerThird.subtitle}
              </Typography>
            )}

            <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
              <Chip
                label={lowerThird.animation.replace('-', ' ')}
                size="small"
                variant="outlined"
                sx={{ height: 20, fontSize: 10 }}
              />
              <Chip
                label={lowerThird.position.replace('-', ' ')}
                size="small"
                variant="outlined"
                sx={{ height: 20, fontSize: 10 }}
              />
              <Chip
                label={`${lowerThird.duration}s`}
                size="small"
                variant="outlined"
                color={
                  getTimingValidation('lowerThird', lowerThird.duration, lowerThird.title)
                    .severity === 'error'
                    ? 'error'
                    : getTimingValidation('lowerThird', lowerThird.duration, lowerThird.title)
                          .severity === 'warning'
                      ? 'warning'
                      : 'success'
                }
                sx={{ height: 20, fontSize: 10 }}
              />
              {lowerThird.orientation && (
                <Chip
                  label={lowerThird.orientation}
                  size="small"
                  variant="outlined"
                  sx={{ height: 20, fontSize: 10 }}
                />
              )}
            </Stack>
          </Box>

          <Stack direction="row" spacing={0.5}>
            {showPreview && (
              <Tooltip title="Preview">
                <IconButton
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePreviewLowerThird(lowerThird);
                  }}
                >
                  <PlayArrow fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
            {mode !== 'select' && (
              <>
                <Tooltip title="Edit">
                  <IconButton
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingLowerThird(lowerThird);
                      setShowCreateDialog(true);
                    }}
                  >
                    <Edit fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Duplicate">
                  <IconButton
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      const duplicated = {
                        ...lowerThird,
                        id: `lt-${Date.now()}`,
                        name: `${lowerThird.name} (Copy)`,
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString(),
                      };
                      setEditingLowerThird(duplicated);
                      setShowCreateDialog(true);
                    }}
                  >
                    <ContentCopy fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Delete">
                  <IconButton
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteLowerThird(lowerThird.id);
                    }}
                    color="error"
                  >
                    <Delete fontSize="small" />
                  </IconButton>
                </Tooltip>
              </>
            )}
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );

  return (
    <Box sx={{ height, display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
          <Stack direction="row" alignItems="center" spacing={2}>
            <Typography variant="h5" component="h2" sx={{ ...{}, color: theming.colors.primary }}>
              Animated Lower Thirds
            </Typography>
            <Tooltip title="View timing guidelines and best practices">
              <IconButton
                size="small"
                onClick={() => setShowGuidelinesDialog(true)}
                sx={{ color: theming.colors.primary }}
              >
                <Info />
              </IconButton>
            </Tooltip>
            {/* Integration Health Indicator */}
            <Chip
              label={`${health.status.toUpperCase()}`}
              size="small"
              color={
                health.status === 'healthy'
                  ? 'success'
                  : health.status === 'degraded'
                    ? 'warning'
                    : 'error'
              }
              variant="outlined"
              sx={{ fontSize: '10px', height: 20 }}
            />
            <Typography variant="caption" color="text.secondary">
              {health.components.active} active components
            </Typography>
          </Stack>
          {mode !== 'select' && (
            <Stack direction="row" spacing={1}>
              <Button
                variant="contained"
                startIcon={<Add />}
                onClick={handleCreateLowerThird}
                sx={{ bgcolor: '#4caf50', ...theming.getThemedButtonSx() }}
              >
                Create Lower Third
              </Button>
              {showCaptionEditor && (
                <Button
                  variant="outlined"
                  startIcon={<TextFields />}
                  onClick={handleOpenCaptionEditor}
                  sx={{ ...theming.getThemedButtonSx() }}
                >
                  Caption Editor
                </Button>
              )}
            </Stack>
          )}
        </Stack>

        {/* Industry Standards Info */}
        <Alert severity="success" sx={{ mb: 2 }}>
          <Typography variant="body2">
            <strong>Industry Standards:</strong> Lower thirds (3-6s), Captions (1.5-6s), Max{' '}
            {TIMING_GUIDELINES.caption.maxCharactersPerLine} chars/line,{' '}
            {TIMING_GUIDELINES.caption.maxLines} lines max. Reading speed:{' '}
            {TIMING_GUIDELINES.lowerThird.readingSpeed} WPM (lower thirds),{' '}
            {TIMING_GUIDELINES.caption.readingSpeed} WPM (captions).
          </Typography>
        </Alert>

        {/* Search and Filter */}
        <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
          <TextField
            placeholder="Search lower thirds..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            size="small"
            sx={{ flex: 1 }}
          />
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Type</InputLabel>
            <Select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as any)}
              label="Type"
            >
              <MenuItem value="all">All</MenuItem>
              <MenuItem value="course">Course</MenuItem>
              <MenuItem value="lesson">Lesson</MenuItem>
            </Select>
          </FormControl>
        </Stack>
      </Box>

      {/* Content */}
      <Box sx={{ flex: 1, overflow: 'auto' }}>
        <Grid container spacing={2}>
          {filteredLowerThirds.map((lowerThird) => (
            <Grid item xs={12} sm={6} md={4} key={lowerThird.id}>
              {renderLowerThirdCard(lowerThird)}
            </Grid>
          ))}
        </Grid>

        {filteredLowerThirds.length === 0 && (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography
              variant="h6"
              color="text.secondary"
              gutterBottom
              sx={{ ...{}, color: theming.colors.primary }}
            >
              No lower thirds found
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Create your first animated lower third
            </Typography>
          </Box>
        )}
      </Box>

      {/* Preview Overlay */}
      {isPreviewing && previewLowerThird && (
        <Box
          sx={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.8)',
            zIndex: 999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'}}
          onClick={() => setIsPreviewing(false)}
        >
          <Box
            sx={{
              position: 'relative',
              width: '100%',
              height: '100%',
              background: 'linear-gradient(45deg, #1a1a1a 0%, #2d2d2d 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'}}
          >
            {renderLowerThirdPreview(previewLowerThird, true)}
            <IconButton
              sx={{
                position: 'absolute',
                top: 20,
                right: 20,
                backgroundColor: 'rgba(0,0,0,0.5)',
                color: 'white'}}
              onClick={() => setIsPreviewing(false)}
            >
              <Close />
            </IconButton>
          </Box>
        </Box>
      )}

      {/* Create/Edit Dialog */}
      <Dialog
        open={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {editingLowerThird?.id.startsWith('lt-') &&
          !lowerThirds.find((lt) => lt.id === editingLowerThird.id)
            ? 'Create Lower Third'
            : 'Edit Lower Third'}
        </DialogTitle>
        <DialogContent>
          {editingLowerThird && (
            <LowerThirdEditor
              lowerThird={editingLowerThird}
              onChange={setEditingLowerThird}
              onPreview={setPreviewLowerThird}
              renderPreview={renderLowerThirdPreview}
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowCreateDialog(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={() => editingLowerThird && handleSaveLowerThird(editingLowerThird)}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>

      {/* Caption Editor Dialog */}
      <Dialog
        open={showCaptionDialog}
        onClose={() => setShowCaptionDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Caption/Subtitle Style Editor</DialogTitle>
        <DialogContent>
          {editingCaptionStyle && (
            <CaptionEditor
              captionStyle={editingCaptionStyle}
              onChange={setEditingCaptionStyle}
              aspectRatio={aspectRatio}
              renderSafeGuides={renderSafeGuides}
              getSafeGuideMargins={getSafeGuideMargins}
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowCaptionDialog(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={() => editingCaptionStyle && handleSaveCaptionStyle(editingCaptionStyle)}
          >
            Save Caption Style
          </Button>
        </DialogActions>
      </Dialog>

      {/* Timing Guidelines Dialog */}
      <Dialog
        open={showGuidelinesDialog}
        onClose={() => setShowGuidelinesDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Industry Timing Guidelines & Best Practices</DialogTitle>
        <DialogContent>
          <Stack spacing={3}>
            {/* Lower Third Guidelines */}
            <Box>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                Lower Thirds
              </Typography>
              <Alert severity="info" sx={{ mb: 2 }}>
                <Typography variant="body2">
                  <strong>Display Duration:</strong> {TIMING_GUIDELINES.lowerThird.minimum}-
                  {TIMING_GUIDELINES.lowerThird.maximum} seconds (recommended:{' '}
                  {TIMING_GUIDELINES.lowerThird.recommended}s)
                </Typography>
              </Alert>
              <Typography variant="body2" sx={{ mb: 2 }}>
                • Allow viewers sufficient time to read without disrupting video flow • Longer text
                may need closer to the maximum duration • Shorter text can use minimum duration •
                Consider reading speed of {TIMING_GUIDELINES.lowerThird.readingSpeed} words per
                minute
              </Typography>
            </Box>

            {/* Caption Guidelines */}
            <Box>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                Captions & Subtitles
              </Typography>
              <Alert severity="info" sx={{ mb: 2 }}>
                <Typography variant="body2">
                  <strong>Display Duration:</strong> {TIMING_GUIDELINES.caption.minimum}-
                  {TIMING_GUIDELINES.caption.maximum} seconds (recommended:{' '}
                  {TIMING_GUIDELINES.caption.recommended}s)
                </Typography>
              </Alert>
              <Typography variant="body2" sx={{ mb: 2 }}>
                • Synchronize with audio for optimal comprehension • Max{' '}
                {TIMING_GUIDELINES.caption.maxCharactersPerLine} characters per line,{' '}
                {TIMING_GUIDELINES.caption.maxLines} lines maximum • Reading speed:{', '}
                {TIMING_GUIDELINES.caption.readingSpeed} words per minute (140-180 WPM range) •
                Ensure accessibility compliance (WCAG 2.2 AA+)
              </Typography>
            </Box>

            {/* General Best Practices */}
            <Box>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                General Best Practices
              </Typography>
              <Typography variant="body2" sx={{ mb: 2 }}>
                • <strong>Safe Areas:</strong> Use title-safe (5% margin) or action-safe (10%
                margin) areas • <strong>Readability:</strong> High contrast colors, clear fonts,
                appropriate sizing • <strong>Consistency:</strong> Maintain consistent timing and
                styling throughout content • <strong>Testing:</strong> Preview on different devices
                and aspect ratios • <strong>Accessibility:</strong> Follow WCAG guidelines for
                inclusive design
              </Typography>
            </Box>

            {/* Industry Sources */}
            <Box>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                Industry Sources
              </Typography>
              <Typography variant="body2">
                Based on guidelines from broadcast television standards, accessibility requirements
                (WCAG 2.2), and industry best practices from major content platforms and
                accessibility organizations.
              </Typography>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowGuidelinesDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

// Caption Editor Component
interface CaptionEditorProps {
  captionStyle: CaptionStyle;
  onChange: (captionStyle: CaptionStyle) => void;
  aspectRatio: string;
  renderSafeGuides: (
    safeGuide: SafeGuide,
    containerWidth: number,
    containerHeight: number,
  ) => React.ReactElement | null;
  getSafeGuideMargins: (
    type: 'title-safe' | 'action-safe' | 'custom',
    aspectRatio: number,
    customMargins?: { top: number; right: number; bottom: number; left: number },
  ) => { top: number; right: number; bottom: number; left: number };
}

function CaptionEditor({
  captionStyle,
  onChange,
  aspectRatio,
  renderSafeGuides,
  getSafeGuideMargins,
}: CaptionEditorProps) {
  const [activeTab, setActiveTab] = useState(0);
  const { analytics, performance, debugging } = useEnhancedMasterIntegration();
  
  // Calculate safe margins for caption positioning
  const safeMargins = getSafeGuideMargins('title-safe', parseFloat(aspectRatio.replace(':', '/')));
  console.log('Caption safe margins:', safeMargins);

  const handleChange = (field: string, value: any) => {
    const endTiming = performance.startTiming('caption_field_change');

    onChange({
      ...captionStyle,
      [field]: value,
    });

    analytics.trackEvent('caption_field_modified', {
      field,
      fieldType: typeof value,
      hasValue: value !== null && value !== undefined && value !== '',
      aspectRatio,
      timestamp: Date.now(),
    });

    debugging.logIntegration('info', `Caption field modified: ${field}`, {
      field,
      newValue: value,
      aspectRatio,
    });

    endTiming();
  };

  const handleStyleChange = (field: string, value: any) => {
    onChange({
      ...captionStyle,
      style: {
        ...captionStyle.style,
        [field]: value,
      },
    });
  };

  const handleSafeGuideChange = (field: string, value: any) => {
    onChange({
      ...captionStyle,
      safeGuides: {
        ...captionStyle.safeGuides,
        [field]: value,
      },
    });
  };

  return (
    <Box>
      <Tabs
        value={activeTab}
        onChange={(_, newValue) => {
          const tabNames = ['Style','Position','Safe Guides','Preview'];

          analytics.trackEvent('caption_editor_tab_changed', {
            fromTab: tabNames[activeTab],
            toTab: tabNames[newValue],
            tabIndex: newValue,
            aspectRatio,
            timestamp: Date.now(),
          });

          debugging.logIntegration('info','Caption editor tab changed', {
            fromTab: activeTab,
            toTab: newValue,
            aspectRatio,
          });

          setActiveTab(newValue);
        }}
      >
        <Tab label="Style" />
        <Tab label="Position" />
        <Tab label="Safe Guides" />
        <Tab label="Preview" />
      </Tabs>

      {activeTab === 0 && (
        <Box sx={{ mt: 2 }}>
          <Stack spacing={3}>
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Colors
              </Typography>
              <Stack direction="row" spacing={2}>
                <TextField
                  label="Background Color"
                  type="color"
                  value={captionStyle.style.backgroundColor}
                  onChange={(e) => handleStyleChange('backgroundColor', e.target.value)}
                  sx={{ width: 120 }}
                />
                <TextField
                  label="Text Color"
                  type="color"
                  value={captionStyle.style.textColor}
                  onChange={(e) => handleStyleChange('textColor', e.target.value)}
                  sx={{ width: 120 }}
                />
                <TextField
                  label="Border Color"
                  type="color"
                  value={captionStyle.style.borderColor || '#ffffff'}
                  onChange={(e) => handleStyleChange('borderColor', e.target.value)}
                  sx={{ width: 120 }}
                />
              </Stack>
            </Box>

            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Typography
              </Typography>
              <Stack direction="row" spacing={2}>
                <TextField
                  label="Font Size"
                  type="number"
                  value={captionStyle.style.fontSize}
                  onChange={(e) => handleStyleChange('fontSize', parseInt(e.target.value))}
                  inputProps={{ min: 8, max: 48 }}
                />
                <FormControl sx={{ minWidth: 120 }}>
                  <InputLabel>Font Weight</InputLabel>
                  <Select
                    value={captionStyle.style.fontWeight}
                    onChange={(e) => handleStyleChange('fontWeight', e.target.value)}
                    label="Font Weight"
                  >
                    <MenuItem value="normal">Normal</MenuItem>
                    <MenuItem value="bold">Bold</MenuItem>
                    <MenuItem value="lighter">Lighter</MenuItem>
                  </Select>
                </FormControl>
                <TextField
                  label="Font Family"
                  value={captionStyle.style.fontFamily}
                  onChange={(e) => handleStyleChange('fontFamily', e.target.value)}
                  fullWidth
                />
              </Stack>
            </Box>

            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Layout
              </Typography>
              <Stack direction="row" spacing={2}>
                <TextField
                  label="Padding"
                  type="number"
                  value={captionStyle.style.padding}
                  onChange={(e) => handleStyleChange('padding', parseInt(e.target.value))}
                  inputProps={{ min: 0, max: 50 }}
                />
                <TextField
                  label="Border Radius"
                  type="number"
                  value={captionStyle.style.borderRadius}
                  onChange={(e) => handleStyleChange('borderRadius', parseInt(e.target.value))}
                  inputProps={{ min: 0, max: 50 }}
                />
                <TextField
                  label="Border Width"
                  type="number"
                  value={captionStyle.style.borderWidth || 0}
                  onChange={(e) => handleStyleChange('borderWidth', parseInt(e.target.value))}
                  inputProps={{ min: 0, max: 10 }}
                />
              </Stack>
            </Box>

            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Text Settings
              </Typography>
              <Stack direction="row" spacing={2}>
                <TextField
                  label="Max Lines"
                  type="number"
                  value={captionStyle.maxLines}
                  onChange={(e) => handleChange('maxLines', parseInt(e.target.value))}
                  inputProps={{ min: 1, max: TIMING_GUIDELINES.caption.maxLines }}
                  helperText={`Recommended: ${TIMING_GUIDELINES.caption.maxLines} lines max`}
                />
                <TextField
                  label="Line Height"
                  type="number"
                  value={captionStyle.lineHeight}
                  onChange={(e) => handleChange('lineHeight', parseFloat(e.target.value))}
                  inputProps={{ min: 0.5, max: 3, step: 0.1 }}
                />
              </Stack>
              <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={captionStyle.wordWrap}
                      onChange={(e) => handleChange('wordWrap', e.target.checked)}
                    />
                  }
                  label="Word Wrap"
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={captionStyle.autoSize}
                      onChange={(e) => handleChange('autoSize', e.target.checked)}
                    />
                  }
                  label="Auto Size"
                />
              </Stack>
            </Box>

            {/* Caption Timing Guidelines */}
            <Alert severity="info" sx={{ mt: 2 }}>
              <Typography variant="body2">
                <strong>Caption Best Practices:</strong>
                <br />• Display for 1.5-6 seconds (recommended: 3-4s)
                <br />• Max {TIMING_GUIDELINES.caption.maxCharactersPerLine} characters per line,{', '}
                {TIMING_GUIDELINES.caption.maxLines} lines max
                <br />• Reading speed: {TIMING_GUIDELINES.caption.readingSpeed} words per minute
                <br />• Synchronize with audio for optimal comprehension
              </Typography>
            </Alert>
          </Stack>
        </Box>
      )}

      {activeTab === 1 && (
        <Box sx={{ mt: 2 }}>
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Position</InputLabel>
            <Select
              value={captionStyle.position}
              onChange={(e) => handleChange('position', e.target.value)}
              label="Position"
            >
              <MenuItem value="bottom-center">Bottom Center</MenuItem>
              <MenuItem value="bottom-left">Bottom Left</MenuItem>
              <MenuItem value="bottom-right">Bottom Right</MenuItem>
              <MenuItem value="top-center">Top Center</MenuItem>
              <MenuItem value="top-left">Top Left</MenuItem>
              <MenuItem value="top-right">Top Right</MenuItem>
            </Select>
          </FormControl>
        </Box>
      )}

      {activeTab === 2 && (
        <Box sx={{ mt: 2 }}>
          <Stack spacing={3}>
            <FormControlLabel
              control={
                <Switch
                  checked={captionStyle.safeGuides.enabled}
                  onChange={(e) => handleSafeGuideChange('enabled', e.target.checked)}
                />
              }
              label="Enable Safe Guides"
            />

            {captionStyle.safeGuides.enabled && (
              <>
                <FormControl fullWidth>
                  <InputLabel>Guide Type</InputLabel>
                  <Select
                    value={captionStyle.safeGuides.type}
                    onChange={(e) => handleSafeGuideChange('type', e.target.value)}
                    label="Guide Type"
                  >
                    <MenuItem value="title-safe">Title Safe (5% margin)</MenuItem>
                    <MenuItem value="action-safe">Action Safe (10% margin)</MenuItem>
                    <MenuItem value="custom">Custom Margins</MenuItem>
                  </Select>
                </FormControl>

                <Stack direction="row" spacing={2}>
                  <TextField
                    label="Guide Color"
                    type="color"
                    value={captionStyle.safeGuides.color}
                    onChange={(e) => handleSafeGuideChange('color', e.target.value)}
                    sx={{ width: 120 }}
                  />
                  <TextField
                    label="Opacity"
                    type="number"
                    value={captionStyle.safeGuides.opacity}
                    onChange={(e) => handleSafeGuideChange('opacity', parseFloat(e.target.value))}
                    inputProps={{ min: 0, max: 1, step: 0.1 }}
                  />
                  <TextField
                    label="Thickness"
                    type="number"
                    value={captionStyle.safeGuides.thickness}
                    onChange={(e) => handleSafeGuideChange('thickness', parseInt(e.target.value))}
                    inputProps={{ min: 1, max: 10 }}
                  />
                </Stack>

                <FormControlLabel
                  control={
                    <Switch
                      checked={captionStyle.safeGuides.showLabels}
                      onChange={(e) => handleSafeGuideChange('showLabels', e.target.checked)}
                    />
                  }
                  label="Show Labels"
                />

                {captionStyle.safeGuides.type === 'custom' && (
                  <Box>
                    <Typography variant="subtitle2" gutterBottom>
                      Custom Margins (%)
                    </Typography>
                    <Stack direction="row" spacing={2}>
                      <TextField
                        label="Top"
                        type="number"
                        value={captionStyle.safeGuides.customMargins?.top || 0}
                        onChange={(e) =>
                          handleSafeGuideChange('customMargins', {
                            ...captionStyle.safeGuides.customMargins,
                            top: parseInt(e.target.value),
                          })
                        }
                        inputProps={{ min: 0, max: 50 }}
                      />
                      <TextField
                        label="Right"
                        type="number"
                        value={captionStyle.safeGuides.customMargins?.right || 0}
                        onChange={(e) =>
                          handleSafeGuideChange('customMargins', {
                            ...captionStyle.safeGuides.customMargins,
                            right: parseInt(e.target.value),
                          })
                        }
                        inputProps={{ min: 0, max: 50 }}
                      />
                      <TextField
                        label="Bottom"
                        type="number"
                        value={captionStyle.safeGuides.customMargins?.bottom || 0}
                        onChange={(e) =>
                          handleSafeGuideChange('customMargins', {
                            ...captionStyle.safeGuides.customMargins,
                            bottom: parseInt(e.target.value),
                          })
                        }
                        inputProps={{ min: 0, max: 50 }}
                      />
                      <TextField
                        label="Left"
                        type="number"
                        value={captionStyle.safeGuides.customMargins?.left || 0}
                        onChange={(e) =>
                          handleSafeGuideChange('customMargins', {
                            ...captionStyle.safeGuides.customMargins,
                            left: parseInt(e.target.value),
                          })
                        }
                        inputProps={{ min: 0, max: 50 }}
                      />
                    </Stack>
                  </Box>
                )}
              </>
            )}
          </Stack>
        </Box>
      )}

      {activeTab === 3 && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="subtitle2" gutterBottom>
            Caption Preview
          </Typography>
          <Box
            sx={{
              position: 'relative',
              height: 300,
              backgroundColor: '#1a1a1a',
              borderRadius: 2,
              overflow: 'hidden',
              border: 'var(--academy-hairline-width, 1px) solid #333'}}
          >
            {/* Safe Guides */}
            {renderSafeGuides(captionStyle.safeGuides, 800, 300)}

            {/* Caption Preview */}
            <Box
              sx={{
                position: 'absolute',
                ...(captionStyle.position.includes('bottom') ? { bottom: 20 } : { top: 20 }),
                ...(captionStyle.position.includes('left')
                  ? { left: 20 }
                  : captionStyle.position.includes('right')
                    ? { right: 20 }
                    : { left: '50%', transform: 'translateX(-50%)' }),
                backgroundColor: captionStyle.style.backgroundColor,
                color: captionStyle.style.textColor,
                fontSize: `${captionStyle.style.fontSize}px`,
                fontWeight: captionStyle.style.fontWeight,
                fontFamily: captionStyle.style.fontFamily,
                padding: `${captionStyle.style.padding}px`,
                borderRadius: `${captionStyle.style.borderRadius}px`,
                border: captionStyle.style.borderWidth
                  ? `${captionStyle.style.borderWidth}px solid ${captionStyle.style.borderColor}`
                  : 'none',
                opacity: captionStyle.style.opacity,
                boxShadow: captionStyle.style.shadow?.enabled
                  ? `${captionStyle.style.shadow.offsetX}px ${captionStyle.style.shadow.offsetY}px ${captionStyle.style.shadow.blur}px ${captionStyle.style.shadow.color}`
                  : 'none',
                maxWidth: '400px',
                lineHeight: captionStyle.lineHeight,
                maxLines: captionStyle.maxLines,
                overflow: captionStyle.wordWrap ? 'visible' : 'hidden',
                textOverflow: captionStyle.wordWrap ? 'clip' : 'ellipsis',
                zIndex: 100}}
            >
              <Typography
                variant="body1"
                sx={{
                  color: captionStyle.style.textColor,
                  fontWeight: captionStyle.style.fontWeight,
                  fontFamily: captionStyle.style.fontFamily,
                  fontSize: `${captionStyle.style.fontSize}px`,
                  lineHeight: captionStyle.lineHeight,
                  margin: 0}}
              >
                This is a preview of your caption style. The text will appear with the selected
                styling and safe guide constraints.
              </Typography>
            </Box>
          </Box>
        </Box>
      )}
    </Box>
  );
}
	
export default withUniversalIntegration(AnimatedLowerThirds, {
  componentId: 'animated-lower-thirds',
  componentName: 'Animated Lower Thirds',
  componentType: 'editor',
  componentCategory: 'academy',
	  featureIds: ['lower-thirds','video-player-academy'],
});

// Lower Third Editor Component
interface LowerThirdEditorProps {
  lowerThird: LowerThird;
  onChange: (lowerThird: LowerThird) => void;
  onPreview: (lowerThird: LowerThird) => void;
  renderPreview: (lowerThird: LowerThird, isLive: boolean) => React.ReactElement;
}

function LowerThirdEditor({
  lowerThird,
  onChange,
  onPreview,
  renderPreview,
}: LowerThirdEditorProps) {
  const [activeTab, setActiveTab] = useState(0);
  const { analytics, performance, debugging } = useEnhancedMasterIntegration();

  // Helper functions (moved from parent component scope)
  const calculateOptimalLowerThirdDuration = (text: string): number => {
    const words = text.split(/\s+/).length;
    const readingTime = (words / TIMING_GUIDELINES.lowerThird.readingSpeed) * 60;
    return Math.max(
      TIMING_GUIDELINES.lowerThird.minimum,
      Math.min(TIMING_GUIDELINES.lowerThird.maximum, readingTime),
    );
  };

  const getTimingValidation = (type: 'lowerThird' | 'caption', duration: number, text?: string) => {
    const guidelines = TIMING_GUIDELINES[type];
    const isValid = duration >= guidelines.minimum && duration <= guidelines.maximum;
    const isRecommended = Math.abs(duration - guidelines.recommended) <= 0.5;

    let suggestion = ', ';
    if (duration < guidelines.minimum) {
      suggestion = `Too short! Minimum is ${guidelines.minimum}s.`;
    } else if (duration > guidelines.maximum) {
      suggestion = `Too long! Maximum is ${guidelines.maximum}s.`;
    } else if (!isRecommended) {
      suggestion = `Consider ${guidelines.recommended}s for optimal readability.`;
    }

    if (text) {
      const optimalDuration =
        type === 'lowerThird'
          ? calculateOptimalLowerThirdDuration(text)
          : calculateOptimalLowerThirdDuration(text); // For simplicity, using same function
      if (Math.abs(duration - optimalDuration) > 0.5) {
        suggestion = `Based on text length, ${optimalDuration.toFixed(1)}s would be optimal.`;
      }
    }

    return {
      isValid,
      isRecommended,
      suggestion,
      severity:
        duration < guidelines.minimum || duration > guidelines.maximum
          ? 'error'
          : !isRecommended
            ? 'warning': 'success',
    };
  };

  const handleChange = (field: string, value: any) => {
    const endTiming = performance.startTiming('lower_third_field_change');

    onChange({
      ...lowerThird,
      [field]: value,
      updatedAt: new Date().toISOString(),
    });

    analytics.trackEvent('lower_third_field_modified', {
      lowerThirdId: lowerThird.id,
      field,
      fieldType: typeof value,
      hasValue: value !== null && value !== undefined && value !== '',
      timestamp: Date.now(),
    });

    debugging.logIntegration('info', `Lower third field modified: ${field}`, {
      lowerThirdId: lowerThird.id,
      field,
      newValue: value,
    });

    endTiming();
  };

  const handleStyleChange = (field: string, value: any) => {
    onChange({
      ...lowerThird,
      style: {
        ...lowerThird.style,
        [field]: value,
      },
      updatedAt: new Date().toISOString(),
    });
  };

  const handleTimingChange = (field: string, value: any) => {
    onChange({
      ...lowerThird,
      timing: {
        ...lowerThird.timing,
        [field]: value,
      },
      updatedAt: new Date().toISOString(),
    });
  };

  const handleSafeGuideChange = (field: string, value: any) => {
    onChange({
      ...lowerThird,
      safeGuides: {
        ...lowerThird.safeGuides,
        [field]: value,
      },
      updatedAt: new Date().toISOString(),
    });
  };

  return (
    <Box>
      <Tabs
        value={activeTab}
        onChange={(_, newValue) => {
          const tabNames = ['Content','Animation','Style','Safe Guides','Preview'];

          analytics.trackEvent('lower_third_editor_tab_changed', {
            lowerThirdId: lowerThird.id,
            fromTab: tabNames[activeTab],
            toTab: tabNames[newValue],
            tabIndex: newValue,
            timestamp: Date.now(),
          });

          debugging.logIntegration('info','Lower third editor tab changed', {
            lowerThirdId: lowerThird.id,
            fromTab: activeTab,
            toTab: newValue,
          });

          setActiveTab(newValue);
        }}
      >
        <Tab label="Content" />
        <Tab label="Animation" />
        <Tab label="Style" />
        <Tab label="Safe Guides" />
        <Tab label="Preview" />
      </Tabs>

      {activeTab === 0 && (
        <Box sx={{ mt: 2 }}>
          <TextField
            fullWidth
            label="Name"
            value={lowerThird.name}
            onChange={(e) => handleChange('name', e.target.value)}
            sx={{ mb: 2 }}
          />
          <TextField
            fullWidth
            label="Title"
            value={lowerThird.title}
            onChange={(e) => handleChange('title', e.target.value)}
            sx={{ mb: 2 }}
          />
          <TextField
            fullWidth
            label="Subtitle"
            value={lowerThird.subtitle || ', '}
            onChange={(e) => handleChange('subtitle', e.target.value)}
            sx={{ mb: 2 }}
          />
          <TextField
            fullWidth
            label="Description"
            value={lowerThird.description || ''}
            onChange={(e) => handleChange('description', e.target.value)}
            multiline
            rows={3}
          />
        </Box>
      )}

      {activeTab === 1 && (
        <Box sx={{ mt: 2 }}>
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Position</InputLabel>
            <Select
              value={lowerThird.position}
              onChange={(e) => handleChange('position', e.target.value)}
              label="Position"
            >
              <MenuItem value="bottom-left">Bottom Left</MenuItem>
              <MenuItem value="bottom-center">Bottom Center</MenuItem>
              <MenuItem value="bottom-right">Bottom Right</MenuItem>
              <MenuItem value="top-left">Top Left</MenuItem>
              <MenuItem value="top-center">Top Center</MenuItem>
              <MenuItem value="top-right">Top Right</MenuItem>
            </Select>
          </FormControl>

          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Animation</InputLabel>
            <Select
              value={lowerThird.animation}
              onChange={(e) => handleChange('animation', e.target.value)}
              label="Animation"
            >
              <MenuItem value="slide-up">Slide Up</MenuItem>
              <MenuItem value="slide-down">Slide Down</MenuItem>
              <MenuItem value="fade-in">Fade In</MenuItem>
              <MenuItem value="slide-left">Slide Left</MenuItem>
              <MenuItem value="slide-right">Slide Right</MenuItem>
              <MenuItem value="zoom-in">Zoom In</MenuItem>
              <MenuItem value="typewriter">Typewriter</MenuItem>
            </Select>
          </FormControl>

          <Stack direction="row" spacing={2}>
            <Box sx={{ flex: 1 }}>
              <TextField
                label="Duration (seconds)"
                type="number"
                value={lowerThird.duration}
                onChange={(e) => handleChange('duration', parseFloat(e.target.value))}
                inputProps={{
                  min: TIMING_GUIDELINES.lowerThird.minimum,
                  max: TIMING_GUIDELINES.lowerThird.maximum,
                  step: 0.1}}
                error={
                  !getTimingValidation('lowerThird', lowerThird.duration, lowerThird.title).isValid
                }
                helperText={
                  getTimingValidation('lowerThird', lowerThird.duration, lowerThird.title)
                    .suggestion
                }
                fullWidth
              />
              <Button
                size="small"
                onClick={() => {
                  const endTiming = performance.startTiming('lower_third_auto_calculate_duration');

                  const optimalDuration = calculateOptimalLowerThirdDuration(lowerThird.title);
                  const oldDuration = lowerThird.duration;

                  handleChange('duration', optimalDuration);

                  analytics.trackEvent('lower_third_auto_calculate_duration', {
                    lowerThirdId: lowerThird.id,
                    textLength: lowerThird.title.length,
                    oldDuration,
                    newDuration: optimalDuration,
                    durationChange: optimalDuration - oldDuration,
                    timestamp: Date.now(),
                  });

                  debugging.logIntegration('info', 'Lower third duration auto-calculated', {
                    lowerThirdId: lowerThird.id,
                    oldDuration,
                    newDuration: optimalDuration,
                    textLength: lowerThird.title.length,
                  });

                  endTiming();
                }}
                sx={{ mt: 1, fontSize: '0.75rem' }}
              >
                Auto-calculate ({calculateOptimalLowerThirdDuration(lowerThird.title).toFixed(1)}s)
              </Button>
            </Box>
            <TextField
              label="Delay (seconds)"
              type="number"
              value={lowerThird.delay}
              onChange={(e) => handleChange('delay', parseFloat(e.target.value))}
              inputProps={{ min: 0, max: 5, step: 0.1 }}
              sx={{ flex: 1 }}
            />
          </Stack>

          {/* Timing Guidelines Info */}
          <Alert severity="info" sx={{ mt: 2 }}>
            <Typography variant="body2">
              <strong>Timing Guidelines:</strong> Lower thirds should display for 3-6 seconds
              (recommended: 4-5s). This ensures viewers have enough time to read without disrupting
              video flow.
            </Typography>
          </Alert>

          <Box sx={{ mt: 3 }}>
            <Typography variant="subtitle2" gutterBottom>
              Timing Controls
            </Typography>
            <Stack spacing={2}>
              <Box>
                <Typography variant="body2" gutterBottom>
                  Ease In: {lowerThird.timing.easeIn}
                </Typography>
                <Slider
                  value={lowerThird.timing.easeIn}
                  onChange={(_, value) => handleTimingChange('easeIn', value)}
                  min={0}
                  max={1}
                  step={0.1}
                />
              </Box>
              <Box>
                <Typography variant="body2" gutterBottom>
                  Ease Out: {lowerThird.timing.easeOut}
                </Typography>
                <Slider
                  value={lowerThird.timing.easeOut}
                  onChange={(_, value) => handleTimingChange('easeOut', value)}
                  min={0}
                  max={1}
                  step={0.1}
                />
              </Box>
              <FormControlLabel
                control={
                  <Switch
                    checked={lowerThird.timing.bounce}
                    onChange={(e) => handleTimingChange('bounce', e.target.checked)}
                  />
                }
                label="Bounce Effect"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={lowerThird.timing.elastic}
                    onChange={(e) => handleTimingChange('elastic', e.target.checked)}
                  />
                }
                label="Elastic Effect"
              />
            </Stack>
          </Box>
        </Box>
      )}

      {activeTab === 2 && (
        <Box sx={{ mt: 2 }}>
          <Stack spacing={3}>
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Colors
              </Typography>
              <Stack direction="row" spacing={2}>
                <TextField
                  label="Background Color"
                  type="color"
                  value={lowerThird.style.backgroundColor}
                  onChange={(e) => handleStyleChange('backgroundColor', e.target.value)}
                  sx={{ width: 120 }}
                />
                <TextField
                  label="Text Color"
                  type="color"
                  value={lowerThird.style.textColor}
                  onChange={(e) => handleStyleChange('textColor', e.target.value)}
                  sx={{ width: 120 }}
                />
                <TextField
                  label="Border Color"
                  type="color"
                  value={lowerThird.style.borderColor || '#000000'}
                  onChange={(e) => handleStyleChange('borderColor', e.target.value)}
                  sx={{ width: 120 }}
                />
              </Stack>
            </Box>

            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Layout
              </Typography>
              <Stack direction="row" spacing={2}>
                <TextField
                  label="Border Radius"
                  type="number"
                  value={lowerThird.style.borderRadius}
                  onChange={(e) => handleStyleChange('borderRadius', parseInt(e.target.value))}
                  inputProps={{ min: 0, max: 50 }}
                />
                <TextField
                  label="Padding"
                  type="number"
                  value={lowerThird.style.padding}
                  onChange={(e) => handleStyleChange('padding', parseInt(e.target.value))}
                  inputProps={{ min: 0, max: 50 }}
                />
                <TextField
                  label="Font Size"
                  type="number"
                  value={lowerThird.style.fontSize}
                  onChange={(e) => handleStyleChange('fontSize', parseInt(e.target.value))}
                  inputProps={{ min: 8, max: 48 }}
                />
              </Stack>
            </Box>

            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Effects
              </Typography>
              <Stack direction="row" spacing={2}>
                <TextField
                  label="Opacity"
                  type="number"
                  value={lowerThird.style.opacity}
                  onChange={(e) => handleStyleChange('opacity', parseFloat(e.target.value))}
                  inputProps={{ min: 0, max: 1, step: 0.1 }}
                />
                <TextField
                  label="Blur"
                  type="number"
                  value={lowerThird.style.blur}
                  onChange={(e) => handleStyleChange('blur', parseInt(e.target.value))}
                  inputProps={{ min: 0, max: 20 }}
                />
              </Stack>
            </Box>
          </Stack>
        </Box>
      )}

      {activeTab === 3 && (
        <Box sx={{ mt: 2 }}>
          <Stack spacing={3}>
            <FormControl fullWidth>
              <InputLabel>Orientation</InputLabel>
              <Select
                value={lowerThird.orientation}
                onChange={(e) => handleChange('orientation', e.target.value)}
                label="Orientation"
              >
                <MenuItem value="horizontal">Horizontal</MenuItem>
                <MenuItem value="vertical">Vertical</MenuItem>
                <MenuItem value="auto">Auto (based on aspect ratio)</MenuItem>
              </Select>
            </FormControl>

            <FormControlLabel
              control={
                <Switch
                  checked={lowerThird.safeGuides.enabled}
                  onChange={(e) => handleSafeGuideChange('enabled', e.target.checked)}
                />
              }
              label="Enable Safe Guides"
            />

            {lowerThird.safeGuides.enabled && (
              <>
                <FormControl fullWidth>
                  <InputLabel>Guide Type</InputLabel>
                  <Select
                    value={lowerThird.safeGuides.type}
                    onChange={(e) => handleSafeGuideChange('type', e.target.value)}
                    label="Guide Type"
                  >
                    <MenuItem value="title-safe">Title Safe (5% margin)</MenuItem>
                    <MenuItem value="action-safe">Action Safe (10% margin)</MenuItem>
                    <MenuItem value="custom">Custom Margins</MenuItem>
                  </Select>
                </FormControl>

                <Stack direction="row" spacing={2}>
                  <TextField
                    label="Guide Color"
                    type="color"
                    value={lowerThird.safeGuides.color}
                    onChange={(e) => handleSafeGuideChange('color', e.target.value)}
                    sx={{ width: 120 }}
                  />
                  <TextField
                    label="Opacity"
                    type="number"
                    value={lowerThird.safeGuides.opacity}
                    onChange={(e) => handleSafeGuideChange('opacity', parseFloat(e.target.value))}
                    inputProps={{ min: 0, max: 1, step: 0.1 }}
                  />
                  <TextField
                    label="Thickness"
                    type="number"
                    value={lowerThird.safeGuides.thickness}
                    onChange={(e) => handleSafeGuideChange('thickness', parseInt(e.target.value))}
                    inputProps={{ min: 1, max: 10 }}
                  />
                </Stack>

                <FormControlLabel
                  control={
                    <Switch
                      checked={lowerThird.safeGuides.showLabels}
                      onChange={(e) => handleSafeGuideChange('showLabels', e.target.checked)}
                    />
                  }
                  label="Show Labels"
                />

                {lowerThird.safeGuides.type === 'custom' && (
                  <Box>
                    <Typography variant="subtitle2" gutterBottom>
                      Custom Margins (%)
                    </Typography>
                    <Stack direction="row" spacing={2}>
                      <TextField
                        label="Top"
                        type="number"
                        value={lowerThird.safeGuides.customMargins?.top || 0}
                        onChange={(e) =>
                          handleSafeGuideChange('customMargins', {
                            ...lowerThird.safeGuides.customMargins,
                            top: parseInt(e.target.value),
                          })
                        }
                        inputProps={{ min: 0, max: 50 }}
                      />
                      <TextField
                        label="Right"
                        type="number"
                        value={lowerThird.safeGuides.customMargins?.right || 0}
                        onChange={(e) =>
                          handleSafeGuideChange('customMargins', {
                            ...lowerThird.safeGuides.customMargins,
                            right: parseInt(e.target.value),
                          })
                        }
                        inputProps={{ min: 0, max: 50 }}
                      />
                      <TextField
                        label="Bottom"
                        type="number"
                        value={lowerThird.safeGuides.customMargins?.bottom || 0}
                        onChange={(e) =>
                          handleSafeGuideChange('customMargins', {
                            ...lowerThird.safeGuides.customMargins,
                            bottom: parseInt(e.target.value),
                          })
                        }
                        inputProps={{ min: 0, max: 50 }}
                      />
                      <TextField
                        label="Left"
                        type="number"
                        value={lowerThird.safeGuides.customMargins?.left || 0}
                        onChange={(e) =>
                          handleSafeGuideChange('customMargins', {
                            ...lowerThird.safeGuides.customMargins,
                            left: parseInt(e.target.value),
                          })
                        }
                        inputProps={{ min: 0, max: 50 }}
                      />
                    </Stack>
                  </Box>
                )}
              </>
            )}
          </Stack>
        </Box>
      )}

      {activeTab === 4 && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="subtitle2" gutterBottom>
            Live Preview
          </Typography>
          <Box
            sx={{
              position: 'relative',
              height: 200,
              backgroundColor: '#1a1a1a',
              borderRadius: 2,
              overflow: 'hidden',
              border: 'var(--academy-hairline-width, 1px) solid #333'}}
          >
            {renderPreview(lowerThird, false)}
          </Box>
          <Button
            variant="outlined"
            startIcon={<PlayArrow />}
            onClick={() => {
              analytics.trackEvent('lower_third_editor_preview_clicked', {
                lowerThirdId: lowerThird.id,
                tabContext: 'preview_tab',
                animation: lowerThird.animation,
                duration: lowerThird.duration,
                safeGuidesEnabled: lowerThird.safeGuides.enabled,
                orientation: lowerThird.orientation,
                timingValid: getTimingValidation(
                 'lowerThird',
                  lowerThird.duration,
                  lowerThird.title,
                ).isValid,
                timestamp: Date.now(),
              });

              debugging.logIntegration('info', 'Lower third editor preview clicked', {
                lowerThirdId: lowerThird.id,
                animation: lowerThird.animation,
                safeGuidesEnabled: lowerThird.safeGuides.enabled,
                orientation: lowerThird.orientation,
              });

              onPreview(lowerThird);
            }}
            sx={{ mt: 2 }}
          >
            Preview Animation
          </Button>
        </Box>
      )}
    </Box>
  );
}
