/**
 * FeedbackAnalyticsService - Analytics, Gamification, and Achievements
 * 
 * Features:
 * - Personal contribution stats
 * - Badges and achievements
 * - Leaderboard
 * - Testing progress tracker
 * - XP and leveling system
 */

import { apiRequest } from '@/lib/queryClient';

const API_BASE = '/api/prototype-testing';

// ============================================================================
// Types
// ============================================================================

export interface TesterStats {
  totalFeedback: number;
  feedbackByType: Record<string, number>;
  feedbackByStatus: Record<string, number>;
  avgRating: number;
  resolvedIssues: number;
  implementedFeatures: number;
  testingSessions: number;
  totalTestingTime: number; // minutes
  componentsTestedCount: number;
  consecutiveDays: number;
  longestStreak: number;
  joinDate: string;
  xp?: number;
  level?: number;
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  tier: 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';
  unlockedAt?: string;
  progress?: number; // 0-100
  requirement: number;
  current: number;
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  avatar?: string;
  xp: number;
  level: number;
  badges: number;
  feedbackCount: number;
  isCurrentUser?: boolean;
}

export interface TesterLevel {
  level: number;
  name: string;
  minXP: number;
  maxXP: number;
  perks: string[];
  color: string;
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  xpReward: number;
  unlockedAt: string;
  type: 'milestone' | 'streak' | 'quality' | 'diversity' | 'special';
}

export interface TestingProgress {
  component: string;
  coverage: number; // 0-100
  lastTested: string;
  feedbackCount: number;
  issues: number;
  resolved: number;
}

// ============================================================================
// Constants
// ============================================================================

export const TESTER_LEVELS: TesterLevel[] = [
  { level: 1, name: 'Newcomer', minXP: 0, maxXP: 100, perks: ['Submit feedback'], color: '#9e9e9e' },
  { level: 2, name: 'Tester', minXP: 100, maxXP: 300, perks: ['Add screenshots'], color: '#4caf50' },
  { level: 3, name: 'Explorer', minXP: 300, maxXP: 600, perks: ['Audio recording'], color: '#2196f3' },
  { level: 4, name: 'Analyst', minXP: 600, maxXP: 1000, perks: ['Element targeting'], color: '#9c27b0' },
  { level: 5, name: 'Expert', minXP: 1000, maxXP: 1500, perks: ['Priority support'], color: '#ff9800' },
  { level: 6, name: 'Master', minXP: 1500, maxXP: 2500, perks: ['Early access'], color: '#f44336' },
  { level: 7, name: 'Champion', minXP: 2500, maxXP: 4000, perks: ['Direct dev access'], color: '#e91e63' },
  { level: 8, name: 'Legend', minXP: 4000, maxXP: 6000, perks: ['Feature voting'], color: '#673ab7' },
  { level: 9, name: 'Visionary', minXP: 6000, maxXP: 10000, perks: ['Roadmap input'], color: '#00bcd4' },
  { level: 10, name: 'Founder', minXP: 10000, maxXP: Infinity, perks: ['All perks', 'Name in credits'], color: '#ffd700' },
];

export const BADGES: Omit<Badge, 'unlockedAt' | 'progress' | 'current'>[] = [
  // Quantity badges
  { id: 'first_feedback', name: 'First Steps', description: 'Submit your first feedback', icon: 'flag', color: '#4caf50', tier: 'bronze', requirement: 1 },
  { id: 'feedback_10', name: 'Getting Started', description: 'Submit 10 feedback items', icon: 'star', color: '#4caf50', tier: 'bronze', requirement: 10 },
  { id: 'feedback_50', name: 'Active Tester', description: 'Submit 50 feedback items', icon: 'stars', color: '#2196f3', tier: 'silver', requirement: 50 },
  { id: 'feedback_100', name: 'Feedback Master', description: 'Submit 100 feedback items', icon: 'military_tech', color: '#ff9800', tier: 'gold', requirement: 100 },
  { id: 'feedback_500', name: 'Legendary Tester', description: 'Submit 500 feedback items', icon: 'emoji_events', color: '#9c27b0', tier: 'platinum', requirement: 500 },
  
  // Quality badges
  { id: 'detailed_1', name: 'Detail Oriented', description: 'Submit feedback with 200+ chars', icon: 'description', color: '#4caf50', tier: 'bronze', requirement: 1 },
  { id: 'screenshot_5', name: 'Visual Reporter', description: 'Include screenshots in 5 feedbacks', icon: 'photo_camera', color: '#2196f3', tier: 'silver', requirement: 5 },
  { id: 'audio_3', name: 'Voice of Reason', description: 'Include audio in 3 feedbacks', icon: 'mic', color: '#ff9800', tier: 'gold', requirement: 3 },
  
  // Bug hunting badges
  { id: 'bug_1', name: 'Bug Hunter', description: 'Report your first bug', icon: 'bug_report', color: '#f44336', tier: 'bronze', requirement: 1 },
  { id: 'bug_10', name: 'Exterminator', description: 'Report 10 bugs', icon: 'pest_control', color: '#f44336', tier: 'silver', requirement: 10 },
  { id: 'critical_bug', name: 'Critical Eye', description: 'Report a critical bug', icon: 'warning', color: '#9c27b0', tier: 'gold', requirement: 1 },
  
  // Feature badges
  { id: 'feature_1', name: 'Idea Spark', description: 'Suggest your first feature', icon: 'lightbulb', color: '#ff9800', tier: 'bronze', requirement: 1 },
  { id: 'feature_implemented', name: 'Visionary', description: 'Have a feature implemented', icon: 'verified', color: '#ffd700', tier: 'diamond', requirement: 1 },
  
  // Streak badges
  { id: 'streak_3', name: 'Consistent', description: '3-day testing streak', icon: 'local_fire_department', color: '#ff9800', tier: 'bronze', requirement: 3 },
  { id: 'streak_7', name: 'Dedicated', description: '7-day testing streak', icon: 'whatshot', color: '#f44336', tier: 'silver', requirement: 7 },
  { id: 'streak_30', name: 'Unstoppable', description: '30-day testing streak', icon: 'bolt', color: '#9c27b0', tier: 'gold', requirement: 30 },
  
  // Diversity badges
  { id: 'all_types', name: 'Well-Rounded', description: 'Submit all feedback types', icon: 'palette', color: '#2196f3', tier: 'silver', requirement: 4 },
  { id: 'components_5', name: 'Explorer', description: 'Test 5 different components', icon: 'explore', color: '#4caf50', tier: 'bronze', requirement: 5 },
  { id: 'components_20', name: 'Adventurer', description: 'Test 20 different components', icon: 'travel_explore', color: '#ff9800', tier: 'gold', requirement: 20 },
  
  // Special badges
  { id: 'early_adopter', name: 'Early Adopter', description: 'Join during beta phase', icon: 'rocket_launch', color: '#e91e63', tier: 'platinum', requirement: 1 },
  { id: 'helpful', name: 'Helpful', description: 'Feedback marked as helpful by dev', icon: 'thumb_up', color: '#4caf50', tier: 'gold', requirement: 1 },
];

// XP rewards
const XP_REWARDS = {
  feedback_submitted: 10,
  bug_report: 15,
  feature_request: 12,
  usability_issue: 12,
  with_screenshot: 5,
  with_audio: 8,
  with_video: 10,
  detailed_description: 5, // 200+ chars
  issue_resolved: 20,
  feature_implemented: 50,
  streak_bonus: 5, // per day in streak
  first_of_day: 5,
};

// ============================================================================
// FeedbackAnalyticsService
// ============================================================================

class FeedbackAnalyticsService {
  private stats: TesterStats | null = null;
  private xp: number = 0;
  private unlockedBadges: Set<string> = new Set();

  // --------------------------------------------------------------------------
  // Stats
  // --------------------------------------------------------------------------

  async fetchStats(userId: string): Promise<TesterStats> {
    try {
      const response = await apiRequest(`${API_BASE}/analytics/stats/${userId}`);
      this.stats = response as TesterStats;
      this.xp = this.stats.xp || this.calculateXP(this.stats);
      return this.stats;
    } catch (error) {
      // Return cached or default
      return this.getDefaultStats();
    }
  }

  async fetchBadges(userId: string): Promise<Badge[]> {
    try {
      const response = await apiRequest(`${API_BASE}/analytics/badges/${userId}`);
      return (response || []).map((b: any) => ({
        id: b.id,
        name: b.name,
        description: b.description,
        icon: this.getBadgeIcon(b.id),
        color: b.color,
        tier: b.tier,
        unlockedAt: b.unlockedAt,
        progress: 100,
        requirement: 1,
        current: 1
      }));
    } catch (error) {
      return [];
    }
  }

  private getBadgeIcon(badgeId: string): string {
    const iconMap: Record<string, string> = {
      'first_feedback':'flag','feedback_10':'star','feedback_50':'stars','feedback_100':'military_tech','feedback_500':'emoji_events','bug_1':'bug_report','bug_10':'pest_control','feature_1':'lightbulb','level_5':'workspace_premium','level_10' : 'diamond',
    };
    return iconMap[badgeId] || 'star';
  }

  getDefaultStats(): TesterStats {
    return {
      totalFeedback: 0,
      feedbackByType: {},
      feedbackByStatus: {},
      avgRating: 0,
      resolvedIssues: 0,
      implementedFeatures: 0,
      testingSessions: 0,
      totalTestingTime: 0,
      componentsTestedCount: 0,
      consecutiveDays: 0,
      longestStreak: 0,
      joinDate: new Date().toISOString(),
    };
  }

  // --------------------------------------------------------------------------
  // XP and Leveling
  // --------------------------------------------------------------------------

  calculateXP(stats: TesterStats): number {
    let xp = 0;

    // Base XP from feedback count
    xp += stats.totalFeedback * XP_REWARDS.feedback_submitted;

    // Bonus for bug reports
    xp += (stats.feedbackByType['bug'] || 0) * (XP_REWARDS.bug_report - XP_REWARDS.feedback_submitted);

    // Bonus for resolved issues
    xp += stats.resolvedIssues * XP_REWARDS.issue_resolved;

    // Bonus for implemented features
    xp += stats.implementedFeatures * XP_REWARDS.feature_implemented;

    // Streak bonus
    xp += stats.consecutiveDays * XP_REWARDS.streak_bonus;

    this.xp = xp;
    return xp;
  }

  getLevel(xp: number): TesterLevel {
    for (let i = TESTER_LEVELS.length - 1; i >= 0; i--) {
      if (xp >= TESTER_LEVELS[i].minXP) {
        return TESTER_LEVELS[i];
      }
    }
    return TESTER_LEVELS[0];
  }

  getLevelProgress(xp: number): number {
    const level = this.getLevel(xp);
    const nextLevel = TESTER_LEVELS.find(l => l.level === level.level + 1);
    
    if (!nextLevel) return 100;
    
    const levelXP = xp - level.minXP;
    const levelRange = nextLevel.minXP - level.minXP;
    
    return Math.min(100, Math.round((levelXP / levelRange) * 100));
  }

  // --------------------------------------------------------------------------
  // Badges
  // --------------------------------------------------------------------------

  calculateBadges(stats: TesterStats): Badge[] {
    const badges: Badge[] = [];

    for (const badgeDef of BADGES) {
      let current = 0;
      let unlocked = false;

      switch (badgeDef.id) {
        // Quantity badges
        case 'first_feedback':
        case 'feedback_10':
        case 'feedback_50':
        case 'feedback_100':
        case 'feedback_500':
          current = stats.totalFeedback;
          unlocked = current >= badgeDef.requirement;
          break;

        // Bug badges
        case 'bug_1':
        case 'bug_10':
          current = stats.feedbackByType['bug'] || 0;
          unlocked = current >= badgeDef.requirement;
          break;

        case 'critical_bug':
          // Would need to track critical bugs specifically
          current = 0;
          break;

        // Feature badges
        case 'feature_1':
          current = stats.feedbackByType['feature'] || 0;
          unlocked = current >= badgeDef.requirement;
          break;

        case 'feature_implemented':
          current = stats.implementedFeatures;
          unlocked = current >= badgeDef.requirement;
          break;

        // Streak badges
        case 'streak_3':
        case 'streak_7':
        case 'streak_30':
          current = stats.longestStreak;
          unlocked = current >= badgeDef.requirement;
          break;

        // Diversity badges
        case 'all_types':
          current = Object.keys(stats.feedbackByType).length;
          unlocked = current >= badgeDef.requirement;
          break;

        case 'components_5':
        case 'components_20':
          current = stats.componentsTestedCount;
          unlocked = current >= badgeDef.requirement;
          break;

        // Special badges
        case 'early_adopter':
          const joinDate = new Date(stats.joinDate);
          const betaEnd = new Date('2025-06-01,'); // Example beta end date
          unlocked = joinDate < betaEnd;
          current = unlocked ? 1 : 0;
          break;

        case 'helpful':
          // Would need to track helpful marks
          current = 0;
          break;
      }

      const badge: Badge = {
        ...badgeDef,
        current,
        progress: Math.min(100, Math.round((current / badgeDef.requirement) * 100)),
        unlockedAt: unlocked ? new Date().toISOString() : undefined,
      };

      badges.push(badge);

      if (unlocked) {
        this.unlockedBadges.add(badge.id);
      }
    }

    return badges;
  }

  getUnlockedBadges(stats: TesterStats): Badge[] {
    return this.calculateBadges(stats).filter(b => b.unlockedAt);
  }

  getNextBadges(stats: TesterStats, limit = 3): Badge[] {
    return this.calculateBadges(stats)
      .filter(b => !b.unlockedAt && b.progress! < 100)
      .sort((a, b) => b.progress! - a.progress!)
      .slice(0, limit);
  }

  // --------------------------------------------------------------------------
  // Leaderboard
  // --------------------------------------------------------------------------

  async fetchLeaderboard(
    timeframe: 'all' | 'month' | 'week' = 'all',
    limit = 10
  ): Promise<LeaderboardEntry[]> {
    try {
      const response = await apiRequest(
        `${API_BASE}/analytics/leaderboard?timeframe=${timeframe}&limit=${limit}`
      );
      return (response || []) as LeaderboardEntry[];
    } catch (error) {
      // Return mock data for development/offline
      return this.getMockLeaderboard(limit);
    }
  }

  private getMockLeaderboard(limit: number): LeaderboardEntry[] {
    const entries: LeaderboardEntry[] = [];
    const names = ['Alpha Tester','Bug Hunter','Feature Fan', 'Quality Queen', 'Testing Pro'];

    for (let i = 0; i < limit; i++) {
      entries.push({
        rank: i + 1,
        userId: `user_${i}`,
        username: names[i % names.length] + ` ${i + 1}`,
        xp: Math.max(0, 5000 - i * 400 + Math.random() * 200),
        level: Math.max(1, 10 - Math.floor(i / 2)),
        badges: Math.max(1, 15 - i),
        feedbackCount: Math.max(1, 100 - i * 8 + Math.floor(Math.random() * 20)),
      });
    }

    return entries;
  }

  // --------------------------------------------------------------------------
  // Testing Progress
  // --------------------------------------------------------------------------

  async fetchTestingProgress(): Promise<TestingProgress[]> {
    try {
      const response = await apiRequest('/api/prototype/analytics/progress');
      return response as TestingProgress[];
    } catch (error) {
      return this.getMockProgress();
    }
  }

  private getMockProgress(): TestingProgress[] {
    return [
      { component: 'Virtual Studio', coverage: 85, lastTested: new Date().toISOString(), feedbackCount: 42, issues: 12, resolved: 10 },
      { component: 'Dashboard', coverage: 72, lastTested: new Date().toISOString(), feedbackCount: 28, issues: 8, resolved: 6 },
      { component: 'Equipment Browser', coverage: 65, lastTested: new Date().toISOString(), feedbackCount: 15, issues: 5, resolved: 3 },
      { component: 'Project Management', coverage: 45, lastTested: new Date().toISOString(), feedbackCount: 10, issues: 4, resolved: 2 },
      { component: 'Client Gallery', coverage: 30, lastTested: new Date().toISOString(), feedbackCount: 5, issues: 2, resolved: 1 },
    ];
  }

  // --------------------------------------------------------------------------
  // Achievements
  // --------------------------------------------------------------------------

  checkNewAchievements(
    oldStats: TesterStats,
    newStats: TesterStats
  ): Achievement[] {
    const achievements: Achievement[] = [];

    // Check milestones
    const milestones = [10, 25, 50, 100, 250, 500];
    for (const milestone of milestones) {
      if (oldStats.totalFeedback < milestone && newStats.totalFeedback >= milestone) {
        achievements.push({
          id: `milestone_${milestone}`,
          name: `${milestone} Feedback Milestone`,
          description: `You've submitted ${milestone} feedback items!`,
          xpReward: milestone,
          unlockedAt: new Date().toISOString(),
          type: 'milestone',
        });
      }
    }

    // Check streak achievements
    if (oldStats.consecutiveDays < 7 && newStats.consecutiveDays >= 7) {
      achievements.push({
        id: 'week_streak',
        name: 'Week Warrior',
        description: '7-day testing streak achieved!',
        xpReward: 50,
        unlockedAt: new Date().toISOString(),
        type: 'streak',
      });
    }

    // Check first bug report
    if ((oldStats.feedbackByType['bug'] || 0) === 0 && (newStats.feedbackByType['bug'] || 0) > 0) {
      achievements.push({
        id: 'first_bug',
        name: 'Bug Spotter',
        description: 'Reported your first bug!',
        xpReward: 25,
        unlockedAt: new Date().toISOString(),
        type: 'quality',
      });
    }

    return achievements;
  }

  // --------------------------------------------------------------------------
  // Display Helpers
  // --------------------------------------------------------------------------

  formatXP(xp: number): string {
    if (xp >= 1000000) return `${(xp / 1000000).toFixed(1)}M`;
    if (xp >= 1000) return `${(xp / 1000).toFixed(1)}K`;
    return xp.toString();
  }

  getTierColor(tier: Badge['tier']): string {
    switch (tier) {
      case 'bronze': return '#cd7f32';
      case 'silver': return '#c0c0c0';
      case 'gold': return '#ffd700';
      case 'platinum': return '#e5e4e2';
      case 'diamond': return '#b9f2ff';
      default: return '#9e9e9e';
    }
  }

  getRankIcon(rank: number): string {
    switch (rank) {
      case 1: return 'emoji_events'; // Trophy
      case 2: return 'military_tech'; // Medal
      case 3: return 'workspace_premium'; // Badge
      default: return'tag'; // Number
    }
  }
}

// ============================================================================
// Export
// ============================================================================

export const feedbackAnalyticsService = new FeedbackAnalyticsService();
export default feedbackAnalyticsService;

