import { useMemo } from 'react';

export interface ProfessionConfig {
  id: string;
  name: string;
  icon: string;
  color: string;
  categories: string[];
}

const defaultConfigs: ProfessionConfig[] = [
  { id: 'photographer', name: 'Fotograf', icon: 'camera', color: '#4CAF50', categories: ['Portrett', 'Landskap', 'Studio'] },
  { id: 'filmmaker', name: 'Filmskaper', icon: 'video', color: '#2196F3', categories: ['Dokumentar', 'Kortfilm', 'Musikkvideo'] },
  { id: 'lighting', name: 'Lystekniker', icon: 'light', color: '#FFC107', categories: ['Studio', 'Event', 'Film'] },
  { id: 'director', name: 'Regissør', icon: 'director', color: '#9C27B0', categories: ['Film', 'Teater', 'TV'] },
  { id: 'editor', name: 'Klipper', icon: 'edit', color: '#FF5722', categories: ['Video', 'Lyd', 'Farge'] },
];

export const useProfessionConfigs = () => {
  const configs = useMemo(() => defaultConfigs, []);
  
  const getConfigById = (id: string) => configs.find(c => c.id === id);
  const getConfigByName = (name: string) => configs.find(c => c.name === name);
  
  return {
    configs,
    getConfigById,
    getConfigByName,
  };
};

export default useProfessionConfigs;
