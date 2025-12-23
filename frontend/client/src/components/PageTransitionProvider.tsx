import { useTheming } from '../utils/theming-helper';
import React, { createContext, useContext, useState } from'react';

interface TransitionContextType {
  isTransitioning: boolean;
  setIsTransitioning: (transitioning: boolean) => void
}

const TransitionContext = createContext<TransitionContextType | undefined>(undefined);

interface PageTransitionProviderProps {
  children: React.ReactNode
}

export function PageTransitionProvider({ children }: PageTransitionProviderProps) {
  const [isTransitioning, setIsTransitioning] = useState(false);
  
  // Theming system
  const theming = useTheming('photographer');

  return (
    <TransitionContext.Provider value={{ isTransitioning, setIsTransitioning }}>
      {children}
    </TransitionContext.Provider>
  );
}

export const useTransition = () => {
  const context = useContext(TransitionContext);
  if (!context) {
    throw new Error('useTransition must be used within PageTransitionProvider');
}
  return context;
};