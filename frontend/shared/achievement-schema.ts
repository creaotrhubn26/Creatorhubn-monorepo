import {
  pgTable,
  serial,
  varchar,
  text,
  timestamp,
  integer,
  boolean,
  jsonb,
  index,
} from 'drizzle-orm/pg-core';
import { users } from './database-persistence-schema';

// Achievement definitions for vendors
export const vendorAchievements = pgTable('vendor_achievements', {
  id: serial('id').primaryKey(),
  achievementId: varchar('achievement_id').notNull().unique(), // e.g., "profile_complete", "first_portfolio"
  name: varchar('name').notNull(),
  description: text('description').notNull(),
  category: varchar('category').notNull(), // "profile", "portfolio", "business", "social", "engagement"

  // Badge configuration
  badgeIcon: varchar('badge_icon').notNull(), // Icon class or URL
  badgeColor: varchar('badge_color').notNull(), // CSS color for badge
  badgeStyle: varchar('badge_style').default('standard'), // "standard", "premium", "legendary"

  // Requirements
  requirements: jsonb('requirements').notNull(), // Detailed requirements object
  pointsReward: integer('points_reward').default(0),

  // Achievement metadata
  difficulty: varchar('difficulty').default('easy'), // "easy", "medium", "hard", "legendary"
  isActive: boolean('is_active').default(true),
  isSecret: boolean('is_secret').default(false), // Hidden until unlocked

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// User achieved badges
export const vendorUserAchievements = pgTable('vendor_user_achievements', {
  id: serial('id').primaryKey(),
  userId: varchar('user_id').notNull(),
  achievementId: varchar('achievement_id').notNull(),

  // Achievement details
  progress: integer('progress').default(0), // Current progress towards achievement
  maxProgress: integer('max_progress').default(100), // Total required for completion
  isCompleted: boolean('is_completed').default(false),

  // Completion data
  completedAt: timestamp('completed_at'),
  pointsEarned: integer('points_earned').default(0),

  // Progress tracking
  metadata: jsonb('metadata').default({}), // Store progress details

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Vendor skill badges
export const vendorSkillBadges = pgTable('vendor_skill_badges', {
  id: serial('id').primaryKey(),
  badgeId: varchar('badge_id').notNull().unique(),
  name: varchar('name').notNull(),
  description: text('description').notNull(),
  category: varchar('category').notNull(), // "photography", "videography", "business", "social"

  // Skill level
  skillLevel: varchar('skill_level').notNull(), // "beginner", "intermediate", "advanced", "expert", "master"

  // Visual design
  icon: varchar('icon').notNull(),
  color: varchar('color').notNull(),
  gradient: varchar('gradient'), // Optional gradient for advanced badges

  // Requirements for earning
  requirements: jsonb('requirements').notNull(),
  prerequisiteBadges: text('prerequisite_badges').array(), // Required badges before this one

  // Badge value
  skillPoints: integer('skill_points').default(0),
  experiencePoints: integer('experience_points').default(0),

  // Metadata
  rarity: varchar('rarity').default('common'), // "common", "uncommon", "rare", "epic", "legendary"
  isActive: boolean('is_active').default(true),

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// User earned skill badges
export const vendorUserSkillBadges = pgTable('vendor_user_skill_badges', {
  id: serial('id').primaryKey(),
  userId: varchar('user_id').notNull(),
  badgeId: varchar('badge_id').notNull(),

  // Earning details
  earnedAt: timestamp('earned_at').defaultNow(),
  skillPointsEarned: integer('skill_points_earned').default(0),
  experiencePointsEarned: integer('experience_points_earned').default(0),

  // Badge display
  isDisplayed: boolean('is_displayed').default(true), // Show on profile
  displayOrder: integer('display_order').default(0),

  // Validation data
  validatedBy: varchar('validated_by'), // System or admin validation
  validationData: jsonb('validation_data'), // Evidence of skill

  createdAt: timestamp('created_at').defaultNow(),
});

export type VendorAchievement = typeof vendorAchievements.$inferSelect;
export type InsertVendorAchievement = typeof vendorAchievements.$inferInsert;
export type VendorUserAchievement = typeof vendorUserAchievements.$inferSelect;
export type InsertVendorUserAchievement = typeof vendorUserAchievements.$inferInsert;
export type VendorSkillBadge = typeof vendorSkillBadges.$inferSelect;
export type InsertVendorSkillBadge = typeof vendorSkillBadges.$inferInsert;
export type VendorUserSkillBadge = typeof vendorUserSkillBadges.$inferSelect;
export type InsertVendorUserSkillBadge = typeof vendorUserSkillBadges.$inferInsert;

// Vendor Customer Journey tables
export const vendorJourneySteps = pgTable(
  'vendor_journey_steps',
  {
    id: serial('id').primaryKey(),
    vendorId: integer('vendor_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    stepId: varchar('step_id', { length: 100 }).notNull(),
    completedAt: timestamp('completed_at').defaultNow(),
    metadata: jsonb('metadata').$type<any>().default({}),
  },
  (table) => [
    index('idx_vendor_journey_steps_vendor').on(table.vendorId),
    index('idx_vendor_journey_steps_step').on(table.stepId),
  ],
);

export type VendorJourneyStep = typeof vendorJourneySteps.$inferSelect;
export type InsertVendorJourneyStep = typeof vendorJourneySteps.$inferInsert;

export const vendorJourneyMilestones = pgTable(
  'vendor_journey_milestones',
  {
    id: serial('id').primaryKey(),
    vendorId: integer('vendor_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    milestoneId: varchar('milestone_id', { length: 100 }).notNull(),
    awardedAt: timestamp('awarded_at').defaultNow(),
    points: integer('points').default(0),
    badges: text('badges').array().default([]),
    features: text('features').array().default([]),
  },
  (table) => [
    index('idx_vendor_journey_milestones_vendor').on(table.vendorId),
    index('idx_vendor_journey_milestones_milestone').on(table.milestoneId),
  ],
);

export type VendorJourneyMilestone = typeof vendorJourneyMilestones.$inferSelect;
export type InsertVendorJourneyMilestone = typeof vendorJourneyMilestones.$inferInsert;

export const vendorEngagementMetrics = pgTable(
  'vendor_engagement_metrics',
  {
    id: serial('id').primaryKey(),
    vendorId: integer('vendor_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    date: timestamp('date').defaultNow(),
    profileViews: integer('profile_views').default(0),
    serviceInquiries: integer('service_inquiries').default(0),
    portfolioViews: integer('portfolio_views').default(0),
    qrCodeScans: integer('qr_code_scans').default(0),
    journeyStage: varchar('journey_stage', { length: 20 }).default('awareness'),
    engagementScore: integer('engagement_score').default(0),
    lastActivity: timestamp('last_activity').defaultNow(),
  },
  (table) => [
    index('idx_vendor_engagement_vendor').on(table.vendorId),
    index('idx_vendor_engagement_date').on(table.date),
  ],
);

export type VendorEngagementMetric = typeof vendorEngagementMetrics.$inferSelect;
export type InsertVendorEngagementMetric = typeof vendorEngagementMetrics.$inferInsert;
