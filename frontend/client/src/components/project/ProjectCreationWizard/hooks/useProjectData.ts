// @ts-nocheck
import React from "react";
// useProjectData - Manages project state with normalization and validation
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import type { ProjectData, ProjectInitialData, ShotListItem, ProjectInitialData as ProjectInitialDataType } from '../types/project';
import { PROJECT_TYPES, getDefaultProjectType, getProjectTimeEstimate, getDefaultPricing, generatePinFromProjectName } from '../constants/project';

interface UseProjectDataProps {
  profession: string;
  initialData?: ProjectInitialData;
  projectType?: string;
  userProfession: string;
  isMusicProducer: boolean;
}

interface UseProjectDataReturn {
  projectData: ProjectData;
  setProjectData: React.Dispatch<React.SetStateAction<ProjectData>>;
  updateProjectData: (updates: Partial<ProjectData>) => void;
  projectTypeDetails: { nextSteps: string; description: string; timeEstimate: number; pricing: number; pin: string } | undefined;
  generatePin: (name: string) => string;
}

export function useProjectData({
  profession,
  initialData,
  projectType,
  userProfession,
  isMusicProducer,
}: UseProjectDataProps): UseProjectDataReturn {
  const isReal = projectType && projectType !== 'sample';

  const initialProjectData = useMemo(() => {
    const base = {
      projectName: initialData?.projectName || '',
      clientName: initialData?.clientName || '',
      clientEmail: initialData?.clientEmail || '',
      clientPhone: initialData?.clientPhone || '',
      eventDate: initialData?.eventDate || '',
      eventDates: (initialData?.eventDates as Record<number, string>) || ({} as Record<number, string>),
      location: initialData?.location || '',
      projectType: initialData?.projectType || getDefaultProjectType(userProfession),
      eventType: 'wedding' as string,
      eventCategory: 'personal' as string,
      weddingCulture: 'norsk',
      totalDays: 1,
      activeDays: [1],
      memoryCardConfigs: [] as any[],
      selectedMemoryCards: [] as any[],
      selectedCameras: [] as Array<{ name: string; brand: string; model?: string }>,
      enhancedMemoryCardSelection: null as any,
      memoryCardBudget: 'mid' as 'budget' | 'mid' | 'premium' | 'professional',
      editingSoftware: '',
      driveIntegration: true,
      meetingOption: 'none',
      meetingTime: '10:00',
      meetingDuration: 60,
      saveAsDefault: false,
      description: initialData?.description || '',
      venue: initialData?.venue || '',
      guestCount: initialData?.guestCount || '',
      primaryCamera: '',
      backupCamera: '',
      estimatedPhotos: '',
      fileFormat: 'raw+jpeg',
      equipmentNotes: '',
      backupStrategy: 'automatic',
      backupFrequency: 'realtime',
      shotList: [] as any[],
      phaseHistory: [] as any[],
      currentPhase: 'pre-planning' as string,
      davinciIntegrationEnabled: false,
      cameraBrand: '' as string,
      logFormat: '' as string,
      memoryCardLabeling: '' as string,
      collaborators: [] as any[],
      enableSplitSheet: false,
      detectedLogFormats: [] as string[],
      createWeddingTimeline: false,
      weddingTimelineShared: false,
      weddingTimelineUrl: '' as string,
      packageId: '' as string,
      budget: initialData?.budget || '',
      estimatedHours: initialData?.estimatedHours || '',
    };
    return base;
  }, [initialData, userProfession]);

  const [projectData, setProjectData] = useState<ProjectData>(initialProjectData);

  const updateProjectData = useCallback((updates: Partial<ProjectData>) => {
    setProjectData(prev => ({ ...prev, ...updates }));
  }, []);

  // Project type details query
  const { data: projectTypeDetails } = useQuery({
    queryKey: ['projectTypeDetails', projectType, userProfession],
    queryFn: async () => {
      const { getProjectTypeNextSteps, getProjectTypeInitialDescription } = await import('../../../../utils/project-worklog-helpers');
      const { getProjectTimeEstimate: getTimeEstimate, getDefaultPricing: getPricing } = await import('../constants/project');
      const { generatePinFromProjectName } = await import('../constants/project');
      const nextSteps = getProjectTypeNextSteps(projectData.projectType, userProfession);
      const description = getProjectTypeInitialDescription(projectData.projectType, projectData.clientName || '', projectData.eventDate || '');
      const timeEstimate = getTimeEstimate(projectData.projectType, userProfession);
      const pricing = getDefaultPricing(userProfession);
      const pin = generatePinFromProjectName(projectData.projectName);
      return { nextSteps, description, timeEstimate, pricing, pin };
    },
    enabled: !!projectData?.projectType,
  });

  const generatePin = useCallback((name: string) => {
    if (!name) return '';
    const cleanName = name.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!cleanName || cleanName.length === 0) return '0000';
    let hash = 0;
    for (let i = 0; i < cleanName.length; i++) {
      const char = cleanName.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString().slice(-4).padStart(4, '0');
  }, []);

  return {
    projectData,
    setProjectData,
    updateProjectData,
    projectTypeDetails,
    generatePin,
  };
}