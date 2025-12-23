/**
 * CMS Advanced Features Schema
 * Complete schema definitions for themes, version history, and collaboration
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
// CMS CORE FEATURES
// ============================================================================

export const cmsAssets = pgTable('cms_assets', {
  id: uuid('id').primaryKey().defaultRandom(),
  assetName: varchar('asset_name').notNull(),
  assetType: varchar('asset_type').notNull(),
  filePath: varchar('file_path').notNull(),
  fileSize: bigint('file_size', { mode: 'number' }).notNull(),
  mimeType: varchar('mime_type').notNull(),
  altText: text('alt_text'),
  caption: text('caption'),
  tags: jsonb('tags').notNull().default('[]'),
  metadata: jsonb('metadata').notNull().default('{}'),
  isPublic: boolean('is_public').default(false),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const cmsThemes = pgTable('cms_themes', {
  id: uuid('id').primaryKey().defaultRandom(),
  themeName: varchar('theme_name').notNull(),
  themeDescription: text('theme_description'),
  themeVersion: varchar('theme_version').notNull(),
  themeConfig: jsonb('theme_config').notNull(),
  cssVariables: jsonb('css_variables').notNull().default('{}'),
  isActive: boolean('is_active').default(false),
  isPublic: boolean('is_public').default(false),
  downloadCount: integer('download_count').default(0),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const cmsComponentLibrary = pgTable('cms_component_library', {
  id: uuid('id').primaryKey().defaultRandom(),
  componentName: varchar('component_name').notNull(),
  componentType: varchar('component_type').notNull(),
  componentCode: text('component_code').notNull(),
  props: jsonb('props').notNull().default('[]'),
  styles: jsonb('styles').notNull().default('{}'),
  category: varchar('category').notNull(),
  isReusable: boolean('is_reusable').default(true),
  usageCount: integer('usage_count').default(0),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// ============================================================================
// VERSION CONTROL & HISTORY
// ============================================================================

export const cmsVersionHistory = pgTable('cms_version_history', {
  id: uuid('id').primaryKey().defaultRandom(),
  contentId: uuid('content_id').notNull(),
  versionNumber: varchar('version_number').notNull(),
  contentSnapshot: jsonb('content_snapshot').notNull(),
  changeDescription: text('change_description'),
  changedBy: varchar('changed_by').notNull(),
  changeType: varchar('change_type').$type<'create' | 'update' | 'delete' | 'restore'>().notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const cmsChangeTracking = pgTable('cms_change_tracking', {
  id: uuid('id').primaryKey().defaultRandom(),
  contentId: uuid('content_id').notNull(),
  fieldName: varchar('field_name').notNull(),
  oldValue: text('old_value'),
  newValue: text('new_value'),
  changeType: varchar('change_type').$type<'add' | 'modify' | 'remove'>().notNull(),
  changedBy: varchar('changed_by').notNull(),
  changedAt: timestamp('changed_at').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const cmsRollbackPoints = pgTable('cms_rollback_points', {
  id: uuid('id').primaryKey().defaultRandom(),
  contentId: uuid('content_id').notNull(),
  pointName: varchar('point_name').notNull(),
  pointDescription: text('point_description'),
  contentSnapshot: jsonb('content_snapshot').notNull(),
  createdBy: varchar('created_by').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// ============================================================================
// COLLABORATION & WORKFLOW
// ============================================================================

export const cmsCollaborationSessions = pgTable('cms_collaboration_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionName: varchar('session_name').notNull(),
  contentId: uuid('content_id').notNull(),
  participants: jsonb('participants').notNull(),
  sessionStatus: varchar('session_status').$type<'active' | 'paused' | 'ended'>().default('active'),
  startedBy: varchar('started_by').notNull(),
  startedAt: timestamp('started_at').notNull(),
  endedAt: timestamp('ended_at'),
  sessionData: jsonb('session_data').notNull().default('{}'),
  createdAt: timestamp('created_at').defaultNow(),
});

// ============================================================================
// PAGE MANAGEMENT
// ============================================================================

export const pageDrafts = pgTable('page_drafts', {
  id: uuid('id').primaryKey().defaultRandom(),
  pageId: uuid('page_id').notNull(),
  draftName: varchar('draft_name').notNull(),
  draftContent: jsonb('draft_content').notNull(),
  draftStatus: varchar('draft_status')
    .$type<'draft' | 'review' | 'approved' | 'rejected'>()
    .default('draft'),
  createdBy: varchar('created_by').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const pageTemplates = pgTable('page_templates', {
  id: uuid('id').primaryKey().defaultRandom(),
  templateName: varchar('template_name').notNull(),
  templateType: varchar('template_type').notNull(),
  templateContent: jsonb('template_content').notNull(),
  templateConfig: jsonb('template_config').notNull().default('{}'),
  isPublic: boolean('is_public').default(false),
  usageCount: integer('usage_count').default(0),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const pageVersions = pgTable('page_versions', {
  id: uuid('id').primaryKey().defaultRandom(),
  pageId: uuid('page_id').notNull(),
  versionNumber: varchar('version_number').notNull(),
  versionContent: jsonb('version_content').notNull(),
  versionNotes: text('version_notes'),
  isPublished: boolean('is_published').default(false),
  publishedAt: timestamp('published_at'),
  createdBy: varchar('created_by').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const draftVersions = pgTable('draft_versions', {
  id: uuid('id').primaryKey().defaultRandom(),
  draftId: uuid('draft_id').notNull(),
  versionNumber: varchar('version_number').notNull(),
  versionContent: jsonb('version_content').notNull(),
  changeSummary: text('change_summary'),
  createdBy: varchar('created_by').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// ============================================================================
// DESIGN SYSTEM
// ============================================================================

export const designTokens = pgTable('design_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  tokenName: varchar('token_name').notNull(),
  tokenType: varchar('token_type').notNull(),
  tokenValue: varchar('token_value').notNull(),
  category: varchar('category').notNull(),
  description: text('description'),
  isDeprecated: boolean('is_deprecated').default(false),
  replacedBy: varchar('replaced_by'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// ============================================================================
// WORKFLOW STATES
// ============================================================================

export const workflowStates = pgTable('workflow_states', {
  id: uuid('id').primaryKey().defaultRandom(),
  workflowName: varchar('workflow_name').notNull(),
  stateName: varchar('state_name').notNull(),
  stateOrder: integer('state_order').notNull(),
  stateConfig: jsonb('state_config').notNull(),
  isInitial: boolean('is_initial').default(false),
  isFinal: boolean('is_final').default(false),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// ============================================================================
// RELATIONS
// ============================================================================

export const cmsVersionHistoryRelations = relations(cmsVersionHistory, ({ many }) => ({
  changes: many(cmsChangeTracking),
}));

export const cmsChangeTrackingRelations = relations(cmsChangeTracking, ({ one }) => ({
  version: one(cmsVersionHistory, {
    fields: [cmsChangeTracking.contentId],
    references: [cmsVersionHistory.contentId],
  }),
}));

export const pageDraftsRelations = relations(pageDrafts, ({ many }) => ({
  versions: many(draftVersions),
}));

export const draftVersionsRelations = relations(draftVersions, ({ one }) => ({
  draft: one(pageDrafts, {
    fields: [draftVersions.draftId],
    references: [pageDrafts.id],
  }),
}));

export const pageVersionsRelations = relations(pageVersions, ({ one }) => ({
  page: one(pageTemplates, {
    fields: [pageVersions.pageId],
    references: [pageTemplates.id],
  }),
}));
