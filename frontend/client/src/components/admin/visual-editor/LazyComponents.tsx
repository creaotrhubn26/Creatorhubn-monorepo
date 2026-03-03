/**
 * Lazy Components for Visual Editor
 * Implements React.lazy for heavy components and features to improve initial load time.
 */

import React, { Suspense, lazy } from 'react';
import { Box, CircularProgress, Skeleton, Typography } from '@mui/material';

type LazyProps = Record<string, unknown>;
type LazyComponent = React.ComponentType<LazyProps>;
type LazyComponentModule = { default: LazyComponent };

const LoadingFallback: React.FC<{ message?: string }> = ({ message = 'Loading...' }) => (
  <Box
    sx={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      p: 4,
      minHeight: 200,
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

const createUnavailableComponent = (name: string): LazyComponent => {
  const UnavailableComponent: React.FC<LazyProps> = () => (
    <LoadingFallback message={`${name} is unavailable in this build.`} />
  );
  UnavailableComponent.displayName = `Unavailable${name.replace(/\s+/g, '')}`;
  return UnavailableComponent;
};

const toLazyModule = (component: LazyComponent): Promise<LazyComponentModule> =>
  Promise.resolve({ default: component });

const adaptComponent = <P extends object>(Component: React.ComponentType<P>): LazyComponent => {
  const AdaptedComponent: React.FC<LazyProps> = (props) =>
    React.createElement(Component, props as unknown as P);
  AdaptedComponent.displayName = `Adapted(${Component.displayName ?? Component.name ?? 'Component'})`;
  return AdaptedComponent;
};

const safeLazy = (loader: () => Promise<LazyComponentModule>, name: string) =>
  lazy(async () => {
    try {
      return await loader();
    } catch (error) {
      console.error(`[LazyComponents] Failed to load ${name}`, error);
      return { default: createUnavailableComponent(name) };
    }
  });

// Lazy load heavy components (mapped to maintained modules in this codebase)
const ScrollStoriesDialog = safeLazy(
  () =>
    import('./LibrarySuggestionDialog').then((module) => ({
      default: adaptComponent(module.default),
    })),
  'Scroll Stories',
);
const AssetLibraryDialog = safeLazy(
  () =>
    import('./AssetManager').then((module) => ({
      default: adaptComponent(module.default),
    })),
  'Asset Library',
);
const QualityAnalysisDialog = safeLazy(
  () =>
    import('./AdvancedTools').then((module) => ({
      default: adaptComponent(module.default),
    })),
  'Quality Analysis',
);
const GoogleServicesDialog = safeLazy(
  () =>
    import('./AISettingsDialog').then((module) => ({
      default: adaptComponent(module.default),
    })),
  'Google Services',
);
const NoteEditorDialog = safeLazy(
  () =>
    import('./NoteEditorPanel').then((module) => ({
      default: adaptComponent(module.default),
    })),
  'Note Editor',
);

// Lazy load view components
const PlanModeView = safeLazy(
  () =>
    import('./VisualEditorDashboardExample').then((module) => ({
      default: adaptComponent(module.default),
    })),
  'Plan Mode View',
);
const DesignerView = safeLazy(
  () =>
    import('./EnhancedVisualEditorPage').then((module) => ({
      default: adaptComponent(module.EnhancedVisualEditorPage),
    })),
  'Designer View',
);
const ComponentsView = safeLazy(
  () =>
    import('./ComponentLibrarySidebar').then((module) => ({
      default: adaptComponent(module.ComponentLibrarySidebar),
    })),
  'Components View',
);
const CodeView = safeLazy(
  () =>
    import('./CodeEditorPanel').then((module) => ({
      default: adaptComponent(module.CodeEditorPanel),
    })),
  'Code View',
);
const PreviewView = safeLazy(
  () =>
    import('./LivePreviewPanel').then((module) => ({
      default: adaptComponent(module.LivePreviewPanel),
    })),
  'Preview View',
);
const SEOView = safeLazy(
  () =>
    import('./SEOToolsPanel').then((module) => ({
      default: adaptComponent(module.default),
    })),
  'SEO View',
);

// Lazy load advanced features
const AdvancedCanvasFeatures = safeLazy(
  () =>
    import('./VisualEditorCanvasOptimized').then((module) => ({
      default: adaptComponent(module.default),
    })),
  'Advanced Canvas Features',
);
const AnimationTimeline = safeLazy(
  () =>
    import('./AnimationDashboard').then((module) => ({
      default: adaptComponent(module.default),
    })),
  'Animation Timeline',
);
const CodeGenerationStudio = safeLazy(
  () =>
    import('../../CodeGenerationStudio').then((module) => ({
      default: adaptComponent(module.default),
    })),
  'Code Generation Studio',
);
const AssetManagementPanel = safeLazy(
  () =>
    import('./AssetManager').then((module) => ({
      default: adaptComponent(module.default),
    })),
  'Asset Management Panel',
);
const CollaborationPanel = safeLazy(
  () =>
    import('./CollaborationTools').then((module) => ({
      default: adaptComponent(module.default),
    })),
  'Collaboration Panel',
);

// Lazy load utility components
const ErrorBoundary = safeLazy(
  () =>
    import('../../common/ErrorBoundary').then((module) => ({
      default: adaptComponent(module.default),
    })),
  'Error Boundary',
);
const LoadingSpinner = safeLazy(
  () => toLazyModule(() => <CircularProgress size={24} />),
  'Loading Spinner',
);
const PerformanceMonitor = safeLazy(
  () =>
    import('./PerformanceMonitorDashboard').then((module) => ({
      default: adaptComponent(module.default),
    })),
  'Performance Monitor',
);

// Lazy component wrappers
export const LazyScrollStoriesDialog: React.FC<LazyProps> = (props) => (
  <Suspense fallback={<LoadingFallback message="Loading Scroll Stories..." />}>
    <ScrollStoriesDialog {...props} />
  </Suspense>
);

export const LazyAssetLibraryDialog: React.FC<LazyProps> = (props) => (
  <Suspense fallback={<LoadingFallback message="Loading Asset Library..." />}>
    <AssetLibraryDialog {...props} />
  </Suspense>
);

export const LazyQualityAnalysisDialog: React.FC<LazyProps> = (props) => (
  <Suspense fallback={<LoadingFallback message="Loading Quality Analysis..." />}>
    <QualityAnalysisDialog {...props} />
  </Suspense>
);

export const LazyGoogleServicesDialog: React.FC<LazyProps> = (props) => (
  <Suspense fallback={<LoadingFallback message="Loading Google Services..." />}>
    <GoogleServicesDialog {...props} />
  </Suspense>
);

export const LazyNoteEditorDialog: React.FC<LazyProps> = (props) => (
  <Suspense fallback={<LoadingFallback message="Loading Note Editor..." />}>
    <NoteEditorDialog {...props} />
  </Suspense>
);

export const LazyPlanModeView: React.FC<LazyProps> = (props) => (
  <Suspense fallback={<SkeletonFallback height={400} />}>
    <PlanModeView {...props} />
  </Suspense>
);

export const LazyDesignerView: React.FC<LazyProps> = (props) => (
  <Suspense fallback={<SkeletonFallback height={600} />}>
    <DesignerView {...props} />
  </Suspense>
);

export const LazyComponentsView: React.FC<LazyProps> = (props) => (
  <Suspense fallback={<SkeletonFallback height={500} />}>
    <ComponentsView {...props} />
  </Suspense>
);

export const LazyCodeView: React.FC<LazyProps> = (props) => (
  <Suspense fallback={<SkeletonFallback height={400} />}>
    <CodeView {...props} />
  </Suspense>
);

export const LazyPreviewView: React.FC<LazyProps> = (props) => (
  <Suspense fallback={<SkeletonFallback height={600} />}>
    <PreviewView {...props} />
  </Suspense>
);

export const LazySEOView: React.FC<LazyProps> = (props) => (
  <Suspense fallback={<SkeletonFallback height={400} />}>
    <SEOView {...props} />
  </Suspense>
);

export const LazyAdvancedCanvasFeatures: React.FC<LazyProps> = (props) => (
  <Suspense fallback={<LoadingFallback message="Loading Advanced Canvas Features..." />}>
    <AdvancedCanvasFeatures {...props} />
  </Suspense>
);

export const LazyAnimationTimeline: React.FC<LazyProps> = (props) => (
  <Suspense fallback={<LoadingFallback message="Loading Animation Timeline..." />}>
    <AnimationTimeline {...props} />
  </Suspense>
);

export const LazyCodeGenerationStudio: React.FC<LazyProps> = (props) => (
  <Suspense fallback={<LoadingFallback message="Loading Code Generation Studio..." />}>
    <CodeGenerationStudio {...props} />
  </Suspense>
);

export const LazyAssetManagementPanel: React.FC<LazyProps> = (props) => (
  <Suspense fallback={<LoadingFallback message="Loading Asset Management..." />}>
    <AssetManagementPanel {...props} />
  </Suspense>
);

export const LazyCollaborationPanel: React.FC<LazyProps> = (props) => (
  <Suspense fallback={<LoadingFallback message="Loading Collaboration Features..." />}>
    <CollaborationPanel {...props} />
  </Suspense>
);

export const LazyErrorBoundary: React.FC<LazyProps> = (props) => (
  <Suspense fallback={<LoadingFallback message="Loading Error Boundary..." />}>
    <ErrorBoundary {...props} />
  </Suspense>
);

export const LazyLoadingSpinner: React.FC<LazyProps> = (props) => (
  <Suspense fallback={<CircularProgress />}>
    <LoadingSpinner {...props} />
  </Suspense>
);

export const LazyPerformanceMonitor: React.FC<LazyProps> = (props) => (
  <Suspense fallback={<LoadingFallback message="Loading Performance Monitor..." />}>
    <PerformanceMonitor {...props} />
  </Suspense>
);

// Preload functions for critical components
export const preloadCriticalComponents = () => {
  void import('./LibrarySuggestionDialog');
  void import('./AssetManager');
  void import('./AdvancedTools');
};

export const preloadViewComponents = () => {
  void import('./VisualEditorDashboardExample');
  void import('./EnhancedVisualEditorPage');
  void import('./ComponentLibrarySidebar');
};

export const preloadAdvancedFeatures = () => {
  void import('./VisualEditorCanvasOptimized');
  void import('./AnimationDashboard');
  void import('../../CodeGenerationStudio');
};

// Lazy loading utility hook
export const useLazyLoading = () => {
  const [loadedComponents, setLoadedComponents] = React.useState<Set<string>>(new Set());

  const loadComponent = React.useCallback((componentName: string) => {
    if (loadedComponents.has(componentName)) {
      return;
    }

    setLoadedComponents((prev) => new Set([...prev, componentName]));

    switch (componentName) {
      case 'scrollStories':
        void import('./LibrarySuggestionDialog');
        break;
      case 'assetLibrary':
        void import('./AssetManager');
        break;
      case 'qualityAnalysis':
        void import('./AdvancedTools');
        break;
      case 'googleServices':
        void import('./AISettingsDialog');
        break;
      case 'noteEditor':
        void import('./NoteEditorPanel');
        break;
      case 'planMode':
        void import('./VisualEditorDashboardExample');
        break;
      case 'designer':
        void import('./EnhancedVisualEditorPage');
        break;
      case 'components':
        void import('./ComponentLibrarySidebar');
        break;
      case 'code':
        void import('./CodeEditorPanel');
        break;
      case 'preview':
        void import('./LivePreviewPanel');
        break;
      case 'seo':
        void import('./SEOToolsPanel');
        break;
      default:
        console.warn(`Unknown component: ${componentName}`);
    }
  }, [loadedComponents]);

  const isComponentLoaded = React.useCallback(
    (componentName: string) => loadedComponents.has(componentName),
    [loadedComponents],
  );

  const preloadComponents = React.useCallback((componentNames: string[]) => {
    componentNames.forEach((componentName) => {
      if (!loadedComponents.has(componentName)) {
        loadComponent(componentName);
      }
    });
  }, [loadedComponents, loadComponent]);

  return {
    loadComponent,
    isComponentLoaded,
    preloadComponents,
    loadedComponents: Array.from(loadedComponents),
  };
};

// Lazy loading with intersection observer
export const useIntersectionLazyLoading = (threshold = 0.1) => {
  const [isVisible, setIsVisible] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold },
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, [threshold]);

  return { ref, isVisible };
};

// Lazy loading with timeout
export const useTimeoutLazyLoading = (delay = 1000) => {
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
  useInteractionLazyLoading,
};
