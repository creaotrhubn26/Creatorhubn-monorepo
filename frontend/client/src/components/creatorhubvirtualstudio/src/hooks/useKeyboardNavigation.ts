/**
 * useKeyboardNavigation Hook
 * 
 * Hook for keyboard navigation support
 */

import { useEffect, useCallback, useRef } from 'react';
import { getFocusableElements, trapFocus } from '../utils/accessibility';

export interface UseKeyboardNavigationOptions {
  containerRef: React.RefObject<HTMLElement>;
  enabled?: boolean;
  trapFocus?: boolean;
  onEscape?: () => void;
  onEnter?: () => void;
  onArrowUp?: () => void;
  onArrowDown?: () => void;
  onArrowLeft?: () => void;
  onArrowRight?: () => void;
}

export function useKeyboardNavigation({
  containerRef,
  enabled = true,
  trapFocus: shouldTrapFocus = false,
  onEscape,
  onEnter,
  onArrowUp,
  onArrowDown,
  onArrowLeft,
  onArrowRight,
}: UseKeyboardNavigationOptions) {
  const trapFocusCleanup = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!enabled || !containerRef.current) return;

    if (shouldTrapFocus) {
      trapFocusCleanup.current = trapFocus(containerRef.current);
    }

    return () => {
      if (trapFocusCleanup.current) {
        trapFocusCleanup.current();
      }
    };
  }, [enabled, shouldTrapFocus, containerRef]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!enabled) return;

      switch (e.key) {
        case 'Escape':
          onEscape?.();
          break;
        case 'Enter':
          if (e.target instanceof HTMLElement && e.target.tagName !== 'BUTTON') {
            onEnter?.();
          }
          break;
        case 'ArrowUp':
          e.preventDefault();
          onArrowUp?.();
          break;
        case 'ArrowDown':
          e.preventDefault();
          onArrowDown?.();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          onArrowLeft?.();
          break;
        case 'ArrowRight':
          e.preventDefault();
          onArrowRight?.();
          break;
      }
    },
    [enabled, onEscape, onEnter, onArrowUp, onArrowDown, onArrowLeft, onArrowRight]
  );

  useEffect(() => {
    if (!enabled) return;

    const container = containerRef.current;
    if (!container) return;

    container.addEventListener('keydown', handleKeyDown as EventListener);

    return () => {
      container.removeEventListener('keydown', handleKeyDown as EventListener);
    };
  }, [enabled, containerRef, handleKeyDown]);

  const focusFirst = useCallback(() => {
    if (!containerRef.current) return;
    const focusableElements = getFocusableElements(containerRef.current);
    focusableElements[0]?.focus();
  }, [containerRef]);

  const focusLast = useCallback(() => {
    if (!containerRef.current) return;
    const focusableElements = getFocusableElements(containerRef.current);
    focusableElements[focusableElements.length - 1]?.focus();
  }, [containerRef]);

  return {
    focusFirst,
    focusLast,
  };
}


