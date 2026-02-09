/**
 * Progress Tracking Service for CreatorHub
 * Provides comprehensive progress tracking, analytics, and reporting capabilities
 */

export interface ProgressData {
  timestamp: string;
  value: number;
  context: ProgressContext;
  metadata?: Record<string, any>;
}

export interface ProgressContext {
  userId?: string;
  projectId?: string;
  sessionId?: string;
  category: 'learning' | 'project' | 'feature' | 'user';
  source?: string;
  tags?: string[];
}

export interface ProgressMetrics {
  total: number;
  completed: number;
  inProgress: number;
  percentage: number;
  lastUpdate: string;
  trends: ProgressTrend[];
}

export interface ProgressTrend {
  date: string;
  value: number;
  category: string;
}

export interface UserProgress {
  userId: string;
  completionPercentage: number;
  lastActivity: string;
  streaks: Record<string, number>;
  achievements: Achievement[];
  skillsDeveloped: string[];
  totalTimeSpent: number;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  category: 'learning' | 'project' | 'skill' | 'milestone';
  difficulty: 'easy' | 'medium' | 'hard' | 'expert';
  points: number;
  unlockedAt?: string;
  icon?: string;
}

export interface ProgressSession {
  sessionId: string;
  userId: string;
  startTime: string;
  endTime?: string;
  activities: ActivityRecord[];
  summary: SessionSummary;
  context?: ProgressContext;
}

export interface ActivityRecord {
  id: string;
  type: string;
  timestamp: string;
  duration: number;
  progress: number;
  metadata: Record<string, any>;
}

export interface SessionSummary {
  totalDuration: number;
  progressGained: number;
  activitiesCompleted: number;
  focusScore: number;
  productivityScore: number;
}

export interface ProgressAnalytics {
  dailyProgress: Record<string, number>;
  weeklyTrends: ProgressTrend[];
  monthlyGoals: GoalTracking[];
  learningVelocity: number;
  skillProgression: SkillProgression[];
}

export interface GoalTracking {
  goalId: string;
  title: string;
  targetValue: number;
  currentValue: number;
  deadline?: string;
  status: 'not_started' | 'in_progress' | 'completed' | 'expired';
  percentageComplete: number;
}

export interface SkillProgression {
  skillId: string;
  name: string;
  level: number;
  experience: number;
  nextLevelXP: number;
  milestones: SkillMilestone[];
}

export interface SkillMilestone {
  id: string;
  title: string;
  description: string;
  xpReward: number;
  achieved: boolean;
  achievedAt?: string;
}

class ProgressTrackingService {
  private baseUrl: string;
  private storage: Map<string, any> = new Map();
  private sessionData: ProgressSession[] = [];
  private isEnabled: boolean = true;

  constructor(baseUrl = '/api/progress') {
    this.baseUrl = baseUrl;
    this.loadFromLocalStorage();
}

  /**
   * Track user progress with detailed metrics
   */
  async trackProgress(data: ProgressData): Promise<void> {
    try {
      if (this.isEnabled) {
        const response = await fetch(`${this.baseUrl}/track`, {
          method: 'POST',
          headers: { 'Content-Type' : 'application/json' },
          body: JSON.stringify(data)
        });

        if (!response.ok) {
          throw new Error(`Progress tracking failed: ${response.statusText}`);
      }
    }
      
      // Also store locally for persistence
      this.storeProgressLocally(data);
  } catch (error) {
      console.error('Progress tracking failed: ', error);
      // Fallback: store locally
      this.storeProgressLocally(data);
    }
}

  /**
   * Get comprehensive progress report for a user
   */
  async getProgress(userId?: string, projectId?: string): Promise<ProgressMetrics> {
    try {
      const params = new URLSearchParams();
      if (userId) params.append('userId', userId);
      if (projectId) params.append('projectId', projectId);

      const response = await fetch(`${this.baseUrl}/metrics?${params}`);
      
      if (!response.ok) {
        throw new Error(`Progress retrieval failed: ${response.statusText}`);
    }

      return await response.json();
  } catch (error) {
      console.error('Progress retrieval failed:', error);
      // Fallback: return local data
      return this.getLocalProgress(userId, projectId);
  }
}

  /**
   * Start a progress tracking session
   */
  startSession(userId: string, context?: Partial<ProgressContext>): string {
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const session: ProgressSession = {
      sessionId,
      userId,
      startTime: new Date().toISOString(),
      activities: [],
      summary: {
        totalDuration: 0,
        progressGained: 0,
        activitiesCompleted: 0,
        focusScore: 0,
        productivityScore: 0
      },
      context: {
        userId,
        category: context?.category ?? 'user',
        projectId: context?.projectId,
        sessionId,
        source: context?.source,
        tags: context?.tags,
      }
    };

    this.sessionData.push(session);
    this.saveToLocalStorage();
    
    return sessionId;
  }

  /**
   * End a progress tracking session
   */
  async endSession(sessionId: string): Promise<SessionSummary> {
    const session = this.sessionData.find(s => s.sessionId === sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    session.endTime = new Date().toISOString();
    const endTime = new Date(session.endTime);
    const startTime = new Date(session.startTime);
    session.summary.totalDuration = endTime.getTime() - startTime.getTime();

    // Calculate session metrics
    session.summary.activitiesCompleted = session.activities.length;
    session.summary.progressGained = session.activities.reduce((sum, activity) => sum + activity.progress, 0);
    
    this.saveToLocalStorage();
    
    return session.summary;
  }

  /**
   * Record an activity within a session
   */
  async recordActivity(
    sessionId: string,
    activity: Omit<ActivityRecord, 'id' | 'timestamp'>
  ): Promise<void> {
    const session = this.sessionData.find(s => s.sessionId === sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const activityRecord: ActivityRecord = {
      id: `activity_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      ...activity,
    };

    session.activities.push(activityRecord);
    this.saveToLocalStorage();
  }

  /**
   * Get user achievements and progress
   */
  async getUserProgress(userId: string): Promise<UserProgress> {
    try {
      const response = await fetch(`${this.baseUrl}/user/${userId}`);
      
      if (!response.ok) {
        throw new Error(`User progress retrieval failed: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('User progress retrieval failed:', error);
      // Fallback: generate basic progress
      return this.generateUserProgress(userId);
    }
  }

  /**
   * Get detailed analytics and insights
   */
  async getAnalytics(userId?: string, timeRange?: { start: string; end: string }): Promise<ProgressAnalytics> {
    try {
      const params = new URLSearchParams();
      if (userId) params.append('userId', userId);
      if (timeRange) {
        params.append('start', timeRange.start);
        params.append('end', timeRange.end);
      }

      const response = await fetch(`${this.baseUrl}/analytics?${params}`);
      
      if (!response.ok) {
        throw new Error(`Analytics retrieval failed: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Analytics retrieval failed:', error);
      // Fallback: generate basic analytics
      return this.generateBasicAnalytics(userId);
    }
  }

  /**
   * Set learning goals for users
   */
  async setGoal(
    userId: string,
    goal: Omit<GoalTracking, 'status' | 'percentageComplete' | 'goalId'>
  ): Promise<string> {
    try {
      const goalId = `goal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const goalTracking: GoalTracking = {
        goalId,
        ...goal,
        status: 'not_started',
        percentageComplete: (goal.currentValue / goal.targetValue) * 100,
      };

      // Store locally
      const goals = this.getLocalGoals(userId);
      goals.push(goalTracking);
      this.storage.set(`goals_${userId}`, goals);
      this.saveToLocalStorage();

      return goalId;
      } catch (error) {
      console.error('Goal setting failed:', error);
      throw error;
      }
      }

  /**
   * Update progress towards a goal
   */
  async updateGoal(goalId: string, currentValue: number): Promise<void> {
    try {
      // Find and update goal in all stored data
      for (const [key, value] of this.storage.entries()) {
        if (key.startsWith('goals_') && Array.isArray(value)) {
          const updatedGoals = value.map((goal: any) => {
            if (goal.goalId === goalId) {
              return {
                ...goal,
                currentValue,
                percentageComplete: (currentValue / goal.targetValue) * 100,
                status: currentValue >= goal.targetValue ? 'completed' : goal.status
              };
            }

            return goal;
          });
          this.storage.set(key, updatedGoals);
        }
      }
      
      this.saveToLocalStorage();
    } catch (error) {
      console.error('Goal update failed:', error);
      throw error;
    }
  }

  // Helper methods for local storage operations

  private loadFromLocalStorage(): void {
    try {
      const stored = localStorage.getItem('progressTrackingData');
      if (stored) {
        const data = JSON.parse(stored);
        if (data.storage) {
          this.storage = new Map(Object.entries(data.storage));
        }
        if (data.sessions) {
          this.sessionData = data.sessions;
        }
      }
    } catch (error) {
      console.error('Failed to load progress data:', error);
    }
  }

  private saveToLocalStorage(): void {
    try {
      const data = {
        storage: Object.fromEntries(this.storage),
        sessions: this.sessionData,
      };
      localStorage.setItem('progressTrackingData', JSON.stringify(data));
    } catch (error) {
      console.error('Failed to save progress data:', error);
    }
  }

  private storeProgressLocally(data: ProgressData): void {
    const key = `progress_${data.context.userId || 'global'}`;
    const existing = this.storage.get(key) || [];
    existing.push(data);
    this.storage.set(key, existing);
    this.saveToLocalStorage();
  }

  private getLocalProgress(userId?: string, projectId?: string): ProgressMetrics {
    const key = `progress_${userId || 'global'}`;
    const progressData: ProgressData[] = this.storage.get(key) || [];

    const filteredData = progressData.filter((entry) => {
      if (userId && entry.context.userId && entry.context.userId !== userId) return false;
      if (projectId && entry.context.projectId && entry.context.projectId !== projectId) return false;
      if (projectId && !entry.context.projectId) return false;
      return true;
    });
    
    const total = filteredData.length;
    const completed = filteredData.filter((p) => p.value >= 1).length;
    const inProgress = filteredData.filter((p) => p.value > 0 && p.value < 1).length;
    
    return {
      total,
      completed,
      inProgress,
      percentage: total > 0 ? (completed / total) * 100 : 0,
      lastUpdate:
        total > 0 ? filteredData[filteredData.length - 1].timestamp : new Date().toISOString(),
      trends: [],
    };
  }

  private generateUserProgress(userId: string): UserProgress {
    return {
      userId,
      completionPercentage: 0,
      lastActivity: new Date().toISOString(),
      streaks: {},
      achievements: [],
      skillsDeveloped: [],
      totalTimeSpent: 0,
    };
  }

  private generateBasicAnalytics(userId?: string): ProgressAnalytics {
    const key = `progress_${userId || 'global'}`;
    const progressData: ProgressData[] = this.storage.get(key) || [];
    const dailyProgress: Record<string, number> = {};

    progressData.forEach((entry) => {
      const day = entry.timestamp.slice(0, 10);
      dailyProgress[day] = (dailyProgress[day] || 0) + entry.value;
    });

    const weeklyTrends: ProgressTrend[] = Object.entries(dailyProgress)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-14)
      .map(([date, value]) => ({
        date,
        value,
        category: 'daily'
      }));

    const learningVelocity = weeklyTrends.length
      ? weeklyTrends.reduce((sum, trend) => sum + trend.value, 0) / weeklyTrends.length
      : 0;

    return {
      dailyProgress,
      weeklyTrends,
      monthlyGoals: [],
      learningVelocity,
      skillProgression: [],
    };
  }

  private getLocalGoals(userId: string): GoalTracking[] {
    return this.storage.get(`goals_${userId}`) || [];
  }

  // Service management

  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
  }

  get isServiceEnabled(): boolean {
    return this.isEnabled;
  }

  clearAllData(): void {
    this.storage.clear();
    this.sessionData = [];
    localStorage.removeItem('progressTrackingData');
  }
}

// Create singleton instance
export const progressTrackingService = new ProgressTrackingService();

export default progressTrackingService;







