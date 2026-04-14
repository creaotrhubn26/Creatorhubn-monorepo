import { createContext, useContext, type ReactNode } from 'react';

import type { ScreenTier } from '../stripboard.types';
import type { SceneId, ShootingDayId, ShotId } from '../types';
import type { ProductionManuscriptResponsiveValues } from './productionManuscriptUi';

interface ProductionManuscriptScreenContext {
  tier: ScreenTier;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  is4K: boolean;
}

interface ProductionManuscriptSelectionContext {
  sceneId: SceneId | null;
  shotId: ShotId | null;
  shootingDayId: ShootingDayId | null;
}

export interface ProductionManuscriptContextValue {
  projectId: string;
  screen: ProductionManuscriptScreenContext;
  responsive: ProductionManuscriptResponsiveValues;
  selection: ProductionManuscriptSelectionContext;
  layout: {
    panelMaxWidth?: number;
    sidebarWidth: number;
  };
}

const ProductionManuscriptContext = createContext<ProductionManuscriptContextValue | null>(null);

export const ProductionManuscriptProvider = ({
  value,
  children,
}: {
  value: ProductionManuscriptContextValue;
  children: ReactNode;
}) => (
  <ProductionManuscriptContext.Provider value={value}>
    {children}
  </ProductionManuscriptContext.Provider>
);

export const useProductionManuscriptContext = (): ProductionManuscriptContextValue => {
  const context = useContext(ProductionManuscriptContext);
  if (!context) {
    throw new Error('useProductionManuscriptContext must be used inside ProductionManuscriptProvider');
  }
  return context;
};
