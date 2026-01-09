/**
 * useKeyboardNavigation Hook
 * 
 * Handles keyboard shortcuts for onboarding navigation
 */

import { useEffect, useCallback } from 'react';

interface UseKeyboardNavigationProps {
  activeStep: number;
  totalSteps: number;
  onNext: () => void;
  onPrevious: () => void;
  onComplete: () => void;
  onSkip: () => void;
  enabled?: boolean;
}

export const useKeyboardNavigation = ({
  activeStep,
  totalSteps,
  onNext,
  onPrevious,
  onComplete,
  onSkip,
  enabled = true,
}: UseKeyboardNavigationProps) => {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return;

      // Don't handle shortcuts when user is typing in an input
      const target = event.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      switch (event.key) {
        case 'ArrowRight':
        case 'ArrowDown':
          event.preventDefault();
          if (activeStep < totalSteps - 1) {
            onNext();
          } else if (activeStep === totalSteps - 1) {
            onComplete();
          }
          break;

        case 'ArrowLeft':
        case 'ArrowUp':
          event.preventDefault();
          if (activeStep > 0) {
            onPrevious();
          }
          break;

        case 'Enter':
          event.preventDefault();
          if (activeStep === totalSteps - 1) {
            onComplete();
          } else {
            onNext();
          }
          break;

        case 'Escape':
          event.preventDefault();
          onSkip();
          break;

        default:
          break;
      }
    },
    [activeStep, totalSteps, onNext, onPrevious, onComplete, onSkip, enabled]
  );

  useEffect(() => {
    if (!enabled) return;

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown, enabled]);
};

export default useKeyboardNavigation;

