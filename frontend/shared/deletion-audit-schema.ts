import {
  pgTable,
  varchar,
  timestamp,
  text,
  jsonb,
  integer,
  boolean,
  serial,
} from 'drizzle-orm/pg-core';

/**
 * ⭐ GDPR COMPLIANCE: Deletion Audit Log
 *
 * Tracks all user data deletions for legal compliance
 * Required by GDPR Article 30 (Records of processing activities)
 * Must be kept indefinitely for audit purposes
 */
export const deletionAuditLog = pgTable('deletion_audit_log', {
  id: serial('id').primaryKey(),
  userId: varchar('user_id', { length: 255 }).notNull(),
  deletedAt: timestamp('deleted_at').notNull().defaultNow(),
  deletedTables: jsonb('deleted_tables').notNull(), // Array of table names
  deletionReason: text('deletion_reason').notNull(),
  deletedBy: varchar('deleted_by', { length: 255 }).notNull(), // 'system' or admin ID
  errorsEncountered: jsonb('errors_encountered'), // Array of error messages
  dataSizeMb: integer('data_size_mb'), // Size of deleted data
  backupCreated: boolean('backup_created').default(false),
  backupLocation: text('backup_location'),
  legalRetentionKept: jsonb('legal_retention_kept'), // What was anonymized vs deleted
});

/**
 * ⭐ MONITORING: Deletion Failures
 *
 * Tracks failed deletion attempts for retry and monitoring
 * Admin can see which deletions need manual intervention
 */
export const deletionFailures = pgTable('deletion_failures', {
  id: serial('id').primaryKey(),
  userId: varchar('user_id', { length: 255 }).notNull().unique(),
  attemptedAt: timestamp('attempted_at').notNull().defaultNow(),
  error: text('error').notNull(),
  tablesDeleted: jsonb('tables_deleted'), // Partial success log
  retryCount: integer('retry_count').default(0).notNull(),
  resolvedAt: timestamp('resolved_at'),
  resolvedBy: varchar('resolved_by', { length: 255 }),
  resolution: text('resolution'),
});

/**
 * ⭐ MONITORING: Cleanup Job Logs
 *
 * Tracks cron job execution for monitoring
 * Admin can see if cleanup jobs are running successfully
 */
export const cleanupJobLogs = pgTable('cleanup_job_logs', {
  id: serial('id').primaryKey(),
  runAt: timestamp('run_at').notNull().defaultNow(),
  status: varchar('status', { length: 50 }).notNull(), // 'success', 'failed', 'partial'
  deletedCount: integer('deleted_count').default(0),
  failedCount: integer('failed_count').default(0),
  error: text('error'),
  details: jsonb('details'),
  durationMs: integer('duration_ms'),
});

/**
 * ⭐ LEGAL: Deletion Requests
 *
 * User-initiated deletion requests (separate from business cancellation)
 * Supports GDPR Article 17 (Right to Erasure)
 */
export const deletionRequests = pgTable('deletion_requests', {
  id: serial('id').primaryKey(),
  userId: varchar('user_id', { length: 255 }).notNull(),
  requestedAt: timestamp('requested_at').notNull().defaultNow(),
  requestType: varchar('request_type', { length: 50 }).notNull(), // 'account_deletion', 'business_cancellation', 'gdpr_erasure'
  reason: text('reason'),
  status: varchar('status', { length: 50 }).notNull().default('pending'), // 'pending', 'approved', 'processing', 'completed', 'failed'
  approvedBy: varchar('approved_by', { length: 255 }),
  approvedAt: timestamp('approved_at'),
  completedAt: timestamp('completed_at'),
  dataExportCreated: boolean('data_export_created').default(false),
  dataExportUrl: text('data_export_url'),
});

// TypeScript types
export type DeletionAuditLog = typeof deletionAuditLog.$inferSelect;
export type InsertDeletionAuditLog = typeof deletionAuditLog.$inferInsert;

export type DeletionFailure = typeof deletionFailures.$inferSelect;
export type InsertDeletionFailure = typeof deletionFailures.$inferInsert;

export type CleanupJobLog = typeof cleanupJobLogs.$inferSelect;
export type InsertCleanupJobLog = typeof cleanupJobLogs.$inferInsert;

export type DeletionRequest = typeof deletionRequests.$inferSelect;
export type InsertDeletionRequest = typeof deletionRequests.$inferInsert;
