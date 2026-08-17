// @ts-nocheck
import React from "react";
// ProjectCreationWithMemoryCards - Refactored main export
// Now uses the new ProjectCreationWizard architecture

export { ProjectCreationWizard } from './ProjectCreationWizard';
export type { ProjectCreationWithMemoryCardsProps } from './ProjectCreationWizard/types/project';
export { useProjectData } from './ProjectCreationWizard/hooks/useProjectData';
export { useProjectWizard } from './ProjectCreationWizard/hooks/useProjectWizard';

import { ProjectCreationWizard } from './ProjectCreationWizard';
export default ProjectCreationWizard;

// Re-export types
export type {
  ProjectCreationWithMemoryCardsProps,
  ProjectInitialData,
  MemoryCardConfig,
  MemoryCardSelectorConfig,
  SelectedMemoryCard,
  ShotListItem,
  PhaseHistoryEntry,
  ProjectCollaboratorEntry,
  LocationSuggestion,
  ContactOption,
  VersionEntry,
  VirtualStudioResult,
  ProjectToEditorData,
  EditorToProjectResult,
  VirtualStudioResult,
  MilestoneData,
  ProjectCreationWithMemoryCardsProps,
  WorklogMutationData,
  ProjectCreationWithMemoryCardsProps as Props,
  WizardStep,
  WizardState,
  WizardActions,
} from './ProjectCreationWizard/types/project';

// Re-export constants
export {
  PROJECT_TYPES,
  PROJECT_TYPE_CATEGORIES,
  WEDDING_CULTURES,
  CULTURAL_DAY_EXPLANATIONS,
  CULTURAL_DAY_WORKLOG_TIPS,
  PROJECT_PHASES,
  LABELING_SCHEMES,
  FOLDERS,
  QUICK,
  QUICK_REAL,
  COLOR_HEX,
  CREW_ROLE_COLOR,
  CREW_ROLE_LABEL,
  EXT_OF,
  SUPPORTED_FEED_PLATFORMS,
  PRESERVED_APPROVAL_KEYS,
  SUPPORTED_WEDDING_CULTURES,
  DEFAULT_PAGINATION,
  MAX_FILE_SIZE,
  AUTO_SAVE_INTERVAL,
  DEBOUNCE_DELAY,
} from './ProjectCreationWizard/constants/project';

export type {
  LabelingKey,
  ProjectCreationWithMemoryCardsProps,
  ProjectInitialData,
  MemoryCardConfig,
  MemoryCardSelectorConfig,
  SelectedMemoryCard,
  ShotListItem,
  PhaseHistoryEntry,
  ProjectCollaboratorEntry,
  LocationSuggestion,
  ContactOption,
  VersionEntry,
  VirtualStudioResult,
  ProjectToEditorData,
  EditorToProjectResult,
  VirtualStudioResult,
  MilestoneData,
  ProjectCreationWithMemoryCardsProps,
  WorklogMutationData,
  ProjectCreationWithMemoryCardsProps as Props,
  WizardStep,
  WizardState,
  WizardActions,
} from './ProjectCreationWizard/types/project';