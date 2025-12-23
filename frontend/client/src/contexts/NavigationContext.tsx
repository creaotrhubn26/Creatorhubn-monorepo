/**
 * NavigationContext - Unified Navigation Management
 * Manages navigation state, history, and transitions between major components
 */

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  ReactNode,
} from 'react';
import { useEnhancedMasterIntegration } from '@/integration/EnhancedMasterIntegrationProvider';

type NavigationView = 'dashboard' | 'showcase' | 'academy' | 'settings';

interface NavigationHistoryEntry {
  view: NavigationView;
  timestamp: number;
  context?: any;
}

interface NavigationContextValue {
  // Current state
  currentView: NavigationView;
  previousView: NavigationView | null;

  // Navigation methods
  navigateTo: (view: NavigationView, context?: any) => void;
  goBack: () => void;
  canGoBack: boolean;

  // History
  history: NavigationHistoryEntry[];
  clearHistory: () => void;

  // Context preservation
  savedContext: Record<NavigationView, any>;
  saveContext: (view: NavigationView, context: unknown) => void;
  getContext: (view: NavigationView) => any;

  // Transition state
  isTransitioning: boolean;
  transitionProgress: number;
}

const NavigationContext = createContext<NavigationContextValue | undefined>(undefined);

export const NavigationProvider: React.FC<{
  children: ReactNode;
  initialView?: NavigationView;
}> = ({ children, initialView = 'dashboard' }) => {
  const { communication, features } = useEnhancedMasterIntegration();

  const [currentView, setCurrentView] = useState<NavigationView>(initialView);
  const [previousView, setPreviousView] = useState<NavigationView | null>(null);
  const [history, setHistory] = useState<NavigationHistoryEntry[]>([
    { view: initialView, timestamp: Date.now() },
  ]);
  const [savedContext, setSavedContext] = useState<Record<NavigationView, any>>({
    dashboard: {},
    showcase: {},
    academy: {},
    settings: {},
  });
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [transitionProgress, setTransitionProgress] = useState(0);

  // Register with integration system
  useEffect(() => {
    communication.registerComponent('navigation-context, ', 'navigation', [
      'event:emit','event:listen','ui:update',
    ]);

    return () => {
      communication.unregisterComponent('navigation-context');
    };
  }, [communication]);

  // Listen for navigation events from other components
  useEffect(() => {
    const unsubscribe = communication.onMessage((message: unknown) => {
      if (message.type === 'navigation:navigate' && message.data?.view) {
        navigateTo(message.data.view, message.data.context);
      }
      if (message.type === 'navigation:back') {
        goBack();
      }
    });

    return unsubscribe;
  }, [communication]);

  // Navigate to a view
  const navigateTo = useCallback(
    (view: NavigationView, context?: any) => {
      // Don't navigate if already on the same view
      if (view === currentView && !context) {
        return;
      }

      // Start transition
      setIsTransitioning(true);
      setTransitionProgress(0);

      // Animate transition progress
      const progressInterval = setInterval(() => {
        setTransitionProgress((prev) => {
          if (prev >= 100) {
            clearInterval(progressInterval);
            return 100;
          }
          return prev + 10;
        });
      }, 30);

      // Save current view context
      if (context) {
        setSavedContext((prev) => ({
          ...prev,
          [view]: context,
        }));
      }

      // Track navigation
      features.trackFeatureUsage(`navigation-${view}`'navigated', {
        from: currentView,
        to: view,
        hasContext: !!context,
        timestamp: Date.now(),
      });

      // Broadcast navigation event
      communication.sendMessage({
        from: 'navigation-context',
        to: 'all',
        type: 'navigation:view-changed',
        data: {
          from: currentView,
          to: view,
          context,
        },
        priority: 'high',
      });

      // Update state
      setTimeout(() => {
        setPreviousView(currentView);
        setCurrentView(view);
        setHistory((prev) => [...prev, { view, timestamp: Date.now(), context }]);

        // End transition
        setTimeout(() => {
          setIsTransitioning(false);
          setTransitionProgress(0);
          clearInterval(progressInterval);
        }, 300);
      }, 300);
    },
    [currentView, communication, features],
  );

  // Go back to previous view
  const goBack = useCallback(() => {
    if (history.length < 2) {
      return;
    }

    // Get previous entry
    const newHistory = [...history];
    newHistory.pop(); // Remove current
    const previousEntry = newHistory[newHistory.length - 1];

    if (previousEntry) {
      setIsTransitioning(true);

      // Broadcast back navigation
      communication.sendMessage({
        from: 'navigation-context',
        to: 'all',
        type: 'navigation:back-navigation',
        data: {
          from: currentView,
          to: previousEntry.view,
        },
        priority: 'high',
      });

      setTimeout(() => {
        setPreviousView(currentView);
        setCurrentView(previousEntry.view);
        setHistory(newHistory);
        setIsTransitioning(false);
      }, 300);

      // Track back navigation
      features.trackFeatureUsage('navigation-back', 'clicked', {
        from: currentView,
        to: previousEntry.view,
      });
    }
  }, [history, currentView, communication, features]);

  // Check if can go back
  const canGoBack = history.length > 1;

  // Clear navigation history
  const clearHistory = useCallback(() => {
    setHistory([{ view: currentView, timestamp: Date.now() }]);

    communication.sendMessage({
      from: 'navigation-context',
      to: 'all',
      type: 'navigation:history-cleared',
      data: {},
      priority: 'low',
    });
  }, [currentView, communication]);

  // Save context for a view
  const saveContext = useCallback((view: NavigationView, context: unknown) => {
    setSavedContext((prev) => ({
      ...prev,
      [view]: context,
    }));
  }, []);

  // Get saved context for a view
  const getContext = useCallback(
    (view: NavigationView) => {
      return savedContext[view] || {};
    },
    [savedContext],
  );

  // Keyboard shortcuts for navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Alt/Option + Number keys for quick navigation
      if (e.altKey) {
        switch (e.key) {
          case '1':
            e.preventDefault();
            navigateTo('dashboard');
            break;
          case '2':
            e.preventDefault();
            navigateTo('showcase');
            break;
          case '3':
            e.preventDefault();
            navigateTo('academy');
            break;
          case '4':
            e.preventDefault();
            navigateTo('settings');
            break;
        }
      }

      // Alt + Left Arrow for back navigation
      if (e.altKey && e.key ==='ArrowLeft' && canGoBack) {
        e.preventDefault();
        goBack();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [navigateTo, goBack, canGoBack]);

  const value: NavigationContextValue = {
    currentView,
    previousView,
    navigateTo,
    goBack,
    canGoBack,
    history,
    clearHistory,
    savedContext,
    saveContext,
    getContext,
    isTransitioning,
    transitionProgress,
  };

  return <NavigationContext.Provider value={value}>{children}</NavigationContext.Provider>;
};

export const useNavigation = () => {
  const context = useContext(NavigationContext);
  if (context === undefined) {
    throw new Error('useNavigation must be used within a NavigationProvider');
  }
  return context;
};
