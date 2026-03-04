import {
  pgTable,
  varchar,
  text,
  timestamp,
  integer,
  boolean,
  decimal,
  jsonb,
} from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { sql } from 'drizzle-orm';
import type { z } from 'zod';

// CreatorHub Bot Text Enhancement System
export const textEnhancementHistory = pgTable('text_enhancement_history', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar('user_id').notNull(),
  originalText: text('original_text').notNull(),
  enhancedText: text('enhanced_text').notNull(),
  enhancementType: varchar('enhancement_type', { length: 50 }).notNull(), // professional, creative, concise, expand, client-friendly, technical
  targetAudience: varchar('target_audience', { length: 50 }), // technical, client, general
  profession: varchar('profession', { length: 50 }), // photographer, videographer, music, admin

  // Enhancement Statistics
  wordsChanged: integer('words_changed').default(0),
  readabilityScore: integer('readability_score').default(0),
  originalLength: integer('original_length').notNull(),
  enhancedLength: integer('enhanced_length').notNull(),

  // Processing metadata
  processingTimeMs: integer('processing_time_ms'),
  qualityScore: decimal('quality_score', { precision: 3, scale: 2 }), // 0.00-1.00

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Smart Notes System with Feedback Integration
export const smartNotes = pgTable('smart_notes', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar('user_id').notNull(),
  title: varchar('title', { length: 200 }).notNull(),
  content: text('content').notNull(),
  category: varchar('category', { length: 50 }).default('general'), // general, bugs, ideas, backend, frontend, performance
  priority: varchar('priority', { length: 20 }).default('medium'), // high, medium, low
  tags: jsonb('tags').$type<string[]>().default([]),
  status: varchar('status', { length: 20 }).default('active'), // active, completed, archived

  // AI Enhancement Data
  aiSuggestions: jsonb('ai_suggestions').$type<string[]>().default([]),
  feedbackData: jsonb('feedback_data'),

  // Project Integration
  projectId: varchar('project_id'),

  // Source tracking
  source: varchar('source', { length: 50 }).default('manual'), // manual, feedback, auto
  sourceId: varchar('source_id'), // Reference to source record

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  lastModified: timestamp('last_modified').defaultNow(),
});

// Improvement Tasks for Magic Creator Integration
export const improvementTasks = pgTable('improvement_tasks', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar('user_id').notNull(),
  taskType: varchar('task_type', { length: 50 }).notNull(), // bug-fix, feature-request, ui-improvement, performance
  title: varchar('title', { length: 200 }).notNull(),
  description: text('description').notNull(),
  priority: varchar('priority', { length: 20 }).default('medium'), // high, medium, low
  status: varchar('status', { length: 20 }).default('pending'), // pending, executing, completed, failed

  // Auto-Fix Integration
  autoFixReady: boolean('auto_fix_ready').default(false),
  magicCreatorScript: varchar('magic_creator_script', { length: 100 }),
  executionId: varchar('execution_id'),

  // Source tracking for Smart Notes integration
  sourceType: varchar('source_type', { length: 50 }), // feedback, note, manual
  sourceId: varchar('source_id'), // Reference to smart_notes or other source

  // Time estimation
  estimatedTime: varchar('estimated_time', { length: 50 }), // automatic, 1-hour, 1-day, 1-week, manual

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Magic Creator Features Registry
export const magicCreatorFeatures = pgTable('magic_creator_features', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  featureName: varchar('feature_name', { length: 100 }).notNull().unique(),
  scriptPath: varchar('script_path', { length: 200 }),
  description: text('description'),
  category: varchar('category', { length: 50 }), // ui-fix, performance, bug-fix, feature-creation
  profession: varchar('profession', { length: 50 }), // all, photographer, videographer, music, admin

  // Usage statistics
  usageCount: integer('usage_count').default(0),
  successRate: decimal('success_rate', { precision: 5, scale: 2 }).default('0'),
  avgExecutionTimeMs: integer('avg_execution_time_ms'),

  // Configuration
  enabled: boolean('enabled').default(true),
  requiresConfirmation: boolean('requires_confirmation').default(true),

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Zod schemas for validation
export const insertTextEnhancementHistorySchema = createInsertSchema(textEnhancementHistory);
export const insertSmartNotesSchema = createInsertSchema(smartNotes);
export const insertImprovementTasksSchema = createInsertSchema(improvementTasks);
export const insertMagicCreatorFeaturesSchema = createInsertSchema(magicCreatorFeatures);

// CreatorHub Bot and Smart Notes Types
export type TextEnhancementHistory = typeof textEnhancementHistory.$inferSelect;
export type InsertTextEnhancementHistory = z.infer<typeof insertTextEnhancementHistorySchema>;
export type SmartNote = typeof smartNotes.$inferSelect;
export type InsertSmartNote = z.infer<typeof insertSmartNotesSchema>;
export type ImprovementTask = typeof improvementTasks.$inferSelect;
export type InsertImprovementTask = z.infer<typeof insertImprovementTasksSchema>;
export type MagicCreatorFeature = typeof magicCreatorFeatures.$inferSelect;
export type InsertMagicCreatorFeature = z.infer<typeof insertMagicCreatorFeaturesSchema>;
