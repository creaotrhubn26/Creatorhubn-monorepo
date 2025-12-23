import { pgTable, serial, varchar, text, timestamp, boolean, jsonb } from 'drizzle-orm/pg-core';

// Platform operational status tracking
export const platformStatus = pgTable('platform_status', {
  id: serial('id').primaryKey(),

  // Status information
  status: varchar('status').notNull(), // "operational", "maintenance", "degraded", "outage"
  statusMessage: text('status_message'), // Human-readable status message

  // Service-specific status
  services: jsonb('services').notNull().default({
    authentication: 'operational',
    vendor_marketplace: 'operational',
    portfolio_system: 'operational',
    file_management: 'operational',
    email_service: 'operational',
    payment_processing: 'operational',
    search_functionality: 'operational',
  }),

  // Maintenance information
  maintenanceMode: boolean('maintenance_mode').default(false),
  maintenanceStart: timestamp('maintenance_start'),
  maintenanceEnd: timestamp('maintenance_end'),
  maintenanceMessage: text('maintenance_message'),

  // Incident information
  incidentActive: boolean('incident_active').default(false),
  incidentSeverity: varchar('incident_severity'), // "low", "medium", "high", "critical"
  incidentDescription: text('incident_description'),
  incidentStarted: timestamp('incident_started'),

  // Update information
  lastUpdated: timestamp('last_updated').defaultNow(),
  updatedBy: varchar('updated_by').notNull(), // Admin user who updated status

  // Automatic monitoring data
  uptime: varchar('uptime'), // "99.9%" format
  responseTime: varchar('response_time'), // "< 200ms" format

  createdAt: timestamp('created_at').defaultNow(),
});

// Status update history for tracking changes
export const platformStatusHistory = pgTable('platform_status_history', {
  id: serial('id').primaryKey(),

  // Reference to status
  statusId: varchar('status_id').notNull(),

  // Change information
  previousStatus: varchar('previous_status'),
  newStatus: varchar('new_status').notNull(),
  changeReason: text('change_reason'),

  // Impact assessment
  userImpact: varchar('user_impact'), // "none", "minimal", "moderate", "severe"
  estimatedDuration: varchar('estimated_duration'), // "15 minutes", "2 hours", etc.

  // Admin information
  updatedBy: varchar('updated_by').notNull(),
  changeTimestamp: timestamp('change_timestamp').defaultNow(),
});

export type PlatformStatus = typeof platformStatus.$inferSelect;
export type InsertPlatformStatus = typeof platformStatus.$inferInsert;
export type PlatformStatusHistory = typeof platformStatusHistory.$inferSelect;
export type InsertPlatformStatusHistory = typeof platformStatusHistory.$inferInsert;
