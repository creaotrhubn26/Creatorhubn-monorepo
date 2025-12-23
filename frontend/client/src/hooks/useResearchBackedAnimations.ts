/**
 * useResearchBackedAnimations Hook
 * Provides research-backed animation utilities for visual editor components
 * Based on Material Design, Apple HIG, and WCAG 2.1 standards
 */

import { useMotionPreference } from './useMotionPreference';
import { RESEARCH_BASED_EASING, RESEARCH_BASED_DURATIONS } from '../utils/animationManager';

// Research-backed animation timing constants
export const UI_ANIMATIONS = {
  // Micro-interactions (<200ms) - Instant feedback
  iconButton: {
    duration: RESEARCH_BASED_DURATIONS.fast, // 100ms
    easing: RESEARCH_BASED_EASING.sharp,
    hoverScale: 1.05,
    activeScale: 0.95
  },
  
  // Standard transitions (200ms) - UI elements
  tooltip: {
    duration: RESEARCH_BASED_DURATIONS.normal, // 200ms
    easing: RESEARCH_BASED_EASING.standard,
    enterDelay: 150
  },
  
  // Menu/dropdown transitions (200-250ms) - Deceleration
  menu: {
    duration: RESEARCH_BASED_DURATIONS.normal, // 200ms
    easing: RESEARCH_BASED_EASING.deceleration
  },
  
  // Panel transitions (250-300ms) - Slide animations
  panel: {
    duration: 250,
    easing: RESEARCH_BASED_EASING.deceleration,
    distance: '100%'
  },
  
  // Modal/dialog transitions (300ms) - Moderate
  modal: {
    duration: RESEARCH_BASED_DURATIONS.moderate, // 300ms
    easing: RESEARCH_BASED_EASING.standard,
    backdropDuration: 250
  },
  
  // Canvas interactions (300ms) - Smooth
  canvas: {
    zoom: {
      duration: RESEARCH_BASED_DURATIONS.moderate, // 300ms
      easing: RESEARCH_BASED_EASING.smooth
    },
    select: {
      duration: RESEARCH_BASED_DURATIONS.fast, // 100ms
      easing: RESEARCH_BASED_EASING.sharp
    }
  },
  
  // Property changes (150ms) - Fast feedback
  property: {
    duration: 150,
    easing: RESEARCH_BASED_EASING.standard
  },
  
  // Card/list item animations
  card: {
    hover: {
      duration: RESEARCH_BASED_DURATIONS.normal, // 200ms
      easing: RESEARCH_BASED_EASING.deceleration,
      liftDistance: '-4px',
      shadowIntensity: '0 8px 16px rgba(0,0,0,0.15)'
    }
  },
  
  // Toast/notification animations
  toast: {
    entrance: {
      duration: RESEARCH_BASED_DURATIONS.moderate, // 300ms
      easing: RESEARCH_BASED_EASING.deceleration
    },
    exit: {
      duration: RESEARCH_BASED_DURATIONS.normal, // 200ms
      easing: RESEARCH_BASED_EASING.acceleration
    },
    autoHideDuration: 4000 // WCAG recommendation
  },
  
  // Focus ring (accessibility)
  focus: {
    duration: 150,
    easing: RESEARCH_BASED_EASING.standard,
    outlineWidth: '2px',
    outlineOffset: '2px'
  }
};

/**
 * Hook for research-backed UI animations
 */
export const useResearchBackedAnimations = () => {
  const { getTransition, shouldAnimate, getDuration } = useMotionPreference();

  /**
   * Get icon button animation styles
   */
  const getIconButtonStyles = () => ({
    transition: getTransition('all', UI_ANIMATIONS.iconButton.duration, UI_ANIMATIONS.iconButton.easing),
    '&:hover:not(:disabled)': {
      bgcolor: 'action.hover',
      transform: shouldAnimate() ? 'translateY(-1px)' : 'none'
    },
    '&:active:not(:disabled)': {
      transform: shouldAnimate() ? `scale(${UI_ANIMATIONS.iconButton.activeScale})` : 'none'
    }
  });

  /**
   * Get tooltip props with accessibility
   */
  const getTooltipProps = () => ({
    enterDelay: shouldAnimate() ? UI_ANIMATIONS.tooltip.enterDelay : 0,
    TransitionProps: {
      timeout: shouldAnimate() ? UI_ANIMATIONS.tooltip.duration : 0
    }
  });

  /**
   * Get menu animation props
   */
  const getMenuProps = () => ({
    TransitionProps: {
      timeout: shouldAnimate() ? UI_ANIMATIONS.menu.duration : 0
    },
    slotProps: {
      paper: {
        sx: {
          transition: shouldAnimate() 
            ? `opacity ${UI_ANIMATIONS.menu.duration}ms ${UI_ANIMATIONS.menu.easing}, transform ${UI_ANIMATIONS.menu.duration}ms ${UI_ANIMATIONS.menu.easing}`
            : 'none'
        }
      }
    }
  });

  /**
   * Get panel slide animation styles
   */
  const getPanelSlideStyles = (direction: 'left' | 'right' | 'top' | 'bottom' = 'right') => {
    const transforms = {
      left: 'translateX(-100%)',
      right: 'translateX(100%)',
      top: 'translateY(-100%)',
      bottom: 'translateY(100%)'
    };

    return {
      transition: getTransition('transform', UI_ANIMATIONS.panel.duration, UI_ANIMATIONS.panel.easing),
      transform: transforms[direction]
    };
  };

  /**
   * Get modal animation props
   */
  const getModalProps = () => ({
    TransitionProps: {
      timeout: shouldAnimate() ? UI_ANIMATIONS.modal.duration : 0
    },
    slotProps: {
      backdrop: {
        timeout: shouldAnimate() ? UI_ANIMATIONS.modal.backdropDuration : 0
      }
    }
  });

  /**
   * Get card hover styles
   */
  const getCardHoverStyles = () => ({
    transition: getTransition('all', UI_ANIMATIONS.card.hover.duration, UI_ANIMATIONS.card.hover.easing),
    '&:hover': {
      transform: shouldAnimate() ? `translateY(${UI_ANIMATIONS.card.hover.liftDistance})` : 'none',
      boxShadow: shouldAnimate() ? UI_ANIMATIONS.card.hover.shadowIntensity : 'none'
    }
  });

  /**
   * Get button press animation
   */
  const getButtonPressStyles = () => ({
    transition: getTransition('all', UI_ANIMATIONS.iconButton.duration, UI_ANIMATIONS.iconButton.easing),
    '&:active': {
      transform: shouldAnimate() ? `scale(${UI_ANIMATIONS.iconButton.activeScale})` : 'none'
    }
  });

  /**
   * Get focus ring styles (accessibility)
   */
  const getFocusStyles = () => ({
    transition: getTransition('outline', UI_ANIMATIONS.focus.duration, UI_ANIMATIONS.focus.easing),
    '&:focus-visible': {
      outline: `${UI_ANIMATIONS.focus.outlineWidth} solid`,
      outlineColor: 'primary.main',
      outlineOffset: UI_ANIMATIONS.focus.outlineOffset
    }
  });

  /**
   * Get canvas element selection styles
   */
  const getCanvasSelectStyles = () => ({
    transition: getTransition('all', UI_ANIMATIONS.canvas.select.duration, UI_ANIMATIONS.canvas.select.easing),
    '&.selected': {
      outline: '2px solid',
      outlineColor: 'primary.main',
      outlineOffset: '2px'
    }
  });

  /**
   * Get staggered animation delay
   * For list items, use 50ms delay between each item (Material Design recommendation)
   */
  const getStaggerDelay = (index: number, baseDelay: number = 50) => {
    return shouldAnimate() ? index * baseDelay : 0;
  };

  /**
   * Get property change animation
   */
  const getPropertyChangeStyles = () => ({
    transition: getTransition('all', UI_ANIMATIONS.property.duration, UI_ANIMATIONS.property.easing)
  });

  return {
    // Animation constants
    UI_ANIMATIONS,
    
    // Style generators
    getIconButtonStyles,
    getTooltipProps,
    getMenuProps,
    getPanelSlideStyles,
    getModalProps,
    getCardHoverStyles,
    getButtonPressStyles,
    getFocusStyles,
    getCanvasSelectStyles,
    getPropertyChangeStyles,
    getStaggerDelay,
    
    // Utilities
    getTransition,
    shouldAnimate,
    getDuration,
    
    // Direct access to easing/durations
    EASING: RESEARCH_BASED_EASING,
    DURATIONS: RESEARCH_BASED_DURATIONS
  };
};

export default useResearchBackedAnimations;














