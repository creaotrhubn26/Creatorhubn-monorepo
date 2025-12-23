import { useState, useEffect, useCallback } from 'react';

interface UserAction {
  id: string;
  type: 'button_click' | 'menu_open' | 'tab_change' | 'form_submit' | 'modal_open' | 'navigation' | 'scroll' | 'hover' | 'form_abandon' | 'error_encountered';
  element: string;
  context: {
    profession?: string;
    dashboard?: string;
    tab?: string;
    location?: string;
    component?: string;
    duration?: number; // How long spent on element
    attempts?: number; // Number of attempts (for forms, etc.)
    errorMessage?: string; // For error tracking
};
  timestamp: number;
  metadata?: any;
}

interface ContextualQuestion {
  question: string;
  category: string;
  suggestions: string[];
  priority: 'low' | 'medium' | 'high'; // Priority for showing question
  trigger: 'immediate' | 'delayed' | 'on_idle'; // When to show
}

interface ActionPattern {
  pattern: string;
  frequency: number;
  lastOccurrence: number;
  averageDuration: number;
  successRate: number;
}

interface StruggleIndicator {
  type: 'repeated_action' | 'rapid_navigation' | 'form_abandonment' | 'error_loop' | 'long_hover';
  severity: 'low' | 'medium' | 'high';
  element: string;
  count: number;
  suggestion: string;
}

interface WorkflowPrediction {
  nextLikelyAction: string;
  confidence: number;
  suggestedShortcut?: string;
  reasoning: string;
}

// Global action tracker for intelligent prototype feedback
export class ActionTracker {
  private static instance: ActionTracker;
  private actions: UserAction[] = [];
  private listeners: ((action: UserAction) => void)[] = [];
  private patterns: Map<string, ActionPattern> = new Map();
  private struggleIndicators: StruggleIndicator[] = [];
  private sessionStartTime: number = Date.now();

  private constructor() {
    // Auto-save to localStorage periodically
    if (typeof window !== 'undefined') {
      setInterval(() => this.saveToStorage(), 30000); // Every 30 seconds
      this.loadFromStorage();
    }
  }

  static getInstance(): ActionTracker {
    if (!ActionTracker.instance) {
      ActionTracker.instance = new ActionTracker();
    }
    return ActionTracker.instance;
  }

  trackAction(action: Omit<UserAction, 'id' | 'timestamp'>) {
    const fullAction: UserAction = {
      ...action,
      id: `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
    };

    this.actions.push(fullAction);

    // Keep only last 50 actions to prevent memory issues
    if (this.actions.length > 50) {
      this.actions = this.actions.slice(-50);
    }

    // Notify listeners
    this.listeners.forEach((listener) => listener(fullAction));
  }

  getLastAction(): UserAction | null {
    return this.actions.length > 0 ? this.actions[this.actions.length - 1] : null;
  }

  getRecentActions(count: number = 5): UserAction[] {
    return this.actions.slice(-count);
  }

  addListener(listener: (action: UserAction) => void) {
    this.listeners.push(listener);
  }

  removeListener(listener: (action: UserAction) => void) {
    this.listeners = this.listeners.filter((l) => l !== listener);
  }

  // 🧠 SMART FEATURES

  /**
   * Detect struggle patterns (user is having difficulty)
   */
  detectStrugglePatterns(): StruggleIndicator[] {
    const recentActions = this.getRecentActions(10);
    const indicators: StruggleIndicator[] = [];

    // Detect repeated clicks on same element
    const elementCounts = new Map<string, number>();
    recentActions.forEach(action => {
      const count = (elementCounts.get(action.element) || 0) + 1;
      elementCounts.set(action.element, count);
  });

    elementCounts.forEach((count, element) => {
      if (count >= 3) {
        indicators.push({
          type: 'repeated_action',
          severity: count >= 5 ? 'high' : 'medium',
          element,
          count,
          suggestion: `Element "${element}" was clicked ${count} times. Consider adding a tutorial or improving feedback.`
      });
    }
  });

    // Detect rapid tab switching (confusion)
    const tabChanges = recentActions.filter(a => a.type === 'tab_change');
    if (tabChanges.length >= 4 && (Date.now() - tabChanges[0].timestamp) < 30000) {
      indicators.push({
        type: 'rapid_navigation',
        severity: 'medium',
        element: 'tabs',
        count: tabChanges.length,
        suggestion: 'User is rapidly switching tabs. They might be lost or looking for something specific.'
    });
  }

    // Detect form abandonment
    const formAbandons = recentActions.filter(a => a.type === 'form_abandon');
    if (formAbandons.length > 0) {
      indicators.push({
        type: 'form_abandonment',
        severity: 'high',
        element: formAbandons[0].element,
        count: formAbandons.length,
        suggestion: 'User abandoned a form. Consider simplifying or providing better guidance.'
    });
  }

    this.struggleIndicators = indicators;
    return indicators;
}

  /**
   * Learn patterns from user behavior
   */
  learnPatterns(): ActionPattern[] {
    const patternMap = new Map<string, { total: number; durations: number[]; successes: number }>();

    this.actions.forEach((action, index) => {
      const patternKey = `${action.type}:${action.element}`;
      const existing = patternMap.get(patternKey) || { total: 0, durations: [], successes: 0 };
      
      // Calculate duration if next action exists
      const nextAction = this.actions[index + 1];
      const duration = nextAction ? nextAction.timestamp - action.timestamp : 0;
      
      existing.total++;
      if (duration > 0) existing.durations.push(duration);
      if (action.metadata?.success !== false) existing.successes++;
      
      patternMap.set(patternKey, existing);
  });

    const patterns: ActionPattern[] = [];
    patternMap.forEach((data, patternKey) => {
      const avgDuration = data.durations.length > 0 
        ? data.durations.reduce((a, b) => a + b, 0) / data.durations.length 
        : 0;
      
      patterns.push({
        pattern: patternKey,
        frequency: data.total,
        lastOccurrence: Date.now(),
        averageDuration: avgDuration,
        successRate: data.total > 0 ? data.successes / data.total : 1
    });
  });

    return patterns.sort((a, b) => b.frequency - a.frequency);
}

  /**
   * Predict next likely action based on patterns
   */
  predictNextAction(): WorkflowPrediction | null {
    const lastAction = this.getLastAction();
    if (!lastAction) return null;

    // Build sequence patterns
    const sequences = new Map<string, Map<string, number>>();
    
    for (let i = 0; i < this.actions.length - 1; i++) {
      const currentKey = `${this.actions[i].type}:${this.actions[i].element}`;
      const nextKey = `${this.actions[i + 1].type}:${this.actions[i + 1].element}`;
      
      if (!sequences.has(currentKey)) {
        sequences.set(currentKey, new Map());
    }
      
      const nextMap = sequences.get(currentKey)!;
      nextMap.set(nextKey, (nextMap.get(nextKey) || 0) + 1);
  }

    const currentKey = `${lastAction.type}:${lastAction.element}`;
    const possibleNext = sequences.get(currentKey);
    
    if (!possibleNext || possibleNext.size === 0) return null;

    // Find most likely next action
    let maxCount = 0;
    let mostLikely = '';
    possibleNext.forEach((count, key) => {
      if (count > maxCount) {
        maxCount = count;
        mostLikely = key;
    }
  });

    const totalCount = Array.from(possibleNext.values()).reduce((a, b) => a + b, 0);
    const confidence = maxCount / totalCount;

    return {
      nextLikelyAction: mostLikely,
      confidence,
      suggestedShortcut: confidence > 0.7 ? `Create shortcut for ${mostLikely}` : undefined,
      reasoning: `Based on ${maxCount} occurrences out of ${totalCount} total transitions from this action.`
  };
}

  /**
   * Get session analytics
   */
  getSessionAnalytics() {
    const sessionDuration = Date.now() - this.sessionStartTime;
    const actionsByType = new Map<string, number>();
    const actionsByElement = new Map<string, number>();

    this.actions.forEach(action => {
      actionsByType.set(action.type, (actionsByType.get(action.type) || 0) + 1);
      actionsByElement.set(action.element, (actionsByElement.get(action.element) || 0) + 1);
  });

    return {
      sessionDuration,
      totalActions: this.actions.length,
      actionsPerMinute: (this.actions.length / (sessionDuration / 60000)).toFixed(2),
      actionsByType: Object.fromEntries(actionsByType),
      actionsByElement: Object.fromEntries(actionsByElement),
      mostUsedElement: Array.from(actionsByElement.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || 'none',
      struggleIndicators: this.detectStrugglePatterns(),
      patterns: this.learnPatterns().slice(0, 10), // Top 10 patterns
      prediction: this.predictNextAction()
  };
}

  /**
   * Save to localStorage for persistence
   */
  private saveToStorage() {
    if (typeof window === 'undefined') return;
    
    try {
      const data = {
        actions: this.actions.slice(-100), // Keep last 100
        sessionStartTime: this.sessionStartTime,
        timestamp: Date.now()
    };
      localStorage.setItem('action_tracker_data', JSON.stringify(data));
  } catch (error) {
      console.warn('Failed to save action tracker data: ', error);
  }
}

  /**
   * Load from localStorage
   */
  private loadFromStorage() {
    if (typeof window === 'undefined') return;
    
    try {
      const stored = localStorage.getItem('action_tracker_data');
      if (stored) {
        const data = JSON.parse(stored);
        // Only load if from today (reset daily)
        if (Date.now() - data.timestamp < 86400000) {
          this.actions = data.actions || [];
          this.sessionStartTime = data.sessionStartTime || Date.now();
      }
    }
  } catch (error) {
      console.warn('Failed to load action tracker data:', error);
  }
}

  /**
   * Clear all data (GDPR compliance)
   */
  clearAllData() {
    this.actions = [];
    this.patterns.clear();
    this.struggleIndicators = [];
    if (typeof window !== 'undefined') {
      localStorage.removeItem('action_tracker_data');
  }
}

  // Generate intelligent contextual questions based on recent actions
  generateContextualQuestion(profession: string, dashboard: string): ContextualQuestion | null {
    // 🧠 SMART: Check for struggle indicators first
    const struggles = this.detectStrugglePatterns();
    if (struggles.length > 0 && struggles[0].severity === 'high') {
      return {
        question: `Jeg la merke til at du har hatt noen utfordringer med "${struggles[0].element}". Kan jeg hjelpe?`,
        category: 'struggle_assistance',
        suggestions: ['Ja, vis meg hvordan','Nei, jeg finner det ut','Vis tutorial','Kontakt support'],
        priority: 'high',
        trigger: 'immediate'
    };
  }

    const lastAction = this.getLastAction();
    if (!lastAction) {
      return {
        question: `Hvordan fungerer ${dashboard} dashboardet for deg som ${profession}?`,
        category: 'general',
        suggestions: ['Meget bra','Bra','Kan forbedres','Trenger hjelp'],
        priority: 'low',
        trigger: 'delayed'
    };
  }

    const { type, element, context } = lastAction;
    const timeSinceAction = Date.now() - lastAction.timestamp;

    // Only generate questions for recent actions (last 2 minutes)
    if (timeSinceAction > 120000) {
      return null;
  }

    // Generate specific questions based on action type and element
    if (type === 'button_click') {
      if (
        element.includes('ny_prosjekt') ||
        element.includes('new_project') ||
        element.includes('Opprett prosjekt')
      ) {
        return {
          question: `Jeg ser du nettopp klikket på "Ny prosjekt"-knappen. Fungerer prosjektopprettelsen optimalt for deg?`,
          category: 'project_creation',
          suggestions: [
            'Ja, very smooth','Noen små problemer','Kan forbedres betydelig','Helt ubrukelig',
          ],
          priority: 'high',
          trigger: 'immediate'
      };
    }

      if (element.includes('innstillinger') || element.includes('settings')) {
        return {
          question: `Du har nettopp åpnet innstillinger. Er det lett å finne det du leter etter?`,
          category: 'settings_navigation',
          suggestions: [
            'Meget intuitivt','Greit å navigere','Litt forvirrende','Vanskelig å finne ting',
          ],
          priority: 'medium',
          trigger: 'delayed'
      };
    }

      if (element.includes('kamera') || element.includes('camera') || element.includes('utstyr')) {
        return {
          question: `Du valgte akkurat kamerautstyr. Fungerer utstyrsdatabasen og firmware-systemet godt?`,
          category: 'equipment_system',
          suggestions: ['Perfekt','Meget bra','Mangler noe','Helt ubrukelig'],
          priority: 'medium',
          trigger: 'delayed'
      };
    }

      if (
        element.includes('prisberegning') ||
        element.includes('price') ||
        element.includes('kalkulator')
      ) {
        return {
          question: `Du brukte nettopp prisberegningssystemet. Er priskalkulatoren nøyaktig og lett å bruke?`,
          category: 'pricing_system',
          suggestions: ['Zeer accurate','Mostly correct','Needs adjustment','Completely wrong'],
          priority: 'high',
          trigger: 'immediate'
      };
    }

      if (
        element.includes('google') ||
        element.includes('drive') ||
        element.includes('integrasjon')
      ) {
        return {
          question: `Du interagerte med Google-integrasjonen. Fungerer Google Drive og andre tjenester sømløst?`,
          category: 'google_integration',
          suggestions: ['Seamless integration','Minor issues','Major problems', "Doesn't work"],
          priority: 'high',
          trigger: 'immediate'
      };
    }
  }

    if (type === 'tab_change') {
      return {
        question: `Du byttet akkurat til "${context.tab}"-fanen. Er navigeringen mellom faner intuitiv?`,
        category: 'navigation',
        suggestions: ['Muy intuitivo','Pretty good','Somewhat confusing','Very confusing'],
        priority: 'low',
        trigger: 'on_idle'
    };
  }

    if (type === 'modal_open') {
      return {
        question: `Du åpnet akkurat "${element}"-dialogen. Er den informative og lett å bruke?`,
        category: 'modal_interaction',
        suggestions: ['Perfect','Good enough','Could be better','Frustrating'],
        priority: 'medium',
        trigger: 'delayed'
    };
  }

    // Profession-specific questions
    if (profession === 'photographer') {
      if (element.includes('bryllup') || element.includes('wedding')) {
        return {
          question: `Du arbeider med bryllupsprosjekt. Fungerer timeline og wedding-spesifikke funksjoner godt?`,
          category: 'wedding_features',
          suggestions: [
            'Fantastisk for bryllup','Bra, men kan forbedres','Mangler viktige funksjoner','Ubrukelig for bryllup',
          ],
          priority: 'high',
          trigger: 'immediate'
      };
    }
  }

    if (profession === 'videographer') {
      if (element.includes('video') || element.includes('story_arc')) {
        return {
          question: `Du bruker video-funksjonene. Hvordan fungerer Story Arc Studio og DaVinci Resolve integrasjonen?`,
          category: 'video_production',
          suggestions: [
            'Professional quality','Very useful','Needs improvement',
            "Doesn't meet needs",
          ],
          priority: 'high',
          trigger: 'immediate'
      };
    }
  }

    if (profession === 'music_producer') {
      if (element.includes('audio') || element.includes('midi') || element.includes('studio')) {
        return {
          question: `Du jobber med musikk-funksjoner. Fungerer studio-utstyret og plugin-systemet optimalt?`,
          category: 'music_production',
          suggestions: ['Perfect for production','Works well','Some issues','Major problems'],
          priority: 'high',
          trigger: 'immediate'
      };
    }
  }

    // Default contextual question
    return {
      question: `Du brukte akkurat "${element}". Fungerer denne funksjonen som forventet?`,
      category: 'feature_feedback',
      suggestions: ['Ja, perfekt','Stort sett bra', 'Trenger forbedring', 'Fungerer ikke'],
      priority: 'low',
      trigger: 'on_idle'
  };
}
  
  /**
   * 🧠 SMART: Get AI-powered optimization recommendations
   */
  getOptimizationRecommendations(): Array<{
    type: 'workflow' | 'ui' | 'feature' | 'performance';
    priority: 'low' | 'medium' | 'high';
    title: string;
    description: string;
    actionRequired: string;
}> {
    const recommendations: any[] = [];
    const analytics = this.getSessionAnalytics();
    const patterns = this.learnPatterns();

    // Recommend shortcuts for frequent actions
    patterns.slice(0, 3).forEach(pattern => {
      if (pattern.frequency >= 5) {
        recommendations.push({
          type: 'workflow',
          priority: 'high',
          title: `Create Keyboard Shortcut for ${pattern.pattern}`,
          description: `This action was performed ${pattern.frequency} times. Adding a keyboard shortcut would save time.`,
          actionRequired: `Add shortcut configuration for ${pattern.pattern}`
      });
    }
  });

    // Recommend UI improvements based on struggle
    this.struggleIndicators.forEach(indicator => {
      if (indicator.severity === 'high') {
        recommendations.push({
          type: 'ui',
          priority: 'high',
          title: `Improve UX for "${indicator.element}"`,
          description: indicator.suggestion,
          actionRequired: `Review and enhance ${indicator.element} user experience`
      });
    }
  });

    // Performance recommendations
    if (analytics.actionsPerMinute && parseFloat(analytics.actionsPerMinute) > 10) {
      recommendations.push({
        type: 'performance',
        priority: 'medium',
        title: 'High Activity Detected',
        description: `User is performing ${analytics.actionsPerMinute} actions per minute. Consider optimizing frequent workflows.`,
        actionRequired: 'Analyze and streamline common workflows'
    });
  }

    return recommendations;
}
}

// React hook for using action tracker
export function useActionTracker() {
  const [lastAction, setLastAction] = useState<UserAction | null>(null);
  const [recentActions, setRecentActions] = useState<UserAction[]>([]);

  const tracker = ActionTracker.getInstance();

  useEffect(() => {
    const listener = (action: UserAction) => {
      setLastAction(action);
      setRecentActions(tracker.getRecentActions());
};

    tracker.addListener(listener);

    // Initialize with existing data
    setLastAction(tracker.getLastAction());
    setRecentActions(tracker.getRecentActions());

    return () => {
      tracker.removeListener(listener);
  };
}, []);

  const trackAction = useCallback(
    (action: Omit<UserAction, 'id' | 'timestamp'>) => {
      tracker.trackAction(action);
  },
    [tracker],
  );

  const generateContextualQuestion = useCallback(
    (profession: string, dashboard: string) => {
      return tracker.generateContextualQuestion(profession, dashboard);
  },
    [tracker],
  );

  // 🧠 SMART: Get analytics and predictions
  const getAnalytics = useCallback(() => {
    return tracker.getSessionAnalytics();
}, [tracker]);

  const getOptimizations = useCallback(() => {
    return tracker.getOptimizationRecommendations();
}, [tracker]);

  const detectStruggles = useCallback(() => {
    return tracker.detectStrugglePatterns();
}, [tracker]);

  const predictNext = useCallback(() => {
    return tracker.predictNextAction();
}, [tracker]);

  return {
    // Basic tracking
    lastAction,
    recentActions,
    trackAction,
    generateContextualQuestion,
    
    // 🧠 SMART FEATURES
    getAnalytics,
    getOptimizations,
    detectStruggles,
    predictNext,
};
}

// Helper function to track button clicks
export function trackButtonClick(element: string, context: any = {}) {
  const tracker = ActionTracker.getInstance();
  tracker.trackAction({
    type: 'button_click',
    element,
    context,
});
}

// Helper function to track navigation
export function trackNavigation(location: string, context: any = {}) {
  const tracker = ActionTracker.getInstance();
  tracker.trackAction({
    type: 'navigation',
    element: location,
    context,
});
}

// Helper function to track tab changes
export function trackTabChange(tab: string, context: any = {}) {
  const tracker = ActionTracker.getInstance();
  tracker.trackAction({
    type: 'tab_change',
    element: tab,
    context: { ...context, tab },
});
}

// Helper function to track modal opens
export function trackModalOpen(modal: string, context: any = {}) {
  const tracker = ActionTracker.getInstance();
  tracker.trackAction({
    type:'modal_open',
    element: modal,
    context,
});
}
