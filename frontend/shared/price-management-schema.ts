import {
  pgTable,
  varchar,
  boolean,
  integer,
  timestamp,
  decimal,
  jsonb,
  text,
} from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';

// Payment Provider Configuration
export const paymentProviders = pgTable('payment_providers', {
  id: varchar('id').primaryKey(),
  name: varchar('name').notNull(),
  isActive: boolean('is_active').default(false),
  config: jsonb('config').$type<{
    apiKey?: string;
    webhookUrl?: string;
    environment?: 'sandbox' | 'production';
  }>(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Subscription Plans
export const subscriptionPlans = pgTable('subscription_plans', {
  id: varchar('id').primaryKey(),
  name: varchar('name').notNull(),
  description: text('description'),
  price: decimal('price', { precision: 10, scale: 2 }).notNull(),
  currency: varchar('currency').default('NOK'),
  billingCycle: varchar('billing_cycle').notNull(), // 'monthly', 'yearly'
  features: jsonb('features').$type<string[]>().notNull(),
  isActive: boolean('is_active').default(true),
  maxUsers: integer('max_users').default(1),
  maxProjects: integer('max_projects').default(10),
  maxStorage: integer('max_storage').default(1024), // MB
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Feature Toggles
export const featureToggles = pgTable('feature_toggles', {
  id: varchar('id').primaryKey(),
  name: varchar('name').notNull(),
  description: text('description'),
  isEnabled: boolean('is_enabled').default(false),
  planRequirement: varchar('plan_requirement'), // 'basic', 'pro', 'enterprise', null for all
  config: jsonb('config').$type<{
    rolloutPercentage?: number;
    targetUsers?: string[];
    excludeUsers?: string[];
    startDate?: string;
    endDate?: string;
  }>(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// User Subscriptions
export const userSubscriptions = pgTable('user_subscriptions', {
  id: varchar('id').primaryKey(),
  userId: varchar('user_id').notNull(),
  planId: varchar('plan_id').notNull(),
  status: varchar('status').notNull(), // 'active', 'canceled', 'past_due', 'paused'
  currentPeriodStart: timestamp('current_period_start').notNull(),
  currentPeriodEnd: timestamp('current_period_end').notNull(),
  cancelAtPeriodEnd: boolean('cancel_at_period_end').default(false),
  stripeSubscriptionId: varchar('stripe_subscription_id'),
  googlePaySubscriptionId: varchar('google_pay_subscription_id'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Analytics Events
export const analyticsEvents = pgTable('analytics_events', {
  id: varchar('id').primaryKey(),
  userId: varchar('user_id'),
  eventType: varchar('event_type').notNull(), // 'subscription_created', 'feature_used', 'churn', etc.
  eventData: jsonb('event_data').$type<{
    planId?: string;
    featureId?: string;
    revenue?: number;
    metadata?: Record<string, any>;
  }>(),
  timestamp: timestamp('timestamp').defaultNow(),
});

// Cohort Analysis
export const userCohorts = pgTable('user_cohorts', {
  id: varchar('id').primaryKey(),
  cohortMonth: varchar('cohort_month').notNull(), // 'YYYY-MM'
  userId: varchar('user_id').notNull(),
  subscriptionStartDate: timestamp('subscription_start_date').notNull(),
  totalRevenue: decimal('total_revenue', { precision: 10, scale: 2 }).default('0'),
  isActive: boolean('is_active').default(true),
  churnDate: timestamp('churn_date'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Schema Types
export type PaymentProvider = typeof paymentProviders.$inferSelect;
export type InsertPaymentProvider = typeof paymentProviders.$inferInsert;

export type SubscriptionPlan = typeof subscriptionPlans.$inferSelect;
export type InsertSubscriptionPlan = typeof subscriptionPlans.$inferInsert;

export type FeatureToggle = typeof featureToggles.$inferSelect;
export type InsertFeatureToggle = typeof featureToggles.$inferInsert;

export type UserSubscription = typeof userSubscriptions.$inferSelect;
export type InsertUserSubscription = typeof userSubscriptions.$inferInsert;

export type AnalyticsEvent = typeof analyticsEvents.$inferSelect;
export type InsertAnalyticsEvent = typeof analyticsEvents.$inferInsert;

export type UserCohort = typeof userCohorts.$inferSelect;
export type InsertUserCohort = typeof userCohorts.$inferInsert;

// Zod Schemas
export const insertPaymentProviderSchema = createInsertSchema(paymentProviders);
export const insertSubscriptionPlanSchema = createInsertSchema(subscriptionPlans);
export const insertFeatureToggleSchema = createInsertSchema(featureToggles);
export const insertUserSubscriptionSchema = createInsertSchema(userSubscriptions);
export const insertAnalyticsEventSchema = createInsertSchema(analyticsEvents);
export const insertUserCohortSchema = createInsertSchema(userCohorts);

// Feature Toggle Check Request
export const featureCheckSchema = z.object({
  userId: z.string(),
  featureId: z.string(),
  planId: z.string().optional(),
});

// Subscription Management Request
export const subscriptionChangeSchema = z.object({
  userId: z.string(),
  newPlanId: z.string(),
  prorationMode: z.enum(['immediate', 'next_cycle']).default('immediate'),
});
