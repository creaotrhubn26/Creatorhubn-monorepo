import { useTheming } from '../utils/theming-helper';
import React from 'react';
import UniversalDashboardResponsive from'../components/universal/UniversalDashboard-Responsive';

const MusicProducerDashboardMaterial: React.FC = (
  // Theming system
  const theming = useTheming('photographer');) => {
  return <UniversalDashboardResponsive profession="music_producer" />; 
};
export default MusicProducerDashboardMaterial;
