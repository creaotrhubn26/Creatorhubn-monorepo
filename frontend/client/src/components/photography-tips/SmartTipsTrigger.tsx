// @ts-nocheck
import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  IconButton,
  Slide,
  Snackbar,
  Typography,
} from '@mui/material';
import { Close as CloseIcon, TipsAndUpdates as TipsIcon } from '@mui/icons-material';
import type { TransitionProps } from '@mui/material/transitions';
import { usePhotographyTips, PhotographyContextDetector } from '../../hooks/usePhotographyTips';
import type { PhotographyTip, TipContext } from '../../../shared/photography-tips-schema';

const SlideUpTransition = React.forwardRef(function SlideUpTransition(
  props: TransitionProps & { children: React.ReactElement<unknown, string | React.JSXElementConstructor<unknown>> },
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

function resolveAnchor(position: string): { vertical: 'top' | 'bottom'; horizontal: 'left' | 'right' | 'center' } {
  if (position === 'center') {
    return { vertical: 'bottom', horizontal: 'center' };
  }

  const vertical = position.startsWith('top') ? 'top' : 'bottom';
  const horizontal = position.endsWith('left') ? 'left' : 'right';
  return { vertical, horizontal };
}

function tipKey(tip: PhotographyTip): string {
  return tip.id;
}

export const SmartTipsTrigger: React.FC<SmartTipsTriggerProps> = ({
  userId = 'photographer_user',
  onTipClick,
  onShowAllTips,
  enableAutoTrigger = true,
}) => {
  const [context, setContext] = useState<TipContext>({});
  const [dismissedTipIds, setDismissedTipIds] = useState<Set<string>>(new Set());
  const [activeTip, setActiveTip] = useState<PhotographyTip | null>(null);
  const [open, setOpen] = useState(false);

  const { contextualTips, trackInteraction, detectContext, displaySettings } = usePhotographyTips({
    context,
    userId,
    autoDetectContext: true,
  });

  const anchorOrigin = useMemo(() => resolveAnchor(displaySettings.overlayPosition), [displaySettings.overlayPosition]);

  useEffect(() => {
    if (!enableAutoTrigger) {
      return;
    }

    let cancelled = false;

    const refreshContext = async () => {
      const baseContext = detectContext();
      const lightingCondition = PhotographyContextDetector.detectLightingConditions();
      const location = await PhotographyContextDetector.detectEnvironment();

      if (cancelled) {
        return;
      }

      setContext({
        ...baseContext,
        lightingCondition,
        location,
      });
    };

    refreshContext();
    const intervalId = window.setInterval(refreshContext, 25_000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [detectContext, enableAutoTrigger]);

  useEffect(() => {
    const onCameraChanged = (event: Event) => {
      const customEvent = event as CustomEvent<{ camera?: string; lens?: string; project?: string }>;
      setContext((previous) => ({
        ...previous,
        currentCamera: customEvent.detail?.camera,
        currentLens: customEvent.detail?.lens,
        currentProject: customEvent.detail?.project,
      }));
    };

    const onProjectChanged = (event: Event) => {
      const customEvent = event as CustomEvent<{ projectType?: string; difficulty?: 'beginner' | 'intermediate' | 'advanced' }>;
      setContext((previous) => ({
        ...previous,
        projectType: customEvent.detail?.projectType,
        userLevel: customEvent.detail?.difficulty,
      }));
    };

    const onLocationChanged = (event: Event) => {
      const customEvent = event as CustomEvent<{ location?: 'indoor' | 'outdoor' | 'studio' }>;
      setContext((previous) => ({
        ...previous,
        location: customEvent.detail?.location,
      }));
    };

    window.addEventListener('camera-changed', onCameraChanged);
    window.addEventListener('project-changed', onProjectChanged);
    window.addEventListener('location-changed', onLocationChanged);

    return () => {
      window.removeEventListener('camera-changed', onCameraChanged);
      window.removeEventListener('project-changed', onProjectChanged);
      window.removeEventListener('location-changed', onLocationChanged);
    };
  }, []);

  useEffect(() => {
    if (!enableAutoTrigger || contextualTips.length === 0 || activeTip) {
      return;
    }

    const candidate = contextualTips.find((tip) => !dismissedTipIds.has(tipKey(tip)));
    if (!candidate) {
      return;
    }

    setActiveTip(candidate);
    setOpen(true);
    trackInteraction(candidate.id, 'auto_triggered');
  }, [activeTip, contextualTips, dismissedTipIds, enableAutoTrigger, trackInteraction]);

  useEffect(() => {
    if (!open || !activeTip || !displaySettings.autoHide) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setOpen(false);
      setDismissedTipIds((previous) => {
        const next = new Set(previous);
        next.add(tipKey(activeTip));
        return next;
      });
      trackInteraction(activeTip.id, 'auto_hidden');
    }, Math.max(1, displaySettings.autoHideDelay) * 1000);

    return () => window.clearTimeout(timeoutId);
  }, [activeTip, displaySettings.autoHide, displaySettings.autoHideDelay, open, trackInteraction]);

  const handleDismiss = () => {
    if (!activeTip) {
      return;
    }

    setOpen(false);
    setDismissedTipIds((previous) => {
      const next = new Set(previous);
      next.add(tipKey(activeTip));
      return next;
    });
    trackInteraction(activeTip.id, 'dismissed');
    window.setTimeout(() => setActiveTip(null), 160);
  };

  const handleReadMore = () => {
    if (!activeTip) {
      return;
    }

    trackInteraction(activeTip.id, 'opened');
    onTipClick?.(activeTip);
    setOpen(false);
    window.setTimeout(() => setActiveTip(null), 160);
  };

  const handleShowAll = () => {
    if (activeTip) {
      trackInteraction(activeTip.id, 'show_all');
    }
    onShowAllTips?.();
    setOpen(false);
    window.setTimeout(() => setActiveTip(null), 160);
  };

  if (!activeTip) {
    return null;
  }

  const difficultyLabel = activeTip.conditions?.difficulty;

  return (
    <Snackbar
      open={open}
      anchorOrigin={anchorOrigin}
      TransitionComponent={SlideUpTransition}
      sx={{ '& .MuiSnackbar-root': { zIndex: 1400 } }}
    >
      <Alert
        severity="info"
        icon={<TipsIcon />}
        action={
          <IconButton size="small" aria-label="Lukk tips" onClick={handleDismiss}>
            <CloseIcon fontSize="small" />
          </IconButton>
        }
        sx={{
          maxWidth: 420,
          border: '1px solid rgba(25,118,210,0.35)',
          backgroundColor: 'rgba(10, 20, 35, 0.92)',
          color: '#fff',
          '& .MuiAlert-icon': {
            color: '#90caf9',
          },
        }}
      >
        <Box sx={{ minWidth: 280 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
              Smart fototips
            </Typography>
            {difficultyLabel && <Chip size="small" label={difficultyLabel} color="primary" />}
          </Box>

          <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
            {activeTip.title}
          </Typography>
          <Typography variant="body2" sx={{ opacity: 0.9, mb: 1.25 }}>
            {activeTip.content}
          </Typography>

          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button size="small" variant="contained" onClick={handleReadMore}>
              Les mer
            </Button>
            <Button size="small" variant="outlined" color="inherit" onClick={handleShowAll}>
              Alle tips
            </Button>
          </Box>
        </Box>
      </Alert>
    </Snackbar>
  );
};

export const TipTriggerUtils = {
  triggerCameraChange(camera: string, lens?: string) {
    window.dispatchEvent(
      new CustomEvent('camera-changed', {
        detail: { camera, lens },
      }),
    );
  },

  triggerProjectChange(projectType: string, difficulty?: 'beginner' | 'intermediate' | 'advanced') {
    window.dispatchEvent(
      new CustomEvent('project-changed', {
        detail: { projectType, difficulty },
      }),
    );
  },

  triggerLocationChange(location: 'indoor' | 'outdoor' | 'studio') {
    window.dispatchEvent(
      new CustomEvent('location-changed', {
        detail: { location },
      }),
    );
  },

  triggerTimeOfDayHints() {
    const hour = new Date().getHours();
    let scenario: string | null = null;

    if (hour >= 5 && hour <= 8) {
      scenario = 'golden_hour_morning';
    } else if (hour >= 17 && hour <= 19) {
      scenario = 'golden_hour_evening';
    } else if (hour >= 20 && hour <= 23) {
      scenario = 'blue_hour';
    }

    if (scenario) {
      window.dispatchEvent(
        new CustomEvent('project-changed', {
          detail: { projectType: scenario },
        }),
      );
    }
  },
};

export default SmartTipsTrigger;
