/**
 * CTA Overlay Editor Component for CreatorHub Academy
 * Interactive call-to-action overlay creation and management
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
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
  Paper,
  Tooltip,
  Alert,
  Tabs,
  Tab,
  Slider,
  Divider,
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  PlayArrow,
  Save,
  Close,
  Visibility,
  VisibilityOff,
  ContentCopy,
  Link,
  Download,
  PersonAdd,
  ShoppingCart,
  Share,
  Email,
  Phone,
  Language,
  Assignment,
  Quiz,
  VideoLibrary,
  Image,
  AudioFile,
  Description,
} from '@mui/icons-material';
import { useEnhancedMasterIntegration } from '@/integration/EnhancedMasterIntegrationProvider';
import { withUniversalIntegration } from '@/integration/UniversalIntegrationHOC';
import { useTheming } from '../../utils/theming-helper';

// Industry-standard timing guidelines based on broadcast and accessibility standards
const TIMING_GUIDELINES = {
  ctaOverlay: {
    minimum: 2, // seconds
    recommended: 5, // seconds (3-7 range)
    maximum: 10, // seconds
    readingSpeed: 140, // words per minute (slightly slower for CTAs)
  },
};

// WCAG 2.2 AA+ compliance guidelines
const WCAG_GUIDELINES = {
  colorContrast: {
    normalText: 4.5, // minimum ratio
    largeText: 3.0, // minimum ratio for 18pt+ or 14pt+ bold
    uiComponents: 3.0, // minimum ratio for UI elements
  },
  textSize: {
    minimum: 14, // pixels
    recommended: 16, // pixels
    largeText: 18, // pixels
  },
  focusIndicators: {
    outlineWidth: 2, // pixels
    outlineOffset: 2, // pixels
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

interface CTAOverlay {
  id: string;
  name: string;
  type:
    | 'subscribe'
    | 'download'
    | 'external'
    | 'email'
    | 'phone'
    | 'quiz'
    | 'assignment'
    | 'custom';
  title: string;
  description?: string;
  buttonText: string;
  action: {
    url?: string;
    email?: string;
    phone?: string;
    fileId?: string;
    assignmentId?: string;
    quizId?: string;
    customAction?: string;
  };
  timing: {
    startTime: number; // seconds
    endTime: number; // seconds
    autoHide: boolean;
    clickToClose: boolean;
  };
  position: {
    x: number; // percentage
    y: number; // percentage
    anchor:
      | 'top-left'
      | 'top-center'
      | 'top-right'
      | 'middle-left'
      | 'middle-center'
      | 'middle-right'
      | 'bottom-left'
      | 'bottom-center'
      | 'bottom-right';
  };
  safeGuides: SafeGuide;
  accessibility: {
    altText: string;
    ariaLabel: string;
    keyboardNavigation: boolean;
    focusVisible: boolean;
    highContrast: boolean;
    reducedMotion: boolean;
  };
  style: {
    backgroundColor: string;
    textColor: string;
    buttonColor: string;
    buttonTextColor: string;
    borderColor?: string;
    borderWidth?: number;
    borderRadius: number;
    padding: number;
    fontSize: number;
    fontWeight: 'normal' | 'bold' | 'lighter';
    opacity: number;
    shadow?: {
      enabled: boolean;
      color: string;
      blur: number;
      offsetX: number;
      offsetY: number;
    };
  };
  animation: {
    type:
      | 'fade-in'
      | 'slide-up'
      | 'slide-down'
      | 'slide-left'
      | 'slide-right'
      | 'zoom-in'
      | 'bounce';
    duration: number; // seconds
    delay: number; // seconds
  };
  isVisible: boolean;
  isPreview: boolean;
  createdAt: string;
  updatedAt: string;
  courseId?: string;
  lessonId?: string;
}

interface CTAOverlayEditorProps {
  courseId?: string;
  lessonId?: string;
  onCTASelect?: (cta: CTAOverlay) => void;
  onCTASave?: (cta: CTAOverlay) => void;
  onCTADelete?: (ctaId: string) => void;
  selectedCTA?: CTAOverlay | null;
  mode?: 'create' | 'edit' | 'browse' | 'select';
  showPreview?: boolean;
  height?: number;
}

const SAMPLE_CTA_OVERLAYS: CTAOverlay[] = [
  {
    id: 'cta-1',
    name: 'Subscribe to Channel',
    type: 'subscribe',
    title: 'Subscribe for More Content',
    description: 'Get notified when we upload new photography tutorials',
    buttonText: 'Subscribe Now',
    action: {
      url: 'https://youtube.com/subscribe',
    },
    timing: {
      startTime: 30,
      endTime: 45,
      autoHide: true,
      clickToClose: true,
    },
    position: {
      x: 50,
      y: 80,
      anchor: 'bottom-center',
    },
    safeGuides: {
      enabled: true,
      type: 'title-safe',
      color: '#00ff00',
      opacity: 0.7,
      thickness: 2,
      showLabels: true,
    },
    accessibility: {
      altText: 'Subscribe to channel call-to-action',
      ariaLabel: 'Subscribe button for more content',
      keyboardNavigation: true,
      focusVisible: true,
      highContrast: false,
      reducedMotion: false,
    },
    style: {
      backgroundColor: '#ff0000',
      textColor: '#ffffff',
      buttonColor: '#ffffff',
      buttonTextColor: '#ff0000',
      borderRadius: 12,
      padding: 20,
      fontSize: 16,
      fontWeight: 'bold',
      opacity: 0.95,
      shadow: {
        enabled: true,
        color: 'rgba(0,0,0,0.3)',
        blur: 8,
        offsetX: 2,
        offsetY: 4,
      },
    },
    animation: {
      type: 'slide-up',
      duration: 1,
      delay: 0,
    },
    isVisible: true,
    isPreview: false,
    createdAt: '2024-01-15T10:30:00Z',
    updatedAt: '2024-01-15T10:30:00Z',
    courseId: 'course-1',
  },
  {
    id: 'cta-2',
    name: 'Download Resources',
    type: 'download',
    title: 'Free Photography Guide',
    description: 'Download our comprehensive guide to portrait photography',
    buttonText: 'Download PDF',
    action: {
      fileId: 'guide-portrait-photography.pdf',
    },
    timing: {
      startTime: 120,
      endTime: 150,
      autoHide: false,
      clickToClose: true,
    },
    position: {
      x: 20,
      y: 20,
      anchor: 'top-left',
    },
    safeGuides: {
      enabled: true,
      type: 'action-safe',
      color: '#ffff00',
      opacity: 0.6,
      thickness: 1,
      showLabels: false,
    },
    accessibility: {
      altText: 'Download photography guide call-to-action',
      ariaLabel: 'Download free photography guide PDF',
      keyboardNavigation: true,
      focusVisible: true,
      highContrast: false,
      reducedMotion: false,
    },
    style: {
      backgroundColor: '#2196f3',
      textColor: '#ffffff',
      buttonColor: '#ffffff',
      buttonTextColor: '#2196f3',
      borderRadius: 8,
      padding: 16,
      fontSize: 14,
      fontWeight: 'normal',
      opacity: 0.9,
      shadow: {
        enabled: true,
        color: 'rgba(0,0,0,0.2)',
        blur: 6,
        offsetX: 1,
        offsetY: 2,
      },
    },
    animation: {
      type: 'fade-in',
      duration: 0.5,
      delay: 0,
    },
    isVisible: true,
    isPreview: false,
    createdAt: '2024-01-14T14:20:00Z',
    updatedAt: '2024-01-14T14:20:00Z',
    courseId: 'course-1',
  },
  {
    id: 'cta-3',
    name: 'Take Quiz',
    type: 'quiz',
    title: 'Test Your Knowledge',
    description: 'Take this quick quiz to reinforce what you learned',
    buttonText: 'Start Quiz',
    action: {
      quizId: 'quiz-basic-photography',
    },
    timing: {
      startTime: 300,
      endTime: 330,
      autoHide: true,
      clickToClose: false,
    },
    position: {
      x: 80,
      y: 20,
      anchor: 'top-right',
    },
    safeGuides: {
      enabled: true,
      type: 'custom',
      color: '#ff00ff',
      opacity: 0.8,
      thickness: 3,
      showLabels: true,
      customMargins: {
        top: 8,
        right: 8,
        bottom: 8,
        left: 8,
      },
    },
    accessibility: {
      altText: 'Take quiz call-to-action',
      ariaLabel: 'Start quiz to test your knowledge',
      keyboardNavigation: true,
      focusVisible: true,
      highContrast: false,
      reducedMotion: false,
    },
    style: {
      backgroundColor: '#4caf50',
      textColor: '#ffffff',
      buttonColor: '#ffffff',
      buttonTextColor: '#4caf50',
      borderRadius: 10,
      padding: 18,
      fontSize: 15,
      fontWeight: 'bold',
      opacity: 0.95,
      shadow: {
        enabled: true,
        color: 'rgba(0,0,0,0.25)',
        blur: 10,
        offsetX: 3,
        offsetY: 3,
      },
    },
    animation: {
      type: 'zoom-in',
      duration: 0.8,
      delay: 0.2,
    },
    isVisible: true,
    isPreview: false,
    createdAt: '2024-01-13T09:15:00Z',
    updatedAt: '2024-01-13T09:15:00Z',
    courseId: 'course-1',
    lessonId: 'lesson-3',
	},
	];

function CTAOverlayEditor({
  courseId,
  lessonId,
  onCTASelect,
  onCTASave,
  onCTADelete,
  selectedCTA,
  mode = 'browse',
  showPreview = true,
  height = 600,
}: CTAOverlayEditorProps) {
  const [ctaOverlays, setCtaOverlays] = useState<CTAOverlay[]>(SAMPLE_CTA_OVERLAYS);
  const [activeTab, setActiveTab] = useState(0);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingCTA, setEditingCTA] = useState<CTAOverlay | null>(null);
  const [previewCTA, setPreviewCTA] = useState<CTAOverlay | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [searchQuery, setSearchQuery] = useState(' ');
  const [filterType, setFilterType] = useState<'all' | 'course' | 'lesson'>('all');

  const { analytics, performance, debugging, lifecycle, health } = useEnhancedMasterIntegration();

  // Theming system
  const theming = useTheming('music_producer');
  const previewRef = useRef<HTMLDivElement>(null);

  // Component lifecycle management
  useEffect(() => {
    const endTiming = performance.startTiming('cta_overlay_editor_render');

    // Register component with enhanced integration
    lifecycle.registerComponent({
      id: `cta-overlay-editor-${courseId || 'new'}`,
      type: 'cta-overlay-editor',
      version: '1.2.0',
      capabilities: {
        data: ['cta-overlays','course-data','lesson-data'],
        events: ['cta-created','cta-updated','cta-deleted','cta-previewed'],
        actions: ['create-cta','update-cta','delete-cta','preview-cta'],
        ui: ['safe-guides','timing-validation','wcag-compliance','preview-mode'],
        system: ['analytics-tracking','performance-monitoring','accessibility-validation'],
      },
      dependencies: ['course-creator','academy-context','theming-system'],
      lastActive: Date.now(),
      performance: {
        renderCount: 0,
        avgRenderTime: 0,
        memoryUsage: 0,
      },
    });

    analytics.trackEvent('cta_overlay_editor_mounted', {
      courseId,
      lessonId,
      mode,
      showPreview,
      timestamp: Date.now(),
    });

    debugging.logIntegration('info', 'CTA Overlay Editor mounted', {
      courseId,
      lessonId,
      mode,
      componentCapabilities: ['safe-guides','timing-validation','wcag-compliance'],
    });

    return () => {
      endTiming();
      lifecycle.unregisterComponent(`cta-overlay-editor-${courseId || 'new'}`);
      analytics.trackEvent('cta_overlay_editor_unmounted', {
        courseId,
        lessonId,
        timestamp: Date.now(),
      });
    };
  }, [courseId, lessonId, mode, showPreview, lifecycle, analytics, performance, debugging]);

  // Timing calculation helpers
  const calculateOptimalCTADuration = (text: string): number => {
    const words = text.split(/\s+/).length;
    const readingTime = (words / TIMING_GUIDELINES.ctaOverlay.readingSpeed) * 60; // Convert to seconds
    return Math.max(
      TIMING_GUIDELINES.ctaOverlay.minimum,
      Math.min(TIMING_GUIDELINES.ctaOverlay.maximum, readingTime),
    );
  };

  const getTimingValidation = (duration: number, text?: string) => {
    const guidelines = TIMING_GUIDELINES.ctaOverlay;
    const isValid = duration >= guidelines.minimum && duration <= guidelines.maximum;
    const isRecommended = Math.abs(duration - guidelines.recommended) <= 1;

    let suggestion = '';
    if (duration < guidelines.minimum) {
      suggestion = `Too short! Minimum is ${guidelines.minimum}s.`;
    } else if (duration > guidelines.maximum) {
      suggestion = `Too long! Maximum is ${guidelines.maximum}s.`;
    } else if (!isRecommended) {
      suggestion = `Consider ${guidelines.recommended}s for optimal engagement.`;
    }

    if (text) {
      const optimalDuration = calculateOptimalCTADuration(text);
      if (Math.abs(duration - optimalDuration) > 1) {
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

  // WCAG compliance helpers
  const calculateColorContrast = (color1: string, color2: string): number => {
    // Simplified contrast calculation - in production, use a proper library
    const getLuminance = (color: string): number => {
      const rgb = parseInt(color.slice(1), 16);
      const r = (rgb >> 16) & 0xff;
      const g = (rgb >> 8) & 0xff;
      const b = (rgb >> 0) & 0xff;
      const [rs, gs, bs] = [rgb].map((c) => {
        c = c / 255;
        return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
      });
      return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
    };

    const lum1 = getLuminance(color1);
    const lum2 = getLuminance(color2);
    const brightest = Math.max(lum1, lum2);
    const darkest = Math.min(lum1, lum2);
    return (brightest + 0.05) / (darkest + 0.05);
  };

  const getContrastValidation = (backgroundColor: string, textColor: string, fontSize: number) => {
    const contrast = calculateColorContrast(backgroundColor, textColor);
    const isLargeText = fontSize >= WCAG_GUIDELINES.textSize.largeText;
    const requiredRatio = isLargeText
      ? WCAG_GUIDELINES.colorContrast.largeText
      : WCAG_GUIDELINES.colorContrast.normalText;

    const isValid = contrast >= requiredRatio;
    const severity = isValid ? 'success' : 'error';

    let suggestion = '';
    if (!isValid) {
      suggestion = `Contrast ratio ${contrast.toFixed(1)}:1 is below WCAG 2.2 AA standard (${requiredRatio}:1 required${isLargeText ? ' for large text' : ','}).`;
    } else if (contrast < requiredRatio + 1) {
      suggestion = `Contrast ratio ${contrast.toFixed(1)}:1 meets WCAG 2.2 AA. Consider higher contrast for better accessibility.`;
    }

    return {
      isValid,
      contrast,
      requiredRatio,
      suggestion,
      severity,
    };
  };

  // Safe guide calculations
  const getSafeGuideMargins = (
    type: 'title-safe' | 'action-safe' | 'custom',
    customMargins?: { top: number; right: number; bottom: number; left: number },
  ) => {
    if (type === 'custom' && customMargins) {
      return customMargins;
    }

    if (type === 'title-safe') {
      // Title safe area: 5% margin from edges
      return { top: 5, right: 5, bottom: 5, left: 5 };
    }

    // Action safe area: 10% margin from edges
    return { top: 10, right: 10, bottom: 10, left: 10 };
  };

  // Render safe guides overlay
  const renderSafeGuides = (
    safeGuide: SafeGuide,
    containerWidth: number,
    containerHeight: number,
  ) => {
    if (!safeGuide.enabled) return null;

    const margins = getSafeGuideMargins(safeGuide.type, safeGuide.customMargins);
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
            <Box sx={{ ...labelStyle, top: '10px', right: '10px' }}>CTA Safe Area</Box>
          </>
        )}
      </>
    );
  };

  // Filter CTA overlays based on search and type
  const filteredCTAOverlays = ctaOverlays.filter((cta) => {
    const matchesSearch =
      cta.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      cta.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      cta.type.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType =
      filterType === 'all' ||
      (filterType === 'course' && cta.courseId && !cta.lessonId) ||
      (filterType === 'lesson' && cta.lessonId);
    return matchesSearch && matchesType;
  });

  // Create new CTA overlay
  const handleCreateCTA = useCallback(() => {
    const endTiming = performance.startTiming('cta_overlay_creation');

    analytics.trackEvent('cta_overlay_creation_started', {
      courseId,
      lessonId,
      timestamp: Date.now(),
    });

    const newCTA: CTAOverlay = {
      id: `cta-${Date.now()}`,
      name: 'New CTA Overlay',
      type: 'subscribe',
      title: 'Enter CTA Title',
      description: 'Enter CTA description',
      buttonText: 'Click Here',
      action: {},
      timing: {
        startTime: 0,
        endTime: 10,
        autoHide: true,
        clickToClose: true,
      },
      position: {
        x: 50,
        y: 80,
        anchor: 'bottom-center',
      },
      safeGuides: {
        enabled: true,
        type: 'title-safe',
        color: '#00ff00',
        opacity: 0.7,
        thickness: 2,
        showLabels: true,
      },
      accessibility: {
        altText: 'New call-to-action overlay',
        ariaLabel: 'Interactive call-to-action button',
        keyboardNavigation: true,
        focusVisible: true,
        highContrast: false,
        reducedMotion: false,
      },
      style: {
        backgroundColor: '#2196f3',
        textColor: '#ffffff',
        buttonColor: '#ffffff',
        buttonTextColor: '#2196f3',
        borderRadius: 8,
        padding: 16,
        fontSize: 16,
        fontWeight: 'bold',
        opacity: 0.95,
        shadow: {
          enabled: true,
          color: 'rgba(0,0,0,0.3)',
          blur: 8,
          offsetX: 2,
          offsetY: 4,
        },
      },
      animation: {
        type: 'fade-in',
        duration: 1,
        delay: 0,
      },
      isVisible: true,
      isPreview: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      courseId,
      lessonId,
    };

    setEditingCTA(newCTA);
    setShowCreateDialog(true);

    endTiming();

    debugging.logIntegration('info','New CTA overlay created', {
      ctaId: newCTA.id,
      courseId,
      lessonId,
      defaultSafeGuides: newCTA.safeGuides.type,
      defaultAccessibility: newCTA.accessibility.keyboardNavigation,
    });
  }, [courseId, lessonId, analytics, performance, debugging]);

  // Save CTA overlay
  const handleSaveCTA = useCallback(
    (cta: CTAOverlay) => {
      setCtaOverlays((prev) => {
        const existing = prev.find((c) => c.id === cta.id);
        if (existing) {
          return prev.map((c) =>
            c.id === cta.id ? { ...cta, updatedAt: new Date().toISOString() } : c,
          );
        } else {
          return [...prev, { ...cta, updatedAt: new Date().toISOString() }];
        }
      });

      if (onCTASave) {
        onCTASave(cta);
      }

      setShowCreateDialog(false);
      setEditingCTA(null);

      analytics.trackEvent('cta_overlay_saved', {
        ctaId: cta.id,
        ctaName: cta.name,
        ctaType: cta.type,
        courseId: cta.courseId,
        lessonId: cta.lessonId,
        timing: cta.timing,
        position: cta.position,
        safeGuides: cta.safeGuides,
        accessibility: cta.accessibility,
        wcagCompliance: {
          contrastValid: getContrastValidation(
            cta.style.backgroundColor,
            cta.style.textColor,
            cta.style.fontSize,
          ).isValid,
          timingValid: getTimingValidation(
            cta.timing.endTime - cta.timing.startTime,
            `${cta.title} ${cta.description || ''}`,
          ).isValid,
          fontSizeValid: cta.style.fontSize >= WCAG_GUIDELINES.textSize.minimum,
        },
        timestamp: Date.now(),
      });

      debugging.logIntegration('info','CTA overlay saved successfully', {
        ctaId: cta.id,
        ctaName: cta.name,
        ctaType: cta.type,
        wcagCompliance: true,
        safeGuidesEnabled: cta.safeGuides.enabled,
      });
    },
    [onCTASave, analytics],
  );

  // Delete CTA overlay
  const handleDeleteCTA = useCallback(
    (ctaId: string) => {
      setCtaOverlays((prev) => prev.filter((c) => c.id !== ctaId));

      if (onCTADelete) {
        onCTADelete(ctaId);
      }

      analytics.trackEvent('cta_overlay_deleted', {
        ctaId,
        courseId,
        lessonId,
        timestamp: Date.now(),
      });

      debugging.logIntegration('info','CTA overlay deleted', {
        ctaId,
        courseId,
        lessonId,
      });
    },
    [onCTADelete, analytics],
  );

  // Preview CTA overlay
  const handlePreviewCTA = useCallback(
    (cta: CTAOverlay) => {
      const endTiming = performance.startTiming('cta_preview_animation');

      setPreviewCTA(cta);
      setIsPreviewing(true);

      analytics.trackEvent('cta_overlay_previewed', {
        ctaId: cta.id,
        ctaName: cta.name,
        ctaType: cta.type,
        animationType: cta.animation.type,
        animationDuration: cta.animation.duration,
        timingDuration: cta.timing.endTime - cta.timing.startTime,
        safeGuidesEnabled: cta.safeGuides.enabled,
        wcagCompliant: getContrastValidation(
          cta.style.backgroundColor,
          cta.style.textColor,
          cta.style.fontSize,
        ).isValid,
        timestamp: Date.now(),
      });

      debugging.logIntegration('info','CTA overlay preview started', {
        ctaId: cta.id,
        animationType: cta.animation.type,
        duration: cta.timing.endTime - cta.timing.startTime,
      });

      // Auto-stop preview after duration
      setTimeout(
        () => {
          setIsPreviewing(false);
          endTiming();

          analytics.trackEvent('cta_overlay_preview_ended', {
            ctaId: cta.id,
            previewDuration: cta.timing.endTime - cta.timing.startTime,
            timestamp: Date.now(),
          });
        },
        (cta.timing.endTime - cta.timing.startTime + cta.animation.delay + cta.animation.duration) *
          1000,
      );
    },
    [analytics, performance, debugging],
  );

  // Get CTA type icon
  const getCTATypeIcon = (type: string) => {
    switch (type) {
      case 'subscribe':
        return <PersonAdd />;
      case 'download':
        return <Download />;
      case 'external':
        return <Language />;
      case 'email':
        return <Email />;
      case 'phone':
        return <Phone />;
      case 'quiz':
        return <Quiz />;
      case 'assignment':
        return <Assignment />;
      default:
        return <Link />;
    }
  };

  // Get CTA type color
  const getCTATypeColor = (type: string) => {
    switch (type) {
      case 'subscribe':
        return '#ff0000';
      case 'download':
        return '#2196f3';
      case 'external':
        return '#ff9800';
      case 'email':
        return '#9c27b0';
      case 'phone':
        return '#4caf50';
      case 'quiz':
        return '#4caf50';
      case 'assignment':
        return '#ff5722';
      default:
        return '#757575';
    }
  };

  // Render CTA overlay preview
  const renderCTAPreview = (
    cta: CTAOverlay,
    isLive: boolean = false,
    containerWidth: number = 800,
    containerHeight: number = 450,
  ) => {
    const { position, style, title, description, buttonText, animation, accessibility } = cta;

    const positionStyles = {
      'top-left': {
        top: `${position.y}%`,
        left: `${position.x}%`,
        transform: 'translate(-100%, -100%)',
      }, 'top-center': {
        top: `${position.y}%`,
        left: `${position.x}%`,
        transform: 'translate(-50%, -100%)',
      }, 'top-right': {
        top: `${position.y}%`,
        left: `${position.x}%`,
        transform: 'translate(0, -100%)',
      }, 'middle-left': {
        top: `${position.y}%`,
        left: `${position.x}%`,
        transform: 'translate(-100%, -50%)',
      }, 'middle-center': {
        top: `${position.y}%`,
        left: `${position.x}%`,
        transform: 'translate(-50%, -50%)',
      }, 'middle-right': {
        top: `${position.y}%`,
        left: `${position.x}%`,
        transform: 'translate(0, -50%)',
      }, 'bottom-left': {
        top: `${position.y}%`,
        left: `${position.x}%`,
        transform: 'translate(-100%, 0)',
      }, 'bottom-center': {
        top: `${position.y}%`,
        left: `${position.x}%`,
        transform: 'translate(-50%, 0)',
      }, 'bottom-right': {
        top: `${position.y}%`,
        left: `${position.x}%`,
        transform: 'translate(0, 0)',
      },
    };

    // Calculate safe guide margins
    const safeMargins = getSafeGuideMargins(cta.safeGuides.type, cta.safeGuides.customMargins);

    // Adjust position based on safe guides
    const adjustedPosition = {
      x: Math.max(safeMargins.left, Math.min(100 - safeMargins.right, position.x)),
      y: Math.max(safeMargins.top, Math.min(100 - safeMargins.bottom, position.y)),
    };

    const adjustedPositionStyles = {
      'top-left': {
        top: `${adjustedPosition.y}%`,
        left: `${adjustedPosition.x}%`,
        transform: 'translate(-100%, -100%)',
      }, 'top-center': {
        top: `${adjustedPosition.y}%`,
        left: `${adjustedPosition.x}%`,
        transform: 'translate(-50%, -100%)',
      }, 'top-right': {
        top: `${adjustedPosition.y}%`,
        left: `${adjustedPosition.x}%`,
        transform: 'translate(0, -100%)',
      }, 'middle-left': {
        top: `${adjustedPosition.y}%`,
        left: `${adjustedPosition.x}%`,
        transform: 'translate(-100%, -50%)',
      }, 'middle-center': {
        top: `${adjustedPosition.y}%`,
        left: `${adjustedPosition.x}%`,
        transform: 'translate(-50%, -50%)',
      }, 'middle-right': {
        top: `${adjustedPosition.y}%`,
        left: `${adjustedPosition.x}%`,
        transform: 'translate(0, -50%)',
      }, 'bottom-left': {
        top: `${adjustedPosition.y}%`,
        left: `${adjustedPosition.x}%`,
        transform: 'translate(-100%, 0)',
      }, 'bottom-center': {
        top: `${adjustedPosition.y}%`,
        left: `${adjustedPosition.x}%`,
        transform: 'translate(-50%, 0)',
      }, 'bottom-right': {
        top: `${adjustedPosition.y}%`,
        left: `${adjustedPosition.x}%`,
        transform: 'translate(0, 0)',
      },
    };

    return (
      <>
        {/* Safe Guides Overlay */}
        {renderSafeGuides(cta.safeGuides, containerWidth, containerHeight)}

        {/* CTA Overlay */}
        <Box
          ref={previewRef}
          sx={{
            position: 'absolute',
            ...adjustedPositionStyles[position.anchor],
            backgroundColor: style.backgroundColor,
            color: style.textColor,
            border: style.borderColor
              ? `${style.borderWidth || 0}px solid ${style.borderColor}`
              : 'none',
            borderRadius: `${style.borderRadius}px`,
            padding: `${style.padding}px`,
            fontSize: `${style.fontSize}px`,
            fontWeight: style.fontWeight,
            opacity: style.opacity,
            boxShadow: style.shadow?.enabled
              ? `${style.shadow.offsetX}px ${style.shadow.offsetY}px ${style.shadow.blur}px ${style.shadow.color}`
              : 'none',
            maxWidth: '300px',
            zIndex: 100,
            animation: isLive
              ? `${animation.type.replace('-', ' ')} ${animation.duration}s ease-in-out ${animation.delay}s`
              : 'none',
            display: isLive ? 'block' : 'block',
            // WCAG 2.2 AA+ accessibility features
            outline: accessibility.focusVisible
              ? `${WCAG_GUIDELINES.focusIndicators.outlineWidth}px solid currentColor`
              : 'none',
            outlineOffset: accessibility.focusVisible
              ? `${WCAG_GUIDELINES.focusIndicators.outlineOffset}px`
              : 'none',
            filter: accessibility.highContrast ? 'contrast(1.5) brightness(1.2)' : 'none',
            transition: accessibility.reducedMotion ? 'none' : 'all 0.3s ease'}}
          role="button"
          tabIndex={accessibility.keyboardNavigation ? 0 : -1}
          aria-label={accessibility.ariaLabel}
          aria-describedby={description ? `${cta.id}-description` : undefined}
        >
          <Typography
            variant="h6"
            sx={{
              fontWeight: 'bold',
              mb: 1,
              color: style.textColor,
              fontSize: Math.max(style.fontSize, WCAG_GUIDELINES.textSize.minimum)}}
          >
            {title}
          </Typography>
          {description && (
            <Typography
              variant="body2"
              id={`${cta.id}-description`}
              sx={{
                mb: 2,
                color: style.textColor,
                opacity: 0.9,
                fontSize: Math.max(style.fontSize - 2, WCAG_GUIDELINES.textSize.minimum)}}
            >
              {description}
            </Typography>
          )}
          <Button
            variant="contained"
            sx={{
              backgroundColor: style.buttonColor,
              color: style.buttonTextColor,
              fontWeight: 'bold',
              borderRadius: `${style.borderRadius - 2}px`,
              fontSize: Math.max(style.fontSize, WCAG_GUIDELINES.textSize.minimum), '&:hover': {
                backgroundColor: style.buttonColor,
                opacity: 0.9,
              }, '&:focus-visible': {
                outline: `${WCAG_GUIDELINES.focusIndicators.outlineWidth}px solid ${style.buttonTextColor}`,
                outlineOffset: `${WCAG_GUIDELINES.focusIndicators.outlineOffset}px`,
              }}}
            aria-label={`${buttonText} - ${accessibility.altText}`}
          >
            {buttonText}
          </Button>
        </Box>
      </>
    );
  };

  // Render CTA overlay card
  const renderCTACard = (cta: CTAOverlay) => (
    <Card
      key={cta.id}
      sx={{
        cursor: mode === 'select' ? 'pointer' : 'default',
        border: selectedCTA?.id === cta.id ? 2 : 1,
        borderColor: selectedCTA?.id === cta.id ? 'primary.main' : 'divider', '&:hover': { boxShadow: 4 }}}
      onClick={() => mode === 'select' && onCTASelect?.(cta)}
    >
      <CardContent sx={{ p: 2,...theming.getThemedCardSx() }}>
        <Stack direction="row" spacing={2} alignItems="flex-start">
          <Box
            sx={{
              width: 60,
              height: 40,
              backgroundColor: getCTATypeColor(cta.type),
              borderRadius: `${cta.style.borderRadius}px`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
              overflow: 'hidden'}}
          >
            {getCTATypeIcon(cta.type)}
          </Box>

          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="subtitle1" noWrap>
              {cta.name}
            </Typography>
            <Typography variant="body2" color="text.secondary" noWrap>
              {cta.title}
            </Typography>
            {cta.description && (
              <Typography variant="caption" color="text.secondary" noWrap>
                {cta.description}
              </Typography>
            )}

            <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
              <Chip
                label={cta.type}
                size="small"
                variant="outlined"
                sx={{ height: 20, fontSize: 10 }}
              />
              <Chip
                label={`${cta.timing.startTime}s-${cta.timing.endTime}s`}
                size="small"
                variant="outlined"
                color={
                  getTimingValidation(
                    cta.timing.endTime - cta.timing.startTime,
                    `${cta.title} ${cta.description || ''}`,
                  ).severity === 'error'
                    ? 'error'
                    : getTimingValidation(
                          cta.timing.endTime - cta.timing.startTime,
                          `${cta.title} ${cta.description || ''}`,
                        ).severity === 'warning'
                      ? 'warning'
                      : 'success'
                }
                sx={{ height: 20, fontSize: 10 }}
              />
              <Chip
                label={cta.position.anchor.replace('-', ' ')}
                size="small"
                variant="outlined"
                sx={{ height: 20, fontSize: 10 }}
              />
              <Chip
                label="WCAG"
                size="small"
                variant="outlined"
                color={
                  getContrastValidation(
                    cta.style.backgroundColor,
                    cta.style.textColor,
                    cta.style.fontSize,
                  ).severity === 'error'
                    ? 'error'
                    : 'success'
                }
                sx={{ height: 20, fontSize: 10 }}
              />
            </Stack>
          </Box>

          <Stack direction="row" spacing={0.5}>
            {showPreview && (
              <Tooltip title="Preview">
                <IconButton
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePreviewCTA(cta);
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
                      setEditingCTA(cta);
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
                        ...cta,
                        id: `cta-${Date.now()}`,
                        name: `${cta.name} (Copy)`,
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString(),
                      };
                      setEditingCTA(duplicated);
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
                      handleDeleteCTA(cta.id);
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
            <Typography variant="h5" component="h2" sx={{ color: theming.colors.primary }}>
              Call-to-Action Overlays
            </Typography>
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
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={handleCreateCTA}
              sx={{ bgcolor: '#ff9800', ...theming.getThemedButtonSx() }}
            >
              Create CTA Overlay
            </Button>
          )}
        </Stack>

        {/* Industry Standards Info */}
        <Alert severity="info" sx={{ mb: 2 }}>
          <Typography variant="body2">
            <strong>Industry Standards:</strong> CTA overlays should display for 3-7 seconds (5s
            recommended), positioned within safe areas, and meet WCAG 2.2 AA+ accessibility
            standards for optimal engagement and compliance.
          </Typography>
        </Alert>

        {/* CTA Types Info */}
        <Alert severity="info" sx={{ mb: 2 }}>
          <Typography variant="body2">
            <strong>CTA Types:</strong> Subscribe, Download, External Links, Email, Phone, Quiz,
            Assignment, Custom Actions. Create interactive overlays that appear at specific
            timestamps in your videos.
          </Typography>
        </Alert>

        {/* Search and Filter */}
        <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
          <TextField
            placeholder="Search CTA overlays..."
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
          {filteredCTAOverlays.map((cta) => (
            <Grid item xs={12} sm={6} md={4} key={cta.id}>
              {renderCTACard(cta)}
            </Grid>
          ))}
        </Grid>

        {filteredCTAOverlays.length === 0 && (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography
              variant="h6"
              color="text.secondary"
              gutterBottom
              sx={{ color: theming.colors.primary }}
            >
              No CTA overlays found
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Create your first call-to-action overlay
            </Typography>
          </Box>
        )}
      </Box>

      {/* Preview Overlay */}
      {isPreviewing && previewCTA && (
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
            {renderCTAPreview(previewCTA, true)}
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
          {editingCTA?.id.startsWith('cta-') && !ctaOverlays.find((c) => c.id === editingCTA.id)
            ? 'Create CTA Overlay'
            : 'Edit CTA Overlay'}
        </DialogTitle>
        <DialogContent>
          {editingCTA && (
            <CTAEditor
              cta={editingCTA}
              onChange={setEditingCTA}
              onPreview={setPreviewCTA}
              renderPreview={renderCTAPreview}
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowCreateDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={() => editingCTA && handleSaveCTA(editingCTA)}>
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

// CTA Editor Component
interface CTAEditorProps {
  cta: CTAOverlay;
  onChange: (cta: CTAOverlay) => void;
  onPreview: (cta: CTAOverlay) => void;
  renderPreview: (cta: CTAOverlay, isLive: boolean) => React.ReactElement;
}

function CTAEditor({ cta, onChange, onPreview, renderPreview }: CTAEditorProps) {
  const [activeTab, setActiveTab] = useState(0);
  const { analytics, performance, debugging } = useEnhancedMasterIntegration();

  // Helper functions (moved from parent component scope)
  const calculateOptimalCTADuration = (text: string): number => {
    const words = text.split(/\s+/).length;
    const readingTime = (words / TIMING_GUIDELINES.ctaOverlay.readingSpeed) * 60;
    return Math.max(
      TIMING_GUIDELINES.ctaOverlay.minimum,
      Math.min(TIMING_GUIDELINES.ctaOverlay.maximum, readingTime),
    );
  };

  const getTimingValidation = (duration: number, text?: string) => {
    const guidelines = TIMING_GUIDELINES.ctaOverlay;
    const isValid = duration >= guidelines.minimum && duration <= guidelines.maximum;
    const isRecommended = Math.abs(duration - guidelines.recommended) <= 1;

    let suggestion = '';
    if (duration < guidelines.minimum) {
      suggestion = `Too short! Minimum is ${guidelines.minimum}s.`;
    } else if (duration > guidelines.maximum) {
      suggestion = `Too long! Maximum is ${guidelines.maximum}s.`;
    } else if (!isRecommended) {
      suggestion = `Consider ${guidelines.recommended}s for optimal engagement.`;
    }

    if (text) {
      const optimalDuration = calculateOptimalCTADuration(text);
      if (Math.abs(duration - optimalDuration) > 1) {
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

  const calculateColorContrast = (color1: string, color2: string): number => {
    const getLuminance = (color: string): number => {
      const rgb = parseInt(color.slice(1), 16);
      const r = (rgb >> 16) & 0xff;
      const g = (rgb >> 8) & 0xff;
      const b = (rgb >> 0) & 0xff;
      const [rs, gs, bs] = [rgb].map((c) => {
        c = c / 255;
        return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
      });
      return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
    };

    const lum1 = getLuminance(color1);
    const lum2 = getLuminance(color2);
    const brightest = Math.max(lum1, lum2);
    const darkest = Math.min(lum1, lum2);
    return (brightest + 0.05) / (darkest + 0.05);
  };

  const getContrastValidation = (backgroundColor: string, textColor: string, fontSize: number) => {
    const contrast = calculateColorContrast(backgroundColor, textColor);
    const isLargeText = fontSize >= WCAG_GUIDELINES.textSize.largeText;
    const requiredRatio = isLargeText
      ? WCAG_GUIDELINES.colorContrast.largeText
      : WCAG_GUIDELINES.colorContrast.normalText;

    const isValid = contrast >= requiredRatio;
    const severity = isValid ? 'success' : 'error';

    let suggestion = '';
    if (!isValid) {
      suggestion = `Contrast ratio ${contrast.toFixed(1)}:1 is below WCAG 2.2 AA standard (${requiredRatio}:1 required${isLargeText ? ' for large text' : ','}).`;
    } else if (contrast < requiredRatio + 1) {
      suggestion = `Contrast ratio ${contrast.toFixed(1)}:1 meets WCAG 2.2 AA. Consider higher contrast for better accessibility.`;
    }

    return {
      isValid,
      contrast,
      requiredRatio,
      suggestion,
      severity,
    };
  };

  const handleChange = (field: string, value: any) => {
    const endTiming = performance.startTiming('cta_field_change');

    onChange({
      ...cta,
      [field]: value,
      updatedAt: new Date().toISOString(),
    });

    analytics.trackEvent('cta_field_modified', {
      ctaId: cta.id,
      field,
      fieldType: typeof value,
      hasValue: value !== null && value !== undefined && value !== '',
      timestamp: Date.now(),
    });

    debugging.logIntegration('info', `CTA field modified: ${field}`, {
      ctaId: cta.id,
      field,
      newValue: value,
    });

    endTiming();
  };

  const handleActionChange = (field: string, value: any) => {
    onChange({
      ...cta,
      action: {
        ...cta.action,
        [field]: value,
      },
      updatedAt: new Date().toISOString(),
    });
  };

  const handleTimingChange = (field: string, value: any) => {
    onChange({
      ...cta,
      timing: {
        ...cta.timing,
        [field]: value,
      },
      updatedAt: new Date().toISOString(),
    });
  };

  const handlePositionChange = (field: string, value: any) => {
    onChange({
      ...cta,
      position: {
        ...cta.position,
        [field]: value,
      },
      updatedAt: new Date().toISOString(),
    });
  };

  const handleStyleChange = (field: string, value: any) => {
    onChange({
      ...cta,
      style: {
        ...cta.style,
        [field]: value,
      },
      updatedAt: new Date().toISOString(),
    });
  };

  const handleAnimationChange = (field: string, value: any) => {
    onChange({
      ...cta,
      animation: {
        ...cta.animation,
        [field]: value,
      },
      updatedAt: new Date().toISOString(),
    });
  };

  const handleSafeGuideChange = (field: string, value: any) => {
    onChange({
      ...cta,
      safeGuides: {
        ...cta.safeGuides,
        [field]: value,
      },
      updatedAt: new Date().toISOString(),
    });
  };

  const handleAccessibilityChange = (field: string, value: any) => {
    onChange({
      ...cta,
      accessibility: {
        ...cta.accessibility,
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
          const tabNames = [
            'Content','Timing & Position','Style','Safe Guides','Accessibility','Preview',
          ];

          analytics.trackEvent('cta_editor_tab_changed', {
            ctaId: cta.id,
            fromTab: tabNames[activeTab],
            toTab: tabNames[newValue],
            tabIndex: newValue,
            timestamp: Date.now(),
          });

          debugging.logIntegration('info','CTA editor tab changed', {
            ctaId: cta.id,
            fromTab: activeTab,
            toTab: newValue,
          });

          setActiveTab(newValue);
        }}
      >
        <Tab label="Content" />
        <Tab label="Timing & Position" />
        <Tab label="Style" />
        <Tab label="Safe Guides" />
        <Tab label="Accessibility" />
        <Tab label="Preview" />
      </Tabs>

      {activeTab === 0 && (
        <Box sx={{ mt: 2 }}>
          <Stack spacing={3}>
            <TextField
              fullWidth
              label="CTA Name"
              value={cta.name}
              onChange={(e) => handleChange('name', e.target.value)}
            />

            <FormControl fullWidth>
              <InputLabel>CTA Type</InputLabel>
              <Select
                value={cta.type}
                onChange={(e) => handleChange('type', e.target.value)}
                label="CTA Type"
              >
                <MenuItem value="subscribe">Subscribe</MenuItem>
                <MenuItem value="download">Download</MenuItem>
                <MenuItem value="external">External Link</MenuItem>
                <MenuItem value="email">Email</MenuItem>
                <MenuItem value="phone">Phone</MenuItem>
                <MenuItem value="quiz">Quiz</MenuItem>
                <MenuItem value="assignment">Assignment</MenuItem>
                <MenuItem value="custom">Custom</MenuItem>
              </Select>
            </FormControl>

            <TextField
              fullWidth
              label="Title"
              value={cta.title}
              onChange={(e) => handleChange('title', e.target.value)}
            />

            <TextField
              fullWidth
              label="Description"
              value={cta.description || ''}
              onChange={(e) => handleChange('description', e.target.value)}
              multiline
              rows={2}
            />

            <TextField
              fullWidth
              label="Button Text"
              value={cta.buttonText}
              onChange={(e) => handleChange('buttonText', e.target.value)}
            />

            {/* Action Configuration */}
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Action Configuration
              </Typography>
              {cta.type === 'external' && (
                <TextField
                  fullWidth
                  label="URL"
                  value={cta.action.url || ''}
                  onChange={(e) => handleActionChange('url', e.target.value)}
                  placeholder="https://example.com"
                />
              )}
              {cta.type === 'email' && (
                <TextField
                  fullWidth
                  label="Email Address"
                  value={cta.action.email || ''}
                  onChange={(e) => handleActionChange('email', e.target.value)}
                  placeholder="contact@example.com"
                />
              )}
              {cta.type === 'phone' && (
                <TextField
                  fullWidth
                  label="Phone Number"
                  value={cta.action.phone || ', '}
                  onChange={(e) => handleActionChange('phone', e.target.value)}
                  placeholder="+1 (555) 123-4567"
                />
              )}
              {cta.type === 'download' && (
                <TextField
                  fullWidth
                  label="File ID"
                  value={cta.action.fileId || ', '}
                  onChange={(e) => handleActionChange('fileId', e.target.value)}
                  placeholder="file-id-or-url"
                />
              )}
              {cta.type === 'quiz' && (
                <TextField
                  fullWidth
                  label="Quiz ID"
                  value={cta.action.quizId || ', '}
                  onChange={(e) => handleActionChange('quizId', e.target.value)}
                  placeholder="quiz-id"
                />
              )}
              {cta.type === 'assignment' && (
                <TextField
                  fullWidth
                  label="Assignment ID"
                  value={cta.action.assignmentId || ', '}
                  onChange={(e) => handleActionChange('assignmentId', e.target.value)}
                  placeholder="assignment-id"
                />
              )}
              {cta.type === 'custom' && (
                <TextField
                  fullWidth
                  label="Custom Action"
                  value={cta.action.customAction || ', '}
                  onChange={(e) => handleActionChange('customAction', e.target.value)}
                  placeholder="custom-action-code"
                />
              )}
            </Box>
          </Stack>
        </Box>
      )}

      {activeTab === 1 && (
        <Box sx={{ mt: 2 }}>
          <Stack spacing={3}>
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Timing
              </Typography>
              <Stack direction="row" spacing={2}>
                <TextField
                  label="Start Time (seconds)"
                  type="number"
                  value={cta.timing.startTime}
                  onChange={(e) => handleTimingChange('startTime', parseFloat(e.target.value))}
                  inputProps={{ min: 0, step: 0.1 }}
                />
                <TextField
                  label="End Time (seconds)"
                  type="number"
                  value={cta.timing.endTime}
                  onChange={(e) => handleTimingChange('endTime', parseFloat(e.target.value))}
                  inputProps={{
                    min: TIMING_GUIDELINES.ctaOverlay.minimum + cta.timing.startTime,
                    max: TIMING_GUIDELINES.ctaOverlay.maximum + cta.timing.startTime,
                    step: 0.1}}
                  error={(() => {
                    const duration = cta.timing.endTime - cta.timing.startTime;
                    const validation = getTimingValidation(
                      duration,
                      `${cta.title} ${cta.description || ', '}`,
                    );
                    return validation.severity === 'error';
                  })()}
                  helperText={(() => {
                    const duration = cta.timing.endTime - cta.timing.startTime;
                    const validation = getTimingValidation(
                      duration,
                      `${cta.title} ${cta.description || ', '}`,
                    );
                    return validation.suggestion;
                  })()}
                />
              </Stack>
              <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => {
                    const endTiming = performance.startTiming('cta_auto_calculate_duration');

                    const duration = calculateOptimalCTADuration(
                      `${cta.title} ${cta.description || ', '}`,
                    );
                    const oldDuration = cta.timing.endTime - cta.timing.startTime;

                    handleTimingChange('endTime', cta.timing.startTime + duration);

                    analytics.trackEvent('cta_auto_calculate_duration', {
                      ctaId: cta.id,
                      textLength: `${cta.title} ${cta.description || ', '}`.length,
                      oldDuration,
                      newDuration: duration,
                      durationChange: duration - oldDuration,
                      timestamp: Date.now(),
                    });

                    debugging.logIntegration('info','CTA duration auto-calculated', {
                      ctaId: cta.id,
                      oldDuration,
                      newDuration: duration,
                      textLength: `${cta.title} ${cta.description || ', '}`.length,
                    });

                    endTiming();
                  }}
                >
                  Auto-calculate Duration
                </Button>
                <Typography variant="caption" color="text.secondary">
                  Recommended: {TIMING_GUIDELINES.ctaOverlay.recommended}s (Range:{''}
                  {TIMING_GUIDELINES.ctaOverlay.minimum}-{TIMING_GUIDELINES.ctaOverlay.maximum}s)
                </Typography>
              </Stack>
              <Alert severity="info" sx={{ mt: 2 }}>
                <Typography variant="body2">
                  <strong>Timing Guidelines:</strong> CTA overlays should be displayed for 3-7
                  seconds (5s recommended) to ensure users have enough time to read and interact
                  while maintaining engagement.
                </Typography>
              </Alert>
              <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={cta.timing.autoHide}
                      onChange={(e) => handleTimingChange('autoHide', e.target.checked)}
                    />
                  }
                  label="Auto Hide"
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={cta.timing.clickToClose}
                      onChange={(e) => handleTimingChange('clickToClose', e.target.checked)}
                    />
                  }
                  label="Click to Close"
                />
              </Stack>
            </Box>

            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Position
              </Typography>
              <Stack direction="row" spacing={2}>
                <TextField
                  label="X Position (%)"
                  type="number"
                  value={cta.position.x}
                  onChange={(e) => handlePositionChange('x', parseInt(e.target.value))}
                  inputProps={{ min: 0, max: 100 }}
                />
                <TextField
                  label="Y Position (%)"
                  type="number"
                  value={cta.position.y}
                  onChange={(e) => handlePositionChange('y', parseInt(e.target.value))}
                  inputProps={{ min: 0, max: 100 }}
                />
              </Stack>
              <FormControl fullWidth sx={{ mt: 2 }}>
                <InputLabel>Anchor Point</InputLabel>
                <Select
                  value={cta.position.anchor}
                  onChange={(e) => handlePositionChange('anchor', e.target.value)}
                  label="Anchor Point"
                >
                  <MenuItem value="top-left">Top Left</MenuItem>
                  <MenuItem value="top-center">Top Center</MenuItem>
                  <MenuItem value="top-right">Top Right</MenuItem>
                  <MenuItem value="middle-left">Middle Left</MenuItem>
                  <MenuItem value="middle-center">Middle Center</MenuItem>
                  <MenuItem value="middle-right">Middle Right</MenuItem>
                  <MenuItem value="bottom-left">Bottom Left</MenuItem>
                  <MenuItem value="bottom-center">Bottom Center</MenuItem>
                  <MenuItem value="bottom-right">Bottom Right</MenuItem>
                </Select>
              </FormControl>
            </Box>

            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Animation
              </Typography>
              <Stack direction="row" spacing={2}>
                <FormControl fullWidth>
                  <InputLabel>Animation Type</InputLabel>
                  <Select
                    value={cta.animation.type}
                    onChange={(e) => handleAnimationChange('type', e.target.value)}
                    label="Animation Type"
                  >
                    <MenuItem value="fade-in">Fade In</MenuItem>
                    <MenuItem value="slide-up">Slide Up</MenuItem>
                    <MenuItem value="slide-down">Slide Down</MenuItem>
                    <MenuItem value="slide-left">Slide Left</MenuItem>
                    <MenuItem value="slide-right">Slide Right</MenuItem>
                    <MenuItem value="zoom-in">Zoom In</MenuItem>
                    <MenuItem value="bounce">Bounce</MenuItem>
                  </Select>
                </FormControl>
                <TextField
                  label="Duration (seconds)"
                  type="number"
                  value={cta.animation.duration}
                  onChange={(e) => handleAnimationChange('duration', parseFloat(e.target.value))}
                  inputProps={{ min: 0.1, max: 5, step: 0.1 }}
                />
                <TextField
                  label="Delay (seconds)"
                  type="number"
                  value={cta.animation.delay}
                  onChange={(e) => handleAnimationChange('delay', parseFloat(e.target.value))}
                  inputProps={{ min: 0, max: 5, step: 0.1 }}
                />
              </Stack>
            </Box>
          </Stack>
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
                  value={cta.style.backgroundColor}
                  onChange={(e) => handleStyleChange('backgroundColor', e.target.value)}
                  sx={{ width: 120 }}
                />
                <TextField
                  label="Text Color"
                  type="color"
                  value={cta.style.textColor}
                  onChange={(e) => handleStyleChange('textColor', e.target.value)}
                  sx={{ width: 120 }}
                />
                <TextField
                  label="Button Color"
                  type="color"
                  value={cta.style.buttonColor}
                  onChange={(e) => handleStyleChange('buttonColor', e.target.value)}
                  sx={{ width: 120 }}
                />
                <TextField
                  label="Button Text Color"
                  type="color"
                  value={cta.style.buttonTextColor}
                  onChange={(e) => handleStyleChange('buttonTextColor', e.target.value)}
                  sx={{ width: 120 }}
                />
              </Stack>

              {/* WCAG Contrast Validation */}
              {(() => {
                const bgTextValidation = getContrastValidation(
                  cta.style.backgroundColor,
                  cta.style.textColor,
                  cta.style.fontSize,
                );
                const buttonValidation = getContrastValidation(
                  cta.style.buttonColor,
                  cta.style.buttonTextColor,
                  cta.style.fontSize,
                );

                return (
                  <Stack spacing={1} sx={{ mt: 2 }}>
                    <Alert
                      severity={bgTextValidation.severity === 'error' ? 'error' : 'success'}
                      sx={{ py: 0.5 }}
                    >
                      <Typography variant="caption">
                        <strong>Background/Text:</strong> {bgTextValidation.suggestion}
                      </Typography>
                    </Alert>
                    <Alert
                      severity={buttonValidation.severity === 'error' ? 'error' : 'success'}
                      sx={{ py: 0.5 }}
                    >
                      <Typography variant="caption">
                        <strong>Button/Button Text:</strong> {buttonValidation.suggestion}
                      </Typography>
                    </Alert>
                  </Stack>
                );
              })()}
            </Box>

            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Layout
              </Typography>
              <Stack direction="row" spacing={2}>
                <TextField
                  label="Border Radius"
                  type="number"
                  value={cta.style.borderRadius}
                  onChange={(e) => handleStyleChange('borderRadius', parseInt(e.target.value))}
                  inputProps={{ min: 0, max: 50 }}
                />
                <TextField
                  label="Padding"
                  type="number"
                  value={cta.style.padding}
                  onChange={(e) => handleStyleChange('padding', parseInt(e.target.value))}
                  inputProps={{ min: 0, max: 50 }}
                />
                <TextField
                  label="Font Size"
                  type="number"
                  value={cta.style.fontSize}
                  onChange={(e) => handleStyleChange('fontSize', parseInt(e.target.value))}
                  inputProps={{
                    min: WCAG_GUIDELINES.textSize.minimum,
                    max: 48,
                    step: 1}}
                  error={cta.style.fontSize < WCAG_GUIDELINES.textSize.minimum}
                  helperText={
                    cta.style.fontSize < WCAG_GUIDELINES.textSize.minimum
                      ? `Minimum ${WCAG_GUIDELINES.textSize.minimum}px for WCAG compliance`
                      : cta.style.fontSize >= WCAG_GUIDELINES.textSize.largeText
                        ? 'Large text - good for accessibility': 'Normal text size'
                  }
                />
              </Stack>
              <FormControl fullWidth sx={{ mt: 2 }}>
                <InputLabel>Font Weight</InputLabel>
                <Select
                  value={cta.style.fontWeight}
                  onChange={(e) => handleStyleChange('fontWeight', e.target.value)}
                  label="Font Weight"
                >
                  <MenuItem value="normal">Normal</MenuItem>
                  <MenuItem value="bold">Bold</MenuItem>
                  <MenuItem value="lighter">Lighter</MenuItem>
                </Select>
              </FormControl>
            </Box>

            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Effects
              </Typography>
              <Stack direction="row" spacing={2}>
                <TextField
                  label="Opacity"
                  type="number"
                  value={cta.style.opacity}
                  onChange={(e) => handleStyleChange('opacity', parseFloat(e.target.value))}
                  inputProps={{ min: 0, max: 1, step: 0.1 }}
                />
              </Stack>
              <FormControlLabel
                control={
                  <Switch
                    checked={cta.style.shadow?.enabled || false}
                    onChange={(e) =>
                      handleStyleChange('shadow', {
                        ...cta.style.shadow,
                        enabled: e.target.checked,
                      })
                    }
                  />
                }
                label="Enable Shadow"
                sx={{ mt: 2 }}
              />
            </Box>
          </Stack>
        </Box>
      )}

      {activeTab === 3 && (
        <Box sx={{ mt: 2 }}>
          <Stack spacing={3}>
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Safe Guide Configuration
              </Typography>
              <Stack spacing={2}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={cta.safeGuides.enabled}
                      onChange={(e) => handleSafeGuideChange('enabled', e.target.checked)}
                    />
                  }
                  label="Enable Safe Guides"
                />

                {cta.safeGuides.enabled && (
                  <>
                    <FormControl fullWidth>
                      <InputLabel>Guide Type</InputLabel>
                      <Select
                        value={cta.safeGuides.type}
                        onChange={(e) => handleSafeGuideChange('type', e.target.value)}
                        label="Guide Type"
                      >
                        <MenuItem value="title-safe">Title Safe (5% margin)</MenuItem>
                        <MenuItem value="action-safe">Action Safe (10% margin)</MenuItem>
                        <MenuItem value="custom">Custom Margins</MenuItem>
                      </Select>
                    </FormControl>

                    {cta.safeGuides.type === 'custom' && (
                      <Stack direction="row" spacing={2}>
                        <TextField
                          label="Top Margin (%)"
                          type="number"
                          value={cta.safeGuides.customMargins?.top || 0}
                          onChange={(e) =>
                            handleSafeGuideChange('customMargins', {
                              ...cta.safeGuides.customMargins,
                              top: parseInt(e.target.value),
                            })
                          }
                          inputProps={{ min: 0, max: 50 }}
                        />
                        <TextField
                          label="Right Margin (%)"
                          type="number"
                          value={cta.safeGuides.customMargins?.right || 0}
                          onChange={(e) =>
                            handleSafeGuideChange('customMargins', {
                              ...cta.safeGuides.customMargins,
                              right: parseInt(e.target.value),
                            })
                          }
                          inputProps={{ min: 0, max: 50 }}
                        />
                        <TextField
                          label="Bottom Margin (%)"
                          type="number"
                          value={cta.safeGuides.customMargins?.bottom || 0}
                          onChange={(e) =>
                            handleSafeGuideChange('customMargins', {
                              ...cta.safeGuides.customMargins,
                              bottom: parseInt(e.target.value),
                            })
                          }
                          inputProps={{ min: 0, max: 50 }}
                        />
                        <TextField
                          label="Left Margin (%)"
                          type="number"
                          value={cta.safeGuides.customMargins?.left || 0}
                          onChange={(e) =>
                            handleSafeGuideChange('customMargins', {
                              ...cta.safeGuides.customMargins,
                              left: parseInt(e.target.value),
                            })
                          }
                          inputProps={{ min: 0, max: 50 }}
                        />
                      </Stack>
                    )}

                    <Stack direction="row" spacing={2}>
                      <TextField
                        label="Guide Color"
                        type="color"
                        value={cta.safeGuides.color}
                        onChange={(e) => handleSafeGuideChange('color', e.target.value)}
                        sx={{ width: 120 }}
                      />
                      <TextField
                        label="Opacity"
                        type="number"
                        value={cta.safeGuides.opacity}
                        onChange={(e) =>
                          handleSafeGuideChange('opacity', parseFloat(e.target.value))
                        }
                        inputProps={{ min: 0, max: 1, step: 0.1 }}
                      />
                      <TextField
                        label="Thickness"
                        type="number"
                        value={cta.safeGuides.thickness}
                        onChange={(e) =>
                          handleSafeGuideChange('thickness', parseInt(e.target.value))
                        }
                        inputProps={{ min: 1, max: 10 }}
                      />
                    </Stack>

                    <FormControlLabel
                      control={
                        <Switch
                          checked={cta.safeGuides.showLabels}
                          onChange={(e) => handleSafeGuideChange('showLabels', e.target.checked)}
                        />
                      }
                      label="Show Guide Labels"
                    />
                  </>
                )}
              </Stack>

              <Alert severity="info" sx={{ mt: 2 }}>
                <Typography variant="body2">
                  <strong>Safe Areas:</strong> Title Safe (5% margin) ensures text is visible on all
                  displays. Action Safe (10% margin) ensures all interactive elements are
                  accessible. Custom margins allow precise control.
                </Typography>
              </Alert>
            </Box>
          </Stack>
        </Box>
      )}

      {activeTab === 4 && (
        <Box sx={{ mt: 2 }}>
          <Stack spacing={3}>
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                WCAG 2.2 AA+ Accessibility Configuration
              </Typography>
              <Stack spacing={2}>
                <TextField
                  fullWidth
                  label="Alt Text"
                  value={cta.accessibility.altText}
                  onChange={(e) => handleAccessibilityChange('altText', e.target.value)}
                  helperText="Descriptive text for screen readers"
                />

                <TextField
                  fullWidth
                  label="ARIA Label"
                  value={cta.accessibility.ariaLabel}
                  onChange={(e) => handleAccessibilityChange('ariaLabel', e.target.value)}
                  helperText="Accessible name for the overlay"
                />

                <Stack direction="row" spacing={2}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={cta.accessibility.keyboardNavigation}
                        onChange={(e) =>
                          handleAccessibilityChange('keyboardNavigation', e.target.checked)
                        }
                      />
                    }
                    label="Keyboard Navigation"
                  />
                  <FormControlLabel
                    control={
                      <Switch
                        checked={cta.accessibility.focusVisible}
                        onChange={(e) =>
                          handleAccessibilityChange('focusVisible', e.target.checked)
                        }
                      />
                    }
                    label="Visible Focus Indicators"
                  />
                </Stack>

                <Stack direction="row" spacing={2}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={cta.accessibility.highContrast}
                        onChange={(e) =>
                          handleAccessibilityChange('highContrast', e.target.checked)
                        }
                      />
                    }
                    label="High Contrast Mode"
                  />
                  <FormControlLabel
                    control={
                      <Switch
                        checked={cta.accessibility.reducedMotion}
                        onChange={(e) =>
                          handleAccessibilityChange('reducedMotion', e.target.checked)
                        }
                      />
                    }
                    label="Respect Reduced Motion"
                  />
                </Stack>
              </Stack>

              <Alert severity="info" sx={{ mt: 2 }}>
                <Typography variant="body2">
                  <strong>Accessibility Features:</strong> Ensure your CTA overlays are accessible
                  to all users by providing proper labels, keyboard navigation, and respecting user
                  preferences for motion and contrast.
                </Typography>
              </Alert>
            </Box>
          </Stack>
        </Box>
      )}

      {activeTab === 5 && (
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
              border: '1px solid #333'}}
          >
            {renderPreview(cta, false)}
          </Box>
          <Button
            variant="outlined"
            startIcon={<PlayArrow />}
            onClick={() => {
              analytics.trackEvent('cta_editor_preview_clicked', {
                ctaId: cta.id,
                tabContext: 'preview_tab',
                animationType: cta.animation.type,
                safeGuidesEnabled: cta.safeGuides.enabled,
                wcagCompliant: getContrastValidation(
                  cta.style.backgroundColor,
                  cta.style.textColor,
                  cta.style.fontSize,
                ).isValid,
                timestamp: Date.now(),
              });

              debugging.logIntegration('info', 'CTA editor preview clicked', {
                ctaId: cta.id,
                animationType: cta.animation.type,
                safeGuidesEnabled: cta.safeGuides.enabled,
              });

              onPreview(cta);
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
	
export default withUniversalIntegration(CTAOverlayEditor, {
  componentId: 'cta-overlay-editor',
  componentName: 'CTA Overlay Editor',
  componentType: 'editor',
  componentCategory: 'academy',
	  featureIds: ['cta-overlays', 'video-player-academy'],
});
