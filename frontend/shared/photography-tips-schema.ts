import { pgTable, varchar, text, integer, boolean, timestamp, jsonb } from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';

// Photography tips overlay table
export const photographyTips = pgTable('photography_tips', {
  id: varchar('id')
    .primaryKey()
    .$defaultFn(() => `tip_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`),
  category: varchar('category', { length: 100 }).notNull(), // portrait, landscape, wedding, macro, street, etc.
  scenario: varchar('scenario', { length: 255 }).notNull(), // specific situation
  title: varchar('title', { length: 255 }).notNull(),
  content: text('content').notNull(),

  // Camera settings recommendations
  recommendedSettings: jsonb('recommended_settings').$type<{
    aperture?: string[];
    shutterSpeed?: string[];
    iso?: number[];
    focusMode?: string[];
    meteringMode?: string[];
    whiteBalance?: string[];
  }>(),

  // Equipment recommendations
  recommendedEquipment: jsonb('recommended_equipment').$type<{
    lenses?: string[];
    accessories?: string[];
    lighting?: string[];
  }>(),

  // Contextual conditions
  conditions: jsonb('conditions').$type<{
    lightingConditions?: string[]; // bright, dim, golden hour, blue hour, indoor, outdoor
    subjects?: string[]; // people, nature, architecture, macro, etc.
    environment?: string[]; // studio, outdoor, event, home, etc.
    difficulty?: 'beginner' | 'intermediate' | 'advanced';
    timeOfDay?: string[];
    weather?: string[];
  }>(),

  // Visual examples
  exampleImages: jsonb('example_images').$type<{
    beforeImage?: string;
    afterImage?: string;
    settingsImage?: string;
    diagramUrl?: string;
  }>(),

  // Interactive elements
  interactive: jsonb('interactive').$type<{
    hasQuiz?: boolean;
    hasSimulator?: boolean;
    hasTryItNow?: boolean;
    estimatedReadTime?: number;
  }>(),

  // Metadata
  priority: integer('priority').default(1), // 1 = highest, 5 = lowest
  isActive: boolean('is_active').default(true),
  language: varchar('language', { length: 5 }).default('no').notNull(), // no, en

  // Timestamps
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),

  // Author/source
  authorId: varchar('author_id'),
  source: varchar('source', { length: 100 }).default('CreatorHub Norge'),
});

// User tip interactions
export const userTipInteractions = pgTable('user_tip_interactions', {
  id: varchar('id')
    .primaryKey()
    .$defaultFn(() => `interaction_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`),
  userId: varchar('user_id').notNull(),
  tipId: varchar('tip_id').notNull(),

  // Interaction types
  viewed: boolean('viewed').default(false),
  bookmarked: boolean('bookmarked').default(false),
  helpful: boolean('helpful'), // true = helpful, false = not helpful, null = not rated

  // Usage tracking
  viewCount: integer('view_count').default(0),
  lastViewedAt: timestamp('last_viewed_at'),

  // Context when tip was shown
  context: jsonb('context').$type<{
    currentCamera?: string;
    currentLens?: string;
    currentProject?: string;
    detectedScenario?: string;
    userLevel?: string;
  }>(),

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Contextual tip triggers
export const tipTriggers = pgTable('tip_triggers', {
  id: varchar('id')
    .primaryKey()
    .$defaultFn(() => `trigger_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`),
  tipId: varchar('tip_id').notNull(),

  // Trigger conditions
  triggerType: varchar('trigger_type', { length: 50 }).notNull(), // camera_detected, project_type, location, time_of_day, etc.
  triggerValue: varchar('trigger_value', { length: 255 }).notNull(),

  // Trigger logic
  condition: varchar('condition', { length: 50 }).default('equals'), // equals, contains, starts_with, range, etc.
  priority: integer('priority').default(1),
  isActive: boolean('is_active').default(true),

  createdAt: timestamp('created_at').defaultNow(),
});

// Insert schemas
export const insertPhotographyTipSchema = createInsertSchema(photographyTips);
export const insertUserTipInteractionSchema = createInsertSchema(userTipInteractions);
export const insertTipTriggerSchema = createInsertSchema(tipTriggers);

// Select types
export type PhotographyTip = typeof photographyTips.$inferSelect;
export type UserTipInteraction = typeof userTipInteractions.$inferSelect;
export type TipTrigger = typeof tipTriggers.$inferSelect;

// Insert types
export type InsertPhotographyTip = z.infer<typeof insertPhotographyTipSchema>;
export type InsertUserTipInteraction = z.infer<typeof insertUserTipInteractionSchema>;
export type InsertTipTrigger = z.infer<typeof insertTipTriggerSchema>;

// Context detection types
export interface TipContext {
  currentCamera?: string;
  currentLens?: string;
  currentProject?: string;
  projectType?: string;
  lightingCondition?: string;
  timeOfDay?: string;
  location?: 'indoor' | 'outdoor' | 'studio';
  userLevel?: 'beginner' | 'intermediate' | 'advanced';
  recentEquipment?: string[];
}

// Tip display preferences
export interface TipDisplaySettings {
  showOverlay: boolean;
  overlayPosition: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'center';
  autoHide: boolean;
  autoHideDelay: number; // seconds
  showOnlyRelevant: boolean;
  difficulty: 'all' | 'beginner' | 'intermediate' | 'advanced';
  categories: string[];
}
