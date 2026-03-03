/**
 * Analytics Manager
 * Manages user interaction analytics and usage tracking
 */

export interface AnalyticsConfig {
  enableTracking: boolean;
  enableHeatmaps: boolean;
  enableUserBehavior: boolean;
  enablePerformance: boolean;
  enableErrors: boolean;
  enableEvents: boolean;
  enableSessions: boolean;
  enablePageViews: boolean;
  enableClicks: boolean;
  enableScrolls: boolean;
  enableForms: boolean;
  enableCustomEvents: boolean;
  batchSize: number;
  flushInterval: number;
  maxRetries: number;
  retryDelay: number;
  endpoint: string;
  apiKey?: string;
  userId?: string;
  sessionId?: string;
  debug: boolean;
}

export interface AnalyticsEvent {
  id: string;
  type: string;
  category: string;
  action: string;
  label?: string;
  value?: number;
  properties: Record<string, any>;
  timestamp: number;
  userId?: string;
  sessionId?: string;
  page?: string;
  url?: string;
  userAgent?: string;
  referrer?: string
}

export interface AnalyticsSession {
  id: string;
  userId?: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  pageViews: number;
  events: number;
  clicks: number;
  scrolls: number;
  forms: number;
  customEvents: number;
  properties: Record<string, any>;
}

export interface AnalyticsState {
  isTracking: boolean;
  isInitialized: boolean;
  hasError: boolean;
  error: string | null;
  currentSession: AnalyticsSession | null;
  eventQueue: AnalyticsEvent[];
  totalEvents: number;
  totalSessions: number;
  lastFlush: number;
  retryCount: number;
}

type AnalyticsEventCallback = (data?: unknown) => void;

class AnalyticsManager {
  private config: AnalyticsConfig;
  private state: AnalyticsState;
  private eventListeners: Map<string, AnalyticsEventCallback[]> = new Map();
  private flushInterval: NodeJS.Timeout | null = null;
  private sessionStartTime: number = Date.now();

  constructor(config: Partial<AnalyticsConfig> = {}) {
    this.config = {
      enableTracking: true,
      enableHeatmaps: true,
      enableUserBehavior: true,
      enablePerformance: true,
      enableErrors: true,
      enableEvents: true,
      enableSessions: true,
      enablePageViews: true,
      enableClicks: true,
      enableScrolls: true,
      enableForms: true,
      enableCustomEvents: true,
      batchSize: 50,
      flushInterval: 30000, // 30 seconds
      maxRetries: 3,
      retryDelay: 1000,
      endpoint: '/api/analytics',
      debug: false,
      ...config
    };

    this.state = {
      isTracking: false,
      isInitialized: false,
      hasError: false,
      error: null,
      currentSession: null,
      eventQueue: [],
      totalEvents: 0,
      totalSessions: 0,
      lastFlush: 0,
      retryCount: 0
    };

    this.initializeAnalytics();
  }

  /**
   * Initialize analytics
   */
  private initializeAnalytics(): void {
    if (!this.config.enableTracking) return;

    try {
      this.setupEventListeners();
      this.startSession();
      this.setupFlushInterval();
      this.state.isInitialized = true;
      this.state.isTracking = true;
      this.emit('initialized, ');
  } catch (error) {
      this.state.hasError = true;
      this.state.error = error instanceof Error ? error.message : 'Unknown error';
      this.emit('error, ', { error: this.state.error });
  }
}

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    if (!this.config.enableTracking) return;

    // Page visibility
    document.addEventListener('visibilitychange', this.handleVisibilityChange.bind(this));

    // Before unload
    window.addEventListener('beforeunload', this.handleBeforeUnload.bind(this));

    // Click tracking
    if (this.config.enableClicks) {
      document.addEventListener('click', this.handleClick.bind(this));
  }

    // Scroll tracking
    if (this.config.enableScrolls) {
      window.addEventListener('scroll', this.handleScroll.bind(this));
  }

    // Form tracking
    if (this.config.enableForms) {
      document.addEventListener('submit', this.handleFormSubmit.bind(this));
  }

    // Error tracking
    if (this.config.enableErrors) {
      window.addEventListener('error', this.handleError.bind(this));
      window.addEventListener('unhandledrejection', this.handleUnhandledRejection.bind(this));
  }
}

  /**
   * Start session
   */
  private startSession(): void {
    if (!this.config.enableSessions) return;

    this.state.currentSession = {
      id: this.generateId(),
      userId: this.config.userId,
      startTime: this.sessionStartTime,
      pageViews: 0,
      events: 0,
      clicks: 0,
      scrolls: 0,
      forms: 0,
      customEvents: 0,
      properties: {}
    };

    this.state.totalSessions++;
    this.emit('session_started', this.state.currentSession);
  }

  /**
   * End session
   */
  private endSession(): void {
    if (!this.state.currentSession) return;

    this.state.currentSession.endTime = Date.now();
    this.state.currentSession.duration = this.state.currentSession.endTime - this.state.currentSession.startTime;

    this.emit('session_ended', this.state.currentSession);
    this.state.currentSession = null;
  }

  /**
   * Setup flush interval
   */
  private setupFlushInterval(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }

    this.flushInterval = setInterval(() => {
      this.flush();
    }, this.config.flushInterval);
  }

  /**
   * Track event
   */
  trackEvent(type: string, category: string, action: string, properties: Record<string, any> = {}): void {
    if (!this.state.isTracking) return;

    const event: AnalyticsEvent = {
      id: this.generateId(),
      type,
      category,
      action,
      properties: {
        ...properties,
        timestamp: Date.now(),
        page: window.location.pathname,
        url: window.location.href,
        userAgent: navigator.userAgent,
        referrer: document.referrer
      },
      timestamp: Date.now(),
      userId: this.config.userId,
      sessionId: this.state.currentSession?.id,
      page: window.location.pathname,
      url: window.location.href,
      userAgent: navigator.userAgent,
      referrer: document.referrer
    };

    this.state.eventQueue.push(event);
    this.state.totalEvents++;

    if (this.state.currentSession) {
      this.state.currentSession.events++;
    }

    this.emit('event_tracked', event);

    // Flush if batch size reached
    if (this.state.eventQueue.length >= this.config.batchSize) {
      this.flush();
    }
  }

  /**
   * Track page view
   */
  trackPageView(page: string, properties: Record<string, any> = {}): void {
    if (!this.config.enablePageViews) return;

    this.trackEvent('page_view', 'navigation','view', {
      page,
      ...properties
  });

    if (this.state.currentSession) {
      this.state.currentSession.pageViews++;
  }
}

  /**
   * Track click
   */
  trackClick(element: string, properties: Record<string, any> = {}): void {
    if (!this.config.enableClicks) return;

    this.trackEvent('click','interaction','click', {
      element,
      ...properties
  });

    if (this.state.currentSession) {
      this.state.currentSession.clicks++;
  }
}

  /**
   * Track scroll
   */
  trackScroll(depth: number, properties: Record<string, any> = {}): void {
    if (!this.config.enableScrolls) return;

    this.trackEvent('scroll','interaction','scroll', {
      depth,
      ...properties
  });

    if (this.state.currentSession) {
      this.state.currentSession.scrolls++;
  }
}

  /**
   * Track form submission
   */
  trackFormSubmit(formName: string, properties: Record<string, any> = {}): void {
    if (!this.config.enableForms) return;

    this.trackEvent('form_submit','interaction','submit', {
      formName,
      ...properties
  });

    if (this.state.currentSession) {
      this.state.currentSession.forms++;
  }
}

  /**
   * Track custom event
   */
  trackCustomEvent(name: string, properties: Record<string, any> = {}): void {
    if (!this.config.enableCustomEvents) return;

    this.trackEvent('custom','custom', name, properties);

    if (this.state.currentSession) {
      this.state.currentSession.customEvents++;
  }
}

  /**
   * Track error
   */
  trackError(error: Error, properties: Record<string, any> = {}): void {
    if (!this.config.enableErrors) return;

    this.trackEvent('error','error','error', {
      message: error.message,
      stack: error.stack,
      ...properties
  });
}

  /**
   * Track performance
   */
  trackPerformance(metric: string, value: number, properties: Record<string, any> = {}): void {
    if (!this.config.enablePerformance) return;

    this.trackEvent('performance', 'performance', metric, {
      value,
      ...properties
  });
}

  /**
   * Handle visibility change
   */
  private handleVisibilityChange(): void {
    if (document.visibilityState === 'hidden') {
      this.endSession();
  } else {
      this.startSession();
  }
}

  /**
   * Handle before unload
   */
  private handleBeforeUnload(): void {
    this.endSession();
    this.flush();
}

  /**
   * Handle click
   */
  private handleClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    const element = target.tagName + (target.id ? `#${target.id}` : ', ') + (target.className ? `.${target.className}` : ', ');
    this.trackClick(element, {
      x: event.clientX,
      y: event.clientY,
      button: event.button
    });
  }

  /**
   * Handle scroll
   */
  private handleScroll(): void {
    const depth = Math.round((window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100);
    this.trackScroll(depth);
  }

  /**
   * Handle form submit
   */
  private handleFormSubmit(event: Event): void {
    const form = event.target as HTMLFormElement;
    this.trackFormSubmit(form.name || form.id || 'unknown');
  }

  /**
   * Handle error
   */
  private handleError(event: ErrorEvent): void {
    this.trackError(new Error(event.message), {
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno
    });
  }

  /**
   * Handle unhandled rejection
   */
  private handleUnhandledRejection(event: PromiseRejectionEvent): void {
    this.trackError(new Error(event.reason), {
      type: 'unhandled_rejection'
    });
  }

  /**
   * Flush events
   */
  async flush(): Promise<void> {
    if (this.state.eventQueue.length === 0) return;

    const events = [...this.state.eventQueue];
    this.state.eventQueue = [];
    this.state.lastFlush = Date.now();

    try {
      await this.sendEvents(events);
      this.state.retryCount = 0;
      this.emit('events_flushed', { count: events.length });
    } catch (error) {
      // Re-queue events on failure
      this.state.eventQueue.unshift(...events);
      this.state.retryCount++;

      if (this.state.retryCount < this.config.maxRetries) {
        setTimeout(() => this.flush(), this.config.retryDelay);
      } else {
        this.state.hasError = true;
        this.state.error = 'Failed to flush events after maximum retries';
        this.emit('error', { error: this.state.error });
      }
    }
  }

  /**
   * Send events
   */
  private async sendEvents(events: AnalyticsEvent[]): Promise<void> {
    try {
      const response = await fetch(this.config.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type' : 'application/json',
          ...(this.config.apiKey && {'Authorization': `Bearer ${this.config.apiKey}` })
        },
        body: JSON.stringify({
          events,
          session: this.state.currentSession,
          userId: this.config.userId,
          timestamp: Date.now()
        })
      });

      if (!response.ok) {
        console.warn(`Analytics endpoint returned ${response.status}, but continuing normally`);
      }
    } catch (error) {
      // Silently fail analytics - don't break the app if analytics is down
      console.warn('Failed to send analytics:', error);
    }
  }

  /**
   * Generate ID
   */
  private generateId(): string {
    return Math.random().toString(36).substring(2, 11) + Date.now().toString(36);
  }

  /**
   * Add event listener
   */
  on(event: string, callback: AnalyticsEventCallback): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(callback);
  }

  /**
   * Remove event listener
   */
  off(event: string, callback: AnalyticsEventCallback): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  /**
   * Emit event
   */
  private emit(event: string, data?: unknown): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(data);
        } catch (err) {
          console.error('Error in analytics event listener:', err);
        }
      });
    }
  }

  /**
   * Get state
   */
  getState(): AnalyticsState {
    return { ...this.state };
  }

  /**
   * Get configuration
   */
  getConfig(): AnalyticsConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<AnalyticsConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Cleanup
   */
  destroy(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }

    this.endSession();
    this.flush();

    this.eventListeners.clear();
    this.state.isTracking = false;
  }
}

// Create singleton instance
export const analyticsManager = new AnalyticsManager();

export default analyticsManager;





