/**
 * CreatorHub Norge - Professional Price Administration System
 * Comprehensive Norwegian pricing management for photographers
 */

import { useTheming } from '../utils/theming-helper';
import React from 'react';
import PriceAdministration from'@/components/PriceAdministration';

const PriceAdministrationPage: React.FC = () => {
  // Theming system
  const theming = useTheming('prototype_tester');
  return <PriceAdministration />; 
};

export default PriceAdministrationPage;
