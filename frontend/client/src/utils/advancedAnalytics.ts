// Placeholder for advancedAnalytics.ts
// This file will contain utilities for advanced analytics features including
// heatmaps, user behavior tracking, conversion funnels, A/B testing, and
// real-time analytics with machine learning insights.

export interface HeatmapData {
  id: string;
  type: 'click' | 'scroll' | 'move' | 'hover' | 'focus';
  x: number;
  y: number;
  intensity: number;
  timestamp: Date;
  sessionId: string;
  userId?: string;
  elementId?: string;
  elementType?: string;
  viewport: {
    width: number;
    height: number;
};
}

export interface UserBehaviorEvent {
  id: string;
  sessionId: string;
  userId?: string;
  eventType: 'page_view' | 'click' | 'scroll' | 'form_submit' | 'download' | 'exit' | 'custom';
  elementId?: string;
  elementType?: string;
  elementText?: string;
  elementClasses?: string[];
  elementAttributes?: Record<string, string>;
  position: {
    x: number;
    y: number;
};
  timestamp: Date;
  duration?: number;
  metadata: Record<string, any>;
}

export interface ConversionFunnel {
  id: string;
  name: string;
  steps: ConversionStep[];
  totalSessions: number;
  conversionRate: number;
  averageTimeToConvert: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ConversionStep {
  id: string;
  name: string;
  description: string;
  eventType: string;
  eventSelector?: string;
  order: number;
  sessions: number;
  conversionRate: number;
  averageTime: number;
  dropOffRate: number;
}

export interface ABTest {
  id: string;
  name: string;
  description: string;
  status: 'draft' | 'running' | 'paused' | 'completed' | 'cancelled';
  variants: ABTestVariant[];
  trafficAllocation: number;
  startDate: Date;
  endDate?: Date;
  primaryMetric: string;
  secondaryMetrics: string[];
  confidenceLevel: number;
  minimumDetectableEffect: number;
  results?: ABTestResults;
}

export interface ABTestVariant {
  id: string;
  name: string;
  description: string;
  trafficPercentage: number;
  changes: ABTestChange[];
  sessions: number;
  conversions: number;
  conversionRate: number;
  averageSessionDuration: number;
  bounceRate: number;
}

export interface ABTestChange {
  type: 'css' | 'html' | 'javascript' | 'content';
  selector: string;
  property?: string;
  value: string;
  description: string;
}

export interface ABTestResults {
  statisticalSignificance: boolean;
  confidenceLevel: number;
  pValue: number;
  winner?: string;
  lift: number;
  confidenceInterval: {
    lower: number;
    upper: number;
};
  sampleSize: number;
  duration: number;
}

export interface AnalyticsInsight {
  id: string;
  type: 'performance' | 'conversion' | 'engagement' | 'technical' | 'business';
  title: string;
  description: string;
  impact: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  data: Record<string, any>;
  recommendations: string[];
  createdAt: Date;
  status: 'new' | 'reviewed' | 'implemented' | 'dismissed';
}

export interface RealTimeMetrics {
  activeUsers: number;
  pageViews: number;
  sessions: number;
  bounceRate: number;
  averageSessionDuration: number;
  topPages: Array<{
    path: string;
    views: number;
    uniqueViews: number;
}>;
  topReferrers: Array<{
    source: string;
    visits: number;
}>;
  deviceBreakdown: {
    desktop: number;
    mobile: number;
    tablet: number;
};
  browserBreakdown: Array<{
    browser: string;
    percentage: number;
}>;
  geographicData: Array<{
    country: string;
    users: number;
}>;
}

export class AdvancedAnalytics {
  private heatmapData: HeatmapData[] = [];
  private userBehaviorEvents: UserBehaviorEvent[] = [];
  private conversionFunnels: ConversionFunnel[] = [];
  private abTests: ABTest[] = [];
  private insights: AnalyticsInsight[] = [];
  private realTimeMetrics: RealTimeMetrics = {
    activeUsers: 0,
    pageViews: 0,
    sessions: 0,
    bounceRate: 0,
    averageSessionDuration: 0,
    topPages: [],
    topReferrers: [],
    deviceBreakdown: { desktop: 0, mobile: 0, tablet: 0 },
    browserBreakdown: [],
    geographicData: []
};

  constructor() {
    this.initializeDefaultData();
}

  private initializeDefaultData(): void {
    // Initialize with sample data
    this.conversionFunnels = [
      {
        id: 'funnel-00',
        name: 'Landing Page Conversion',
        steps: [
          {
            id: 'step-landing',
            name: 'Landing Page View',
            description: 'User visits the landing page',
            eventType: 'page_view',
            order:  1,
            sessions: 100,
            conversionRate: 10,
            averageTime:  0,
            dropOffRate: 0
          },
          {
            id: 'step-cta',
            name: 'CTA Click',
            description: 'User clicks the main call-to-action',
            eventType: 'click',
            eventSelector: '.cta-button',
            order:  2,
            sessions: 30,
            conversionRate:  30,
            averageTime:  45,
            dropOffRate: 70
          },
          {
            id: 'step-submit',
            name: 'Form Submission',
            description: 'User submits the contact form',
            eventType: 'form_submit',
            order:  3,
            sessions: 10,
            conversionRate:  50,
            averageTime: 10,
            dropOffRate: 50
 }
        ],
        totalSessions: 100,
        conversionRate:  15,
        averageTimeToConvert: 15,
        createdAt: new Date(),
        updatedAt: new Date()
 }
    ];

    this.abTests = [
      {
        id: 'test-00',
        name: 'Button Color Test',
        description: 'Test different button colors for conversion rate',
        status: 'running',
        variants: [
          {
            id: 'variant-control',
            name: 'Control (Blue)',
            description: 'Original blue button',
            trafficPercentage:  50,
            changes:  [],
            sessions: 500,
            conversions:  75,
            conversionRate:  15,
            averageSessionDuration: 10,
            bounceRate: 45
 },
          {
            id: 'variant-test',
            name: 'Test (Green)',
            description: 'Green button variant',
            trafficPercentage:  50,
            changes: [
              {
                type: 'css',
                selector: '.cta-button',
                property: 'background-color',
                value: '#16a34a',
                description: 'Change button color to green'
 }
            ],
            sessions: 500,
            conversions:  90,
            conversionRate:  18,
            averageSessionDuration: 15,
            bounceRate: 42
 }
        ],
        trafficAllocation: 100,
        startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        primaryMetric: 'conversion_rate',
        secondaryMetrics: ['bounce_rate','session_duration'],
        confidenceLevel:  95,
        minimumDetectableEffect: 10
 }
    ];
}

  // Heatmap methods
  recordHeatmapEvent(data: Omit<HeatmapData, 'id' | 'timestamp'>): HeatmapData {
    const heatmapEvent: HeatmapData = {
      id: `heatmap-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      ...data
};

    this.heatmapData.push(heatmapEvent);
    return heatmapEvent;
}

  getHeatmapData(sessionId?: string, type?: string): HeatmapData[] {
    let filtered = this.heatmapData;

    if (sessionId) {
      filtered = filtered.filter(event => event.sessionId === sessionId);
}

    if (type) {
      filtered = filtered.filter(event => event.type === type);
}

    return filtered;
}

  getHeatmapAggregatedData(elementId?: string): Array<{
    x: number;
    y: number;
    intensity: number;
    count: number;
 }> {
    let filtered = this.heatmapData;

    if (elementId) {
      filtered = filtered.filter(event => event.elementId === elementId);
}

    // Aggregate data by position
    const aggregated = new Map<string, { x: number; y: number; intensity: number; count: number }>();

    filtered.forEach(event => {
      const key = `${event.x},${event.y}`;
      const existing = aggregated.get(key);

      if (existing) {
        existing.intensity += event.intensity;
        existing.count += 1;
  } else {
        aggregated.set(key, {
          x: event.x,
          y: event.y,
          intensity: event.intensity,
          count: 1
 });
  }
});

    return Array.from(aggregated.values());
}

  // User behavior tracking methods
  recordUserBehaviorEvent(data: Omit<UserBehaviorEvent, 'id' | 'timestamp'>): UserBehaviorEvent {
    const event: UserBehaviorEvent = {
      id: `behavior-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      ...data
};

    this.userBehaviorEvents.push(event);
    return event;
}

  getUserBehaviorEvents(sessionId?: string, eventType?: string): UserBehaviorEvent[] {
    let filtered = this.userBehaviorEvents;

    if (sessionId) {
      filtered = filtered.filter(event => event.sessionId === sessionId);
}

    if (eventType) {
      filtered = filtered.filter(event => event.eventType === eventType);
}

    return filtered.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
}

  getSessionPath(sessionId: string): UserBehaviorEvent[] {
    return this.userBehaviorEvents
      .filter(event => event.sessionId === sessionId)
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  getPopularElements(elementType?: string): Array<{
    elementId: string;
    elementType: string;
    elementText?: string;
    clickCount: number;
    hoverCount: number;
    uniqueUsers: number;
 }> {
    const elementStats = new Map<string, {
      elementId: string;
      elementType: string;
      elementText?: string;
      clickCount: number;
      hoverCount: number;
      uniqueUsers: Set<string>;
 }>();

    this.userBehaviorEvents.forEach(event => {
      if (!event.elementId) return;

      const key = event.elementId;
      const existing = elementStats.get(key);

      if (existing) {
        if (event.eventType === 'click') existing.clickCount++;
        if (event.userId) existing.uniqueUsers.add(event.userId);
      } else {
        elementStats.set(key, {
          elementId: event.elementId,
          elementType: event.elementType || 'unknown',
          elementText: event.elementText,
          clickCount: event.eventType === 'click' ? 1 : 0,
          hoverCount: 0,
          uniqueUsers: new Set(event.userId ? [event.userId] : [])
        });
      }
    });

    return Array.from(elementStats.values())
      .filter(stat => !elementType || stat.elementType === elementType)
      .map(stat => ({
        ...stat,
        uniqueUsers: stat.uniqueUsers.size
 }))
      .sort((a, b) => (b.clickCount + b.hoverCount) - (a.clickCount + a.hoverCount));
}

  // Conversion funnel methods
  createConversionFunnel(data: Omit<ConversionFunnel, 'id' | 'createdAt' | 'updatedAt'>): ConversionFunnel {
    const funnel: ConversionFunnel = {
      id: `funnel-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...data
};

    this.conversionFunnels.push(funnel);
    return funnel;
}

  getConversionFunnels(): ConversionFunnel[] {
    return this.conversionFunnels;
}

  getConversionFunnel(id: string): ConversionFunnel | undefined {
    return this.conversionFunnels.find(funnel => funnel.id === id);
 }

  updateConversionFunnel(id: string, updates: Partial<ConversionFunnel>): ConversionFunnel | null {
    const index = this.conversionFunnels.findIndex(funnel => funnel.id === id);
    if (index === -1) return null;

    this.conversionFunnels[index] = {
      ...this.conversionFunnels[index],
      ...updates,
      updatedAt: new Date()
};

    return this.conversionFunnels[index];
}

  // A/B testing methods
  createABTest(data: Omit<ABTest, 'id'>): ABTest {
    const test: ABTest = {
      id: `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      ...data
};

    this.abTests.push(test);
    return test;
}

  getABTests(): ABTest[] {
    return this.abTests;
}

  getABTest(id: string): ABTest | undefined {
    return this.abTests.find(test => test.id === id);
 }

  updateABTest(id: string, updates: Partial<ABTest>): ABTest | null {
    const index = this.abTests.findIndex(test => test.id === id);
    if (index === -1) return null;

    this.abTests[index] = {
      ...this.abTests[index],
      ...updates
};

    return this.abTests[index];
}

  startABTest(id: string): ABTest | null {
    const test = this.getABTest(id);
    if (!test) return null;

    test.status = 'running';
    test.startDate = new Date();
    return test;
 }

  stopABTest(id: string): ABTest | null {
    const test = this.getABTest(id);
    if (!test) return null;

    test.status = 'completed';
    test.endDate = new Date();
    return test;
 }

  calculateABTestResults(testId: string): ABTestResults | null {
    const test = this.getABTest(testId);
    if (!test || test.variants.length < 2) return null;

    const control = test.variants[0];
    const treatment = test.variants[1];

    // Simplified statistical calculation
    const controlRate = control.conversionRate / 100;
    const treatmentRate = treatment.conversionRate / 100;
    const controlSessions = control.sessions;
    const treatmentSessions = treatment.sessions;

    const pooledRate = (control.conversions + treatment.conversions) / (controlSessions + treatmentSessions);
    const standardError = Math.sqrt(pooledRate * (1 - pooledRate) * (1/controlSessions + 1/treatmentSessions));
    const zScore = (treatmentRate - controlRate) / standardError;
    const pValue = 2 * (1 - this.normalCDF(Math.abs(zScore)));

    const lift = ((treatmentRate - controlRate) / controlRate) * 100;
    const confidenceInterval = 1.96 * standardError;

    const results: ABTestResults = {
      statisticalSignificance: pValue < 0.05,
      confidenceLevel: 95,
      pValue,
      winner: treatmentRate > controlRate ? treatment.id : control.id,
      lift,
      confidenceInterval: {
        lower: lift - confidenceInterval,
        upper: lift + confidenceInterval
      },
      sampleSize: controlSessions + treatmentSessions,
      duration: test.endDate ? test.endDate.getTime() - test.startDate.getTime() : Date.now() - test.startDate.getTime()
    };

    test.results = results;
    return results;
}

  private normalCDF(x: number): number {
    // Approximation of the normal cumulative distribution function
    return 0.5 * (1 + this.erf(x / Math.sqrt(2)));
 }

  private erf(x: number): number {
    // Approximation of the error function
    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const p = 0.3275911;

    const sign = x >= 0 ? 1 : -1;
    x = Math.abs(x);

    const t = 1.0 / (1.0 + p * x);
    const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

    return sign * y;
 }

  // Real-time metrics methods
  updateRealTimeMetrics(): void {
    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;

    // Filter events from the last hour
    const recentEvents = this.userBehaviorEvents.filter(
      event => event.timestamp.getTime() > oneHourAgo
  );

    const uniqueSessions = new Set(recentEvents.map(event => event.sessionId));
    const uniqueUsers = new Set(recentEvents.map(event => event.userId).filter(Boolean));

    this.realTimeMetrics = {
      activeUsers: uniqueUsers.size,
      pageViews: recentEvents.filter(event => event.eventType === 'page_view').length,
      sessions: uniqueSessions.size,
      bounceRate: this.calculateBounceRate(recentEvents),
      averageSessionDuration: this.calculateAverageSessionDuration(recentEvents),
      topPages: this.getTopPages(recentEvents),
      topReferrers: this.getTopReferrers(recentEvents),
      deviceBreakdown: this.getDeviceBreakdown(recentEvents),
      browserBreakdown: this.getBrowserBreakdown(recentEvents),
      geographicData: this.getGeographicData(recentEvents)
};
}

  getRealTimeMetrics(): RealTimeMetrics {
    this.updateRealTimeMetrics();
    return this.realTimeMetrics;
}

  private calculateBounceRate(events: UserBehaviorEvent[]): number {
    const sessions = new Map<string, UserBehaviorEvent[]>();
    
    events.forEach(event => {
      if (!sessions.has(event.sessionId)) {
        sessions.set(event.sessionId, []);
  }
      sessions.get(event.sessionId)!.push(event);
});

    let bounceCount = 0;
    sessions.forEach(sessionEvents => {
      if (sessionEvents.length === 1) {
        bounceCount++;
  }
});

    return sessions.size > 0 ? (bounceCount / sessions.size) * 100 : 0;
}

  private calculateAverageSessionDuration(events: UserBehaviorEvent[]): number {
    const sessions = new Map<string, UserBehaviorEvent[]>();
    
    events.forEach(event => {
      if (!sessions.has(event.sessionId)) {
        sessions.set(event.sessionId, []);
  }
      sessions.get(event.sessionId)!.push(event);
});

    let totalDuration = 0;
    let sessionCount = 0;

    sessions.forEach(sessionEvents => {
      if (sessionEvents.length > 1) {
        const firstEvent = sessionEvents[0];
        const lastEvent = sessionEvents[sessionEvents.length - 1];
        const duration = lastEvent.timestamp.getTime() - firstEvent.timestamp.getTime();
        totalDuration += duration;
        sessionCount++;
  }
});

    return sessionCount > 0 ? totalDuration / sessionCount / 1000 : 0; // Return in seconds
}

  private getTopPages(events: UserBehaviorEvent[]): Array<{ path: string; views: number; uniqueViews: number }> {
    const pageViews = events.filter(event => event.eventType === 'page_view');
    const pageStats = new Map<string, { views: number; uniqueUsers: Set<string> }>();

    pageViews.forEach(event => {
      const path = event.metadata.path || 'unknown';
      if (!pageStats.has(path)) {
        pageStats.set(path, { views: 0, uniqueUsers: new Set() });
      }

      const stats = pageStats.get(path)!;
      stats.views++;
      if (event.userId) stats.uniqueUsers.add(event.userId);
    });

    return Array.from(pageStats.entries())
      .map(([path, stats]) => ({
        path,
        views: stats.views,
        uniqueViews: stats.uniqueUsers.size
      }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 10);
  }

  private getTopReferrers(events: UserBehaviorEvent[]): Array<{ source: string; visits: number }> {
    const referrerStats = new Map<string, number>();

    events.forEach(event => {
      const referrer = event.metadata.referrer || 'direct';
      referrerStats.set(referrer, (referrerStats.get(referrer) || 0) + 1);
});

    return Array.from(referrerStats.entries())
      .map(([source, visits]) => ({ source, visits }))
      .sort((a, b) => b.visits - a.visits)
      .slice(0, 10);
}

  private getDeviceBreakdown(events: UserBehaviorEvent[]): { desktop: number; mobile: number; tablet: number } {
    const deviceStats = { desktop:  0, mobile:  0, tablet:  0 };

    events.forEach(event => {
      const device = event.metadata.device || 'desktop';
      if (device in deviceStats) {
        deviceStats[device as keyof typeof deviceStats]++;
  }
});

    return deviceStats;
}

  private getBrowserBreakdown(events: UserBehaviorEvent[]): Array<{ browser: string; percentage: number }> {
    const browserStats = new Map<string, number>();

    events.forEach(event => {
      const browser = event.metadata.browser || 'unknown';
      browserStats.set(browser, (browserStats.get(browser) || 0) + 1);
});

    const total = Array.from(browserStats.values()).reduce((sum, count) => sum + count, 0);

    return Array.from(browserStats.entries())
      .map(([browser, count]) => ({
        browser,
        percentage: total > 0 ? (count / total) * 100 : 0
 }))
      .sort((a, b) => b.percentage - a.percentage);
}

  private getGeographicData(events: UserBehaviorEvent[]): Array<{ country: string; users: number }> {
    const countryStats = new Map<string, Set<string>>();

    events.forEach(event => {
      if (event.userId && event.metadata.country) {
        const country = event.metadata.country;
        if (!countryStats.has(country)) {
          countryStats.set(country, new Set());
    }
        countryStats.get(country)!.add(event.userId);
  }
});

    return Array.from(countryStats.entries())
      .map(([country, users]) => ({
        country,
        users: users.size
 }))
      .sort((a, b) => b.users - a.users)
      .slice(0, 10);
}

  // Analytics insights methods
  generateInsights(): AnalyticsInsight[] {
    const insights: AnalyticsInsight[] = [];

    // Performance insights
    const avgSessionDuration = this.calculateAverageSessionDuration(this.userBehaviorEvents);
    if (avgSessionDuration < 30) {
      insights.push({
        id: `insight-${Date.now()}-1`,
        type: 'performance',
        title: 'Low Session Duration',
        description: 'Average session duration is below 30 seconds, indicating potential user engagement issues.',
        impact: 'high',
        confidence: 0.5,
        data: { averageSessionDuration: avgSessionDuration },
        recommendations: [
          'Improve page loading speed','Add more engaging content','Optimize user flow'
        ],
        createdAt: new Date(),
        status: 'new'
 });
}

    // Conversion insights
    const bounceRate = this.calculateBounceRate(this.userBehaviorEvents);
    if (bounceRate > 70) {
      insights.push({
        id: `insight-${Date.now()}-2`,
        type: 'conversion',
        title: 'High Bounce Rate',
        description: `Bounce rate is ${bounceRate.toFixed()}%, which is above the recommended threshold.`,
        impact: 'high',
        confidence: 0.8,
        data: { bounceRate },
        recommendations: [
          'Improve page relevance','Add clear call-to-actions','Optimize page content'
        ],
        createdAt: new Date(),
        status: 'new'
 });
}

    // Engagement insights
    const popularElements = this.getPopularElements();
    if (popularElements.length > 0) {
      const topElement = popularElements[0];
      if (topElement.clickCount > 100) {
        insights.push({
          id: `insight-${Date.now()}-3`,
          type: 'engagement',
          title: 'High Element Engagement',
          description: `Element "${topElement.elementText || topElement.elementId}" has ${topElement.clickCount} clicks.`,
          impact: 'medium',
          confidence: 0.5,
          data: { element: topElement },
          recommendations: [
            'Consider promoting this element',
            'Use similar design patterns elsewhere',
            'Analyze what makes this element successful'
          ],
          createdAt: new Date(),
          status: 'new'
 });
  }
}

    this.insights.push(...insights);
    return insights;
}

  getInsights(): AnalyticsInsight[] {
    return this.insights.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

  updateInsightStatus(id: string, status: AnalyticsInsight['status']): AnalyticsInsight | null {
    const insight = this.insights.find(i => i.id === id);
    if (!insight) return null;

    insight.status = status;
    return insight;
 }

  // Export methods
  exportData(): Record<string, any> {
    return {
      heatmapData: this.heatmapData,
      userBehaviorEvents: this.userBehaviorEvents,
      conversionFunnels: this.conversionFunnels,
      abTests: this.abTests,
      insights: this.insights,
      realTimeMetrics: this.realTimeMetrics,
      exportedAt: new Date().toISOString()
};
}

  importData(data: Record<string, any>): void {
    if (data.heatmapData) this.heatmapData = data.heatmapData;
    if (data.userBehaviorEvents) this.userBehaviorEvents = data.userBehaviorEvents;
    if (data.conversionFunnels) this.conversionFunnels = data.conversionFunnels;
    if (data.abTests) this.abTests = data.abTests;
    if (data.insights) this.insights = data.insights;
    if (data.realTimeMetrics) this.realTimeMetrics = data.realTimeMetrics;
}
}

// Export singleton instance
export const advancedAnalytics = new AdvancedAnalytics();



