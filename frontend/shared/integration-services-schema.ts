/**
 * Integration Services Schema
 * Complete schema definitions for Google services, API protocols, and integrations
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
  uuid,
  date,
  bigint,
  serial,
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ============================================================================
// GOOGLE SERVICES INTEGRATION
// ============================================================================

export const gmailConnected = pgTable('gmail_connected', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: varchar('user_id').notNull(),
  emailAddress: varchar('email_address').notNull(),
  connectionStatus: varchar('connection_status')
    .$type<'connected' | 'disconnected' | 'error'>()
    .notNull(),
  lastSync: timestamp('last_sync'),
  syncSettings: jsonb('sync_settings').notNull().default('{}'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const googleCalendarConnected = pgTable('google_calendar_connected', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: varchar('user_id').notNull(),
  calendarId: varchar('calendar_id').notNull(),
  calendarName: varchar('calendar_name').notNull(),
  connectionStatus: varchar('connection_status')
    .$type<'connected' | 'disconnected' | 'error'>()
    .notNull(),
  lastSync: timestamp('last_sync'),
  syncSettings: jsonb('sync_settings').notNull().default('{}'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const googleChatConnected = pgTable('google_chat_connected', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: varchar('user_id').notNull(),
  spaceId: varchar('space_id').notNull(),
  spaceName: varchar('space_name').notNull(),
  connectionStatus: varchar('connection_status')
    .$type<'connected' | 'disconnected' | 'error'>()
    .notNull(),
  lastSync: timestamp('last_sync'),
  syncSettings: jsonb('sync_settings').notNull().default('{}'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const googleMeetConnected = pgTable('google_meet_connected', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: varchar('user_id').notNull(),
  meetingId: varchar('meeting_id').notNull(),
  meetingTitle: varchar('meeting_title').notNull(),
  connectionStatus: varchar('connection_status')
    .$type<'connected' | 'disconnected' | 'error'>()
    .notNull(),
  lastSync: timestamp('last_sync'),
  syncSettings: jsonb('sync_settings').notNull().default('{}'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const googleAnalyticsIntegration = pgTable('google_analytics_integration', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: varchar('user_id').notNull(),
  propertyId: varchar('property_id').notNull(),
  propertyName: varchar('property_name').notNull(),
  connectionStatus: varchar('connection_status')
    .$type<'connected' | 'disconnected' | 'error'>()
    .notNull(),
  lastSync: timestamp('last_sync'),
  syncSettings: jsonb('sync_settings').notNull().default('{}'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const googleIntegrationSettings = pgTable('google_integration_settings', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: varchar('user_id').notNull(),
  serviceType: varchar('service_type').notNull(),
  settings: jsonb('settings').notNull(),
  isEnabled: boolean('is_enabled').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// ============================================================================
// API PROTOCOLS & DOCUMENTATION
// ============================================================================

export const openapiDocumentationProtocols = pgTable('openapi_documentation_protocols', {
  id: uuid('id').primaryKey().defaultRandom(),
  protocolName: varchar('protocol_name').notNull(),
  version: varchar('version').notNull(),
  openapiSpec: jsonb('openapi_spec').notNull(),
  isActive: boolean('is_active').default(true),
  lastUpdated: timestamp('last_updated').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// ============================================================================
// NOTIFICATION SYSTEM
// ============================================================================

export const notificationDeliveryLog = pgTable('notification_delivery_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  notificationId: uuid('notification_id').notNull(),
  recipientId: varchar('recipient_id').notNull(),
  deliveryMethod: varchar('delivery_method').notNull(),
  deliveryStatus: varchar('delivery_status')
    .$type<'sent' | 'delivered' | 'failed' | 'bounced'>()
    .notNull(),
  sentAt: timestamp('sent_at').notNull(),
  deliveredAt: timestamp('delivered_at'),
  errorMessage: text('error_message'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const notificationPreferences = pgTable('notification_preferences', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: varchar('user_id').notNull(),
  notificationType: varchar('notification_type').notNull(),
  isEnabled: boolean('is_enabled').default(true),
  deliveryMethod: varchar('delivery_method').notNull(),
  frequency: varchar('frequency')
    .$type<'immediate' | 'daily' | 'weekly' | 'monthly'>()
    .default('immediate'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const notificationTemplates = pgTable('notification_templates', {
  id: uuid('id').primaryKey().defaultRandom(),
  templateName: varchar('template_name').notNull(),
  templateType: varchar('template_type').notNull(),
  subject: varchar('subject').notNull(),
  body: text('body').notNull(),
  variables: jsonb('variables').notNull().default('[]'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// ============================================================================
// CONTENT PROCESSING
// ============================================================================

export const processedFiles = pgTable('processed_files', {
  id: uuid('id').primaryKey().defaultRandom(),
  originalFilename: varchar('original_filename').notNull(),
  processedFilename: varchar('processed_filename').notNull(),
  fileType: varchar('file_type').notNull(),
  processingStatus: varchar('processing_status')
    .$type<'pending' | 'processing' | 'completed' | 'failed'>()
    .notNull(),
  processingLog: text('processing_log'),
  processedAt: timestamp('processed_at'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const contentAnalysisCache = pgTable('content_analysis_cache', {
  id: uuid('id').primaryKey().defaultRandom(),
  contentHash: varchar('content_hash').notNull().unique(),
  analysisType: varchar('analysis_type').notNull(),
  analysisResult: jsonb('analysis_result').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// ============================================================================
// OCR & RECEIPT PROCESSING
// ============================================================================

export const ocrReceipts = pgTable('ocr_receipts', {
  id: uuid('id').primaryKey().defaultRandom(),
  receiptImage: varchar('receipt_image').notNull(),
  extractedText: text('extracted_text'),
  merchantName: varchar('merchant_name'),
  totalAmount: decimal('total_amount'),
  receiptDate: date('receipt_date'),
  processingStatus: varchar('processing_status')
    .$type<'pending' | 'processing' | 'completed' | 'failed'>()
    .notNull(),
  processedAt: timestamp('processed_at'),
  createdAt: timestamp('created_at').defaultNow(),
});

// ============================================================================
// EQUIPMENT NEWS
// ============================================================================

export const equipmentNews = pgTable('equipment_news', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: varchar('title').notNull(),
  description: text('description'),
  content: text('content').notNull(),
  category: varchar('category').notNull(),
  equipment_category: varchar('equipment_category'),
  author: varchar('author').notNull(),
  source_name: varchar('source_name').notNull(),
  published_date: timestamp('published_date').notNull(),
  publishedAt: timestamp('published_at').notNull(),
  url: text('url'),
  norwegian_relevance: integer('norwegian_relevance').default(0),
  price_nok: decimal('price_nok', { precision: 10, scale: 2 }),
  discount_percentage: integer('discount_percentage').default(0),
  supplier_name: varchar('supplier_name'),
  isPublished: boolean('is_published').default(false),
  viewCount: integer('view_count').default(0),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// ============================================================================
// TRAVEL LOG
// ============================================================================

export const travelLog = pgTable('travel_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: varchar('user_id').notNull(),
  destination: varchar('destination').notNull(),
  startDate: date('start_date').notNull(),
  endDate: date('end_date').notNull(),
  purpose: varchar('purpose').notNull(),
  notes: text('notes'),
  expenses: jsonb('expenses').notNull().default('[]'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// ============================================================================
// RELATIONS
// ============================================================================

export const googleIntegrationSettingsRelations = relations(
  googleIntegrationSettings,
  ({ one }) => ({
    gmail: one(gmailConnected, {
      fields: [googleIntegrationSettings.userId],
      references: [gmailConnected.userId],
    }),
    calendar: one(googleCalendarConnected, {
      fields: [googleIntegrationSettings.userId],
      references: [googleCalendarConnected.userId],
    }),
    chat: one(googleChatConnected, {
      fields: [googleIntegrationSettings.userId],
      references: [googleChatConnected.userId],
    }),
    meet: one(googleMeetConnected, {
      fields: [googleIntegrationSettings.userId],
      references: [googleMeetConnected.userId],
    }),
    analytics: one(googleAnalyticsIntegration, {
      fields: [googleIntegrationSettings.userId],
      references: [googleAnalyticsIntegration.userId],
    }),
  }),
);

export const notificationDeliveryLogRelations = relations(notificationDeliveryLog, ({ one }) => ({
  template: one(notificationTemplates, {
    fields: [notificationDeliveryLog.notificationId],
    references: [notificationTemplates.id],
  }),
}));

export const notificationPreferencesRelations = relations(notificationPreferences, ({ one }) => ({
  user: one(googleIntegrationSettings, {
    fields: [notificationPreferences.userId],
    references: [googleIntegrationSettings.userId],
  }),
}));
