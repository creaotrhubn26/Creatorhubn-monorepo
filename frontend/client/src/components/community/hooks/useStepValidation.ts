/**
 * useStepValidation Hook
 * 
 * Validates step completion before allowing progression
 */

import { useCallback } from 'react';

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  content_type: 'text' | 'video' | 'image' | 'checklist';
  content: any;
  position: number;
  is_required: boolean;
}

interface ValidationResult {
  isValid: boolean;
  error?: string;
}

export const useStepValidation = () => {
  const validateStep = useCallback((step: OnboardingStep, stepData?: any): ValidationResult => {
    // Check if step is required
    if (step.is_required) {
      switch (step.content_type) {
        case 'video':
          // For video steps, we might want to check if video was watched
          // This would require tracking video watch time
          // For now, we'll just check if step data exists
          if (!stepData || !stepData.watched) {
            return {
              isValid: false,
              error: 'Du må se videoen før du kan fortsette',
            };
          }
          break;

        case 'checklist':
          // For checklist steps, check if all items are checked
          if (!stepData || !stepData.checkedItems) {
            return {
              isValid: false,
              error: 'Du må fullføre alle punkter i listen',
            };
          }
          const allChecked = step.content.items?.every((item: string, index: number) =>
            stepData.checkedItems?.includes(index)
          );
          if (!allChecked) {
            return {
              isValid: false,
              error: 'Du må fullføre alle punkter i listen',
            };
          }
          break;

        case 'text':
        case 'image':
        default:
          // For text and image steps, just check if step was viewed
          // This is a basic validation - you might want to add more specific checks
          break;
      }
    }

    return { isValid: true };
  }, []);

  const canProceed = useCallback(
    (step: OnboardingStep, stepData?: any): boolean => {
      const validation = validateStep(step, stepData);
      return validation.isValid;
    },
    [validateStep]
  );

  return {
    validateStep,
    canProceed,
  };
};

export default useStepValidation;

