/**
 * CreatorHub Norge - Profession CMS Schema
 * Database schema for visual profession management
 */

import {
  pgTable,
  text,
  varchar,
  timestamp,
  jsonb,
  integer,
  serial,
  boolean,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { createInsertSchema } from 'drizzle-zod';
import type { z } from 'zod';

// Profession Configurations Table
export const professionConfigurations = pgTable('profession_configurations', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  key: varchar('key').notNull().unique(), // programmer key: photographer, videographer, etc.
  name: varchar('name').notNull(), // Norwegian display name
  nameEnglish: varchar('name_english'), // English display name
  description: text('description'),
  color: varchar('color').notNull().default('#2196F3'), // Brand color
  icon: varchar('icon').default('💼'), // Emoji or icon identifier
  status: varchar('status')
    .$type<'active' | 'inactive' | 'beta' | 'coming_soon'>()
    .notNull()
    .default('active'),
  tabs: jsonb('tabs')
    .$type<string[]>()
    .notNull()
    .default(['Oversikt', 'Prosjekter', 'Kunder', 'Utstyr', 'Filer', 'Innstillinger']),
  features: jsonb('features').$type<string[]>().default([]),
  integrations: jsonb('integrations').$type<string[]>().default([]),
  priority: integer('priority').notNull().default(1), // Display priority
  metadata: jsonb('metadata')
    .$type<{
      marketSize?: string;
      averageRevenue?: string;
      complexity?: 'low' | 'medium' | 'high';
      developmentTime?: string;
      targetAudience?: string;
      competitorAnalysis?: string;
      launchDate?: string;
      betaUsers?: number;
    }>()
    .default({}),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Profession Feature Templates
export const professionFeatureTemplates = pgTable('profession_feature_templates', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  professionKey: varchar('profession_key').notNull(),
  featureName: varchar('feature_name').notNull(),
  displayName: varchar('display_name').notNull(),
  description: text('description'),
  category: varchar('category').notNull(), // 'workflow', 'integration', 'tool', 'analytics'
  isEnabled: boolean('is_enabled').notNull().default(true),
  configuration: jsonb('configuration')
    .$type<{
      componentPath?: string;
      apiEndpoints?: string[];
      dependencies?: string[];
      settings?: Record<string, any>;
      permissions?: string[];
    }>()
    .default({}),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Profession Usage Analytics
export const professionUsageAnalytics = pgTable('profession_usage_analytics', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  professionKey: varchar('profession_key').notNull(),
  userId: varchar('user_id'),
  eventType: varchar('event_type').notNull(), // 'dashboard_view', 'feature_usage', 'tab_switch'
  eventData: jsonb('event_data')
    .$type<{
      tabName?: string;
      featureName?: string;
      sessionId?: string;
      duration?: number;
      metadata?: Record<string, any>;
    }>()
    .default({}),
  timestamp: timestamp('timestamp').defaultNow(),
  createdAt: timestamp('created_at').defaultNow(),
});

// Profession Dashboard Layout Configurations
export const professionDashboardLayouts = pgTable('profession_dashboard_layouts', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  professionKey: varchar('profession_key').notNull(),
  layoutName: varchar('layout_name').notNull(), // 'default', 'compact', 'advanced'
  isDefault: boolean('is_default').notNull().default(false),
  configuration: jsonb('configuration')
    .$type<{
      gridLayout?: Array<{
        i: string;
        x: number;
        y: number;
        w: number;
        h: number;
      }>;
      widgets?: Array<{
        id: string;
        type: string;
        title: string;
        settings: Record<string, any>;
      }>;
      theme?: {
        primaryColor: string;
        accentColor: string;
        layout: 'grid' | 'list' | 'cards';
      };
    }>()
    .default({}),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Insert schemas for type safety
export const insertProfessionConfiguration = createInsertSchema(professionConfigurations);
export const insertProfessionFeatureTemplate = createInsertSchema(professionFeatureTemplates);
export const insertProfessionUsageAnalytics = createInsertSchema(professionUsageAnalytics);
export const insertProfessionDashboardLayout = createInsertSchema(professionDashboardLayouts);

// Type exports
export type ProfessionConfiguration = typeof professionConfigurations.$inferSelect;
export type InsertProfessionConfiguration = z.infer<typeof insertProfessionConfiguration>;
export type ProfessionFeatureTemplate = typeof professionFeatureTemplates.$inferSelect;
export type InsertProfessionFeatureTemplate = z.infer<typeof insertProfessionFeatureTemplate>;
export type ProfessionUsageAnalytics = typeof professionUsageAnalytics.$inferSelect;
export type InsertProfessionUsageAnalytics = z.infer<typeof insertProfessionUsageAnalytics>;
export type ProfessionDashboardLayout = typeof professionDashboardLayouts.$inferSelect;
export type InsertProfessionDashboardLayout = z.infer<typeof insertProfessionDashboardLayout>;
