import React from 'react';
import { EnhancedVisualEditorPage } from './visual-editor/EnhancedVisualEditorPage';

interface SelectedProject {
  id: string;
}

export interface CreatorhubVisualEditorProps {
  selectedProject?: SelectedProject;
  onProjectUpdate?: (_project: Record<string, unknown>) => void;
  selectedClient?: Record<string, unknown>;
  onWorklogCreate?: (_worklog: Record<string, unknown>) => void;
  onNotificationCreate?: (_notification: Record<string, unknown>) => void;
}

const CreatorhubVisualEditorRefactored: React.FC<CreatorhubVisualEditorProps> = ({
  selectedProject,
}) => {
  return <EnhancedVisualEditorPage projectId={selectedProject?.id} />;
};

export default CreatorhubVisualEditorRefactored;
