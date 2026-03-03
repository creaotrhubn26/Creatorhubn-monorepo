/**
 * AnimationDashboard Component
 * Animation management dashboard with timeline editor
 */

import { useTheming } from '../../../utils/theming-helper';
import { useResearchBackedAnimations } from '../../../hooks/useResearchBackedAnimations';
import React, { memo, useCallback, useState, useMemo } from 'react';
import {
  Box,
  Paper,
  Typography,
  Chip,
  Tooltip,
  IconButton,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  ListItemAvatar,
  Avatar,
  Grid,
  Card,
  CardContent,
  Switch,
  FormControlLabel,
  CircularProgress,
  Tabs,
  Tab,
  Slider,
  TextField,
  Select,
  MenuItem,
  Divider,
  Menu,
  ListItemIcon,
  Badge,
  Alert,
} from '@mui/material';
import {
  Animation,
  KeyboardArrowDown,
  PlayArrow,
  Pause,
  Stop,
  Edit,
  Delete,
  FileCopy,
  Add,
  GetApp,
  Publish,
  FavoriteBorder,
  Favorite,
  Speed as Speed,
  Refresh,
  TrendingFlat,
  TrendingUp,
  ZoomIn,
  RotateRight,
  FlipToFront,
  AutoAwesome,
} from '@mui/icons-material';
import { useAnimation, UseAnimationOptions } from '../../../hooks/useAnimation';
import { Animation as AnimationType } from '../../../utils/animationManager';

// Animation preset templates
interface AnimationPreset {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  category: 'entrance' | 'exit' | 'emphasis' | 'motion' | 'transform';
  animationData: Partial<AnimationType>;
}

const ANIMATION_PRESETS: AnimationPreset[] = [
  {
    id: 'fade-in',
    name: 'Fade In',
    description: 'Smooth fade in animation',
    icon: <AutoAwesome />,
    category: 'entrance',
    animationData: {
      name: 'Fade In',
      type: 'custom',
      duration: 500,
      easing: 'ease-in',
      keyframes: [
        { id: 'start', time: 0, properties: { opacity: 0 } },
        { id: 'end', time: 1, properties: { opacity: 1 } }
      ],
      properties: [{ name: 'opacity', type: 'opacity', value: 1, description: 'Opacity' }]
    }
  },
  {
    id: 'fade-out',
    name: 'Fade Out',
    description: 'Smooth fade out animation',
    icon: <AutoAwesome />,
    category: 'exit',
    animationData: {
      name: 'Fade Out',
      type: 'custom',
      duration: 500,
      easing: 'ease-out',
      keyframes: [
        { id: 'start', time: 0, properties: { opacity: 1 } },
        { id: 'end', time: 1, properties: { opacity: 0 } }
      ],
      properties: [{ name: 'opacity', type: 'opacity', value: 0, description: 'Opacity' }]
    }
  },
  {
    id: 'slide-in-left',
    name: 'Slide In Left',
    description: 'Slide in from left',
    icon: <TrendingFlat />,
    category: 'entrance',
    animationData: {
      name: 'Slide In Left',
      type: 'custom',
      duration: 600,
      easing: 'ease-out',
      keyframes: [
        { id: 'start', time: 0, properties: { transform: 'translateX(-100%)', opacity: 0 } },
        { id: 'end', time: 1, properties: { transform: 'translateX(0)', opacity: 1 } }
      ],
      properties: [{ name: 'transform', type: 'transform', value: 'translateX(0)', description: 'Transform' }]
    }
  },
  {
    id: 'slide-in-right',
    name: 'Slide In Right',
    description: 'Slide in from right',
    icon: <TrendingFlat style={{ transform: 'rotate(180deg)' }} />,
    category: 'entrance',
    animationData: {
      name: 'Slide In Right',
      type: 'custom',
      duration: 600,
      easing: 'ease-out',
      keyframes: [
        { id: 'start', time: 0, properties: { transform: 'translateX(100%)', opacity: 0 } },
        { id: 'end', time: 1, properties: { transform: 'translateX(0)', opacity: 1 } }
      ],
      properties: [{ name: 'transform', type: 'transform', value: 'translateX(0)', description: 'Transform' }]
    }
  },
  {
    id: 'slide-up',
    name: 'Slide Up',
    description: 'Slide up animation',
    icon: <TrendingUp />,
    category: 'entrance',
    animationData: {
      name: 'Slide Up',
      type: 'custom',
      duration: 600,
      easing: 'ease-out',
      keyframes: [
        { id: 'start', time: 0, properties: { transform: 'translateY(100%)', opacity: 0 } },
        { id: 'end', time: 1, properties: { transform: 'translateY(0)', opacity: 1 } }
      ],
      properties: [{ name: 'transform', type: 'transform', value: 'translateY(0)', description: 'Transform' }]
    }
  },
  {
    id: 'scale-in',
    name: 'Scale In',
    description: 'Scale from small to normal',
    icon: <ZoomIn />,
    category: 'entrance',
    animationData: {
      name: 'Scale In',
      type: 'custom',
      duration: 400,
      easing: 'ease-out',
      keyframes: [
        { id: 'start', time: 0, properties: { transform: 'scale(0)', opacity: 0 } },
        { id: 'end', time: 1, properties: { transform: 'scale(1)', opacity: 1 } }
      ],
      properties: [{ name: 'transform', type: 'transform', value: 'scale(1)', description: 'Transform' }]
    }
  },
  {
    id: 'rotate-in',
    name: 'Rotate In',
    description: 'Rotate and fade in',
    icon: <RotateRight />,
    category: 'entrance',
    animationData: {
      name: 'Rotate In',
      type: 'custom',
      duration: 600,
      easing: 'ease-in-out',
      keyframes: [
        { id: 'start', time: 0, properties: { transform: 'rotate(-180deg) scale(0)', opacity: 0 } },
        { id: 'end', time: 1, properties: { transform: 'rotate(0) scale(1)', opacity: 1 } }
      ],
      properties: [{ name: 'transform', type: 'transform', value: 'rotate(0) scale(1)', description: 'Transform' }]
    }
  },
  {
    id: 'bounce-in',
    name: 'Bounce In',
    description: 'Bouncy entrance animation',
    icon: <FlipToFront />,
    category: 'entrance',
    animationData: {
      name: 'Bounce In',
      type: 'custom',
      duration: 800,
      easing: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
      keyframes: [
        { id: 'start', time: 0, properties: { transform: 'scale(0)', opacity: 0 } },
        { id: 'mid', time: 0.5, properties: { transform: 'scale(1.2)', opacity: 1 } },
        { id: 'end', time: 1, properties: { transform: 'scale(1)', opacity: 1 } }
      ],
      properties: [{ name: 'transform', type: 'transform', value: 'scale(1)', description: 'Transform' }]
    }
  },
  {
    id: 'pulse',
    name: 'Pulse',
    description: 'Pulsing emphasis animation',
    icon: <Speed />,
    category: 'emphasis',
    animationData: {
      name: 'Pulse',
      type: 'custom',
      duration: 1000,
      easing: 'ease-in-out',
      iterationCount: Infinity,
      keyframes: [
        { id: 'start', time: 0, properties: { transform: 'scale(1)' } },
        { id: 'mid', time: 0.5, properties: { transform: 'scale(1.1)' } },
        { id: 'end', time: 1, properties: { transform: 'scale(1)' } }
      ],
      properties: [{ name: 'transform', type: 'transform', value: 'scale(1)', description: 'Transform' }]
    }
  },
  {
    id: 'shake',
    name: 'Shake',
    description: 'Shaking emphasis animation',
    icon: <Refresh />,
    category: 'emphasis',
    animationData: {
      name: 'Shake',
      type: 'custom',
      duration: 500,
      easing: 'ease-in-out',
      keyframes: [
        { id: 'start', time: 0, properties: { transform: 'translateX(0)' } },
        { id: 'q1', time: 0.25, properties: { transform: 'translateX(-10px)' } },
        { id: 'mid', time: 0.5, properties: { transform: 'translateX(10px)' } },
        { id: 'q3', time: 0.75, properties: { transform: 'translateX(-10px)' } },
        { id: 'end', time: 1, properties: { transform: 'translateX(0)' } }
      ],
      properties: [{ name: 'transform', type: 'transform', value: 'translateX(0)', description: 'Transform' }]
    }
  }
];

interface AnimationDashboardProps {
  showDetails?: boolean;
  showSettings?: boolean;
  showManagement?: boolean;
  showMonitoring?: boolean;
  showAnimations?: boolean;
  showTimeline?: boolean;
  showKeyframes?: boolean;
  showPreview?: boolean;
  _showManagement?: boolean;
  _showMonitoring?: boolean;
  _showAnimations?: boolean;
  _showTimeline?: boolean;
  _showKeyframes?: boolean;
  _showPreview?: boolean;
  variant?: 'minimal' | 'detailed' | 'full';
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'top-center' | 'bottom-center';
  onSettingsClick?: () => void;
  onManagementClick?: () => void;
  onMonitoringClick?: () => void;
  onAnimationsClick?: () => void;
  onTimelineClick?: () => void;
  onKeyframesClick?: () => void;
  onPreviewClick?: () => void;
  _onManagementClick?: () => void;
  _onMonitoringClick?: () => void;
  _onAnimationsClick?: () => void;
  _onTimelineClick?: () => void;
  _onKeyframesClick?: () => void;
  _onPreviewClick?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

const AnimationDashboard: React.FC<AnimationDashboardProps> = memo((props) => {
  const {
    showDetails = true,
    showSettings = true,
    showManagement: showManagementProp,
    showMonitoring: showMonitoringProp,
    showAnimations: showAnimationsProp,
    showTimeline: showTimelineProp,
    showKeyframes: showKeyframesProp,
    showPreview: showPreviewProp,
    _showManagement,
    _showMonitoring,
    _showAnimations,
    _showTimeline,
    _showKeyframes,
    _showPreview,
    variant = 'minimal',
    position = 'top-right',
    onSettingsClick,
    onManagementClick: onManagementClickProp,
    onMonitoringClick: onMonitoringClickProp,
    onAnimationsClick: onAnimationsClickProp,
    onTimelineClick: onTimelineClickProp,
    onKeyframesClick: onKeyframesClickProp,
    onPreviewClick: onPreviewClickProp,
    _onManagementClick,
    _onMonitoringClick,
    _onAnimationsClick,
    _onTimelineClick,
    _onKeyframesClick,
    _onPreviewClick,
    className,
    style,
  } = props;
  const showManagement = showManagementProp ?? _showManagement ?? true;
  const showMonitoring = showMonitoringProp ?? _showMonitoring ?? true;
  const showAnimations = showAnimationsProp ?? _showAnimations ?? true;
  const showTimeline = showTimelineProp ?? _showTimeline ?? true;
  const showKeyframes = showKeyframesProp ?? _showKeyframes ?? true;
  const showPreview = showPreviewProp ?? _showPreview ?? true;
  const onManagementClick = onManagementClickProp ?? _onManagementClick;
  const onMonitoringClick = onMonitoringClickProp ?? _onMonitoringClick;
  const onAnimationsClick = onAnimationsClickProp ?? _onAnimationsClick;
  const onTimelineClick = onTimelineClickProp ?? _onTimelineClick;
  const onKeyframesClick = onKeyframesClickProp ?? _onKeyframesClick;
  const onPreviewClick = onPreviewClickProp ?? _onPreviewClick;

  const [showAnimationDialog, setShowAnimationDialog] = useState(false);
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [timelinePosition, setTimelinePosition] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [presetMenuAnchor, setPresetMenuAnchor] = useState<null | HTMLElement>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [favoriteAnimations, setFavoriteAnimations] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAnimationId, setSelectedAnimationId] = useState<string | null>(null);
  
  // Theming system
  const theming = useTheming('prototype_tester');
  
  // Research-backed animations
  const { getIconButtonStyles, getTooltipProps, getCardHoverStyles, getStaggerDelay } = useResearchBackedAnimations();

  // Animation options
  const animationOptions: UseAnimationOptions = useMemo(() => ({
    onAnimationAdded: (data: { animation: AnimationType }) => {
      console.debug('Animation added:', data.animation.id);
  },
    onAnimationPlayed: (data: { animation: AnimationType; element?: HTMLElement }) => {
      console.debug('Animation played:', data.animation.id);
      setIsPlaying(true);
  },
    onAnimationPaused: (data: { animation: AnimationType }) => {
      console.debug('Animation paused:', data.animation.id);
      setIsPlaying(false);
  },
    onAnimationStopped: (data: { animation: AnimationType }) => {
      console.debug('Animation stopped:', data.animation.id);
      setIsPlaying(false);
      setTimelinePosition(0);
  },
    onAnimationFinished: (data: { animation: AnimationType; element: HTMLElement }) => {
      console.debug('Animation finished:', data.animation.id, data.element);
      setIsPlaying(false);
      setTimelinePosition(1);
  },
    onAnimationApplyFailed: (data: { animation: AnimationType; element: HTMLElement; error: string }) => {
      console.error('Animation apply failed: ', data.error);
  },
    onPerformanceMeasure: (data: { entry: PerformanceEntry }) => {
      console.debug('Performance measure:', data.entry);
  },
    onError: (error: string) => {
      console.error('Animation error:', error);
  },
    onInitialized: () => {
      console.debug('Animation system initialized');
}
}), []);

  // Use animation hook
  const {
    addAnimation,
    playAnimation,
    pauseAnimation,
    stopAnimation,
    config,
    updateConfig,
    isEnabled,
    isInitialized,
    hasError,
    animations,
    activeAnimations,
    totalAnimations,
    totalKeyframes,
    totalProperties,
    totalTriggers,
    totalTimelines
} = useAnimation(animationOptions);

  // Handle settings click
  const handleSettingsClick = useCallback(() => {
    if (onSettingsClick) {
      onSettingsClick();
  } else {
      setShowSettingsDialog(true);
  }
}, [onSettingsClick]);

  const openAnimationDialog = useCallback(() => {
    onAnimationsClick?.();
    setShowAnimationDialog(true);
  }, [onAnimationsClick]);

  const handleTabChange = useCallback(
    (_event: React.SyntheticEvent, newValue: number) => {
      setActiveTab(newValue);
      if (newValue === 0) onMonitoringClick?.();
      if (newValue === 1) onAnimationsClick?.();
      if (newValue === 3) onTimelineClick?.();
      if (newValue === 4) onKeyframesClick?.();
      if (newValue === 5) onPreviewClick?.();
      if (newValue === 6) onManagementClick?.();
    },
    [
      onAnimationsClick,
      onKeyframesClick,
      onManagementClick,
      onMonitoringClick,
      onPreviewClick,
      onTimelineClick,
    ],
  );

  // Handle create animation
  const handleCreateAnimation = useCallback(async () => {
    try {
      const animationData: Partial<AnimationType> = {
        name: 'Custom Animation',
        description: 'A custom animation created by the user',
        type: 'custom',
        duration: 100,
        delay:  0,
        iterationCount:  1,
        direction: 'normal',
        fillMode: 'forwards',
        playState: 'paused',
        easing: 'ease-in-out',
        keyframes: [
          { id: 'start', time: 0, properties: { opacity: 0 } },
          { id: 'end', time: 1, properties: { opacity: 1 } }
        ],
        properties: [
          { name: 'opacity', type: 'opacity', value: 1, description: 'Opacity property',}
        ],
        triggers: []
  };
      await addAnimation(animationData);
  } catch (error) {
      console.error('Failed to create animation:', error);
  }
}, [addAnimation]);

  // Handle play animation
  const handlePlayAnimation = useCallback(async (animationId: string) => {
    try {
      await playAnimation(animationId);
} catch (error) {
      console.error('Failed to play animation:', error);
  }
}, [playAnimation]);

  // Handle pause animation
  const handlePauseAnimation = useCallback(async (animationId: string) => {
    try {
      await pauseAnimation(animationId);
} catch (error) {
      console.error('Failed to pause animation:', error);
  }
}, [pauseAnimation]);

  // Handle stop animation
  const handleStopAnimation = useCallback(async (animationId: string) => {
    try {
      await stopAnimation(animationId);
} catch (error) {
      console.error('Failed to stop animation:', error);
  }
}, [stopAnimation]);

  // Handle create animation from preset
  const handleCreateFromPreset = useCallback(async (preset: AnimationPreset) => {
    try {
      const animationData: Partial<AnimationType> = {
        ...preset.animationData,
        description: preset.description,
        delay: 0,
        iterationCount: preset.animationData.iterationCount || 1,
        direction: 'normal',
        fillMode: 'forwards',
        playState: 'paused',
        triggers: []
      };
      await addAnimation(animationData);
      setPresetMenuAnchor(null);
    } catch (error) {
      console.error('Failed to create animation from preset:', error);
    }
  }, [addAnimation]);

  // Handle duplicate animation
  const handleDuplicateAnimation = useCallback(async (animation: AnimationType) => {
    try {
      const duplicatedAnimation: Partial<AnimationType> = {
        ...animation,
        name: `${animation.name} (Copy)`,
        id: undefined // Let the system generate a new ID
      };
      await addAnimation(duplicatedAnimation);
    } catch (error) {
      console.error('Failed to duplicate animation:', error);
    }
  }, [addAnimation]);

  // Handle toggle favorite
  const handleToggleFavorite = useCallback((animationId: string) => {
    setFavoriteAnimations(prev => {
      const newFavorites = new Set(prev);
      if (newFavorites.has(animationId)) {
        newFavorites.delete(animationId);
      } else {
        newFavorites.add(animationId);
      }
      return newFavorites;
    });
  }, []);

  // Handle export animation
  const handleExportAnimation = useCallback((animation: AnimationType) => {
    try {
      const dataStr = JSON.stringify(animation, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${animation.name.replace(/\s+/g, '-').toLowerCase()}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export animation:', error);
    }
  }, []);

  // Handle import animation
  const handleImportAnimation = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const file = event.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const content = e.target?.result as string;
          const animationData = JSON.parse(content);
          await addAnimation(animationData);
        } catch (error) {
          console.error('Failed to parse animation file:', error);
        }
      };
      reader.readAsText(file);
    } catch (error) {
      console.error('Failed to import animation:', error);
    }
  }, [addAnimation]);

  // Handle delete animation
  const handleDeleteAnimation = useCallback(async (animationId: string) => {
    await stopAnimation(animationId);
  }, [stopAnimation]);

  // Filter animations by category
  const filteredAnimations = useMemo(() => {
    let filtered = animations;

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(anim =>
        anim.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        anim.description?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filter by category
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(anim => anim.type === selectedCategory);
    }

    return filtered;
  }, [animations, searchTerm, selectedCategory]);

  // Get animation categories
  const animationCategories = useMemo(() => {
    const categories = new Set<string>();
    animations.forEach(anim => {
      if (anim.type) categories.add(anim.type);
    });
    return ['all', ...Array.from(categories)];
  }, [animations]);

  // Get preset categories
  const presetCategories = useMemo(() => {
    return ['all', 'entrance', 'exit', 'emphasis', 'motion', 'transform'];
  }, []);

  // Filter presets by category
  const filteredPresets = useMemo(() => {
    if (selectedCategory === 'all') return ANIMATION_PRESETS;
    return ANIMATION_PRESETS.filter(preset => preset.category === selectedCategory);
  }, [selectedCategory]);

  // Get status color
  const getStatusColor = useCallback(() => {
    if (hasError) return 'error';
    if (!isInitialized) return 'warning';
    if (isEnabled) return 'success';
    return 'default';
}, [hasError, isInitialized, isEnabled]);

  // Get status icon
  const getStatusIcon = useCallback(() => {
    if (hasError) return theming.getThemedIcon('error');
    if (!isInitialized) return <CircularProgress size={16} />;
    if (isEnabled) return <Animation />;
    return theming.getThemedIcon('warning');
  }, [hasError, isInitialized, isEnabled, theming]);

  // Get status text
  const getStatusText = useCallback(() => {
    if (hasError) return 'Error';
    if (!isInitialized) return 'Initializing...';
    if (isEnabled) return 'Active';
    return 'Disabled';
}, [hasError, isInitialized, isEnabled]);

  // Get position styles
  const getPositionStyles = useCallback(() => {
    const baseStyles = {
      position: 'fixed' as const,
      zIndex: 100,
};

    switch (position) {
      case 'top-left':
        return { ...baseStyles, top:  16, left: 16,};
      case 'top-right':
        return { ...baseStyles, top:  16, right: 16,};
      case 'bottom-left':
        return { ...baseStyles, bottom:  16, left: 16,};
      case 'bottom-right':
        return { ...baseStyles, bottom:  16, right: 16,};
      case 'top-center':
        return { ...baseStyles, top:  16, left: '50%', transform: 'translateX(-50%)',};
      case 'bottom-center':
        return { ...baseStyles, bottom:  16, left: '50%', transform: 'translateX(-50%)',};
      default: return { ...baseStyles, top:  16, right: 16,};
  }
}, [position]);

  // Render minimal variant
  const renderMinimal = () => (
    <Tooltip title={`Animations: ${getStatusText()}`}>
      <Chip
        icon={getStatusIcon() as React.ReactElement}
        label={totalAnimations}
        color={getStatusColor()}
        size="small"
        onClick={openAnimationDialog}
        sx={{ cursor: 'pointer'}}
      />
    </Tooltip>
  );

  // Render detailed variant
  const renderDetailed = () => (
    <Paper elevation={2} sx={{ ...theming.getThemedCardSx(), p: 1, minWidth: 200 }}>
      <Box display="flex" alignItems="center" justifyContent="space-between">
        <Box display="flex" alignItems="center" gap={1}>
          {getStatusIcon()}
          {showMonitoring && (
            <Typography variant="body2" color={getStatusColor() + '.main'}>
              {getStatusText()}
            </Typography>
          )}
        </Box>
        
        <Box display="flex" gap={1}>
          <IconButton size="small" onClick={openAnimationDialog}>
            <KeyboardArrowDown />
          </IconButton>
          
          {showSettings && (
            <IconButton size="small" onClick={handleSettingsClick}>
              {theming.getThemedIcon('settings')}
            </IconButton>
          )}
        </Box>
      </Box>
      
      {showDetails && (
        <Box mt={1}>
          <Typography variant="caption" color="text.secondary">
            {totalAnimations} animations • {activeAnimations.length} active
          </Typography>
          {isPlaying && (
            <Typography variant="caption" color="info.main" sx={{ ml:  1 }}>
              Playing
            </Typography>
          )}
        </Box>
      )}
    </Paper>
  );

  // Render full variant
  const renderFull = () => (
    <Paper elevation={3} sx={{ ...theming.getThemedCardSx(), p: 2, minWidth: 300 }}>
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
        <Box display="flex" alignItems="center" gap={1}>
          <Animation color="primary" />
          <Typography variant="h6" sx={{ ...{}, color: theming.colors.primary }}>
            Animations
          </Typography>
        </Box>
        
        <Box display="flex" gap={1}>
          <Button
            startIcon={<Add />}
            onClick={handleCreateAnimation}
            variant="outlined"
            size="small"
          >
            Custom
          </Button>
          
          <Button
            startIcon={<AutoAwesome />}
            onClick={(e) => setPresetMenuAnchor(e.currentTarget)}
            variant="contained"
            size="small"
          >
            Presets
          </Button>

          {showMonitoring && (
            <Tooltip title="Monitoring">
              <IconButton onClick={onMonitoringClick}>
                <TrendingUp />
              </IconButton>
            </Tooltip>
          )}

          {showManagement && (
            <Tooltip title="Management">
              <IconButton onClick={onManagementClick}>
                <Edit />
              </IconButton>
            </Tooltip>
          )}
          
          {showSettings && (
            <IconButton onClick={handleSettingsClick}>
              {theming.getThemedIcon('settings')}
            </IconButton>
          )}
        </Box>
      </Box>
      
      <Grid container spacing={2}>
        <Grid item xs={6}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="subtitle2" gutterBottom>
                Total Animations
              </Typography>
              <Typography variant="h4" color="primary" sx={{ ...{}, color: theming.colors.primary }}>
                {totalAnimations}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={6}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="subtitle2" gutterBottom>
                Active
              </Typography>
              <Typography variant="h4" color="info.main" sx={{ ...{}, color: theming.colors.primary }}>
                {activeAnimations.length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={6}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="subtitle2" gutterBottom>
                Keyframes
              </Typography>
              <Typography variant="h4" color="success.main" sx={{ ...{}, color: theming.colors.primary }}>
                {totalKeyframes}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        {showMonitoring && (
          <Grid item xs={6}>
            <Card sx={theming.getThemedCardSx()}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Typography variant="subtitle2" gutterBottom>
                  Status
                </Typography>
                <Box display="flex" alignItems="center" gap={1}>
                  {getStatusIcon()}
                  <Typography variant="body2" color={getStatusColor() + '.main'}>
                    {getStatusText()}
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        )}
      </Grid>
      
      <Box mt={2}>
        <Typography variant="caption" color="text.secondary">
          Timelines: {totalTimelines} • Properties: {totalProperties} • Triggers: {totalTriggers}
        </Typography>
      </Box>
    </Paper>
  );

  // Render based on variant
  const renderContent = () => {
    switch (variant) {
      case 'minimal':
        return renderMinimal();
      case 'detailed':
        return renderDetailed();
      case 'full':
        return renderFull();
      default: return renderMinimal();
}
};

  return (
    <>
      <Box
        className={className}
        style={{
          ...getPositionStyles(),
          ...style
      }}
      >
        {renderContent()}
      </Box>

      {/* Animation Dialog */}
      <Dialog open={showAnimationDialog} onClose={() => setShowAnimationDialog(false)} maxWidth="lg" fullWidth>
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            <Animation />
            <Typography variant="h6" sx={{ ...{}, color: theming.colors.primary }}>Animation Dashboard</Typography>
          </Box>
        </DialogTitle>
        
        <DialogContent>
          <Tabs value={activeTab} onChange={handleTabChange}>
            <Tab label="Overview" />
            <Tab label="Animations" disabled={!showAnimations} />
            <Tab label="Presets" />
            <Tab label="Timeline" disabled={!showTimeline} />
            <Tab label="Keyframes" disabled={!showKeyframes} />
            <Tab label="Preview" disabled={!showPreview} />
            <Tab label="Settings" disabled={!(showSettings || showManagement)} />
          </Tabs>
          
          {activeTab === 0 && (
            <Grid container spacing={2} sx={{ mt:  2 }}>
              <Grid item xs={12} sm={6} md={3}>
                <Card sx={theming.getThemedCardSx()}>
                  <CardContent sx={theming.getThemedCardSx()}>
                    <Typography variant="subtitle2" gutterBottom>
                      Total Animations
                    </Typography>
                    <Typography variant="h4" color="primary" sx={{ ...{}, color: theming.colors.primary }}>
                      {totalAnimations}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              
              <Grid item xs={12} sm={6} md={3}>
                <Card sx={theming.getThemedCardSx()}>
                  <CardContent sx={theming.getThemedCardSx()}>
                    <Typography variant="subtitle2" gutterBottom>
                      Active
                    </Typography>
                    <Typography variant="h4" color="info.main" sx={{ ...{}, color: theming.colors.primary }}>
                      {activeAnimations.length}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              
              <Grid item xs={12} sm={6} md={3}>
                <Card sx={theming.getThemedCardSx()}>
                  <CardContent sx={theming.getThemedCardSx()}>
                    <Typography variant="subtitle2" gutterBottom>
                      Keyframes
                    </Typography>
                    <Typography variant="h4" color="success.main" sx={{ ...{}, color: theming.colors.primary }}>
                      {totalKeyframes}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              
              <Grid item xs={12} sm={6} md={3}>
                <Card sx={theming.getThemedCardSx()}>
                  <CardContent sx={theming.getThemedCardSx()}>
                    <Typography variant="subtitle2" gutterBottom>
                      Status
                    </Typography>
                    <Box display="flex" alignItems="center" gap={1}>
                      {getStatusIcon()}
                      <Typography variant="body2" color={getStatusColor() + '.main'}>
                        {getStatusText()}
                      </Typography>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          )}
          
          {activeTab === 1 && showAnimations && (
            <Box sx={{ mt:  2 }}>
              <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
                <Typography variant="h6" sx={{ ...{}, color: theming.colors.primary }}>
                  Animation Library
                </Typography>
                <Box display="flex" gap={1}>
                  <Button
                    component="label"
                    startIcon={<Publish />}
                    size="small"
                    variant="outlined"
                  >
                    Import
                    <input
                      type="file"
                      hidden
                      accept=".json"
                      onChange={handleImportAnimation}
                    />
                  </Button>
                </Box>
              </Box>

              {/* Search and Filter Controls */}
              <Box display="flex" gap={2} mb={2}>
                <TextField
                  placeholder="Search animations..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  size="small"
                  fullWidth
                />
                <Select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  size="small"
                  sx={{ minWidth: 150 }}
                >
                  {animationCategories.map(category => (
                    <MenuItem key={category} value={category}>
                      {category.charAt(0).toUpperCase() + category.slice(1)}
                    </MenuItem>
                  ))}
                </Select>
              </Box>

              {/* Animation List */}
              {filteredAnimations.length === 0 ? (
                <Alert severity="info" sx={{ mt: 2 }}>
                  No animations found. Create one or import from a preset!
                </Alert>
              ) : (
                <List>
                  {filteredAnimations.map((animation) => (
                    <ListItem 
                      key={animation.id}
                      sx={{
                        bgcolor: selectedAnimationId === animation.id ? 'action.selected' : 'transparent',
                        borderRadius: 1,
                        mb: 1,
                        '&:hover': { bgcolor: 'action.hover' }
                      }}
                    >
                      <ListItemAvatar>
                        <Badge
                          badgeContent={favoriteAnimations.has(animation.id) ? <Favorite color="error" fontSize="small" /> : null}
                          overlap="circular"
                        >
                          <Avatar sx={{ bgcolor: 'primary.main' }}>
                            <Animation />
                          </Avatar>
                        </Badge>
                      </ListItemAvatar>
                      <ListItemText
                        primary={
                          <Box display="flex" alignItems="center" gap={1}>
                            <Typography variant="body1" fontWeight="medium">
                              {animation.name}
                            </Typography>
                            <Chip label={animation.type} size="small" />
                          </Box>
                        }
                        secondary={
                          <Box>
                            <Typography variant="caption" color="text.secondary">
                              {animation.description}
                            </Typography>
                            <Typography variant="caption" display="block" color="text.secondary">
                              Duration: {animation.duration}ms • Easing: {animation.easing}
                            </Typography>
                          </Box>
                        }
                      />
                      <ListItemSecondaryAction>
                        <Box display="flex" gap={0.5}>
                          <Tooltip 
                            title={favoriteAnimations.has(animation.id) ? 'Remove from favorites' : 'Add to favorites'}
                            {...getTooltipProps()}
                          >
                            <IconButton
                              size="small"
                              onClick={() => handleToggleFavorite(animation.id)}
                              sx={getIconButtonStyles()}
                            >
                              {favoriteAnimations.has(animation.id) ? <Favorite color="error" /> : <FavoriteBorder />}
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Play" {...getTooltipProps()}>
                            <IconButton
                              size="small"
                              onClick={() => handlePlayAnimation(animation.id)}
                              disabled={animation.playState === 'running'}
                              color="primary"
                              sx={getIconButtonStyles()}
                            >
                              <PlayArrow />
                            </IconButton>
                          </Tooltip>
                          {animation.playState === 'running' && (
                            <Tooltip title="Pause">
                              <IconButton
                                size="small"
                                onClick={() => handlePauseAnimation(animation.id)}
                                color="primary"
                              >
                                <Pause />
                              </IconButton>
                            </Tooltip>
                          )}
                          <Tooltip title="Stop">
                            <IconButton
                              size="small"
                              onClick={() => handleStopAnimation(animation.id)}
                            >
                              <Stop />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Duplicate">
                            <IconButton
                              size="small"
                              onClick={() => handleDuplicateAnimation(animation)}
                            >
                              <FileCopy />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Export">
                            <IconButton
                              size="small"
                              onClick={() => handleExportAnimation(animation)}
                            >
                              <GetApp />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Edit">
                            <IconButton
                              size="small"
                              onClick={() => setSelectedAnimationId(animation.id)}
                            >
                              <Edit />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Delete">
                            <IconButton
                              size="small"
                              onClick={() => handleDeleteAnimation(animation.id)}
                              color="error"
                            >
                              <Delete />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </ListItemSecondaryAction>
                    </ListItem>
                  ))}
                </List>
              )}
            </Box>
          )}
          
          {activeTab === 2 && (
            <Box sx={{ mt:  2 }}>
              <Typography variant="h6" gutterBottom sx={{ ...{}, color: theming.colors.primary }}>
                Animation Presets
              </Typography>
              
              {/* Category Filter */}
              <Box display="flex" gap={2} mb={3}>
                <Select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  size="small"
                  fullWidth
                >
                  {presetCategories.map(category => (
                    <MenuItem key={category} value={category}>
                      {category.charAt(0).toUpperCase() + category.slice(1)}
                    </MenuItem>
                  ))}
                </Select>
              </Box>

              {/* Preset Grid */}
              <Grid container spacing={2}>
                {filteredPresets.map((preset) => (
                  <Grid item xs={12} sm={6} md={4} key={preset.id}>
                    <Card 
                      sx={{ 
                        ...theming.getThemedCardSx(),
                        ...getCardHoverStyles(),
                        cursor: 'pointer'
                      }}
                      onClick={() => handleCreateFromPreset(preset)}
                      style={{
                        animationDelay: `${getStaggerDelay(ANIMATION_PRESETS.indexOf(preset))}ms`
                      }}
                    >
                      <CardContent>
                        <Box display="flex" alignItems="center" gap={1} mb={1}>
                          <Box sx={{ color: 'primary.main' }}>
                            {preset.icon}
                          </Box>
                          <Typography variant="h6" component="div">
                            {preset.name}
                          </Typography>
                        </Box>
                        
                        <Typography variant="body2" color="text.secondary" gutterBottom>
                          {preset.description}
                        </Typography>
                        
                        <Box display="flex" gap={1} mt={2}>
                          <Chip
                            label={preset.category}
                            size="small"
                            color="primary"
                            variant="outlined"
                          />
                          <Chip
                            label={`${preset.animationData.duration}ms`}
                            size="small"
                          />
                          <Chip
                            label={preset.animationData.easing}
                            size="small"
                          />
                        </Box>
                        
                        <Button
                          fullWidth
                          variant="contained"
                          startIcon={<Add />}
                          sx={{ mt: 2 }}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCreateFromPreset(preset);
                          }}
                        >
                          Add to Library
                        </Button>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            </Box>
          )}
          
          {activeTab === 3 && showTimeline && (
            <Box sx={{ mt:  2 }}>
              <Typography variant="h6" gutterBottom sx={{ ...{}, color: theming.colors.primary }}>
                Timeline Editor
              </Typography>
              <Box sx={{ mb:  2 }}>
                <Box display="flex" alignItems="center" gap={2} mb={2}>
                  <Button
                    onClick={() => setIsPlaying(!isPlaying)}
                    startIcon={isPlaying ? theming.getThemedIcon('pause') : theming.getThemedIcon('play')}
                    variant="contained"
                  >
                    {isPlaying ? 'Pause' : 'Play'}
                  </Button>
                  <Button
                    onClick={() => {
                      setIsPlaying(false);
                      setTimelinePosition(0);
                  }}
                    startIcon={theming.getThemedIcon('stop')}
                  >
                    Stop
                  </Button>
                  <Button
                    onClick={() => {
                      setIsPlaying(false);
                      setTimelinePosition(0);
                  }}
                    startIcon={theming.getThemedIcon('replay')}
                  >
                    Reset
                  </Button>
                </Box>
                
                <Box display="flex" alignItems="center" gap={2} mb={2}>
                  <Typography variant="body2">Speed: </Typography>
                  <Slider
                    value={playbackSpeed}
                    onChange={(_, value) => setPlaybackSpeed(value as number)}
                    min={0.1}
                    max={3}
                    step={0.1}
                    sx={{ width: 100}}
                  />
                  <Typography variant="body2">{playbackSpeed}x</Typography>
                </Box>
                
                <Box display="flex" alignItems="center" gap={2} mb={2}>
                  <Typography variant="body2">Position: </Typography>
                  <Slider
                    value={timelinePosition}
                    onChange={(_, value) => setTimelinePosition(value as number)}
                    min={0}
                    max={1}
                    step={0.01}
                    sx={{ flexGrow:  1 }}
                  />
                  <Typography variant="body2">{Math.round(timelinePosition * 100)}%</Typography>
                </Box>
              </Box>
              
              <List>
                {animations.map((animation, index) => (
                  <ListItem key={animation.id}>
                    <ListItemAvatar>
                      <Avatar color="primary">
                        <Animation />
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={animation.name}
                      secondary={`${animation.description} • ${animation.duration}ms`}
                    />
                    <ListItemSecondaryAction>
                      <Box display="flex" alignItems="center" gap={1}>
                        <Typography variant="caption" color="text.secondary">
                          {index + 1}
                        </Typography>
                        <Button
                          onClick={() => handlePlayAnimation(animation.id)}
                          startIcon={theming.getThemedIcon('play')}
                          size="small"
                        >
                          Play
                        </Button>
                      </Box>
                    </ListItemSecondaryAction>
                  </ListItem>
                ))}
              </List>
            </Box>
          )}
          
          {activeTab === 4 && showKeyframes && (
            <Box sx={{ mt:  2 }}>
              <Typography variant="h6" gutterBottom sx={{ ...{}, color: theming.colors.primary }}>
                Keyframe Management
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Manage animation keyframes and properties
              </Typography>
            </Box>
          )}
          
          {activeTab === 5 && showPreview && (
            <Box sx={{ mt:  2 }}>
              <Typography variant="h6" gutterBottom sx={{ ...{}, color: theming.colors.primary }}>
                Animation Preview
              </Typography>
              <Box sx={{ p: 2, border: '1px dashed #ccc', borderRadius: 1, textAlign: 'center'}}>
                <Typography variant="body2" color="text.secondary">
                  Animation preview area
                </Typography>
                <Box sx={{ mt:  2 }}>
                  <Button
                    onClick={() => setIsPlaying(!isPlaying)}
                    startIcon={isPlaying ? theming.getThemedIcon('pause') : theming.getThemedIcon('play')}
                    variant="contained"
                  >
                    {isPlaying ? 'Pause' : 'Play'} Preview
                  </Button>
                </Box>
              </Box>
            </Box>
          )}
          
          {activeTab === 6 && (showSettings || showManagement) && (
            <Box sx={{ mt:  2 }}>
              <Typography variant="h6" gutterBottom sx={{ ...{}, color: theming.colors.primary }}>
                Animation Settings
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={config.enableAnimations}
                        onChange={(e) => updateConfig({ enableAnimations: e.target.checked })}
                      />
                  }
                    label="Enable Animations"
                  />
                </Grid>
                
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={config.enableTimeline}
                        onChange={(e) => updateConfig({ enableTimeline: e.target.checked })}
                      />
                  }
                    label="Enable Timeline"
                  />
                </Grid>
                
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={config.enableKeyframes}
                        onChange={(e) => updateConfig({ enableKeyframes: e.target.checked })}
                      />
                  }
                    label="Enable Keyframes"
                  />
                </Grid>
                
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={config.enableEasing}
                        onChange={(e) => updateConfig({ enableEasing: e.target.checked })}
                      />
                  }
                    label="Enable Easing"
                  />
                </Grid>
                
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={config.enableTransitions}
                        onChange={(e) => updateConfig({ enableTransitions: e.target.checked })}
                      />
                  }
                    label="Enable Transitions"
                  />
                </Grid>
                
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={config.enableTransforms}
                        onChange={(e) => updateConfig({ enableTransforms: e.target.checked })}
                      />
                  }
                    label="Enable Transforms"
                  />
                </Grid>
                
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={config.enableFilters}
                        onChange={(e) => updateConfig({ enableFilters: e.target.checked })}
                      />
                  }
                    label="Enable Filters"
                  />
                </Grid>
                
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={config.enableEffects}
                        onChange={(e) => updateConfig({ enableEffects: e.target.checked })}
                      />
                  }
                    label="Enable Effects"
                  />
                </Grid>
                
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={config.enablePerformance}
                        onChange={(e) => updateConfig({ enablePerformance: e.target.checked })}
                      />
                  }
                    label="Enable Performance Monitoring"
                  />
                </Grid>
                
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={config.enableOptimization}
                        onChange={(e) => updateConfig({ enableOptimization: e.target.checked })}
                      />
                  }
                    label="Enable Optimization"
                  />
                </Grid>
              </Grid>
            </Box>
          )}
        </DialogContent>
        
        <DialogActions>
          <Button onClick={() => setShowAnimationDialog(false)}>
            Close
          </Button>
          <Button onClick={handleCreateAnimation}
            variant="contained"
            startIcon={theming.getThemedIcon('add')}
           sx={theming.getThemedButtonSx()}>
            Create Animation
          </Button>
        </DialogActions>
      </Dialog>

      {/* Settings Dialog */}
      <Dialog open={showSettingsDialog} onClose={() => setShowSettingsDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            {theming.getThemedIcon('settings')}
            <Typography variant="h6" sx={{ ...{}, color: theming.colors.primary }}>Animation Settings</Typography>
          </Box>
        </DialogTitle>
        
        <DialogContent>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.enableAnimations}
                    onChange={(e) => updateConfig({ enableAnimations: e.target.checked })}
                  />
              }
                label="Enable Animations"
              />
            </Grid>
            
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.enableTimeline}
                    onChange={(e) => updateConfig({ enableTimeline: e.target.checked })}
                  />
              }
                label="Enable Timeline"
              />
            </Grid>
            
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.enableKeyframes}
                    onChange={(e) => updateConfig({ enableKeyframes: e.target.checked })}
                  />
              }
                label="Enable Keyframes"
              />
            </Grid>
            
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.enableEasing}
                    onChange={(e) => updateConfig({ enableEasing: e.target.checked })}
                  />
              }
                label="Enable Easing"
              />
            </Grid>
            
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.enableTransitions}
                    onChange={(e) => updateConfig({ enableTransitions: e.target.checked })}
                  />
              }
                label="Enable Transitions"
              />
            </Grid>
            
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.enableTransforms}
                    onChange={(e) => updateConfig({ enableTransforms: e.target.checked })}
                  />
              }
                label="Enable Transforms"
              />
            </Grid>
            
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.enableFilters}
                    onChange={(e) => updateConfig({ enableFilters: e.target.checked })}
                  />
              }
                label="Enable Filters"
              />
            </Grid>
            
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.enableEffects}
                    onChange={(e) => updateConfig({ enableEffects: e.target.checked })}
                  />
              }
                label="Enable Effects"
              />
            </Grid>
            
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.enablePerformance}
                    onChange={(e) => updateConfig({ enablePerformance: e.target.checked })}
                  />
              }
                label="Enable Performance Monitoring"
              />
            </Grid>
            
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.enableOptimization}
                    onChange={(e) => updateConfig({ enableOptimization: e.target.checked })}
                  />
              }
                label="Enable Optimization"
              />
            </Grid>
          </Grid>
        </DialogContent>
        
        <DialogActions>
          <Button onClick={() => setShowSettingsDialog(false)}>
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Preset Menu */}
      <Menu
        anchorEl={presetMenuAnchor}
        open={Boolean(presetMenuAnchor)}
        onClose={() => setPresetMenuAnchor(null)}
        PaperProps={{
          sx: {
            maxHeight: 500,
            width: 350,
          }
        }}
      >
        <Box sx={{ p: 2, pb: 1 }}>
          <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
            Animation Presets
          </Typography>
          <Select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            size="small"
            fullWidth
            sx={{ mb: 1 }}
          >
            {presetCategories.map(category => (
              <MenuItem key={category} value={category}>
                {category.charAt(0).toUpperCase() + category.slice(1)}
              </MenuItem>
            ))}
          </Select>
        </Box>
        <Divider />
        <Box sx={{ maxHeight: 400, overflowY: 'auto' }}>
          {filteredPresets.map((preset) => (
            <MenuItem
              key={preset.id}
              onClick={() => handleCreateFromPreset(preset)}
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                py: 1.5,
                '&:hover': {
                  bgcolor: 'action.hover'
                }
              }}
            >
              <Box display="flex" alignItems="center" gap={1} width="100%">
                <ListItemIcon sx={{ minWidth: 36 }}>
                  {preset.icon}
                </ListItemIcon>
                <Box flex={1}>
                  <Typography variant="body2" fontWeight="medium">
                    {preset.name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" display="block">
                    {preset.description}
                  </Typography>
                  <Box display="flex" gap={1} mt={0.5}>
                    <Chip
                      label={preset.category}
                      size="small"
                      sx={{ height: 20, fontSize: '0.7rem' }}
                    />
                    <Chip
                      label={`${preset.animationData.duration}ms`}
                      size="small"
                      sx={{ height: 20, fontSize: '0.7rem' }}
                    />
                  </Box>
                </Box>
              </Box>
            </MenuItem>
          ))}
        </Box>
        <Divider />
        <Box sx={{ p: 1 }}>
          <Button
            fullWidth
            size="small"
            onClick={() => {
              setPresetMenuAnchor(null);
              handleCreateAnimation();
            }}
            startIcon={<Add />}
          >
            Create Custom Animation
          </Button>
        </Box>
      </Menu>
    </>
  );
});

AnimationDashboard.displayName ='AnimationDashboard';

export default AnimationDashboard;
