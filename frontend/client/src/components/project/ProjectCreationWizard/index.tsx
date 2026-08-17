// @ts-nocheck
import React from "react";
// ProjectCreationWizard - Main orchestrator component
import { useState, useEffect, useCallback, useMemo } from 'react';
import { Box, Stack, Typography, Button, Alert, CircularProgress } from '@mui/material';
import { Folder, CloudUpload } from '@mui/icons-material';
import { useProjectData } from './hooks/useProjectData';
import { useProjectWizard } from './hooks/useProjectWizard';
import { WizardStepper } from './components/WizardStepper';
import { BasicInfoStep } from './steps/BasicInfoStep';
import { ProjectTypeStep } from './steps/ProjectTypeStep';
import { LocationStep } from './steps/LocationStep';
import { ShotListStep } from './steps/ShotListStep';
import { MemoryCardStep } from './steps/MemoryCardStep';
import { BackupStep } from './steps/BackupStep';
import { CollaboratorsStep } from './steps/CollaboratorsStep';
import { WorklogStep } from './steps/WorklogStep';
import { PreviewStep } from './steps/PreviewStep';
import { ConfirmStep } from './steps/ConfirmStep';
import { PROJECT_TYPES, getDefaultProjectType, getProjectTimeEstimate, getDefaultPricing, generatePinFromProjectName } from '../constants/project';
import { useProjectData as useProjectDataHook } from './hooks/useProjectData';

interface ProjectCreationWizardProps {
  profession: string;
  userId?: string;
  onProjectCreated?: (projectData: any) => void;
  initialData?: any;
  evendiCoupleId?: string;
  onMeetingCreate?: (meeting: Record<string, unknown>) => void;
  onProjectUpdate?: (project: any) => void;
  onWorklogCreate?: (worklog: any) => void;
  selectedProject?: { id: string; [key: string]: unknown };
  onProjectSelect?: (project: any) => void;
  onOpenEventManagement?: (eventData: Record<string, unknown>) => void;
  onGoToTab?: (tabName: string) => void;
}

export function ProjectCreationWizard({
  profession,
  userId,
  onProjectCreated,
  initialData,
  evendiCoupleId,
  onMeetingCreate,
  onProjectUpdate,
  onWorklogCreate,
  selectedProject,
  onProjectSelect,
  onOpenEventManagement,
  onGoToTab,
}: ProjectCreationWizardProps) {
  // Use the refactored hooks
  const { projectData, updateProjectData, projectTypeDetails, generatePin } = useProjectDataHook({
    profession,
    initialData,
    projectType: '',
    userProfession: profession,
    isMusicProducer: profession === 'music_producer',
  });

  const wizard = useProjectWizard();

  // Map wizard steps to step components
  const stepComponents = useMemo(() => ({
    'basic-info': () => <BasicInfoStep projectData={projectData} updateProjectData={updateProjectData} onNext={wizard.nextStep} onBack={wizard.previousStep} canProceed={!!projectData.projectName && !!projectData.clientName} projectTypeDetails={undefined} />,
    'project-type': () => <ProjectTypeStep projectData={projectData} updateProjectData={updateProjectData} dynamicProjectTypes={[]} trackUsage={() => {}} onNext={wizard.nextStep} onBack={wizard.previousStep} canProceed={!!projectData.projectType} />,
    'location': () => <LocationStep projectData={projectData} updateProjectData={updateProjectData} onNext={wizard.nextStep} onBack={wizard.previousStep} canProceed={!!projectData.location} locationSuggestions={[]} locationLoading={false} selectedLocation={null} handleLocationSearch={() => {}} handleLocationSelect={() => {}} />,
    'shot-list': () => <ShotListStep projectData={projectData} updateProjectData={updateProjectData} shotList={[]} onShotCreate={() => {}} onShotUpdate={() => {}} onShotDelete={() => {}} onNext={wizard.nextStep} onBack={wizard.previousStep} canProceed={true} />,
    'memory-cards': () => <MemoryCardStep projectData={projectData} updateProjectData={updateProjectData} onNext={wizard.nextStep} onBack={wizard.previousStep} canProceed={true} selectedMemoryCards={[]} enhancedMemoryCardSelection={null} memoryCardRecommendation={null} />,
    'backup': () => <BackupStep projectData={projectData} updateProjectData={updateProjectData} onNext={wizard.nextStep} onBack={wizard.previousStep} canProceed={true} />,
    'collaborators': () => <CollaboratorsStep projectData={projectData} updateProjectData={updateProjectData} collaborators={[]} onNext={wizard.nextStep} onBack={wizard.previousStep} canProceed={true} />,
    'worklog': () => <WorklogStep projectData={projectData} updateProjectData={updateProjectData} onNext={wizard.nextStep} onBack={wizard.previousStep} canProceed={true} worklogFormData={null} setWorklogFormData={() => {}} PROJECT_PHASES={[]} userProfession="" handleWorklogSubmit={() => {}} setShowWorklogTipsDialog={() => {}} />,
    'preview': () => <PreviewStep projectData={projectData} projectTypeDetails={undefined} getProfessionDisplayName={() => ''} getProfessionIcon={() => null} generatePin={() => ''} onNext={wizard.nextStep} onBack={wizard.previousStep} canProceed={true} />,
    'confirm': () => <ConfirmStep projectData={projectData} projectTypeDetails={undefined} generatePin={() => ''} onCreate={() => {}} onBack={wizard.previousStep} isCreating={false} />,
  }), []);

  const currentStepComponent = stepComponents[wizard.currentStep];

  return (
    <Box sx={{ p: { xs: 2, sm: 3, md: 4 }, maxWidth: '1000px', mx: 'auto' }}>
      <Box sx={{ mb: 3 }}>
        <WizardStepper onPhaseChange={(phase) => {}} currentPhase={wizard.currentStep} />
      </Box>

      <Box sx={{ mt: 3 }}>
        {currentStepComponent}
      </Box>
    </Box>
  );
}

export default ProjectCreationWizard;