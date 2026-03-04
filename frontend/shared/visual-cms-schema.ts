import {
  pgTable,
  serial,
  text,
  json,
  timestamp,
  boolean,
  integer,
  varchar,
  uuid,
} from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import type { z } from 'zod';

// Page Templates - defines structure and allowed components
export const pageTemplates = pgTable('page_templates', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 255 }).notNull().unique(),
  description: text('description'),
  schema: json('schema').notNull(), // JSON schema defining allowed components
  thumbnail: text('thumbnail'), // Template preview image
  category: varchar('category', { length: 100 }).notNull().default('general'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Design Tokens - global styling variables
export const designTokens = pgTable('design_tokens', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  type: varchar('type', { length: 50 }).notNull(), // 'color', 'typography', 'spacing', 'breakpoint'
  value: json('value').notNull(), // Token value object
  category: varchar('category', { length: 100 }).notNull(),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Component Definitions - reusable building blocks
export const componentDefinitions = pgTable('component_definitions', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  type: varchar('type', { length: 100 }).notNull(), // 'text', 'image', 'video', 'grid', 'layout'
  category: varchar('category', { length: 100 }).notNull(),
  icon: varchar('icon', { length: 50 }), // Lucide icon name
  description: text('description'),
  propsSchema: json('props_schema').notNull(), // JSON schema for component props
  defaultProps: json('default_props').notNull(), // Default prop values
  styleSchema: json('style_schema').notNull(), // Allowed style overrides
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Pages - the main content entities
export const cmsPages = pgTable('cms_pages', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: varchar('title', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 255 }).notNull().unique(),
  templateId: integer('template_id').references(() => pageTemplates.id),
  components: json('components').notNull().default('[]'), // Array of component instances
  metadata: json('metadata').notNull().default('{}'), // SEO and other metadata
  status: varchar('status', { length: 20 }).notNull().default('draft'), // draft, review, published
  language: varchar('language', { length: 5 }).notNull().default('no'),
  publishedAt: timestamp('published_at'),
  createdBy: varchar('created_by', { length: 255 }).notNull(),
  updatedBy: varchar('updated_by', { length: 255 }),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Page Versions - for version control and rollback
export const pageVersions = pgTable('page_versions', {
  id: uuid('id').primaryKey().defaultRandom(),
  pageId: uuid('page_id')
    .references(() => cmsPages.id)
    .notNull(),
  version: integer('version').notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  components: json('components').notNull(),
  metadata: json('metadata').notNull(),
  changeDescription: text('change_description'),
  createdBy: varchar('created_by', { length: 255 }).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// Assets - file management for images, videos, etc.
export const cmsAssets = pgTable('cms_assets', {
  id: uuid('id').primaryKey().defaultRandom(),
  filename: varchar('filename', { length: 255 }).notNull(),
  originalName: varchar('original_name', { length: 255 }).notNull(),
  mimeType: varchar('mime_type', { length: 100 }).notNull(),
  size: integer('size').notNull(),
  url: text('url').notNull(),
  cdnUrl: text('cdn_url'),
  thumbnailUrl: text('thumbnail_url'),
  altText: text('alt_text'),
  tags: json('tags').default('[]'),
  uploadedBy: varchar('uploaded_by', { length: 255 }).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Draft system for page builder - separate from published CMS pages
export const pageDrafts = pgTable('page_drafts', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: varchar('user_id', { length: 255 }).notNull(),
  pageId: uuid('page_id').references(() => cmsPages.id), // null for new pages
  title: varchar('title', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 255 }),
  content: json('content').notNull(), // page components and metadata
  template: varchar('template', { length: 100 }),
  isDraft: boolean('is_draft').notNull().default(true),
  isAutoSaved: boolean('is_auto_saved').notNull().default(false),
  lastSavedAt: timestamp('last_saved_at').defaultNow(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Draft versions for history tracking
export const draftVersions = pgTable('draft_versions', {
  id: uuid('id').primaryKey().defaultRandom(),
  draftId: uuid('draft_id')
    .references(() => pageDrafts.id)
    .notNull(),
  versionNumber: integer('version_number').notNull(),
  content: json('content').notNull(),
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Workflow States - for approval process
export const workflowStates = pgTable('workflow_states', {
  id: uuid('id').primaryKey().defaultRandom(),
  pageId: uuid('page_id')
    .references(() => cmsPages.id)
    .notNull(),
  status: varchar('status', { length: 20 }).notNull(), // draft, review, approved, rejected
  assignedTo: varchar('assigned_to', { length: 255 }),
  comment: text('comment'),
  createdBy: varchar('created_by', { length: 255 }).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// Themes - for global styling
export const cmsThemes = pgTable('cms_themes', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 255 }).notNull().unique(),
  variables: json('variables').notNull(), // CSS custom properties
  isActive: boolean('is_active').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Zod schemas for validation
export const insertPageTemplateSchema = createInsertSchema(pageTemplates);
export const insertDesignTokenSchema = createInsertSchema(designTokens);
export const insertComponentDefinitionSchema = createInsertSchema(componentDefinitions);
export const insertCmsPageSchema = createInsertSchema(cmsPages);
export const insertPageVersionSchema = createInsertSchema(pageVersions);
export const insertCmsAssetSchema = createInsertSchema(cmsAssets);
export const insertWorkflowStateSchema = createInsertSchema(workflowStates);
export const insertCmsThemeSchema = createInsertSchema(cmsThemes);

// TypeScript types
export type PageTemplate = typeof pageTemplates.$inferSelect;
export type InsertPageTemplate = z.infer<typeof insertPageTemplateSchema>;
export type DesignToken = typeof designTokens.$inferSelect;
export type InsertDesignToken = z.infer<typeof insertDesignTokenSchema>;
export type ComponentDefinition = typeof componentDefinitions.$inferSelect;
export type InsertComponentDefinition = z.infer<typeof insertComponentDefinitionSchema>;
export type CmsPage = typeof cmsPages.$inferSelect;
export type InsertCmsPage = z.infer<typeof insertCmsPageSchema>;
export type PageVersion = typeof pageVersions.$inferSelect;
export type InsertPageVersion = z.infer<typeof insertPageVersionSchema>;
export type CmsAsset = typeof cmsAssets.$inferSelect;
export type InsertCmsAsset = z.infer<typeof insertCmsAssetSchema>;
export type WorkflowState = typeof workflowStates.$inferSelect;
export type InsertWorkflowState = z.infer<typeof insertWorkflowStateSchema>;
export type CmsTheme = typeof cmsThemes.$inferSelect;
export type InsertCmsTheme = z.infer<typeof insertCmsThemeSchema>;

// Component Instance Interface
export interface ComponentInstance {
  id: string;
  componentId: number;
  props: Record<string, any>;
  styleOverrides: Record<string, any>;
  order: number;
  children?: ComponentInstance[];
}

// Page Metadata Interface
export interface PageMetadata {
  title: string;
  description: string;
  keywords: string[];
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  canonicalUrl?: string;
  noIndex?: boolean;
}

// Draft Types
export type PageDraft = typeof pageDrafts.$inferSelect;
export type InsertPageDraft = typeof pageDrafts.$inferInsert;
export type DraftVersion = typeof draftVersions.$inferSelect;
export type InsertDraftVersion = typeof draftVersions.$inferInsert;

// Draft Schema Validators
export const insertPageDraftSchema = createInsertSchema(pageDrafts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastSavedAt: true,
});

export const insertDraftVersionSchema = createInsertSchema(draftVersions).omit({
  id: true,
  createdAt: true,
});
