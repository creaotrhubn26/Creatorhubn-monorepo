import { useTheming } from '../../utils/theming-helper';
import { useProfessionConfigs } from '@/hooks/useProfessionConfigs';
import { useProfessionAdapter } from '@/hooks/useProfessionAdapter';
import getProfessionIcon from '@/utils/profession-icons';
import { useDynamicProfessions } from '../universal/hooks/useDynamicProfessions';
import React, { useEffect, useState } from 'react';
import {
  Snackbar,
  Alert,
  Button,
  Box,
  Typography,
  Slide,
  Fade,
  IconButton,
  Chip
} from '@mui/material';
import {
  TipsAndUpdates as TipsIcon,
  Close as CloseIcon,
  AutoAwesome as MagicIcon,
  PhotoCamera as CameraIcon
} from '@mui/icons-material';
import { TransitionProps } from '@mui/material/transitions';
import { usePhotographyTips, PhotographyContextDetector } from '../../hooks/usePhotographyTips';
import { PhotographyTip, TipContext } from '../../../shared/photography-tips-schema';

const SlideTransition = React.forwardRef(function Transition(
  props: TransitionProps & {
    children: React.ReactElement<any, any>;
},
  ref: React.Ref<unknown>,
) {
  return <Slide direction="up" ref={ref} {...props} />;
});

interface SmartTipsTriggerProps {
  userId?: string;
  onTipClick?: (tip: PhotographyTip) => void;
  onShowAllTips?: () => void;
  enableAutoTrigger?: boolean;
  profession?: 'photographer' | 'videographer' | 'music_producer' | 'vendor';
}

export const SmartTipsTrigger: React.FC<SmartTipsTriggerProps> = ({
  userId = 'photographer_user',
  onTipClick,
  onShowAllTips,
  profession = 'photographer',
  enableAutoTrigger = true
}) => {
  const [currentTip, setCurrentTip] = useState<PhotographyTip | null>(null);
  const [showTip, setShowTip] = useState(false);
  
  // Theming system - use dynamic profession
  const theming = useTheming(profession);
  const [dismissedTips, setDismissedTips] = useState<Set<string>>(new Set());
  const [context, setContext] = useState<TipContext>({});

  const {
    contextualTips,
    trackInteraction,
    detectContext,
    displaySettings
} = usePhotographyTips({
    context,
    userId,
    autoDetectContext: true
});

  // Detect context changes and trigger relevant tips
  useEffect(() => {
    if (!enableAutoTrigger) return;

    let isMounted = true;
    const detectAndShowTip = async () => {
      try {
        // Detect current context
        const detectedContext = detectContext();
        
        // Get lighting conditions
        const lightingCondition = PhotographyContextDetector.detectLightingConditions();
        const environment = await PhotographyContextDetector.detectEnvironment();

        const updatedContext = {
          ...detectedContext,
          lightingCondition,
          location: environment
    };

        if (isMounted) {
          setContext(updatedContext);
      }

        // Find most relevant tip that hasn't been dismissed
        const relevantTip = contextualTips.find(tip => 
          !dismissedTips.has(tip.id!) &&
          tip.priority === 1 && // High priority tips only
          tip.conditions?.difficulty !== 'advanced' // Skip advanced tips for auto-trigger
        );

        if (relevantTip && !currentTip) {
          setCurrentTip(relevantTip);
          setShowTip(true);
          trackInteraction(relevantTip.id 'auto_trigger');
        }
      } catch (error) {
        console.error('Error detecting context for tips: ', error);
    }
  };

    // Initial detection
    detectAndShowTip();

    // Set up context detection intervals
    const contextInterval = setInterval(detectAndShowTip, 30000); // Every 30 seconds

    return () => {
      isMounted = false;
      clearInterval(contextInterval);
  };
}, [enableAutoTrigger]); // Simplified dependencies to prevent infinite loop

  // Handle camera settings detection from page context
  useEffect(() => {
    // Listen for camera/equipment changes in the application
    const handleCameraChange = (event: CustomEvent) => {
      const { camera, lens, project } = event.detail;
      const updatedContext = {
        ...context,
        currentCamera: camera,
        currentLens: lens,
        currentProject: project
  };
      setContext(updatedContext);
      PhotographyContextDetector.saveContext(updatedContext);
  };

    // Listen for project type changes
    const handleProjectChange = (event: CustomEvent) => {
      const { projectType, difficulty } = event.detail;
      const updatedContext = {
        ...context,
        projectType,
        userLevel: difficulty
  };
      setContext(updatedContext);
      PhotographyContextDetector.saveContext(updatedContext);
  };

    window.addEventListener('camera-changed' as any, handleCameraChange);
    window.addEventListener('project-changed' as any, handleProjectChange);

    return () => {
      window.removeEventListener('camera-changed' as any, handleCameraChange);
      window.removeEventListener('project-changed' as any, handleProjectChange);
  };
}, [context]);

  // Handle tip interaction
  const handleTipAction = (action: string) => {
    if (!currentTip) return;

    switch (action) {
      case 'view':
        trackInteraction(currentTip.id'view');
        onTipClick?.(currentTip);
        setShowTip(false);
        break;
      case 'dismiss':
        trackInteraction(currentTip.id!'dismiss');
        setDismissedTips(prev => new Set(prev).add(currentTip.id!));
        setShowTip(false);
        break;
      case 'show_all':
        trackInteraction(currentTip.id!'view_all_from_trigger');
        onShowAllTips?.();
        setShowTip(false);
        break;
  }

    // Reset current tip after a delay
    setTimeout(() => {
      setCurrentTip(null);
  }, 1000);
};

  // Auto-hide tip after delay
  useEffect(() => {
    if (showTip && displaySettings.autoHide && currentTip) {
      const timer = setTimeout(() => {
        handleTipAction('dismiss');
    }, displaySettings.autoHideDelay * 1000);

      return () => clearTimeout(timer);
  }
}, [showTip, displaySettings.autoHide, displaySettings.autoHideDelay, currentTip]);

  if (!currentTip || !showTip) return null;

  return (
    <Snackbar
      open={showTip}
      anchorOrigin={{
        vertical: displaySettings.overlayPosition.includes('bottom') ? 'bottom' : 'top',
        horizontal: displaySettings.overlayPosition.includes('right') ? 'right' : 'left'
  }}
      sx={{
        '& .MuiSnackbar-root': {
          position: 'fixed',
          zIndex: 1300,  }
    }}
      TransitionComponent={SlideTransition}
    >
      <Alert
        severity="info"
        sx={{
          background: 'linear-gradient(135deg, rgba(2, 5, 5, 107, 53, 0.95) 0%, rgba(2, 4, 7, 147, 30, 0.95) 100%)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(25, 255, 255, 0.2)',
          borderRadius:  2,
          color: 'white',
          minWidth: 30,
          maxWidth: 40, '& .MuiAlert-icon': { color: 'white'
      }, '& .MuiAlert-action': {
            color: 'white'
      }
      }}
        icon={<MagicIcon />}
        action={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5}}>
            <IconButton
              size="small"
              onClick={() => handleTipAction('dismiss')}
              sx={{ color: 'white' }}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>
      }
      >
        <Box>
          {/* Header */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <TipsIcon fontSize="small" />
            <Typography variant="subtitle2" sx={{ fontWeight: 600}>
              Fotograferingstips
            </Typography>
            {currentTip.conditions?.difficulty && (
              <Chip
                label={currentTip.conditions.difficulty}
                size="small"
                sx={{
                  background: 'rgba(25, 255, 255, 0.3)',
                  color: 'white',
                  fontSize: '0.7rem',
                  height:  20,
                  textTransform: 'capitalize'
            }}
              />
            )}
          </Box>

          {/* Context indicators */}
          {Object.keys(context).length > 0 && (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0,mb:  1 }}>
              {context.currentCamera && (
                <Chip
                  icon={<CameraIcon />}
                  label={context.currentCamera}
                  size="small"
                  sx={{
                    background: 'rgba(25, 255, 255, 0.2)',
                    color: 'white',
                    fontSize: '0.7rem',
                    height: 18 }}
                />
              )}
              {context.lightingCondition && (
                <Chip
                  label={context.lightingCondition}
                  size="small"
                  sx={{
                    background: 'rgba(25, 255, 255, 0.2)',
                    color: 'white',
                    fontSize: '0.7rem',
                    height: 18 }}
                />
              )}
            </Box>
          )}

          {/* Tip content */}
          <Typography variant="body2" sx={{ mb: 1, .fontWeight: 500}}>
            {currentTip.title}
          </Typography>

          <Typography
            variant="body2"
            sx={{
              opacity: 0.9,
              mb:  2,
              display: '-webkit-box',
              WebkitLineClamp:  2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              lineHeight: 1.3 }}
          >
            {currentTip.content}
          </Typography>

          {/* Action buttons */}
          <Box sx={{ display: 'flex', gap: 1, justifyContent: 'space-between' }}>
            <Button
              size="small"
              variant="outlined"
              onClick={() => handleTipAction('view')}
              sx={{
                borderColor: 'rgba(25, 255, 255, 0.5)',
                color: 'white',
                fontSize: '0.75rem', '&:hover': {
                  borderColor: 'white',
                  background: 'rgba(25, 255, 255, 0.1)'
              }
            }}
            >
              Les mer
            </Button>
            <Button
              size="small"
              variant="text"
              onClick={() => handleTipAction('show_all')}
              sx={{
                color: 'rgba(25, 255, 255, 0.8)',
                fontSize: '0.75rem',
                minWidth: 'auto','&:hover': {
                  color: 'white',
                  background: 'rgba(25, 255, 255, 0.1)'
              }
            }}
            >
              Se alle tips
            </Button>
          </Box>

          {/* Auto-hide progress indicator */}
          {displaySettings.autoHide && (
            <Box
              sx={{
                position: 'absolute',
                bottom:  0,
                left:  0,
                right:  0,
                height:  2,
                background: 'rgba(25, 255, 255, 0.3)',
                borderRadius: '0 0 8px 8px',
                overflow: 'hidden'
          }}
            >
              <Box
                sx={{
                  height: '100%',
                  background: 'white',
                  animation: `shrinkProgress ${displaySettings.autoHideDelay}s linear`,
                  transformOrigin: 'left', '@keyframes shrinkProgress': {
                    from: { transform: 'scaleX(1)' },
                    to: { transform: 'scaleX(0)' }
                }
              }}
              />
            </Box>
          )}
        </Box>
      </Alert>
    </Snackbar>
  );
};

// Utility functions for triggering contextual tips
export const TipTriggerUtils = {
  // Trigger tip when camera is detected
  triggerCameraChange: (camera: string, lens?: string) => {
    window.dispatchEvent(new CustomEvent('camera-changed', {
      detail: { camera, lens }
  }));
},

  // Trigger tip when project type changes
  triggerProjectChange: (projectType: string, difficulty?: string) => {
    window.dispatchEvent(new CustomEvent('project-changed', {
      detail: { projectType, difficulty }
  }));
},

  // Trigger tip based on time of day
  triggerTimeOfDay: () => {
    const hour = new Date().getHours();
    let scenario = ', ';
    
    if (hour >= 5 && hour <= 8) {
      scenario = 'golden_hour_morning';
} else if (hour >= 17 && hour <= 19) {
      scenario = 'golden_hour_evening';
  } else if (hour >= 20 && hour <= 23) {
      scenario = 'blue_hour';
  }

    if (scenario) {
      window.dispatchEvent(new CustomEvent('lighting-condition-detected', {
        detail: { scenario, timeOfDay: hour }
    }));
  }
},

  // Trigger tip based on location
  triggerLocationChange: (location: 'indoor' | 'outdoor' |'studio') => {
    window.dispatchEvent(new CustomEvent('location-changed', {
      detail: { location }
  }));
}
};