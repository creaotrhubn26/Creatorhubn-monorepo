/**
 * useMotionPreference Hook
 * Detects and responds to user's motion preference based on WCAG 2.1
 * Implements Success Criterion 2.3.3
 */

import { useState, useEffect } from 'react';

export interface MotionPreferenceOptions {
  respectSystemPreference?: boolean;
  defaultPreference?: boolean;
}

/**
 * Hook to detect and manage motion preferences for accessibility
 * Respects prefers-reduced-motion system setting
 */
export const useMotionPreference = (options: MotionPreferenceOptions = {}) => {
  const {
    respectSystemPreference = true,
    defaultPreference = false
  } = options;

  const [prefersReducedMotion, setPrefersReducedMotion] = useState<boolean>(defaultPreference);
  const [isSupported, setIsSupported] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !respectSystemPreference) {
      return;
    }

    try {
      const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      setIsSupported(true);
      setPrefersReducedMotion(mediaQuery.matches);

      const handleChange = (e: MediaQueryListEvent | MediaQueryList) => {
        setPrefersReducedMotion(e.matches);
      };

      // Use modern API if available, fallback to deprecated method
      if (mediaQuery.addEventListener) {
        mediaQuery.addEventListener('change', handleChange);
        return () => mediaQuery.removeEventListener('change', handleChange);
      } else if (mediaQuery.addListener) {
        mediaQuery.addListener(handleChange);
        return () => mediaQuery.removeListener(handleChange);
      }
    } catch (error) {
      console.warn('Motion preference detection not supported:', error);
      setIsSupported(false);
      setPrefersReducedMotion(defaultPreference);
    }
  }, [respectSystemPreference, defaultPreference]);

  /**
   * Get duration adjusted for motion preference
   * Returns 0 if reduced motion is preferred
   */
  const getDuration = (baseDuration: number): number => {
    return prefersReducedMotion ? 0 : baseDuration;
  };

  /**
   * Check if animations should be played
   */
  const shouldAnimate = (): boolean => {
    return !prefersReducedMotion;
  };

  /**
   * Get transition CSS with accessibility consideration
   */
  const getTransition = (property: string, duration: number, easing: string = 'ease'): string => {
    const adjustedDuration = getDuration(duration);
    return adjustedDuration > 0 ? `${property} ${adjustedDuration}ms ${easing}` : 'none';
  };

  /**
   * Get animation CSS with accessibility consideration
   */
  const getAnimation = (name: string, duration: number, ...rest: string[]): string => {
    const adjustedDuration = getDuration(duration);
    return adjustedDuration > 0 ? `${name} ${adjustedDuration}ms ${rest.join(' ')}` : 'none';
  };

  return {
    prefersReducedMotion,
    isSupported,
    getDuration,
    shouldAnimate,
    getTransition,
    getAnimation
  };
};

export default useMotionPreference;














