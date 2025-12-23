/**
 * Wedding Timeline Schema
 * Complete schema definitions for wedding timeline management
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
// WEDDING TIMELINE CORE
// ============================================================================

export const weddingEvents = pgTable('wedding_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  weddingId: uuid('wedding_id').notNull(),
  eventName: varchar('event_name').notNull(),
  eventType: varchar('event_type').notNull(),
  startTime: timestamp('start_time').notNull(),
  endTime: timestamp('end_time').notNull(),
  location: varchar('location'),
  description: text('description'),
  status: varchar('status')
    .$type<'planned' | 'in-progress' | 'completed' | 'cancelled'>()
    .default('planned'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const weddingPersons = pgTable('wedding_persons', {
  id: uuid('id').primaryKey().defaultRandom(),
  weddingId: uuid('wedding_id').notNull(),
  eventId: uuid('event_id'),
  name: varchar('name').notNull(),
  role: varchar('role').notNull(),
  email: varchar('email'),
  phone: varchar('phone'),
  isVip: boolean('is_vip').default(false),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const weddingMeetings = pgTable('wedding_meetings', {
  id: uuid('id').primaryKey().defaultRandom(),
  weddingId: uuid('wedding_id').notNull(),
  date: date('date').notNull(),
  time: varchar('time').notNull(),
  type: varchar('type').notNull(),
  location: varchar('location').notNull(),
  attendees: jsonb('attendees').notNull(),
  agenda: jsonb('agenda').notNull(),
  preparation: jsonb('preparation').notNull(),
  status: varchar('status')
    .$type<'planned' | 'in-progress' | 'completed' | 'cancelled'>()
    .default('planned'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const weddingMusicSelections = pgTable('wedding_music_selections', {
  id: uuid('id').primaryKey().defaultRandom(),
  weddingId: uuid('wedding_id').notNull(),
  title: varchar('title').notNull(),
  youtubeUrl: varchar('youtube_url').notNull(),
  duration: varchar('duration'),
  mood: varchar('mood').notNull(),
  usage: varchar('usage').notNull(),
  timestamp: timestamp('timestamp').defaultNow(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const weddingPostProduction = pgTable('wedding_post_production', {
  id: uuid('id').primaryKey().defaultRandom(),
  weddingId: uuid('wedding_id').notNull().unique(),
  totalPhotos: integer('total_photos').notNull().default(0),
  editedPhotos: integer('edited_photos').notNull().default(0),
  remainingPhotos: integer('remaining_photos').notNull().default(0),
  estimatedCompletion: date('estimated_completion'),
  deliveryTracking: jsonb('delivery_tracking').notNull().default('[]'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// ============================================================================
// RELATIONS
// ============================================================================

export const weddingEventsRelations = relations(weddingEvents, ({ many }) => ({
  persons: many(weddingPersons),
}));

export const weddingPersonsRelations = relations(weddingPersons, ({ one }) => ({
  event: one(weddingEvents, {
    fields: [weddingPersons.eventId],
    references: [weddingEvents.id],
  }),
}));

export const weddingMeetingsRelations = relations(weddingMeetings, ({ one }) => ({
  wedding: one(weddingEvents, {
    fields: [weddingMeetings.weddingId],
    references: [weddingEvents.id],
  }),
}));

export const weddingMusicSelectionsRelations = relations(weddingMusicSelections, ({ one }) => ({
  wedding: one(weddingEvents, {
    fields: [weddingMusicSelections.weddingId],
    references: [weddingEvents.id],
  }),
}));

export const weddingPostProductionRelations = relations(weddingPostProduction, ({ one }) => ({
  wedding: one(weddingEvents, {
    fields: [weddingPostProduction.weddingId],
    references: [weddingEvents.id],
  }),
}));
