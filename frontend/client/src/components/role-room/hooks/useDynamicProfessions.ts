import { useState, useCallback, useMemo } from 'react';

export interface DynamicProfession {
  id: string;
  name: string;
  icon: string;
  color: string;
  description: string;
  isActive: boolean;
}

export interface ProfessionConfig {
  id: string;
  name: string;
  icon: string;
  color: string;
  features: string[];
  defaultProjectType: string;
}

const DEFAULT_PROFESSIONS: DynamicProfession[] = [
  { id: 'photographer', name: 'Fotograf', icon: 'camera', color: '#10b981', description: 'Profesjonell fotograf', isActive: true },
  { id: 'videographer', name: 'Videograf', icon: 'video', color: '#8b5cf6', description: 'Profesjonell videograf', isActive: true },
  { id: 'director', name: 'Regissør', icon: 'movie', color: '#ff6b35', description: 'Film- og videoregissør', isActive: true },
  { id: 'editor', name: 'Redigerer', icon: 'edit', color: '#3b82f6', description: 'Video- og bilderedigerer', isActive: true },
];

const PROFESSION_CONFIGS: Record<string, ProfessionConfig> = {
  photographer: { id: 'photographer', name: 'Fotograf', icon: 'camera_alt', color: '#10b981', features: ['gallery', 'editing', 'presets'], defaultProjectType: 'photo' },
  videographer: { id: 'videographer', name: 'Videograf', icon: 'videocam', color: '#8b5cf6', features: ['timeline', 'color', 'audio'], defaultProjectType: 'video' },
  director: { id: 'director', name: 'Regissør', icon: 'movie', color: '#ff6b35', features: ['storyboard', 'casting', 'scheduling'], defaultProjectType: 'film' },
  editor: { id: 'editor', name: 'Redigerer', icon: 'edit', color: '#3b82f6', features: ['timeline', 'effects', 'export'], defaultProjectType: 'edit' },
};

export function useDynamicProfessions() {
  const [professions, setProfessions] = useState<DynamicProfession[]>(DEFAULT_PROFESSIONS);
  const [loading, setLoading] = useState(false);
  const [isLoading] = useState(false);

  const professionConfigs = useMemo(() => PROFESSION_CONFIGS, []);

  const addProfession = useCallback((profession: DynamicProfession) => {
    setProfessions(prev => [...prev, profession]);
  }, []);

  const removeProfession = useCallback((id: string) => {
    setProfessions(prev => prev.filter(p => p.id !== id));
  }, []);

  const getCurrentUserProfession = useCallback((): string => {
    return 'photographer';
  }, []);

  const getProfessionDisplayName = useCallback((professionId: string): string => {
    const config = PROFESSION_CONFIGS[professionId];
    return config?.name || professionId;
  }, []);

  const getProfessionIcon = useCallback((professionId: string): string => {
    const config = PROFESSION_CONFIGS[professionId];
    return config?.icon || 'work';
  }, []);

  const getProfessionColor = useCallback((professionId: string): string => {
    const config = PROFESSION_CONFIGS[professionId];
    return config?.color || '#6b7280';
  }, []);

  return {
    professions,
    professionConfigs,
    loading,
    isLoading,
    addProfession,
    removeProfession,
    getCurrentUserProfession,
    getProfessionDisplayName,
    getProfessionIcon,
    getProfessionColor,
  };
}
