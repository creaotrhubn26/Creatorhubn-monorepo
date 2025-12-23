/**
 * useElementAnimations Hook
 * Provides animation system for user-created elements with smart recommendations
 * Based on element type, context, and UX research
 */

import { useCallback, useMemo } from 'react';
import { useAnimation } from './useAnimation';
import { useMotionPreference } from './useMotionPreference';
import { RESEARCH_BASED_EASING, RESEARCH_BASED_DURATIONS } from '../utils/animationManager';
import type { Animation } from '../utils/animationManager';

export type ElementType = 'button' | 'text' | 'image' | 'card' | 'container' | 'grid' | 'audio' | 'video' | 'modal' | 'tooltip' | 'notification';
export type AnimationContext = 'entrance' | 'exit' | 'emphasis' | 'interaction' | 'transition';
export type InteractionTrigger = 'hover' | 'click' | 'focus' | 'scroll' | 'load';

interface AnimationRecommendation {
  animationId: string;
  name: string;
  description: string;
  reason: string;
  confidence: number; // 0-1
  category: 'entrance' | 'exit' | 'emphasis' | 'interaction';
  preview?: string;
}

/**
 * Smart animation recommendations based on element type and context
 */
const ELEMENT_ANIMATION_MAP: Record<ElementType, Record<AnimationContext, string[]>> = {
  button: {
    entrance: ['fade-in', 'scale-in'],
    exit: ['fade-out', 'scale-out'],
    emphasis: ['pulse', 'button-press'],
    interaction: ['button-press', 'hover-lift', 'ripple'],
    transition: ['fade-in', 'fade-out']
  },
  text: {
    entrance: ['fade-in', 'slide-in-bottom'],
    exit: ['fade-out'],
    emphasis: ['highlight-flash'],
    interaction: ['fade-in'],
    transition: ['fade-in', 'fade-out']
  },
  image: {
    entrance: ['fade-in', 'zoom-in', 'scale-in'],
    exit: ['fade-out', 'scale-out'],
    emphasis: ['glow', 'hover-lift'],
    interaction: ['hover-lift', 'zoom-in'],
    transition: ['fade-in', 'zoom-in']
  },
  card: {
    entrance: ['fade-in', 'slide-in-bottom', 'scale-in'],
    exit: ['fade-out', 'slide-out-bottom'],
    emphasis: ['hover-lift', 'glow'],
    interaction: ['hover-lift'],
    transition: ['fade-in', 'slide-in-bottom']
  },
  container: {
    entrance: ['fade-in', 'slide-in-bottom'],
    exit: ['fade-out', 'collapse'],
    emphasis: [],
    interaction: [],
    transition: ['fade-in']
  },
  grid: {
    entrance: ['fade-in'], // Items can be staggered
    exit: ['fade-out'],
    emphasis: [],
    interaction: [],
    transition: ['fade-in']
  },
  audio: {
    entrance: ['fade-in', 'slide-in-bottom'],
    exit: ['fade-out', 'slide-out-bottom'],
    emphasis: ['pulse'],
    interaction: ['button-press'],
    transition: ['fade-in']
  },
  video: {
    entrance: ['fade-in', 'zoom-in'],
    exit: ['fade-out', 'zoom-in'],
    emphasis: [],
    interaction: ['hover-lift'],
    transition: ['fade-in', 'zoom-in']
  },
  modal: {
    entrance: ['fade-in', 'scale-in', 'slide-in-top'],
    exit: ['fade-out', 'scale-out', 'slide-out-top'],
    emphasis: [],
    interaction: [],
    transition: ['fade-in', 'scale-in']
  },
  tooltip: {
    entrance: ['fade-in'],
    exit: ['fade-out'],
    emphasis: [],
    interaction: [],
    transition: ['fade-in']
  },
  notification: {
    entrance: ['slide-in-top', 'slide-in-bottom', 'fade-in'],
    exit: ['slide-out-top', 'slide-out-bottom', 'fade-out'],
    emphasis: ['shake', 'attention-seeker'],
    interaction: [],
    transition: ['slide-in-top']
  }
};

/**
 * Hook for element-level animations with smart recommendations
 */
export const useElementAnimations = () => {
  const { animations, addAnimation, playAnimation } = useAnimation();
  const { shouldAnimate, getDuration } = useMotionPreference();

  /**
   * Get recommended animations for an element
   */
  const getRecommendations = useCallback((
    elementType: ElementType,
    context: AnimationContext,
    additionalCriteria?: {
      isImportant?: boolean;
      isSubtle?: boolean;
      performanceConstraint?: 'low' | 'medium' | 'high';
    }
  ): AnimationRecommendation[] => {
    const recommendedIds = ELEMENT_ANIMATION_MAP[elementType]?.[context] || [];
    
    const recommendations: AnimationRecommendation[] = recommendedIds
      .map(id => {
        const animation = animations.find(a => a.id === id);
        if (!animation) return null;

        let confidence = 0.8; // Base confidence
        let reason = `Recommended ${context} animation for ${elementType} elements`;

        // Adjust confidence based on research metadata
        if (animation.research) {
          const { performanceImpact, cognitiveLoad, accessibilityRating } = animation.research;
          
          // Performance considerations
          if (additionalCriteria?.performanceConstraint) {
            if (performanceImpact === additionalCriteria.performanceConstraint) {
              confidence += 0.1;
            } else if (
              (additionalCriteria.performanceConstraint === 'low' && performanceImpact !== 'low') ||
              (additionalCriteria.performanceConstraint === 'medium' && performanceImpact === 'high')
            ) {
              confidence -= 0.2;
            }
          }

          // Importance considerations
          if (additionalCriteria?.isImportant && cognitiveLoad === 'low') {
            confidence -= 0.1;
            reason += ' (Consider more prominent animation for important elements)';
          }

          // Subtlety considerations
          if (additionalCriteria?.isSubtle && cognitiveLoad === 'high') {
            confidence -= 0.15;
            reason += ' (May be too prominent for subtle elements)';
          }

          // Accessibility bonus
          if (accessibilityRating === 'AAA') {
            confidence += 0.05;
          }
        }

        return {
          animationId: animation.id,
          name: animation.name,
          description: animation.description,
          reason,
          confidence: Math.min(1, Math.max(0, confidence)),
          category: context as any,
          preview: animation.research?.useCase
        };
      })
      .filter((rec): rec is AnimationRecommendation => rec !== null)
      .sort((a, b) => b.confidence - a.confidence);

    return recommendations;
  }, [animations]);

  /**
   * Apply entrance animation to element
   */
  const applyEntranceAnimation = useCallback(async (
    elementId: string,
    elementType: ElementType,
    options?: {
      animationId?: string;
      delay?: number;
      customDuration?: number;
    }
  ) => {
    if (!shouldAnimate()) return;

    let animationId = options?.animationId;
    
    // Get smart recommendation if no specific animation provided
    if (!animationId) {
      const recommendations = getRecommendations(elementType, 'entrance');
      animationId = recommendations[0]?.animationId || 'fade-in';
    }

    const element = document.getElementById(elementId);
    if (!element) return;

    try {
      await playAnimation(animationId, element);
    } catch (error) {
      console.error('Failed to apply entrance animation:', error);
    }
  }, [shouldAnimate, getRecommendations, playAnimation]);

  /**
   * Apply exit animation to element
   */
  const applyExitAnimation = useCallback(async (
    elementId: string,
    elementType: ElementType,
    options?: {
      animationId?: string;
      onComplete?: () => void;
    }
  ) => {
    if (!shouldAnimate()) {
      options?.onComplete?.();
      return;
    }

    let animationId = options?.animationId;
    
    if (!animationId) {
      const recommendations = getRecommendations(elementType, 'exit');
      animationId = recommendations[0]?.animationId || 'fade-out';
    }

    const element = document.getElementById(elementId);
    if (!element) return;

    try {
      await playAnimation(animationId, element);
      options?.onComplete?.();
    } catch (error) {
      console.error('Failed to apply exit animation:', error);
      options?.onComplete?.();
    }
  }, [shouldAnimate, getRecommendations, playAnimation]);

  /**
   * Apply interaction animation
   */
  const applyInteractionAnimation = useCallback(async (
    elementId: string,
    elementType: ElementType,
    trigger: InteractionTrigger
  ) => {
    if (!shouldAnimate()) return;

    const recommendations = getRecommendations(elementType, 'interaction');
    const animationId = recommendations[0]?.animationId || 'button-press';

    const element = document.getElementById(elementId);
    if (!element) return;

    try {
      await playAnimation(animationId, element);
    } catch (error) {
      console.error('Failed to apply interaction animation:', error);
    }
  }, [shouldAnimate, getRecommendations, playAnimation]);

  /**
   * Get animation for specific scenario
   */
  const getAnimationForScenario = useCallback((scenario: {
    element: ElementType;
    context: AnimationContext;
    isUserInitiated?: boolean;
    isRepeated?: boolean;
    hasUserData?: boolean;
  }): string => {
    const recommendations = getRecommendations(scenario.element, scenario.context, {
      isImportant: scenario.hasUserData,
      isSubtle: scenario.isRepeated
    });

    return recommendations[0]?.animationId || 'fade-in';
  }, [getRecommendations]);

  /**
   * Create staggered entrance for multiple elements
   */
  const createStaggeredEntrance = useCallback((
    elementIds: string[],
    elementType: ElementType,
    staggerDelay: number = 50 // Material Design recommendation
  ) => {
    if (!shouldAnimate()) return;

    const recommendations = getRecommendations(elementType, 'entrance');
    const animationId = recommendations[0]?.animationId || 'fade-in';

    elementIds.forEach((id, index) => {
      setTimeout(() => {
        const element = document.getElementById(id);
        if (element) {
          playAnimation(animationId, element).catch(console.error);
        }
      }, index * staggerDelay);
    });
  }, [shouldAnimate, getRecommendations, playAnimation]);

  /**
   * Get CSS animation string with accessibility
   */
  const getAnimationCSS = useCallback((
    animationName: string,
    duration: number,
    easing: string = RESEARCH_BASED_EASING.standard,
    delay: number = 0
  ): string => {
    const adjustedDuration = getDuration(duration);
    if (adjustedDuration === 0) return 'none';
    
    return `${animationName} ${adjustedDuration}ms ${easing} ${delay}ms`;
  }, [getDuration]);

  /**
   * Validate animation choice for element
   */
  const validateAnimationChoice = useCallback((
    elementType: ElementType,
    animationId: string,
    context: AnimationContext
  ): {
    valid: boolean;
    warnings: string[];
    suggestions: string[];
  } => {
    const warnings: string[] = [];
    const suggestions: string[] = [];
    const validIds = ELEMENT_ANIMATION_MAP[elementType]?.[context] || [];
    const isValid = validIds.includes(animationId);

    if (!isValid) {
      warnings.push(`Animation "${animationId}" is not typically used for ${elementType} ${context}`);
      const recommendations = getRecommendations(elementType, context);
      if (recommendations.length > 0) {
        suggestions.push(`Consider using: ${recommendations.slice(0, 3).map(r => r.name).join(', ')}`);
      }
    }

    const animation = animations.find(a => a.id === animationId);
    if (animation) {
      // Check duration
      if (animation.duration > 500 && context === 'interaction') {
        warnings.push('Interaction animations should be < 500ms for better user experience');
      }

      // Check accessibility
      if (animation.research?.accessibilityRating === 'Needs Review') {
        warnings.push('This animation has accessibility concerns');
      }

      // Check performance
      if (animation.research?.performanceImpact === 'high') {
        warnings.push('This animation has high performance impact - use sparingly');
      }
    }

    return {
      valid: isValid,
      warnings,
      suggestions
    };
  }, [animations, getRecommendations]);

  return {
    // Recommendation system
    getRecommendations,
    getAnimationForScenario,
    validateAnimationChoice,
    
    // Application methods
    applyEntranceAnimation,
    applyExitAnimation,
    applyInteractionAnimation,
    createStaggeredEntrance,
    
    // Utilities
    getAnimationCSS,
    shouldAnimate,
    getDuration,
    
    // Constants
    ELEMENT_TYPES: Object.keys(ELEMENT_ANIMATION_MAP) as ElementType[],
    ANIMATION_CONTEXTS: ['entrance', 'exit', 'emphasis', 'interaction', 'transition'] as AnimationContext[]
  };
};

export default useElementAnimations;














