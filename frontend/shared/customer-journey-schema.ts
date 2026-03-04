/**
 * Customer Journey Builder Schema
 * Profesjon-tilpasset journey management med AI-integrasjon
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
  serial,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { createInsertSchema } from 'drizzle-zod';
import type { z } from 'zod';

// ✅ Customer Journey Templates
export const customerJourneyTemplates = pgTable('customer_journey_templates', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: varchar('name').notNull(),
  description: text('description'),
  profession: varchar('profession').notNull(), // photographer, videographer, musicproducer, vendor
  packageType: varchar('package_type').notNull(), // creator_premium, creator_standard, creator_basic
  status: varchar('status').default('draft'), // draft, active, archived
  aiContextPrompt: text('ai_context_prompt'),
  brandColors: jsonb('brand_colors').$type<{
    primary?: string;
    secondary?: string;
    accent?: string;
  }>(),
  styleGuide: jsonb('style_guide').$type<{
    welcomeStyle?: string;
    animationStyle?: string;
    tone?: string;
  }>(),
  createdBy: varchar('created_by'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ✅ Journey Steps (modular components)
export const journeySteps = pgTable('journey_steps', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  templateId: varchar('template_id').references(() => customerJourneyTemplates.id, {
    onDelete: 'cascade',
  }),
  stepOrder: integer('step_order').notNull(),
  stepType: varchar('step_type').notNull(), // ai_welcome_video, interactive_demo, roi_calculator, success_story
  title: varchar('title').notNull(),
  content: text('content'),
  aiGeneratedContent: jsonb('ai_generated_content').$type<{
    generatedAt?: string;
    prompt?: string;
    content?: string;
    imageUrls?: string[];
    videoUrl?: string;
  }>(),
  componentConfig: jsonb('component_config').$type<{
    componentType?: string;
    props?: Record<string, any>;
    interactionData?: Record<string, any>;
  }>(),
  animationData: jsonb('animation_data').$type<{
    animationType?: string;
    duration?: number;
    effects?: string[];
  }>(),
  videoUrl: varchar('video_url'),
  interactiveConfig: jsonb('interactive_config').$type<{
    allowSkip?: boolean;
    requireCompletion?: boolean;
    trackEngagement?: boolean;
  }>(),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ✅ Interactive Components Library
export const interactiveComponents = pgTable('interactive_components', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  componentType: varchar('component_type').notNull(), // video_player, ai_animation, calculator, quiz, demo
  name: varchar('name').notNull(),
  description: text('description'),
  profession: varchar('profession'), // null = all professions
  configSchema: jsonb('config_schema').$type<{
    properties?: Record<string, any>;
    required?: string[];
  }>(),
  previewImage: varchar('preview_image'),
  openaiPromptTemplate: text('openai_prompt_template'),
  animationTemplate: jsonb('animation_template'),
  category: varchar('category'), // media, interactive, ai_content, calculator
  isSystemComponent: boolean('is_system_component').default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ✅ Journey Analytics (profesjon-spesifikk tracking)
export const journeyAnalytics = pgTable('journey_analytics', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  templateId: varchar('template_id').references(() => customerJourneyTemplates.id),
  stepId: varchar('step_id').references(() => journeySteps.id),
  userId: varchar('user_id'),
  profession: varchar('profession'),
  packageType: varchar('package_type'),
  stepName: varchar('step_name'),
  completionRate: decimal('completion_rate', { precision: 5, scale: 2 }),
  engagementTimeSeconds: integer('engagement_time_seconds'),
  conversionRate: decimal('conversion_rate', { precision: 5, scale: 2 }),
  feedbackScore: decimal('feedback_score', { precision: 3, scale: 1 }),
  sessionId: varchar('session_id'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ✅ AI Content Generation History
export const aiContentGenerations = pgTable('ai_content_generations', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  stepId: varchar('step_id').references(() => journeySteps.id),
  profession: varchar('profession'),
  packageType: varchar('package_type'),
  generationType: varchar('generation_type'), // text, image, animation, video
  prompt: text('prompt'),
  aiProvider: varchar('ai_provider'), // openai, gemini, anthropic
  generatedContent: jsonb('generated_content').$type<{
    content?: string;
    imageUrl?: string;
    metadata?: Record<string, any>;
  }>(),
  cost: decimal('cost', { precision: 8, scale: 4 }),
  processingTimeMs: integer('processing_time_ms'),
  quality: varchar('quality'), // excellent, good, fair, poor
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ✅ Profession-Specific Component Mappings
export const professionComponentMappings = pgTable('profession_component_mappings', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  profession: varchar('profession').notNull(),
  componentId: varchar('component_id').references(() => interactiveComponents.id),
  priority: integer('priority').default(1),
  customConfig: jsonb('custom_config').$type<{
    professionSpecificProps?: Record<string, any>;
    contextualPrompts?: string[];
  }>(),
  isEnabled: boolean('is_enabled').default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ✅ Relations
export const customerJourneyTemplatesRelations = relations(
  customerJourneyTemplates,
  ({ many }) => ({
    steps: many(journeySteps),
    analytics: many(journeyAnalytics),
  }),
);

export const journeyStepsRelations = relations(journeySteps, ({ one, many }) => ({
  template: one(customerJourneyTemplates, {
    fields: [journeySteps.templateId],
    references: [customerJourneyTemplates.id],
  }),
  analytics: many(journeyAnalytics),
  aiGenerations: many(aiContentGenerations),
}));

export const interactiveComponentsRelations = relations(interactiveComponents, ({ many }) => ({
  professionMappings: many(professionComponentMappings),
}));

export const professionComponentMappingsRelations = relations(
  professionComponentMappings,
  ({ one }) => ({
    component: one(interactiveComponents, {
      fields: [professionComponentMappings.componentId],
      references: [interactiveComponents.id],
    }),
  }),
);

// ✅ Zod Schemas
export const insertCustomerJourneyTemplateSchema = createInsertSchema(customerJourneyTemplates);
export const insertJourneyStepSchema = createInsertSchema(journeySteps);
export const insertInteractiveComponentSchema = createInsertSchema(interactiveComponents);
export const insertJourneyAnalyticsSchema = createInsertSchema(journeyAnalytics);

export type CustomerJourneyTemplate = typeof customerJourneyTemplates.$inferSelect;
export type InsertCustomerJourneyTemplate = z.infer<typeof insertCustomerJourneyTemplateSchema>;
export type JourneyStep = typeof journeySteps.$inferSelect;
export type InsertJourneyStep = z.infer<typeof insertJourneyStepSchema>;
export type InteractiveComponent = typeof interactiveComponents.$inferSelect;
export type InsertInteractiveComponent = z.infer<typeof insertInteractiveComponentSchema>;
export type JourneyAnalytics = typeof journeyAnalytics.$inferSelect;

// Fix SQL import
import { sql } from 'drizzle-orm';
