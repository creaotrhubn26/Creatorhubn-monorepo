/**
 * Lazy Components for Visual Editor
 * Implements React.lazy for heavy components and features to improve initial load time
 */

import React, { Suspense, lazy } from 'react';
import {
  Box,
  CircularProgress,
  Typography,
  Skeleton,
} from '@mui/material';

// Lazy load heavy components
const ScrollStoriesDialog = lazy(() => import('./ScrollStoriesDialog'));
const AssetLibraryDialog = lazy(() => import('./AssetLibraryDialog'));
const QualityAnalysisDialog = lazy(() => import('./QualityAnalysisDialog'));
const GoogleServicesDialog = lazy(() => import('./GoogleServicesDialog'));
const NoteEditorDialog = lazy(() => import('./NoteEditorDialog'));

// Lazy load view components
const PlanModeView = lazy(() => import('./PlanModeView'));
const DesignerView = lazy(() => import('./DesignerView'));
const ComponentsView = lazy(() => import('./ComponentsView'));
const CodeView = lazy(() => import('./CodeView'));
const PreviewView = lazy(() => import('./PreviewView'));
const SEOView = lazy(() => import('./SEOView'));

// Lazy load advanced features
const AdvancedCanvasFeatures = lazy(() => import('./AdvancedCanvasFeatures'));
const AnimationTimeline = lazy(() => import('./AnimationTimeline'));
const CodeGenerationStudio = lazy(() => import('./CodeGenerationStudio'));
const AssetManagementPanel = lazy(() => import('./AssetManagementPanel'));
const CollaborationPanel = lazy(() => import('./CollaborationPanel'));

// Lazy load utility components
const ErrorBoundary = lazy(() => import('./ErrorBoundary'));
const LoadingSpinner = lazy(() => import('./LoadingSpinner'));
const PerformanceMonitor = lazy(() => import('./PerformanceMonitor'));

// Loading fallback components
const LoadingFallback: React.FC<{ message?: string }> = ({ message = 'Loading...' }) => (
  <Box
    sx={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      p: 4,
      minHeight: 200
  }}
  >
    <CircularProgress size={40} />
    <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
      {message}
    </Typography>
  </Box>
);

const SkeletonFallback: React.FC<{ height?: number }> = ({ height = 200 }) => (
  <Box sx={{ p: 2 }}>
    <Skeleton variant="rectangular" height={height} sx={{ mb: 2 }} />
    <Skeleton variant="text" width="60%" />
    <Skeleton variant="text" width="40%" />
  </Box>
);

// Lazy component wrappers with error boundaries
export const LazyScrollStoriesDialog: React.FC<Record<string, unknown>> = (props) => (
  <Suspense fallback={<LoadingFallback message="Loading Scroll Stories..." />}>
    <ScrollStoriesDialog {...props} />
  </Suspense>
);

export const LazyAssetLibraryDialog: React.FC<Record<string, unknown>> = (props) => (
  <Suspense fallback={<LoadingFallback message="Loading Asset Library..." />}>
    <AssetLibraryDialog {...props} />
  </Suspense>
);

export const LazyQualityAnalysisDialog: React.FC<Record<string, unknown>> = (props) => (
  <Suspense fallback={<LoadingFallback message="Loading Quality Analysis..." />}>
    <QualityAnalysisDialog {...props} />
  </Suspense>
);

export const LazyGoogleServicesDialog: React.FC<Record<string, unknown>> = (props) => (
  <Suspense fallback={<LoadingFallback message="Loading Google Services..." />}>
    <GoogleServicesDialog {...props} />
  </Suspense>
);

export const LazyNoteEditorDialog: React.FC<Record<string, unknown>> = (props) => (
  <Suspense fallback={<LoadingFallback message="Loading Note Editor..." />}>
    <NoteEditorDialog {...props} />
  </Suspense>
);

export const LazyPlanModeView: React.FC<Record<string, unknown>> = (props) => (
  <Suspense fallback={<SkeletonFallback height={400} />}>
    <PlanModeView {...props} />
  </Suspense>
);

export const LazyDesignerView: React.FC<Record<string, unknown>> = (props) => (
  <Suspense fallback={<SkeletonFallback height={600} />}>
    <DesignerView {...props} />
  </Suspense>
);

export const LazyComponentsView: React.FC<Record<string, unknown>> = (props) => (
  <Suspense fallback={<SkeletonFallback height={500} />}>
    <ComponentsView {...props} />
  </Suspense>
);

export const LazyCodeView: React.FC<Record<string, unknown>> = (props) => (
  <Suspense fallback={<SkeletonFallback height={400} />}>
    <CodeView {...props} />
  </Suspense>
);

export const LazyPreviewView: React.FC<Record<string, unknown>> = (props) => (
  <Suspense fallback={<SkeletonFallback height={600} />}>
    <PreviewView {...props} />
  </Suspense>
);

export const LazySEOView: React.FC<Record<string, unknown>> = (props) => (
  <Suspense fallback={<SkeletonFallback height={400} />}>
    <SEOView {...props} />
  </Suspense>
);

export const LazyAdvancedCanvasFeatures: React.FC<Record<string, unknown>> = (props) => (
  <Suspense fallback={<LoadingFallback message="Loading Advanced Canvas Features..." />}>
    <AdvancedCanvasFeatures {...props} />
  </Suspense>
);

export const LazyAnimationTimeline: React.FC<Record<string, unknown>> = (props) => (
  <Suspense fallback={<LoadingFallback message="Loading Animation Timeline..." />}>
    <AnimationTimeline {...props} />
  </Suspense>
);

export const LazyCodeGenerationStudio: React.FC<Record<string, unknown>> = (props) => (
  <Suspense fallback={<LoadingFallback message="Loading Code Generation Studio..." />}>
    <CodeGenerationStudio {...props} />
  </Suspense>
);

export const LazyAssetManagementPanel: React.FC<Record<string, unknown>> = (props) => (
  <Suspense fallback={<LoadingFallback message="Loading Asset Management..." />}>
    <AssetManagementPanel {...props} />
  </Suspense>
);

export const LazyCollaborationPanel: React.FC<Record<string, unknown>> = (props) => (
  <Suspense fallback={<LoadingFallback message="Loading Collaboration Features..." />}>
    <CollaborationPanel {...props} />
  </Suspense>
);

export const LazyErrorBoundary: React.FC<Record<string, unknown>> = (props) => (
  <Suspense fallback={<LoadingFallback message="Loading Error Boundary..." />}>
    <ErrorBoundary {...props} />
  </Suspense>
);

export const LazyLoadingSpinner: React.FC<Record<string, unknown>> = (props) => (
  <Suspense fallback={<CircularProgress />}>
    <LoadingSpinner {...props} />
  </Suspense>
);

export const LazyPerformanceMonitor: React.FC<Record<string, unknown>> = (props) => (
  <Suspense fallback={<LoadingFallback message="Loading Performance Monitor..." />}>
    <PerformanceMonitor {...props} />
  </Suspense>
);

// Preload functions for critical components
export const preloadCriticalComponents = () => {
  // Preload components that are likely to be used soon
  import('./ScrollStoriesDialog');
  import('./AssetLibraryDialog');
  import('./QualityAnalysisDialog');
};

export const preloadViewComponents = () => {
  // Preload view components
  import('./PlanModeView');
  import('./DesignerView');
  import('./ComponentsView');
};

export const preloadAdvancedFeatures = () => {
  // Preload advanced features
  import('./AdvancedCanvasFeatures');
  import('./AnimationTimeline');
  import('./CodeGenerationStudio');
};

// Lazy loading utility hook
export const useLazyLoading = () => {
  const [loadedComponents, setLoadedComponents] = React.useState<Set<string>>(new Set());

  const loadComponent = React.useCallback((componentName: string) => {
    if (loadedComponents.has(componentName)) return;

    setLoadedComponents(prev => new Set([...prev, componentName]));

    // Load component based on name
    switch (componentName) {
      case 'scrollStories':
        import('./ScrollStoriesDialog');
        break;
      case 'assetLibrary':
        import('./AssetLibraryDialog');
        break;
      case 'qualityAnalysis':
        import('./QualityAnalysisDialog');
        break;
      case 'googleServices':
        import('./GoogleServicesDialog');
        break;
      case 'noteEditor':
        import('./NoteEditorDialog');
        break;
      case 'planMode':
        import('./PlanModeView');
        break;
      case 'designer':
        import('./DesignerView');
        break;
      case 'components':
        import('./ComponentsView');
        break;
      case 'code':
        import('./CodeView');
        break;
      case 'preview':
        import('./PreviewView');
        break;
      case 'seo':
        import('./SEOView');
        break;
      default: console.warn(`Unknown component: ${componentName}`);
  }
}, [loadedComponents]);

  const isComponentLoaded = React.useCallback((componentName: string) => {
    return loadedComponents.has(componentName);
}, [loadedComponents]);

  const preloadComponents = React.useCallback((componentNames: string[]) => {
    componentNames.forEach(componentName => {
      if (!loadedComponents.has(componentName)) {
        loadComponent(componentName);
    }
  });
}, [loadedComponents, loadComponent]);

  return {
    loadComponent,
    isComponentLoaded,
    preloadComponents,
    loadedComponents: Array.from(loadedComponents)
};
};

// Lazy loading with intersection observer
export const useIntersectionLazyLoading = (threshold: number = 0.1) => {
  const [isVisible, setIsVisible] = React.useState(false);
  
  // Theming system
  const theming = useTheming('prototype_tester');
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
      }
    },
      { threshold }
    );

    if (ref.current) {
      observer.observe(ref.current);
  }

    return () => observer.disconnect();
}, [threshold]);

  return { ref, isVisible };
};

// Lazy loading with timeout
export const useTimeoutLazyLoading = (delay: number = 1000) => {
  const [shouldLoad, setShouldLoad] = React.useState(false);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setShouldLoad(true);
  }, delay);

    return () => clearTimeout(timer);
}, [delay]);

  return shouldLoad;
};

// Lazy loading with user interaction
export const useInteractionLazyLoading = () => {
  const [shouldLoad, setShouldLoad] = React.useState(false);

  React.useEffect(() => {
    const handleInteraction = () => {
      setShouldLoad(true);
      document.removeEventListener('click', handleInteraction);
      document.removeEventListener('keydown', handleInteraction);
      document.removeEventListener('scroll', handleInteraction);
  };

    document.addEventListener('click', handleInteraction);
    document.addEventListener('keydown', handleInteraction);
    document.addEventListener('scroll', handleInteraction);

    return () => {
      document.removeEventListener('click', handleInteraction);
      document.removeEventListener('keydown', handleInteraction);
      document.removeEventListener('scroll', handleInteraction);
  };
}, []);

  return shouldLoad;
};

export default {
  LazyScrollStoriesDialog,
  LazyAssetLibraryDialog,
  LazyQualityAnalysisDialog,
  LazyGoogleServicesDialog,
  LazyNoteEditorDialog,
  LazyPlanModeView,
  LazyDesignerView,
  LazyComponentsView,
  LazyCodeView,
  LazyPreviewView,
  LazySEOView,
  LazyAdvancedCanvasFeatures,
  LazyAnimationTimeline,
  LazyCodeGenerationStudio,
  LazyAssetManagementPanel,
  LazyCollaborationPanel,
  LazyErrorBoundary,
  LazyLoadingSpinner,
  LazyPerformanceMonitor,
  preloadCriticalComponents,
  preloadViewComponents,
  preloadAdvancedFeatures,
  useLazyLoading,
  useIntersectionLazyLoading,
  useTimeoutLazyLoading,
  useInteractionLazyLoading
};


