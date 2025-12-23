// Hook for managing templates and presets
import { useState, useEffect, useCallback } from 'react';
import { templateManager, Template, Preset } from '../utils/templateManager';

export interface UseTemplateManagerReturn {
  templates: Template[];
  presets: Preset[];
  isLoading: boolean;
  error: string | null;
  
  // Template methods
  getTemplates: (filter?: { category?: string; profession?: string; featured?: boolean }) => Template[];
  getTemplate: (id: string) => Template | undefined;
  applyTemplate: (templateId: string, targetId: string) => boolean;
  
  // Preset methods
  getPresets: (filter?: { category?: string; profession?: string }) => Preset[];
  getPreset: (id: string) => Preset | undefined;
  applyPreset: (presetId: string, targetId: string) => boolean;
  
  // Data management
  refreshData: () => void;
}

export const useTemplateManager = (): UseTemplateManagerReturn => {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshData = useCallback(() => {
    try {
      setTemplates(templateManager.getTemplates());
      setPresets(templateManager.getPresets());
  } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh data');
  }
}, []);

  useEffect(() => {
    refreshData();
}, [refreshData]);

  const getTemplates = useCallback((filter?: { category?: string; profession?: string; featured?: boolean }) => {
    return templateManager.getTemplates(filter);
}, []);

  const getTemplate = useCallback((id: string) => {
    return templateManager.getTemplate(id);
}, []);

  const applyTemplate = useCallback((templateId: string, targetId: string) => {
    try {
      return templateManager.applyTemplate(templateId, targetId);
  } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to apply template');
      return false;
  }
}, []);

  const getPresets = useCallback((filter?: { category?: string; profession?: string }) => {
    return templateManager.getPresets(filter);
}, []);

  const getPreset = useCallback((id: string) => {
    return templateManager.getPreset(id);
}, []);

  const applyPreset = useCallback((presetId: string, targetId: string) => {
    try {
      return templateManager.applyPreset(presetId, targetId);
  } catch (err) {
      setError(err instanceof Error ? err.message :'Failed to apply preset');
      return false;
  }
}, []);

  return {
    templates,
    presets,
    isLoading,
    error,
    getTemplates,
    getTemplate,
    applyTemplate,
    getPresets,
    getPreset,
    applyPreset,
    refreshData
};
};

