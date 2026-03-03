/**
 * ScrollStory with Toast Notifications
 * Wrapper component that adds toast notifications to ScrollStory for better UX
 */

import React, { useState, useCallback, useEffect } from 'react';
import { Snackbar, Alert } from '@mui/material';
import type { AlertColor } from '@mui/material/Alert';
import ScrollStory from './ScrollStory.enhanced';
import type { ScrollStory as ScrollStoryType } from './useScrollStory';
import { useEnhancedMasterIntegration } from '../../integration/EnhancedMasterIntegrationProvider';

interface ScrollStoryWithToastsProps {
  story: ScrollStoryType;
  onScrollProgress?: (progress: number) => void;
  onAnimationEnter?: (elementId: string) => void;
  onAnimationExit?: (elementId: string) => void;
  onTriggerActivate?: (triggerId: string) => void;
  enableParallax?: boolean;
  enableKeyboardNav?: boolean;
  preloadMedia?: boolean;
  autoPlayVideos?: boolean;
  children?: React.ReactNode;

  // Toast configuration
  enableToasts?: boolean;
  toastPosition?: 'top' | 'bottom';
}

export default function ScrollStoryWithToasts({
  story,
  onScrollProgress,
  onAnimationEnter,
  onAnimationExit,
  onTriggerActivate,
  enableParallax = true,
  enableKeyboardNav = true,
  preloadMedia = true,
  autoPlayVideos = true,
  children,
  enableToasts = true,
  toastPosition = 'bottom',
}: ScrollStoryWithToastsProps) {
  const { analytics } = useEnhancedMasterIntegration();

  // Toast state
  const [toastQueue, setToastQueue] = useState<
    Array<{
      id: string;
      message: string;
      severity: AlertColor;
      duration: number;
    }>
  >([]);

  const [currentToast, setCurrentToast] = useState<{
    open: boolean;
    message: string;
    severity: AlertColor;
  } | null>(null);

  // Show toast helper
  const showToast = useCallback(
    (message: string, severity: AlertColor = 'info', duration: number = 3000) => {
      if (!enableToasts) return;

      const toastId = `toast-${Date.now()}`;

      // Add to queue
      setToastQueue((prev) => [...prev, { id: toastId, message, severity, duration }]);

      // Track toast analytics
      analytics.trackEvent('scroll_story_toast_shown', {
        storyId: story.id,
        message,
        severity,
        duration,
        timestamp: Date.now(),
      });
    },
    [enableToasts, analytics, story.id],
  );

  // Process toast queue
  useEffect(() => {
    if (toastQueue.length > 0 && !currentToast?.open) {
      const nextToast = toastQueue[0];
      setCurrentToast({
        open: true,
        message: nextToast.message,
        severity: nextToast.severity,
      });

      // Remove from queue after showing
      setTimeout(() => {
        setToastQueue((prev) => prev.slice(1));
        setCurrentToast((prev) => (prev ? { ...prev, open: false } : null));
      }, nextToast.duration);
    }
  }, [toastQueue, currentToast]);

  // Show initial load toast
  useEffect(() => {
    if (enableToasts) {
      showToast(`📖 ${story.name} loaded`, 'success', 2000);
    }
  }, [story.id, story.name, showToast, enableToasts]);

  // Enhanced callbacks with toasts
  const handleScrollProgress = useCallback(
    (progress: number) => {
      onScrollProgress?.(progress);

      // Show milestone toasts
      if (progress >= 0.25 && progress < 0.26) {
        showToast('25% through the story', 'info', 1500);
      } else if (progress >= 0.5 && progress < 0.51) {
        showToast('Halfway there! 🎉', 'success', 1500);
      } else if (progress >= 0.75 && progress < 0.76) {
        showToast('Almost done! 📚', 'info', 1500);
      } else if (progress >= 0.99) {
        showToast('Story complete! ✨', 'success', 2500);
      }
    },
    [onScrollProgress, showToast],
  );

  const handleAnimationEnter = useCallback(
    (elementId: string) => {
      onAnimationEnter?.(elementId);
      // Optional: show toast for important animations
      // showToast(`Animation triggered: ${elementId}`'info', 1000);
    },
    [onAnimationEnter],
  );

  const handleAnimationExit = useCallback(
    (elementId: string) => {
      onAnimationExit?.(elementId);
    },
    [onAnimationExit],
  );

  const handleTriggerActivate = useCallback(
    (triggerId: string) => {
      onTriggerActivate?.(triggerId);
      showToast('🎬 Scroll trigger activated', 'info', 1500);
    },
    [onTriggerActivate, showToast],
  );

  // Close toast handler
  const handleCloseToast = useCallback(() => {
    setCurrentToast((prev) => (prev ? { ...prev, open: false } : null));
  }, []);

  return (
    <>
      <ScrollStory
        story={story}
        onScrollProgress={handleScrollProgress}
        onAnimationEnter={handleAnimationEnter}
        onAnimationExit={handleAnimationExit}
        onTriggerActivate={handleTriggerActivate}
        enableParallax={enableParallax}
        enableKeyboardNav={enableKeyboardNav}
        preloadMedia={preloadMedia}
        autoPlayVideos={autoPlayVideos}
      >
        {children}
      </ScrollStory>

      {/* Toast Notifications */}
      {enableToasts && currentToast && (
        <Snackbar
          open={currentToast.open}
          autoHideDuration={3000}
          onClose={handleCloseToast}
          anchorOrigin={{
            vertical: toastPosition,
            horizontal: 'center'}}
          sx={{
            '& .MuiSnackbar-root': {
              bottom: toastPosition === 'bottom' ? 24 : 'auto',
              top: toastPosition === 'top' ? 24 : 'auto',
            }}}
        >
          <Alert
            onClose={handleCloseToast}
            severity={currentToast.severity}
            variant="filled"
            sx={{
              width: '100%',
              minWidth: 300,
              boxShadow: 3,
              '& .MuiAlert-message': {
                fontSize: '0.95rem',
                fontWeight: 500,
              },
            }}
          >
            {currentToast.message}
          </Alert>
        </Snackbar>
      )}
    </>
  );
}

// Export both versions for flexibility
export { ScrollStory as ScrollStoryBasic };
