// @ts-nocheck
import React from "react";
// ProjectCreationWizard Types
// Extracted from ProjectCreationWithMemoryCards.tsx for better organization

import type { ProjectData } from '../../contexts/ProjectContext';
import type { ShotListItem } from './shotlist';
import type { WorklogMutationData } from './worklog';

export interface ProjectCreationWithMemoryCardsProps {
  profession: string;
  userId?: string;
  onProjectCreated?: (projectData: ProjectData) => void;
  initialData?: ProjectInitialData;
  evendiCoupleId?: string;
  onMeetingCreate?: (meeting: Record<string, unknown>) => void;
  onProjectUpdate?: (project: ProjectData) => void;
  onWorklogCreate?: (worklog: WorklogMutationData) => void;
  selectedProject?: { id: string; [key: string]: unknown };
  onProjectSelect?: (project: ProjectData | { id: string; [key: string]: unknown }) => void;
  onOpenEventManagement?: (eventData: Record<string, unknown>) => void;
  onGoToTab?: (tabName: string) => void;
}

export interface ProjectInitialData {
  projectName?: string;
  clientName?: string;
  clientEmail?: string;
  clientPhone?: string;
  eventDate?: string;
  eventDates?: Record<number, string> | string[];
  description?: string;
  venue?: string;
  guestCount?: string;
  location?: string;
  projectType?: string;
  budget?: string;
  submissionId?: string;
}

export interface MemoryCardConfig {
  label: string;
  type: string;
  capacity: string;
  dayNumber: number;
  dayName: string;
  count?: number;
  estimatedPhotos?: number;
}

export interface MemoryCardSelectorConfig {
  capacity: string;
  count: number;
  estimatedPhotos: {
    raw: number;
    craw: number;
  };
}

export interface SelectedMemoryCard {
  type: string;
  capacity: string;
  brand?: string;
  model?: string;
  count?: number;
  estimatedPhotos?: number;
  price?: number;
}

export interface ShotListItem {
  id: string;
  scene: string;
  description: string;
  estimatedDuration?: number;
  priority?: string;
  shotType?: string;
  notes?: string;
  locationName?: string;
  locationLat?: number;
  locationLng?: number;
  locationNotes?: string;
  weatherTip?: string;
  travelFromVenue?: string;
  location?: { name?: string; lat?: number; lng?: number };
  imageUri?: string | null;
  scouted?: boolean;
}

export interface PhaseHistoryEntry {
  phase: string;
  timestamp: string;
  notes: string;
}

export interface ProjectCollaboratorEntry {
  id?: string;
  name: string;
  email: string;
  role: string;
  invitationStatus: string;
}

export interface LocationSuggestion {
  name?: string;
  address?: string;
  municipality?: string;
  type?: string;
  lat: number;
  lng: number;
  coordinates?: { lat: number; lng: number };
}

export interface ContactOption {
  displayName?: string;
  email?: string;
  phone?: string;
}

export interface VersionEntry {
  id: string;
  version: string;
  createdAt: string;
  description?: string;
  action?: string;
  timestamp?: string;
}

export interface VirtualStudioResult {
  sceneCount: number;
  cameraPathCount: number;
  renderCount: number;
  workTime: number;
  renderUrls?: string[];
  exportedFormats?: string[];
  updatedShots?: ShotListItem[];
  cameraSettings?: Record<string, unknown>;
  duration?: number;
  clipCount?: number;
  transitionCount?: number;
  usedAI?: boolean;
  aiConfidence?: number;
  videoUrl?: string;
  culturalMoments?: unknown[];
  appliedLUTs?: unknown[];
  exportSettings?: unknown[];
}

export interface ProjectToEditorData {
  projectId: string;
  projectName: string;
  clientName: string;
  clientEmail: string;
  projectType: string;
  weddingCulture: string;
  shotList: Array<{
    id: string;
    scene: string;
    description: string;
    duration: number;
    priority: 'must_have' | 'nice_to_have' | 'optional';
  }>;
  timelineEvents?: Array<{
    time: string;
    title: string;
    type: string;
    location?: string;
    duration?: number;
  }>;
  googleDriveFolderId?: string;
  memoryCardConfigs: MemoryCardConfig[];
  primaryCamera: string;
  backupCamera: string;
  logFormat: string;
  returnCallback: (result: EditorToProjectResult) => void;
}

export interface EditorToProjectResult {
  videoUrl: string;
  duration: number;
  clipCount: number;
  transitionCount: number;
  usedAI: boolean;
  aiConfidence: number;
  worklogEntry: {
    taskName: string;
    description: string;
    hoursSpent: number;
    status: string;
  };
  culturalMoments: unknown[];
  appliedLUTs: unknown[];
  exportSettings: unknown[];
}

export interface VirtualStudioResult {
  sceneCount: number;
  cameraPathCount: number;
  renderCount: number;
  workTime: number;
  renderUrls?: string[];
  exportedFormats?: string[];
  updatedShots?: ShotListItem[];
  cameraSettings?: Record<string, unknown>;
}

export interface MilestoneData {
  name: string;
  date: string;
}

export interface ProjectCreationWithMemoryCardsProps {
  profession: string;
  userId?: string;
  onProjectCreated?: (projectData: unknown) => void;
  initialData?: ProjectInitialData;
  evendiCoupleId?: string;
  onMeetingCreate?: (meeting: Record<string, unknown>) => void;
  onProjectUpdate?: (project: unknown) => void;
  onWorklogCreate?: (worklog: WorklogMutationData) => void;
  selectedProject?: { id: string; [key: string]: unknown };
  onProjectSelect?: (project: unknown) => void;
  onOpenEventManagement?: (eventData: Record<string, unknown>) => void;
  onGoToTab?: (tabName: string) => void;
}

export interface WorklogMutationData {
  projectId?: string;
  userId?: string;
  taskName?: string;
  title?: string;
  description?: string;
  hoursSpent?: number;
  timeSpent?: number;
  status?: string;
  category?: string;
  phase?: string;
  projectPhase?: string;
  profession?: string;
  phaseName?: string;
  phaseColor?: string;
  timeEstimate?: number;
  artifacts?: string[];
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface ProjectCreationWithMemoryCardsProps {
  profession: string;
  userId?: string;
  onProjectCreated?: (projectData: unknown) => void;
  initialData?: ProjectInitialData;
  evendiCoupleId?: string;
  onMeetingCreate?: (meeting: Record<string, unknown>) => void;
  onProjectUpdate?: (project: unknown) => void;
  onWorklogCreate?: (worklog: WorklogMutationData) => void;
  selectedProject?: { id: string; [key: string]: unknown };
  onProjectSelect?: (project: unknown) => void;
  onOpenEventManagement?: (eventData: Record<string, unknown>) => void;
  onGoToTab?: (tabName: string) => void;
}

// Wizard-specific types
export type WizardStep = 
  | 'basic-info'
  | 'project-type'
  | 'location'
  | 'shot-list'
  | 'memory-cards'
  | 'backup'
  | 'collaborators'
  | 'worklog'
  | 'preview'
  | 'confirm';

export interface WizardState {
  currentStep: WizardStep;
  completedSteps: WizardStep[];
  canGoNext: boolean;
  canGoBack: boolean;
}

export interface WizardActions {
  goToStep: (step: WizardStep) => void;
  nextStep: () => void;
  previousStep: () => void;
  completeWizard: () => Promise<void>;
}