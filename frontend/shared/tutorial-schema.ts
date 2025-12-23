import {
  pgTable,
  text,
  varchar,
  timestamp,
  jsonb,
  integer,
  boolean,
  serial,
} from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';

// Tutorial progress tracking table
export const tutorialProgress = pgTable('tutorial_progress', {
  id: serial('id').primaryKey(),
  tutorialId: varchar('tutorial_id').notNull(),
  userId: varchar('user_id').notNull(),
  profession: varchar('profession').notNull(), // photographer, videographer, music_producer, vendor
  currentStep: integer('current_step').default(0),
  totalSteps: integer('total_steps'),
  completed: boolean('completed').default(false),
  startedAt: timestamp('started_at').defaultNow(),
  completedAt: timestamp('completed_at'),
  timeSpent: integer('time_spent'), // in seconds
  lastAccessedAt: timestamp('last_accessed_at').defaultNow(),

  // Tutorial feedback
  feedback: jsonb('feedback'), // { rating: number, comments: string, helpful: boolean }

  // Progress data
  progressData: jsonb('progress_data'), // { completedSteps: number[], currentLessonData: any }

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Tutorial definitions table (for storing dynamic tutorial content)
export const tutorials = pgTable('tutorials', {
  id: serial('id').primaryKey(),
  tutorialId: varchar('tutorial_id').notNull().unique(),
  title: varchar('title').notNull(),
  description: text('description'),
  category: varchar('category').notNull(),
  difficulty: varchar('difficulty').notNull(), // beginner, intermediate, advanced
  duration: varchar('duration'), // estimated time like "15 min"
  profession: jsonb('profession'), // array of applicable professions
  component: varchar('component'), // component name this tutorial covers
  scenario: text('scenario'), // real-world scenario description
  keyFeatures: jsonb('key_features'), // array of key features covered
  implementationStatus: varchar('implementation_status').default('planned'), // planned, in_development, completed

  // Tutorial content
  steps: jsonb('steps'), // array of tutorial steps with instructions
  resources: jsonb('resources'), // additional resources and links
  prerequisites: jsonb('prerequisites'), // array of prerequisite tutorial IDs

  // Metadata
  isActive: boolean('is_active').default(true),
  sortOrder: integer('sort_order').default(0),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Tutorial analytics table
export const tutorialAnalytics = pgTable('tutorial_analytics', {
  id: serial('id').primaryKey(),
  tutorialId: varchar('tutorial_id').notNull(),
  profession: varchar('profession'),

  // Engagement metrics
  totalStarted: integer('total_started').default(0),
  totalCompleted: integer('total_completed').default(0),
  averageTimeSpent: integer('average_time_spent'), // in seconds
  completionRate: integer('completion_rate'), // percentage
  averageRating: integer('average_rating'), // 1-5 stars * 100 for precision

  // Step-by-step analytics
  stepDropoffData: jsonb('step_dropoff_data'), // which steps users drop off at
  commonIssues: jsonb('common_issues'), // array of reported issues

  lastUpdated: timestamp('last_updated').defaultNow(),
});

// Zod schemas for validation
export const insertTutorialProgressSchema = createInsertSchema(tutorialProgress);
export const insertTutorialSchema = createInsertSchema(tutorials);
export const insertTutorialAnalyticsSchema = createInsertSchema(tutorialAnalytics);

// TypeScript types
export type TutorialProgress = typeof tutorialProgress.$inferSelect;
export type InsertTutorialProgress = typeof tutorialProgress.$inferInsert;
export type Tutorial = typeof tutorials.$inferSelect;
export type InsertTutorial = typeof tutorials.$inferInsert;
export type TutorialAnalytics = typeof tutorialAnalytics.$inferSelect;
export type InsertTutorialAnalytics = typeof tutorialAnalytics.$inferInsert;

// Additional validation schemas
export const tutorialFeedbackSchema = z.object({
  rating: z.number().min(1).max(5),
  comments: z.string().optional(),
  helpful: z.boolean().optional(),
  suggestions: z.string().optional(),
});

export const tutorialStepSchema = z.object({
  id: z.number(),
  title: z.string(),
  description: z.string(),
  instructions: z.array(z.string()),
  tips: z.array(z.string()).optional(),
  warningMessages: z.array(z.string()).optional(),
  expectedOutcome: z.string().optional(),
  interactiveElements: z.array(z.any()).optional(),
});

export const tutorialContentSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  category: z.string(),
  difficulty: z.enum(['beginner', 'intermediate', 'advanced']),
  duration: z.string(),
  profession: z.array(z.enum(['photographer', 'videographer', 'music_producer', 'vendor'])),
  component: z.string(),
  scenario: z.string(),
  keyFeatures: z.array(z.string()),
  steps: z.array(tutorialStepSchema),
  prerequisites: z.array(z.string()).optional(),
  resources: z
    .array(
      z.object({
        title: z.string(),
        url: z.string(),
        type: z.enum(['documentation', 'video', 'article', 'tool']),
      }),
    )
    .optional(),
});
