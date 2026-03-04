/**
 * Face Analysis Context
 * 
 * Provides shared state for face analysis results across components
 */

import type { ReactNode } from 'react';
import React, { createContext, useContext, useState } from 'react';
import type { FaceAnalysisResults } from'../services/FaceAnalysisEnhancements';

interface FaceAnalysisContextValue {
  analysisData: {
    landmarks?: FaceAnalysisResults['landmarks'];
    headPose?: FaceAnalysisResults['headpose'];
    compositionGuides?: any;
  } | null;
  setAnalysisData: (data: FaceAnalysisContextValue['analysisData']) => void;
  showOverlay: boolean;
  setShowOverlay: (show: boolean) => void;
}

const FaceAnalysisContext = createContext<FaceAnalysisContextValue | undefined>(undefined);

export function FaceAnalysisProvider({ children }: { children: ReactNode }) {
  const [analysisData, setAnalysisData] = useState<FaceAnalysisContextValue['analysisData']>(null);
  const [showOverlay, setShowOverlay] = useState(true);

  return (
    <FaceAnalysisContext.Provider
      value={{
        analysisData,
        setAnalysisData,
        showOverlay,
        setShowOverlay}}
    >
      {children}
    </FaceAnalysisContext.Provider>
  );
}

export function useFaceAnalysis() {
  const context = useContext(FaceAnalysisContext);
  if (context === undefined) {
    throw new Error('useFaceAnalysis must be used within a FaceAnalysisProvider');
  }
  return context;
}


