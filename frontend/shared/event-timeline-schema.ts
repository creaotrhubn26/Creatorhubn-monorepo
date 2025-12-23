/**
 * Event Timeline Schema
 * Complete schema for universal event timeline management (weddings, corporate, events, etc.)
 * Includes GDPR compliance and data retention tracking
 */

import {
  pgTable,
  text,
  varchar,
  timestamp,
  jsonb,
  integer,
  boolean,
  serial,
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ============================================================================
// EVENT TIMELINES - Universal timeline for all event types
// ============================================================================

export const eventTimelines = pgTable(
  'event_timelines',
  {
    id: serial('id').primaryKey(),
    projectId: varchar('project_id', { length: 255 }).notNull(),
    userId: varchar('user_id', { length: 255 }).notNull(),
    projectType: varchar('project_type', { length: 100 }).notNull(), // 'wedding', 'corporate', 'event', 'portrait', etc.

    // Client information
    clientName: varchar('client_name', { length: 255 }).notNull(),
    clientEmail: varchar('client_email', { length: 255 }),
    clientPhone: varchar('client_phone', { length: 50 }),

    // Event details
    eventDate: timestamp('event_date'),
    eventLocation: varchar('event_location', { length: 500 }),
    eventDescription: text('event_description'),

    // Timeline settings
    status: varchar('status', { length: 50 }).default('draft'), // 'draft', 'active', 'completed', 'cancelled'
    clientAccessEnabled: boolean('client_access_enabled').default(false),
    clientAccessCode: varchar('client_access_code', { length: 100 }),

    // GDPR Compliance & Data Retention
    completedAt: timestamp('completed_at'),
    gdprDeletionScheduled: boolean('gdpr_deletion_scheduled').default(false),
    gdprDeletionDate: timestamp('gdpr_deletion_date'),
    clientRetentionDays: integer('client_retention_days'),
    contractId: varchar('contract_id', { length: 255 }), // Reference to contract that specifies retention

    // Metadata
    metadata: jsonb('metadata'),

    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    projectIdIdx: index('event_timelines_project_id_idx').on(table.projectId),
    userIdIdx: index('event_timelines_user_id_idx').on(table.userId),
    statusIdx: index('event_timelines_status_idx').on(table.status),
    gdprDeletionIdx: index('event_timelines_gdpr_deletion_idx').on(
      table.gdprDeletionScheduled,
      table.gdprDeletionDate,
    ),
    contractIdIdx: index('event_timelines_contract_id_idx').on(table.contractId),
  }),
);

// ============================================================================
// EVENT TIMELINE EVENTS - Individual events within a timeline
// ============================================================================

export const eventTimelineEvents = pgTable(
  'event_timeline_events',
  {
    id: serial('id').primaryKey(),
    timelineId: integer('timeline_id').notNull(),

    // Event details
    title: varchar('title', { length: 255 }).notNull(),
    time: varchar('time', { length: 50 }).notNull(), // "14:00" or "2:00 PM"
    duration: integer('duration').default(60), // minutes
    description: text('description'),
    location: varchar('location', { length: 500 }),

    // Event classification
    eventType: varchar('event_type', { length: 100 }).default('other'), // 'ceremony', 'reception', 'meeting', 'photoshoot', etc.
    priority: varchar('priority', { length: 50 }).default('medium'), // 'high', 'medium', 'low'
    status: varchar('status', { length: 50 }).default('planned'), // 'planned', 'confirmed', 'in_progress', 'completed', 'cancelled'

    // Additional metadata
    metadata: jsonb('metadata'),

    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    timelineIdIdx: index('event_timeline_events_timeline_id_idx').on(table.timelineId),
    statusIdx: index('event_timeline_events_status_idx').on(table.status),
  }),
);

// ============================================================================
// EVENT TIMELINE SUGGESTIONS - Client suggestions for timeline changes
// ============================================================================

export const eventTimelineSuggestions = pgTable(
  'event_timeline_suggestions',
  {
    id: serial('id').primaryKey(),
    timelineId: integer('timeline_id').notNull(),

    // Suggestion details
    eventTitle: varchar('event_title', { length: 255 }).notNull(),
    suggestedTime: varchar('suggested_time', { length: 50 }).notNull(),
    reason: text('reason'),
    priority: varchar('priority', { length: 50 }).default('medium'), // 'high', 'medium', 'low'

    // Status tracking
    status: varchar('status', { length: 50 }).default('pending'), // 'pending', 'accepted', 'rejected'
    reviewNote: text('review_note'),
    reviewedBy: varchar('reviewed_by', { length: 255 }),
    reviewedAt: timestamp('reviewed_at'),

    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    timelineIdIdx: index('event_timeline_suggestions_timeline_id_idx').on(table.timelineId),
    statusIdx: index('event_timeline_suggestions_status_idx').on(table.status),
  }),
);

// ============================================================================
// RELATIONS
// ============================================================================

export const eventTimelinesRelations = relations(eventTimelines, ({ many }) => ({
  events: many(eventTimelineEvents),
  suggestions: many(eventTimelineSuggestions),
}));

export const eventTimelineEventsRelations = relations(eventTimelineEvents, ({ one }) => ({
  timeline: one(eventTimelines, {
    fields: [eventTimelineEvents.timelineId],
    references: [eventTimelines.id],
  }),
}));

export const eventTimelineSuggestionsRelations = relations(eventTimelineSuggestions, ({ one }) => ({
  timeline: one(eventTimelines, {
    fields: [eventTimelineSuggestions.timelineId],
    references: [eventTimelines.id],
  }),
}));

// ============================================================================
// TYPES
// ============================================================================

export type EventTimeline = typeof eventTimelines.$inferSelect;
export type InsertEventTimeline = typeof eventTimelines.$inferInsert;

export type EventTimelineEvent = typeof eventTimelineEvents.$inferSelect;
export type InsertEventTimelineEvent = typeof eventTimelineEvents.$inferInsert;

export type EventTimelineSuggestion = typeof eventTimelineSuggestions.$inferSelect;
export type InsertEventTimelineSuggestion = typeof eventTimelineSuggestions.$inferInsert;
