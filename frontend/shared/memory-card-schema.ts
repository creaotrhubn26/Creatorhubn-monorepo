/**
 * CreatorHub Norge - Memory Card Backup System Schema
 * Comprehensive memory card management for photographers and videographers
 * Aktiveres automatisk i post-produksjonsfasen
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
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';
// Import removed - memoryCards is defined in this file

// Memory Cards Table
export const memoryCards = pgTable('memory_cards', {
  id: serial('id').primaryKey(),
  cardId: varchar('card_id').notNull().unique(),
  userId: varchar('user_id').notNull(),
  projectId: varchar('project_id'),
  cardName: varchar('card_name').notNull(),
  cardType: varchar('card_type').$type<'CF' | 'SD' | 'microSD' | 'XQD' | 'CFexpress'>().notNull(),
  capacity: integer('capacity_gb').notNull(),
  brand: varchar('brand'),
  model: varchar('model'),
  serialNumber: varchar('serial_number'),
  purchaseDate: date('purchase_date'),
  warrantyExpiry: date('warranty_expiry'),
  status: varchar('status')
    .$type<'active' | 'backup' | 'retired' | 'lost' | 'damaged'>()
    .default('active'),
  lastUsed: timestamp('last_used'),
  totalWrites: bigint('total_writes', { mode: 'number' }).default(0),
  totalReads: bigint('total_reads', { mode: 'number' }).default(0),
  healthStatus: varchar('health_status')
    .$type<'excellent' | 'good' | 'fair' | 'poor' | 'critical'>()
    .default('excellent'),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Memory Card Backup Sessions
export const memoryCardSessions = pgTable('memory_card_sessions', {
  id: serial('id').primaryKey(),
  sessionId: varchar('session_id').notNull().unique(),
  projectId: varchar('project_id').notNull(),
  userId: varchar('user_id').notNull(),
  profession: varchar('profession').notNull(), // photographer, videographer

  // Project Integration
  projectPhase: varchar('project_phase').notNull().default('post_production'),
  eventDate: timestamp('event_date'),
  executionDate: timestamp('execution_date'),
  postProductionStartDate: timestamp('post_production_start_date'),
  activatedAt: timestamp('activated_at').defaultNow(),

  // Session Configuration
  eventType: varchar('event_type').notNull(), // single_day, multi_day, commercial, wedding
  weddingCulture: varchar('wedding_culture'), // norsk, indisk, tyrkisk, marokkansk, pakistansk, etc.
  totalDays: integer('total_days').default(1),
  activeDays: jsonb('active_days'), // Array av dagnummer som brukes [1, 2, 3]
  cardLabelingScheme: varchar('card_labeling_scheme').notNull(), // ABCD, EFGH, custom

  // Mappestruktur Integration
  driveFolderId: varchar('drive_folder_id'), // Google Drive hovedmappe ID
  dayFolders: jsonb('day_folders'), // Mappestruktur per dag
  uploadProgress: jsonb('upload_progress'), // Opplastingsstatus per dag/kort

  // Session Status
  status: varchar('status').notNull().default('active'), // active, completed, archived
  isAutoActivated: boolean('is_auto_activated').default(true),

  // Backup Progress
  totalCards: integer('total_cards').default(0),
  backedUpCards: integer('backed_up_cards').default(0),
  lastBackupAt: timestamp('last_backup_at'),

  // Metadata
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  completedAt: timestamp('completed_at'),
});

// Memory Card Entries - moved to main database-persistence-schema.ts to avoid conflicts

// Memory Card Backup Tips
export const backupTips = pgTable('backup_tips', {
  id: serial('id').primaryKey(),
  tipId: varchar('tip_id').notNull().unique(),

  // Tip Categories
  category: varchar('category').notNull(), // labeling, backup_process, safety, organization
  eventType: varchar('event_type').notNull(), // single_day, multi_day, commercial, wedding
  profession: varchar('profession').notNull(), // photographer, videographer

  // Tip Content
  title: varchar('title').notNull(),
  description: text('description').notNull(),
  actionItems: jsonb('action_items'), // Array of specific actions to take
  importance: varchar('importance').notNull().default('medium'), // low, medium, high, critical

  // Display Conditions
  showOnActivation: boolean('show_on_activation').default(false),
  showDuringBackup: boolean('show_during_backup').default(false),
  showOnCompletion: boolean('show_on_completion').default(false),

  // Norwegian Localization
  titleNorwegian: varchar('title_norwegian'),
  descriptionNorwegian: text('description_norwegian'),

  // Metadata
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Memory Card Backup Logs
export const backupLogs = pgTable('backup_logs', {
  id: serial('id').primaryKey(),
  logId: varchar('log_id').notNull().unique(),
  sessionId: integer('session_id').references(() => memoryCardSessions.id),
  cardId: varchar('card_id').notNull(), // Reference to memoryCards.cardId (not a direct FK here to avoid circular dependency)

  // Log Information
  action: varchar('action').notNull(), // backup_started, backup_completed, verification_passed, error_occurred
  status: varchar('status').notNull(), // success, warning, error
  message: text('message').notNull(),
  details: jsonb('details'), // Additional structured data

  // Performance Metrics
  filesTransferred: integer('files_transferred'),
  bytesTransferred: bigint('bytes_transferred', { mode: 'number' }),
  transferDuration: integer('transfer_duration'), // in seconds
  transferSpeed: decimal('transfer_speed', { precision: 10, scale: 2 }), // MB/s

  // Error Information
  errorCode: varchar('error_code'),
  errorDetails: jsonb('error_details'),

  // Metadata
  timestamp: timestamp('timestamp').defaultNow(),
  userId: varchar('user_id').notNull(),
});

// Relations
export const memoryCardSessionsRelations = relations(memoryCardSessions, ({ many }) => ({
  backupLogs: many(backupLogs),
}));

// memoryCardsRelations moved to main database-persistence-schema.ts

export const backupLogsRelations = relations(backupLogs, ({ one }) => ({
  session: one(memoryCardSessions, {
    fields: [backupLogs.sessionId],
    references: [memoryCardSessions.id],
  }),
  memoryCard: one(memoryCards, {
    fields: [backupLogs.cardId],
    references: [memoryCards.id],
  }),
}));

// Export Types
export type MemoryCardSession = typeof memoryCardSessions.$inferSelect;
export type InsertMemoryCardSession = typeof memoryCardSessions.$inferInsert;
// MemoryCard types moved to main database-persistence-schema.ts
export type BackupTip = typeof backupTips.$inferSelect;
export type InsertBackupTip = typeof backupTips.$inferInsert;
export type BackupLog = typeof backupLogs.$inferSelect;
export type InsertBackupLog = typeof backupLogs.$inferInsert;

// Zod schemas for validation
export const insertMemoryCardSessionSchema = createInsertSchema(memoryCardSessions);
// insertMemoryCardSchema moved to main database-persistence-schema.ts
export const insertBackupTipSchema = createInsertSchema(backupTips);
export const insertBackupLogSchema = createInsertSchema(backupLogs);

// Memory Card Session Create Schema
export const createMemoryCardSessionSchema = insertMemoryCardSessionSchema.extend({
  eventType: z.enum(['single_day', 'multi_day', 'commercial', 'wedding']),
  profession: z.enum(['photographer', 'videographer']),
  totalDays: z.number().min(1).max(30).default(1),
});

export type CreateMemoryCardSession = z.infer<typeof createMemoryCardSessionSchema>;

// Memory Card Create Schema moved to main database-persistence-schema.ts
