/**
 * CreatorHub Norge - Trial Management Schema
 * Comprehensive trial tracking, subscription management, and billing
 */

import {
  pgTable,
  text,
  varchar,
  timestamp,
  jsonb,
  integer,
  boolean,
  decimal,
  serial,
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';
import { createInsertSchema } from 'drizzle-zod';
import type { z } from 'zod';

// ============================================================================
// TRIAL MANAGEMENT TABLES
// ============================================================================

// User Subscriptions - Complete subscription tracking
export const trialUserSubscriptions = pgTable('trial_user_subscriptions', {
  id: serial('id').primaryKey(),
  userId: varchar('user_id').notNull(),
  profession: varchar('profession')
    .$type<'photographer' | 'videographer' | 'music_producer' | 'vendor'>()
    .notNull(),
  packageId: varchar('package_id').notNull(), // e.g., 'photographer-trial', 'photographer-basic'
  packageTier: varchar('package_tier')
    .$type<'trial' | 'basic' | 'professional' | 'enterprise' | 'premium'>()
    .notNull(),
  status: varchar('status')
    .$type<'active' | 'expired' | 'cancelled' | 'suspended' | 'converting'>()
    .notNull()
    .default('active'),

  // Trial specific fields
  isTrialAccount: boolean('is_trial_account').default(false),
  trialStartDate: timestamp('trial_start_date'),
  trialEndDate: timestamp('trial_end_date'),
  trialDaysRemaining: integer('trial_days_remaining'),
  trialActivatedBy: varchar('trial_activated_by'), // admin user who activated trial

  // Subscription limits and features
  maxProjects: integer('max_projects'),
  maxStorage: integer('max_storage'), // GB
  maxShowcaseItems: integer('max_showcase_items'),
  maxClientCommunications: integer('max_client_communications'),
  maxExports: integer('max_exports'),
  restrictedFeatures: jsonb('restricted_features').$type<string[]>(),

  // Billing information
  monthlyPrice: decimal('monthly_price', { precision: 10, scale: 2 }),
  annualPrice: decimal('annual_price', { precision: 10, scale: 2 }),
  billingCycle: varchar('billing_cycle').$type<'monthly' | 'annual'>(),
  nextBillingDate: timestamp('next_billing_date'),

  // Conversion tracking
  convertedFromTrial: boolean('converted_from_trial').default(false),
  conversionDate: timestamp('conversion_date'),
  conversionReason: text('conversion_reason'),

  // Metadata
  activatedAt: timestamp('activated_at').defaultNow(),
  lastModified: timestamp('last_modified').defaultNow(),
  createdAt: timestamp('created_at').defaultNow(),
});

// Trial Usage Tracking - Track how users use trial features
export const trialUsageTracking = pgTable('trial_usage_tracking', {
  id: serial('id').primaryKey(),
  userId: varchar('user_id').notNull(),
  subscriptionId: integer('subscription_id')
    .notNull()
    .references(() => trialUserSubscriptions.id, { onDelete: 'cascade' }),

  // Usage metrics
  projectsCreated: integer('projects_created').default(0),
  storageUsedMB: integer('storage_used_mb').default(0),
  showcaseItemsCreated: integer('showcase_items_created').default(0),
  clientCommunicationsSent: integer('client_communications_sent').default(0),
  exportsCompleted: integer('exports_completed').default(0),

  // Engagement metrics
  loginCount: integer('login_count').default(0),
  sessionTimeMinutes: integer('session_time_minutes').default(0),
  featuresUsed: jsonb('features_used').$type<string[]>(),
  lastActiveDate: timestamp('last_active_date'),

  // Trial progression
  daysSinceActivation: integer('days_since_activation').default(0),
  onboardingCompleted: boolean('onboarding_completed').default(false),
  firstProjectCreated: boolean('first_project_created').default(false),
  firstShowcaseCreated: boolean('first_showcase_created').default(false),

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Trial Notifications - Track and manage trial-related notifications
export const trialNotifications = pgTable('trial_notifications', {
  id: serial('id').primaryKey(),
  userId: varchar('user_id').notNull(),
  subscriptionId: integer('subscription_id')
    .notNull()
    .references(() => trialUserSubscriptions.id, { onDelete: 'cascade' }),

  notificationType: varchar('notification_type')
    .$type<
      | 'welcome'
      | 'day_3_checkin'
      | 'day_5_conversion'
      | 'day_7_final'
      | 'expiry_warning'
      | 'trial_expired'
      | 'conversion_success'
    >()
    .notNull(),
  notificationChannel: varchar('notification_channel')
    .$type<'chat' | 'email' | 'dashboard' | 'push'>()
    .notNull(),

  // Notification content
  title: varchar('title').notNull(),
  message: text('message').notNull(),
  actionRequired: boolean('action_required').default(false),
  actionUrl: varchar('action_url'),

  // Delivery tracking
  scheduled: boolean('scheduled').default(false),
  scheduledFor: timestamp('scheduled_for'),
  sent: boolean('sent').default(false),
  sentAt: timestamp('sent_at'),
  delivered: boolean('delivered').default(false),
  deliveredAt: timestamp('delivered_at'),
  opened: boolean('opened').default(false),
  openedAt: timestamp('opened_at'),

  // Response tracking
  userResponded: boolean('user_responded').default(false),
  userResponse: text('user_response'),
  responseAt: timestamp('response_at'),

  createdAt: timestamp('created_at').defaultNow(),
});

// Subscription Changes History - Track all subscription changes
export const subscriptionChangeHistory = pgTable('subscription_change_history', {
  id: serial('id').primaryKey(),
  userId: varchar('user_id').notNull(),
  subscriptionId: integer('subscription_id')
    .notNull()
    .references(() => trialUserSubscriptions.id, { onDelete: 'cascade' }),

  changeType: varchar('change_type')
    .$type<
      | 'trial_activation'
      | 'trial_extension'
      | 'upgrade'
      | 'downgrade'
      | 'cancellation'
      | 'reactivation'
      | 'suspension'
    >()
    .notNull(),

  // Before/after state
  previousPackageId: varchar('previous_package_id'),
  newPackageId: varchar('new_package_id'),
  previousStatus: varchar('previous_status'),
  newStatus: varchar('new_status'),

  // Change details
  reason: text('reason'),
  changedBy: varchar('changed_by'), // admin user or 'system' for automatic changes
  changeSource: varchar('change_source').$type<
    'user_request' | 'admin_action' | 'automatic' | 'payment_failure' | 'trial_expiry'
  >(),

  // Billing impact
  pricingChange: decimal('pricing_change', { precision: 10, scale: 2 }),
  prorationAmount: decimal('proration_amount', { precision: 10, scale: 2 }),

  effectiveDate: timestamp('effective_date').defaultNow(),
  createdAt: timestamp('created_at').defaultNow(),
});

// Service Activations Log - Track all service activations for users
export const serviceActivations = pgTable('service_activations', {
  id: serial('id').primaryKey(),
  userId: varchar('user_id').notNull(),
  subscriptionId: integer('subscription_id').references(() => trialUserSubscriptions.id, {
    onDelete: 'set null',
  }),

  serviceName: varchar('service_name').notNull(),
  serviceType: varchar('service_type').notNull(),
  activatedFeatures: jsonb('activated_features').$type<string[]>(),

  // Activation details
  activatedBy: varchar('activated_by'), // admin user who activated
  activationMethod: varchar('activation_method').$type<
    'manual' | 'automatic' | 'trial' | 'upgrade'
  >(),

  // Notification tracking
  chatNotificationSent: boolean('chat_notification_sent').default(false),
  emailNotificationSent: boolean('email_notification_sent').default(false),
  notificationMessage: text('notification_message'),

  activatedAt: timestamp('activated_at').defaultNow(),
  createdAt: timestamp('created_at').defaultNow(),
});

// ============================================================================
// RELATIONS
// ============================================================================

export const trialUserSubscriptionsRelations = relations(trialUserSubscriptions, ({ many }) => ({
  usageTracking: many(trialUsageTracking),
  notifications: many(trialNotifications),
  changeHistory: many(subscriptionChangeHistory),
  serviceActivations: many(serviceActivations),
}));

export const trialUsageTrackingRelations = relations(trialUsageTracking, ({ one }) => ({
  subscription: one(trialUserSubscriptions, {
    fields: [trialUsageTracking.subscriptionId],
    references: [trialUserSubscriptions.id],
  }),
}));

export const trialNotificationsRelations = relations(trialNotifications, ({ one }) => ({
  subscription: one(trialUserSubscriptions, {
    fields: [trialNotifications.subscriptionId],
    references: [trialUserSubscriptions.id],
  }),
}));

export const subscriptionChangeHistoryRelations = relations(
  subscriptionChangeHistory,
  ({ one }) => ({
    subscription: one(trialUserSubscriptions, {
      fields: [subscriptionChangeHistory.subscriptionId],
      references: [trialUserSubscriptions.id],
    }),
  }),
);

export const serviceActivationsRelations = relations(serviceActivations, ({ one }) => ({
  subscription: one(trialUserSubscriptions, {
    fields: [serviceActivations.subscriptionId],
    references: [trialUserSubscriptions.id],
  }),
}));

// ============================================================================
// ZOD SCHEMAS
// ============================================================================

export const insertTrialUserSubscriptionSchema = createInsertSchema(trialUserSubscriptions);
export const insertTrialUsageTrackingSchema = createInsertSchema(trialUsageTracking);
export const insertTrialNotificationSchema = createInsertSchema(trialNotifications);
export const insertSubscriptionChangeHistorySchema = createInsertSchema(subscriptionChangeHistory);
export const insertServiceActivationSchema = createInsertSchema(serviceActivations);

export type TrialUserSubscription = typeof trialUserSubscriptions.$inferSelect;
export type InsertTrialUserSubscription = z.infer<typeof insertTrialUserSubscriptionSchema>;
export type TrialUsageTracking = typeof trialUsageTracking.$inferSelect;
export type InsertTrialUsageTracking = z.infer<typeof insertTrialUsageTrackingSchema>;
export type TrialNotification = typeof trialNotifications.$inferSelect;
export type InsertTrialNotification = z.infer<typeof insertTrialNotificationSchema>;
export type SubscriptionChangeHistory = typeof subscriptionChangeHistory.$inferSelect;
export type InsertSubscriptionChangeHistory = z.infer<typeof insertSubscriptionChangeHistorySchema>;
export type ServiceActivation = typeof serviceActivations.$inferSelect;
export type InsertServiceActivation = z.infer<typeof insertServiceActivationSchema>;
