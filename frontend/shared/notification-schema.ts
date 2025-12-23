import { pgTable, text, timestamp, json, boolean, varchar } from 'drizzle-orm/pg-core';

/**
 * Notifications Table
 * Stores notifications for users about various events
 */
export const notifications = pgTable('notifications', {
  id: text('id')
    .primaryKey()
    .default('notif_' + Math.random().toString(36).substr(2, 9)),
  userId: text('user_id').notNull(),
  type: varchar('type', { length: 50 }).notNull(), // 'feedback_resolved', 'system_update', 'invitation', etc.
  title: text('title').notNull(),
  message: text('message').notNull(),
  details: json('details'), // Additional notification details
  priority: varchar('priority', { length: 10 }).default('medium').notNull(), // 'low', 'medium', 'high'
  isRead: boolean('is_read').default(false).notNull(),
  readAt: timestamp('read_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  metadata: json('metadata'), // Additional metadata for the notification
});

/**
 * Notification Templates Table
 * Templates for generating notifications
 */
export const notificationTemplates = pgTable('notification_templates', {
  id: text('id')
    .primaryKey()
    .default('nt_' + Math.random().toString(36).substr(2, 9)),
  name: text('name').notNull(),
  type: varchar('type', { length: 50 }).notNull(),
  title: text('title').notNull(),
  message: text('message').notNull(),
  details: json('details'), // Template for details structure
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  createdBy: text('created_by').notNull().default('system'),
});

/**
 * Notification Preferences Table
 * User preferences for notifications
 */
export const notificationPreferences = pgTable('notification_preferences', {
  id: text('id')
    .primaryKey()
    .default('np_' + Math.random().toString(36).substr(2, 9)),
  userId: text('user_id').notNull(),
  type: varchar('type', { length: 50 }).notNull(),
  enabled: boolean('enabled').default(true).notNull(),
  emailEnabled: boolean('email_enabled').default(true).notNull(),
  pushEnabled: boolean('push_enabled').default(true).notNull(),
  inAppEnabled: boolean('in_app_enabled').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

/**
 * Notification Delivery Log Table
 * Log of notification delivery attempts
 */
export const notificationDeliveryLog = pgTable('notification_delivery_log', {
  id: text('id')
    .primaryKey()
    .default('ndl_' + Math.random().toString(36).substr(2, 9)),
  notificationId: text('notification_id').notNull(),
  deliveryMethod: varchar('delivery_method', { length: 20 }).notNull(), // 'email', 'push', 'in_app'
  status: varchar('status', { length: 20 }).notNull(), // 'sent', 'delivered', 'failed', 'bounced'
  attemptedAt: timestamp('attempted_at').defaultNow().notNull(),
  deliveredAt: timestamp('delivered_at'),
  errorMessage: text('error_message'),
  retryCount: text('retry_count').default('0'),
  metadata: json('metadata'), // Additional delivery metadata
});
