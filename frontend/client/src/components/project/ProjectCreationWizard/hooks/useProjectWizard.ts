// @ts-nocheck
import React from "react";
// useProjectWizard - Wizard state machine for project creation flow
import { useState, useCallback, useMemo } from 'react';
import type { WizardStep, WizardState, WizardActions } from '../types/project';

const STEPS = [
  'basic-info',
  'project-type',
  'location',
  'shot-list',
  'memory-cards',
  'backup',
  'collaborators',
  'worklog',
  'preview',
  'confirm',
] as const;

type WizardStep = (typeof STEPS)[number];

export function useProjectWizard(initialStep: string = 'basic-info') {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<string[]>([]);

  const currentStep = STEPS[currentStepIndex];

  const canGoNext = useMemo(() => currentStepIndex < STEPS.length - 1, [currentStepIndex]);
  const canGoBack = useMemo(() => currentStepIndex > 0, [currentStepIndex]);

  const goToStep = (step: string) => {
    const index = ['basic-info', 'project-type', 'location', 'shot-list', 'memory-cards', 'backup', 'collaborators', 'worklog', 'preview', 'confirm'].indexOf(step);
    if (index !== -1) {
      setCurrentStepIndex(index);
    }
  };

  const nextStep = () => {
    if (currentStepIndex < 9) {
      setCompletedSteps(prev => [...prev, STEPS[currentStepIndex]]);
      setCurrentStepIndex(prev => prev + 1);
    }
  };

  const previousStep = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(prev => prev - 1);
    }
  };

  const completeWizard = async () => {
    // Final validation and submission would happen here
    console.log('Wizard completed');
  };

  const canProceed = () => {
    // Validation logic for current step
    return true;
  };

  return {
    currentStep,
    currentStepIndex,
    completedSteps,
    canGoNext,
    canGoBack,
    goToStep,
    nextStep,
    previousStep,
    completeWizard,
    canProceed,
    steps: ['basic-info', 'project-type', 'location', 'shot-list', 'memory-cards', 'backup', 'collaborators', 'worklog', 'preview', 'confirm'],
  };
}