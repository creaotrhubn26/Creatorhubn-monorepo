/**
 * Learning Academy Schema
 * Complete schema definitions for the learning management system
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
// LEARNING ACADEMY CORE
// ============================================================================

export const learningCourses = pgTable('learning_courses', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: varchar('title').notNull(),
  description: text('description'),
  profession: varchar('profession').notNull(),
  difficultyLevel: varchar('difficulty_level').notNull(),
  estimatedDuration: integer('estimated_duration').notNull(),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const learningModules = pgTable('learning_modules', {
  id: uuid('id').primaryKey().defaultRandom(),
  courseId: uuid('course_id').notNull(),
  title: varchar('title').notNull(),
  description: text('description'),
  moduleOrder: integer('module_order').notNull(),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const learningLessons = pgTable('learning_lessons', {
  id: uuid('id').primaryKey().defaultRandom(),
  moduleId: uuid('module_id').notNull(),
  title: varchar('title').notNull(),
  content: text('content').notNull(),
  lessonType: varchar('lesson_type').notNull(),
  lessonOrder: integer('lesson_order').notNull(),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const learningProgress = pgTable('learning_progress', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: varchar('user_id').notNull(),
  courseId: uuid('course_id').notNull(),
  moduleId: uuid('module_id'),
  lessonId: uuid('lesson_id'),
  progressPercentage: decimal('progress_percentage').notNull().default('0'),
  completedAt: timestamp('completed_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const learningCertificates = pgTable('learning_certificates', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: varchar('user_id').notNull(),
  courseId: uuid('course_id').notNull(),
  certificateUrl: varchar('certificate_url').notNull(),
  issuedAt: timestamp('issued_at').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// ============================================================================
// RELATIONS
// ============================================================================

export const learningCoursesRelations = relations(learningCourses, ({ many }) => ({
  modules: many(learningModules),
  progress: many(learningProgress),
  certificates: many(learningCertificates),
}));

export const learningModulesRelations = relations(learningModules, ({ one, many }) => ({
  course: one(learningCourses, {
    fields: [learningModules.courseId],
    references: [learningCourses.id],
  }),
  lessons: many(learningLessons),
  progress: many(learningProgress),
}));

export const learningLessonsRelations = relations(learningLessons, ({ one, many }) => ({
  module: one(learningModules, {
    fields: [learningLessons.moduleId],
    references: [learningModules.id],
  }),
  progress: many(learningProgress),
}));

export const learningProgressRelations = relations(learningProgress, ({ one }) => ({
  course: one(learningCourses, {
    fields: [learningProgress.courseId],
    references: [learningCourses.id],
  }),
  module: one(learningModules, {
    fields: [learningProgress.moduleId],
    references: [learningModules.id],
  }),
  lesson: one(learningLessons, {
    fields: [learningProgress.lessonId],
    references: [learningLessons.id],
  }),
}));

export const learningCertificatesRelations = relations(learningCertificates, ({ one }) => ({
  course: one(learningCourses, {
    fields: [learningCertificates.courseId],
    references: [learningCourses.id],
  }),
}));
