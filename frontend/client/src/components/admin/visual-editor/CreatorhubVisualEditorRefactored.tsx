import React from 'react';
import { EnhancedVisualEditorPage } from './EnhancedVisualEditorPage';

interface CreatorhubVisualEditorRefactoredProps {
  projectId?: string;
  selectedProject?: {
    id?: string;
  };
}

const CreatorhubVisualEditorRefactored: React.FC<CreatorhubVisualEditorRefactoredProps> = ({
  projectId,
  selectedProject,
}) => {
  return <EnhancedVisualEditorPage projectId={projectId ?? selectedProject?.id} />;
};

export default CreatorhubVisualEditorRefactored;
