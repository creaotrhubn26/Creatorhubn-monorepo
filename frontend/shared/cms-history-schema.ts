/**
 * CreatorHub Norge - CMS History & Version Control Schema
 * Komplett historikk og rollback system for Visual CMS
 */

import { pgTable, text, varchar, timestamp, jsonb, integer, boolean } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';

// CMS Version History Table
export const cmsVersionHistory = pgTable('cms_version_history', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  pageId: varchar('page_id').notNull(),
  versionNumber: integer('version_number').notNull(),
  userId: varchar('user_id').notNull(),
  changeType: varchar('change_type')
    .$type<
      | 'create'
      | 'update'
      | 'delete'
      | 'publish'
      | 'unpublish'
      | 'component_add'
      | 'component_remove'
      | 'component_edit'
      | 'style_change'
      | 'layout_change'
      | 'content_edit'
      | 'seo_update'
      | 'metadata_change'
      | 'restore'
      | 'rollback'
    >()
    .notNull(),
  changeDescription: text('change_description').notNull(),

  // Snapshot data
  beforeSnapshot: jsonb('before_snapshot').$type<{
    components: any[];
    globalStyles: Record<string, any>;
    meta: Record<string, any>;
    layout: any[];
  }>(),

  afterSnapshot: jsonb('after_snapshot').$type<{
    components: any[];
    globalStyles: Record<string, any>;
    meta: Record<string, any>;
    layout: any[];
  }>(),

  // Detailed change tracking
  changedComponents: jsonb('changed_components')
    .$type<{
      added: string[];
      modified: string[];
      deleted: string[];
      moved: string[];
    }>()
    .default({
      added: [],
      modified: [],
      deleted: [],
      moved: [],
    }),

  // Metadata
  isAutosave: boolean('is_autosave').default(false),
  isMajorVersion: boolean('is_major_version').default(false),
  tags: jsonb('tags').$type<string[]>().default([]),

  // User context
  userAgent: text('user_agent'),
  ipAddress: varchar('ip_address'),
  sessionId: varchar('session_id'),

  createdAt: timestamp('created_at').defaultNow(),
});

// CMS Rollback Points Table
export const cmsRollbackPoints = pgTable('cms_rollback_points', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  pageId: varchar('page_id').notNull(),
  rollbackPointName: varchar('rollback_point_name').notNull(),
  rollbackPointType: varchar('rollback_point_type')
    .$type<
      | 'manual'
      | 'auto_before_publish'
      | 'auto_daily'
      | 'auto_weekly'
      | 'before_major_change'
      | 'milestone'
      | 'backup'
    >()
    .notNull(),

  // Complete page state
  completeSnapshot: jsonb('complete_snapshot')
    .$type<{
      id: string;
      name: string;
      route: string;
      profession: string;
      status: string;
      components: any[];
      globalStyles: Record<string, any>;
      meta: Record<string, any>;
      layout: any[];
      customCSS?: string;
      customJS?: string;
    }>()
    .notNull(),

  // Version information
  versionNumber: integer('version_number').notNull(),
  previousVersionId: varchar('previous_version_id'),
  nextVersionId: varchar('next_version_id'),

  // Metadata
  description: text('description'),
  isStable: boolean('is_stable').default(true),
  canRestore: boolean('can_restore').default(true),

  // Creator information
  createdBy: varchar('created_by').notNull(),
  createdAt: timestamp('created_at').defaultNow(),

  // Expiration (for auto-cleanup)
  expiresAt: timestamp('expires_at'),
});

// CMS Change Tracking Table
export const cmsChangeTracking = pgTable('cms_change_tracking', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  pageId: varchar('page_id').notNull(),
  sessionId: varchar('session_id').notNull(),
  userId: varchar('user_id').notNull(),

  // Real-time change tracking
  changeSequence: integer('change_sequence').notNull(),
  changeTimestamp: timestamp('change_timestamp').defaultNow(),

  // Change details
  componentId: varchar('component_id'),
  changeOperation: varchar('change_operation')
    .$type<
      | 'create'
      | 'update'
      | 'delete'
      | 'move'
      | 'resize'
      | 'style'
      | 'content'
      | 'property'
      | 'layout'
      | 'duplicate'
      | 'paste'
    >()
    .notNull(),

  // Change data
  propertyPath: varchar('property_path'), // e.g., 'props.text', 'style.backgroundColor'
  oldValue: jsonb('old_value'),
  newValue: jsonb('new_value'),

  // Context
  cursorPosition: jsonb('cursor_position').$type<{ x: number; y: number }>(),
  selectedElements: jsonb('selected_elements').$type<string[]>().default([]),

  // Undo/Redo support
  isUndoable: boolean('is_undoable').default(true),
  undoComplexity: integer('undo_complexity').default(1), // 1-10, higher = more complex to undo

  createdAt: timestamp('created_at').defaultNow(),
});

// CMS Collaboration Sessions Table
export const cmsCollaborationSessions = pgTable('cms_collaboration_sessions', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  pageId: varchar('page_id').notNull(),
  sessionName: varchar('session_name').notNull(),

  // Active collaborators
  activeUsers: jsonb('active_users')
    .$type<
      Array<{
        userId: string;
        userName: string;
        avatar?: string;
        cursor: { x: number; y: number };
        selectedComponents: string[];
        isEditing: boolean;
        joinedAt: string;
      }>
    >()
    .default([]),

  // Session state
  isActive: boolean('is_active').default(true),
  lockLevel: varchar('lock_level').$type<'none' | 'component' | 'page'>().default('component'),

  // Conflict resolution
  conflictResolution: varchar('conflict_resolution')
    .$type<'first_wins' | 'last_wins' | 'merge' | 'manual'>()
    .default('last_wins'),

  // Session metadata
  createdBy: varchar('created_by').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  lastActivity: timestamp('last_activity').defaultNow(),
  endedAt: timestamp('ended_at'),
});

// CMS Component Library Table
export const cmsComponentLibrary = pgTable('cms_component_library', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  componentName: varchar('component_name').notNull(),
  displayName: varchar('display_name').notNull(),
  category: varchar('category').notNull(), // 'layout', 'content', 'media', 'forms', 'widgets'
  profession: varchar('profession')
    .$type<'all' | 'photographer' | 'videographer' | 'music_producer' | 'vendor'>()
    .default('all'),

  // Component definition
  componentDefinition: jsonb('component_definition')
    .$type<{
      type: string;
      defaultProps: Record<string, any>;
      defaultStyles: Record<string, any>;
      settingsSchema: Record<string, any>;
      previewImage?: string;
      documentation?: string;
    }>()
    .notNull(),

  // Metadata
  version: varchar('version').notNull().default('1.0.0'),
  isBuiltIn: boolean('is_built_in').default(false),
  isCustom: boolean('is_custom').default(true),
  isEnabled: boolean('is_enabled').default(true),

  // Usage statistics
  usageCount: integer('usage_count').default(0),
  lastUsed: timestamp('last_used'),

  // Creator information
  createdBy: varchar('created_by').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Insert schemas
export const insertCmsVersionHistory = createInsertSchema(cmsVersionHistory);
export const insertCmsRollbackPoints = createInsertSchema(cmsRollbackPoints);
export const insertCmsChangeTracking = createInsertSchema(cmsChangeTracking);
export const insertCmsCollaborationSessions = createInsertSchema(cmsCollaborationSessions);
export const insertCmsComponentLibrary = createInsertSchema(cmsComponentLibrary);

// Type exports
export type CmsVersionHistory = typeof cmsVersionHistory.$inferSelect;
export type InsertCmsVersionHistory = z.infer<typeof insertCmsVersionHistory>;
export type CmsRollbackPoints = typeof cmsRollbackPoints.$inferSelect;
export type InsertCmsRollbackPoints = z.infer<typeof insertCmsRollbackPoints>;
export type CmsChangeTracking = typeof cmsChangeTracking.$inferSelect;
export type InsertCmsChangeTracking = z.infer<typeof insertCmsChangeTracking>;
export type CmsCollaborationSessions = typeof cmsCollaborationSessions.$inferSelect;
export type InsertCmsCollaborationSessions = z.infer<typeof insertCmsCollaborationSessions>;
export type CmsComponentLibrary = typeof cmsComponentLibrary.$inferSelect;
export type InsertCmsComponentLibrary = z.infer<typeof insertCmsComponentLibrary>;
