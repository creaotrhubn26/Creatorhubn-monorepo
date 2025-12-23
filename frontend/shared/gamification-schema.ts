import { pgTable, text, integer, boolean, timestamp, jsonb } from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';

// User Progress Table
export const userProgress = pgTable('user_progress', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  userType: text('user_type').notNull(), // photographer, videographer, music_producer, etc.
  currentLevel: integer('current_level').default(1),
  totalXP: integer('total_xp').default(0),
  weeklyXP: integer('weekly_xp').default(0),
  monthlyXP: integer('monthly_xp').default(0),
  streakDays: integer('streak_days').default(0),
  lastActivityDate: timestamp('last_activity_date').defaultNow(),
  completedOnboarding: boolean('completed_onboarding').default(false),
  onboardingStep: integer('onboarding_step').default(0),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Achievement Definitions
export const achievements = pgTable('achievements', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description').notNull(),
  category: text('category').notNull(), // onboarding, learning, project, social, milestone
  userType: text('user_type'), // null for universal achievements
  xpReward: integer('xp_reward').default(0),
  badgeIcon: text('badge_icon').notNull(),
  badgeColor: text('badge_color').default('amber'),
  difficulty: text('difficulty').notNull(), // easy, medium, hard, legendary
  requirement: jsonb('requirement'), // { type: 'count', target: 5, action: 'complete_course' }
  isHidden: boolean('is_hidden').default(false),
  createdAt: timestamp('created_at').defaultNow(),
});

// User Achievements (earned)
export const userAchievements = pgTable('user_achievements', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  achievementId: text('achievement_id').notNull(),
  earnedAt: timestamp('earned_at').defaultNow(),
  progress: integer('progress').default(0), // for incremental achievements
  isCompleted: boolean('is_completed').default(false),
  notificationShown: boolean('notification_shown').default(false),
});

// Onboarding Milestones
export const onboardingMilestones = pgTable('onboarding_milestones', {
  id: text('id').primaryKey(),
  userType: text('user_type').notNull(),
  step: integer('step').notNull(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  xpReward: integer('xp_reward').default(10),
  requiredActions: jsonb('required_actions'), // [{ type: 'complete_profile', completed: false }]
  icon: text('icon').notNull(),
  estimatedTime: integer('estimated_time').default(5), // minutes
  isRequired: boolean('is_required').default(true),
  unlockLevel: integer('unlock_level').default(1),
});

// Gamification Events (XP tracking)
export const gamificationEvents = pgTable('gamification_events', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  eventType: text('event_type').notNull(), // profile_completed, course_started, project_created, etc.
  xpEarned: integer('xp_earned').default(0),
  description: text('description').notNull(),
  metadata: jsonb('metadata'), // additional context
  createdAt: timestamp('created_at').defaultNow(),
});

// Leaderboard (weekly/monthly)
export const leaderboard = pgTable('leaderboard', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  userType: text('user_type').notNull(),
  period: text('period').notNull(), // weekly, monthly, all_time
  xpAmount: integer('xp_amount').notNull(),
  rank: integer('rank').notNull(),
  periodStart: timestamp('period_start').notNull(),
  periodEnd: timestamp('period_end').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// Zod schemas for validation
export const insertUserProgressSchema = createInsertSchema(userProgress);
export const insertAchievementSchema = createInsertSchema(achievements);
export const insertUserAchievementSchema = createInsertSchema(userAchievements);
export const insertOnboardingMilestoneSchema = createInsertSchema(onboardingMilestones);
export const insertGamificationEventSchema = createInsertSchema(gamificationEvents);
export const insertLeaderboardSchema = createInsertSchema(leaderboard);

// Type exports
export type UserProgress = typeof userProgress.$inferSelect;
export type NewUserProgress = z.infer<typeof insertUserProgressSchema>;
export type Achievement = typeof achievements.$inferSelect;
export type NewAchievement = z.infer<typeof insertAchievementSchema>;
export type UserAchievement = typeof userAchievements.$inferSelect;
export type NewUserAchievement = z.infer<typeof insertUserAchievementSchema>;
export type OnboardingMilestone = typeof onboardingMilestones.$inferSelect;
export type NewOnboardingMilestone = z.infer<typeof insertOnboardingMilestoneSchema>;
export type GamificationEvent = typeof gamificationEvents.$inferSelect;
export type NewGamificationEvent = z.infer<typeof insertGamificationEventSchema>;
export type LeaderboardEntry = typeof leaderboard.$inferSelect;
export type NewLeaderboardEntry = z.infer<typeof insertLeaderboardSchema>;

// XP Level calculation
export const calculateLevel = (xp: number): number => {
  // Level 1: 0-99 XP
  // Level 2: 100-299 XP
  // Level 3: 300-599 XP
  // Level 4: 600-999 XP
  // Level 5: 1000-1499 XP
  // And so on...
  if (xp < 100) return 1;
  if (xp < 300) return 2;
  if (xp < 600) return 3;
  if (xp < 1000) return 4;
  if (xp < 1500) return 5;
  if (xp < 2100) return 6;
  if (xp < 2800) return 7;
  if (xp < 3600) return 8;
  if (xp < 4500) return 9;
  return Math.floor(xp / 500) + 1; // Beyond level 9
};

export const getXPForNextLevel = (currentXP: number): number => {
  const level = calculateLevel(currentXP);
  const thresholds = [0, 100, 300, 600, 1000, 1500, 2100, 2800, 3600, 4500];

  if (level <= 9) {
    return thresholds[level] || level * 500;
  }
  return level * 500;
};

// Achievement categories
export const ACHIEVEMENT_CATEGORIES = {
  ONBOARDING: 'onboarding',
  LEARNING: 'learning',
  PROJECT: 'project',
  SOCIAL: 'social',
  MILESTONE: 'milestone',
  EQUIPMENT: 'equipment',
  NORWEGIAN: 'norwegian', // Norwegian-specific achievements
} as const;

// XP rewards
export const XP_REWARDS = {
  PROFILE_COMPLETE: 50,
  FIRST_PROJECT: 100,
  COURSE_COMPLETE: 200,
  EQUIPMENT_REGISTER: 25,
  DAILY_LOGIN: 10,
  WEEKLY_STREAK: 50,
  MONTHLY_MILESTONE: 200,
  NORWEGIAN_COMPLIANCE: 100,
  TONO_GRAMO_SETUP: 150,
  GDPR_COMPLETION: 75,
} as const;
