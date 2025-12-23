/**
 * Additional Features Schema
 * Complete schema definitions for all remaining platform features
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
// SHOWCASE SYSTEM
// ============================================================================

export const showcases = pgTable('showcases', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: varchar('user_id').notNull(),
  title: varchar('title').notNull(),
  description: text('description'),
  categoryId: uuid('category_id'),
  setId: uuid('set_id'),
  status: varchar('status').$type<'draft' | 'published' | 'archived'>().default('draft'),
  settings: jsonb('settings').notNull().default('{}'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const showcaseSets = pgTable('showcase_sets', {
  id: uuid('id').primaryKey().defaultRandom(),
  categoryId: uuid('category_id').notNull(),
  name: varchar('name').notNull(),
  description: text('description'),
  coverImageId: uuid('cover_image_id'),
  sortOrder: integer('sort_order').default(0),
  profession: varchar('profession').notNull(),
  userId: varchar('user_id').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// ============================================================================
// PHOTO SESSIONS
// ============================================================================

export const photoSessions = pgTable('photo_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull(),
  sessionName: varchar('session_name').notNull(),
  sessionDate: date('session_date').notNull(),
  location: varchar('location'),
  photographerId: varchar('photographer_id').notNull(),
  status: varchar('status')
    .$type<'planned' | 'in-progress' | 'completed' | 'cancelled'>()
    .default('planned'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const additionalImages = pgTable('additional_images', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: uuid('session_id').notNull(),
  filename: varchar('filename').notNull(),
  filePath: varchar('file_path').notNull(),
  fileSize: bigint('file_size', { mode: 'number' }).notNull(),
  mimeType: varchar('mime_type').notNull(),
  width: integer('width'),
  height: integer('height'),
  editingState: jsonb('editing_state').notNull().default('{}'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const customProfiles = pgTable('custom_profiles', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id'),
  profileName: varchar('profile_name').notNull(),
  profileData: jsonb('profile_data').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// ============================================================================
// EMAIL SYSTEM
// ============================================================================

export const emails = pgTable('emails', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id'),
  recipientEmail: varchar('recipient_email').notNull(),
  subject: varchar('subject').notNull(),
  content: text('content').notNull(),
  status: varchar('status').$type<'draft' | 'sent' | 'failed'>().default('draft'),
  sentAt: timestamp('sent_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const smartMeetingNotes = pgTable('smart_meeting_notes', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: varchar('user_id').notNull(),
  meetingTitle: varchar('meeting_title').notNull(),
  meetingDate: date('meeting_date').notNull(),
  notes: text('notes').notNull(),
  actionItems: jsonb('action_items').notNull().default('[]'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// ============================================================================
// GDPR COMPLIANCE
// ============================================================================

export const gdprConsents = pgTable('gdpr_consents', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: varchar('user_id').notNull(),
  consentType: varchar('consent_type').notNull(),
  granted: boolean('granted').notNull(),
  grantedAt: timestamp('granted_at').notNull(),
  revokedAt: timestamp('revoked_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const gdprDataRequests = pgTable('gdpr_data_requests', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: varchar('user_id').notNull(),
  requestType: varchar('request_type').notNull(),
  status: varchar('status')
    .$type<'pending' | 'processing' | 'completed' | 'rejected'>()
    .default('pending'),
  requestedAt: timestamp('requested_at').notNull(),
  processedAt: timestamp('processed_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// ============================================================================
// SMART TIMING
// ============================================================================

export const smartTimingRules = pgTable('smart_timing_rules', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: varchar('user_id').notNull(),
  ruleName: varchar('rule_name').notNull(),
  ruleConfig: jsonb('rule_config').notNull(),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const smartTimingEvents = pgTable('smart_timing_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  ruleId: uuid('rule_id').notNull(),
  eventType: varchar('event_type').notNull(),
  eventData: jsonb('event_data').notNull(),
  triggeredAt: timestamp('triggered_at').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// ============================================================================
// ONBOARDING
// ============================================================================

export const onboardingSteps = pgTable('onboarding_steps', {
  id: uuid('id').primaryKey().defaultRandom(),
  stepName: varchar('step_name').notNull(),
  stepOrder: integer('step_order').notNull(),
  profession: varchar('profession').notNull(),
  stepConfig: jsonb('step_config').notNull(),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// ============================================================================
// MEMORY CARD MANAGEMENT
// ============================================================================

export const memoryCardBackups = pgTable('memory_card_backups', {
  id: uuid('id').primaryKey().defaultRandom(),
  memoryCardId: uuid('memory_card_id').notNull(),
  backupLocation: varchar('backup_location').notNull(),
  backupSize: bigint('backup_size', { mode: 'number' }).notNull(),
  backupStatus: varchar('backup_status')
    .$type<'in-progress' | 'completed' | 'failed'>()
    .default('in-progress'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// ============================================================================
// TUTORIALS
// ============================================================================

export const tutorialCategories = pgTable('tutorial_categories', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name').notNull(),
  description: text('description'),
  sortOrder: integer('sort_order').default(0),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// ============================================================================
// ANALYTICS
// ============================================================================

export const analyticsData = pgTable('analytics_data', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: varchar('user_id').notNull(),
  metricName: varchar('metric_name').notNull(),
  metricValue: decimal('metric_value').notNull(),
  metricDate: date('metric_date').notNull(),
  metadata: jsonb('metadata').notNull().default('{}'),
  createdAt: timestamp('created_at').defaultNow(),
});

// ============================================================================
// ADDITIONAL FEATURES
// ============================================================================

export const smartNotes = pgTable('smart_notes', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: varchar('user_id').notNull(),
  title: varchar('title').notNull(),
  content: text('content').notNull(),
  category: varchar('category').notNull(),
  tags: jsonb('tags').notNull().default('[]'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const magicCreatorFeatures = pgTable('magic_creator_features', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: varchar('user_id').notNull(),
  featureName: varchar('feature_name').notNull(),
  featureType: varchar('feature_type').notNull(),
  generatedCode: text('generated_code').notNull(),
  status: varchar('status').$type<'generating' | 'completed' | 'failed'>().default('generating'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const crmContacts = pgTable('crm_contacts', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name').notNull(),
  email: varchar('email').notNull(),
  phone: varchar('phone'),
  company: varchar('company'),
  status: varchar('status').$type<'lead' | 'prospect' | 'customer' | 'inactive'>().default('lead'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const crmEmailTemplates = pgTable('crm_email_templates', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name').notNull(),
  subject: varchar('subject').notNull(),
  content: text('content').notNull(),
  category: varchar('category'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const crmPipelineStages = pgTable('crm_pipeline_stages', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name').notNull(),
  stageOrder: integer('stage_order').notNull().default(0),
  color: varchar('color'),
  description: text('description'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// ============================================================================
// RELATIONS
// ============================================================================

export const showcasesRelations = relations(showcases, ({ one }) => ({
  set: one(showcaseSets, {
    fields: [showcases.setId],
    references: [showcaseSets.id],
  }),
}));

export const showcaseSetsRelations = relations(showcaseSets, ({ many }) => ({
  showcases: many(showcases),
}));

export const photoSessionsRelations = relations(photoSessions, ({ many }) => ({
  images: many(additionalImages),
}));

export const additionalImagesRelations = relations(additionalImages, ({ one }) => ({
  session: one(photoSessions, {
    fields: [additionalImages.sessionId],
    references: [photoSessions.id],
  }),
}));

export const smartTimingEventsRelations = relations(smartTimingEvents, ({ one }) => ({
  rule: one(smartTimingRules, {
    fields: [smartTimingEvents.ruleId],
    references: [smartTimingRules.id],
  }),
}));

export const smartTimingRulesRelations = relations(smartTimingRules, ({ many }) => ({
  events: many(smartTimingEvents),
}));
