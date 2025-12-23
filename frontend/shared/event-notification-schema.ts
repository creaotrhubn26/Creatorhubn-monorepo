/**
 * Event Planning Notification System Schema
 * Real-time notifications and creator preferences for event planning deadlines
 */

import { pgTable, varchar, timestamp, boolean, integer, text, jsonb } from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';

// Creator notification preferences for event planning
export const creatorNotificationPreferences = pgTable('creator_notification_preferences', {
  id: varchar('id').primaryKey(),
  creatorId: varchar('creator_id').notNull(), // SSO user ID
  creatorEmail: varchar('creator_email').notNull(),

  // Event planning deadlines and preferences
  editingDeadlineDays: integer('editing_deadline_days').notNull().default(3), // Close editing X days before event
  clientNotificationDays: integer('client_notification_days').notNull().default(5), // Notify client X days before deadline
  finalReviewDays: integer('final_review_days').notNull().default(2), // Final review deadline

  // Notification preferences
  emailNotifications: boolean('email_notifications').notNull().default(true),
  smsNotifications: boolean('sms_notifications').notNull().default(false),
  pushNotifications: boolean('push_notifications').notNull().default(true),

  // Auto-close editing preferences
  autoCloseEditing: boolean('auto_close_editing').notNull().default(true),
  sendClientReminders: boolean('send_client_reminders').notNull().default(true),

  // Norwegian business hours for notifications
  businessHoursStart: varchar('business_hours_start').notNull().default('09:00'),
  businessHoursEnd: varchar('business_hours_end').notNull().default('17:00'),

  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Event planning deadlines and milestones
export const eventPlanningDeadlines = pgTable('event_planning_deadlines', {
  id: varchar('id').primaryKey(),
  projectId: varchar('project_id').notNull(),
  creatorId: varchar('creator_id').notNull(),
  clientId: varchar('client_id'),

  // Event information
  eventName: varchar('event_name').notNull(),
  eventDate: timestamp('event_date').notNull(),
  eventType: varchar('event_type').notNull(), // bryllup, bursdag, bedrift, etc.

  // Calculated deadlines based on creator preferences
  editingDeadline: timestamp('editing_deadline').notNull(),
  clientNotificationDate: timestamp('client_notification_date').notNull(),
  finalReviewDeadline: timestamp('final_review_deadline').notNull(),

  // Status tracking
  editingClosed: boolean('editing_closed').notNull().default(false),
  clientNotified: boolean('client_notified').notNull().default(false),
  finalReviewCompleted: boolean('final_review_completed').notNull().default(false),

  // Progress tracking
  planningProgress: integer('planning_progress').notNull().default(0), // 0-100%

  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Real-time event notifications
export const eventNotifications = pgTable('event_notifications', {
  id: varchar('id').primaryKey(),
  projectId: varchar('project_id').notNull(),
  creatorId: varchar('creator_id').notNull(),
  clientId: varchar('client_id'),

  // Notification details
  notificationType: varchar('notification_type').notNull(), // deadline_reminder, editing_closed, review_needed
  title: varchar('title').notNull(),
  message: text('message').notNull(),

  // Timing
  scheduledFor: timestamp('scheduled_for').notNull(),
  sentAt: timestamp('sent_at'),

  // Delivery status
  emailSent: boolean('email_sent').notNull().default(false),
  smsSent: boolean('sms_sent').notNull().default(false),
  pushSent: boolean('push_sent').notNull().default(false),

  // Notification data
  notificationData: jsonb('notification_data'), // Additional context

  // Status
  status: varchar('status').notNull().default('scheduled'), // scheduled, sent, failed
  priority: varchar('priority').notNull().default('medium'), // low, medium, high, urgent

  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Live event planning activities
export const liveEventActivities = pgTable('live_event_activities', {
  id: varchar('id').primaryKey(),
  projectId: varchar('project_id').notNull(),
  creatorId: varchar('creator_id').notNull(),

  // Activity details
  activityType: varchar('activity_type').notNull(), // planning_update, deadline_approaching, editing_closed
  activityTitle: varchar('activity_title').notNull(),
  activityDescription: text('activity_description'),

  // Real-time data
  timestamp: timestamp('timestamp').notNull().defaultNow(),
  isRealTime: boolean('is_real_time').notNull().default(true),

  // Norwegian localization
  titleNo: varchar('title_no'),
  descriptionNo: text('description_no'),

  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// Types for TypeScript integration
export type CreatorNotificationPreferences = typeof creatorNotificationPreferences.$inferSelect;
export type InsertCreatorNotificationPreferences =
  typeof creatorNotificationPreferences.$inferInsert;

export type EventPlanningDeadlines = typeof eventPlanningDeadlines.$inferSelect;
export type InsertEventPlanningDeadlines = typeof eventPlanningDeadlines.$inferInsert;

export type EventNotifications = typeof eventNotifications.$inferSelect;
export type InsertEventNotifications = typeof eventNotifications.$inferInsert;

export type LiveEventActivities = typeof liveEventActivities.$inferSelect;
export type InsertLiveEventActivities = typeof liveEventActivities.$inferInsert;

// Zod schemas for validation
export const insertCreatorNotificationPreferencesSchema = createInsertSchema(
  creatorNotificationPreferences,
);
export const insertEventPlanningDeadlinesSchema = createInsertSchema(eventPlanningDeadlines);
export const insertEventNotificationsSchema = createInsertSchema(eventNotifications);
export const insertLiveEventActivitiesSchema = createInsertSchema(liveEventActivities);

// Norwegian event types
export const norwegianEventTypes = {
  bryllup: 'Bryllup',
  bursdag: 'Bursdag',
  bedrift: 'Bedrift arrangement',
  jubileum: 'Jubileum',
  konfirmasjon: 'Konfirmasjon',
  dåp: 'Dåp',
  utdanning: 'Utdanning',
  familie: 'Familie samling',
} as const;

// Notification types in Norwegian
export const norwegianNotificationTypes = {
  deadline_reminder: 'Frist påminnelse',
  editing_closed: 'Redigering stengt',
  review_needed: 'Gjennomgang nødvendig',
  client_notification: 'Klient varsel',
  final_deadline: 'Siste frist',
} as const;
