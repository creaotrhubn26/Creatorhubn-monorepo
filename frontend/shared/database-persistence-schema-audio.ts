/**
 * Audio Enhancement Database Schema
 * Add to main database-persistence-schema.ts
 */

import {
  pgTable,
  varchar,
  integer,
  timestamp,
  jsonb,
  boolean,
  text,
  index,
} from 'drizzle-orm/pg-core';

export const audioEnhancementJobs = pgTable(
  'audio_enhancement_jobs',
  {
    id: varchar('id').primaryKey(),
    userId: varchar('user_id').notNull(),
    projectId: varchar('project_id'),

    // File info
    filename: varchar('filename', { length: 500 }).notNull(),
    originalSize: integer('original_size').notNull(),
    originalUrl: varchar('original_url', { length: 1000 }).notNull(),
    enhancedUrl: varchar('enhanced_url', { length: 1000 }),

    // Processing
    enhancementType: varchar('enhancement_type', { length: 50 }).notNull(), // 'denoise' | 'speech_enhance' | 'source_separate'
    status: varchar('status', { length: 50 }).default('pending'), // 'pending' | 'processing' | 'completed' | 'error' | 'cancelled'
    progress: integer('progress').default(0), // 0-100

    // Parameters used
    parameters: jsonb('parameters'), // Full parameter object from UI

    // Quality metrics
    qualityMetrics: jsonb('quality_metrics'), // SNR, THD, dynamic range, etc.

    // Timing
    startedAt: timestamp('started_at').defaultNow(),
    completedAt: timestamp('completed_at'),
    processingTime: integer('processing_time'), // milliseconds

    // Error handling
    errorMessage: text('error_message'),

    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    userIdIdx: index('audio_enhancement_jobs_user_id_idx').on(table.userId),
    statusIdx: index('audio_enhancement_jobs_status_idx').on(table.status),
    createdAtIdx: index('audio_enhancement_jobs_created_at_idx').on(table.createdAt),
  }),
);

export type AudioEnhancementJob = typeof audioEnhancementJobs.$inferSelect;
export type InsertAudioEnhancementJob = typeof audioEnhancementJobs.$inferInsert;
