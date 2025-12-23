import { pgTable, text, varchar, timestamp, boolean, jsonb } from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';

// CMS Pages table - stores all platform pages
export const cmsPages = pgTable('cms_pages', {
  id: varchar('id').primaryKey().notNull(),
  slug: varchar('slug').unique().notNull(), // URL path like '/about', '/services', '/photographer-dashboard'
  title: varchar('title').notNull(),
  description: text('description'),
  components: jsonb('components').notNull().default('[]'), // Component array for page builder
  metadata: jsonb('metadata').default('{}'), // SEO, custom fields, etc.
  status: varchar('status').notNull().default('draft'), // draft, scheduled, published, archived
  language: varchar('language').notNull().default('no'), // Language code
  scheduledAt: timestamp('scheduled_at'), // When to auto-publish
  publishedAt: timestamp('published_at'), // When actually published
  pageType: varchar('page_type').notNull(), // landing, dashboard, feature, admin, etc.
  accessLevel: varchar('access_level').notNull().default('public'), // public, authenticated, admin
  createdBy: varchar('created_by').notNull(), // Who created the page
  updatedBy: varchar('updated_by'), // Who last updated the page
  lastEditedBy: varchar('last_edited_by'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// CMS Templates table - reusable page templates
export const cmsTemplates = pgTable('cms_templates', {
  id: varchar('id').primaryKey().notNull(),
  name: varchar('name').notNull(),
  description: text('description'),
  category: varchar('category').notNull(), // system, custom, business, etc.
  components: jsonb('components').notNull().default('[]'),
  previewImage: varchar('preview_image'),
  isSystem: boolean('is_system').default(false), // true for built-in templates
  createdBy: varchar('created_by'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Page revision history
export const cmsPageRevisions = pgTable('cms_page_revisions', {
  id: varchar('id').primaryKey().notNull(),
  pageId: varchar('page_id').notNull(),
  components: jsonb('components').notNull(),
  editedBy: varchar('edited_by').notNull(),
  editNote: text('edit_note'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Type definitions
export type CmsPage = typeof cmsPages.$inferSelect;
export type InsertCmsPage = typeof cmsPages.$inferInsert;
export type CmsTemplate = typeof cmsTemplates.$inferSelect;
export type InsertCmsTemplate = typeof cmsTemplates.$inferInsert;
export type CmsPageRevision = typeof cmsPageRevisions.$inferSelect;
export type InsertCmsPageRevision = typeof cmsPageRevisions.$inferInsert;

// Zod schemas
export const insertCmsPageSchema = createInsertSchema(cmsPages);
export const insertCmsTemplateSchema = createInsertSchema(cmsTemplates);
export const insertCmsPageRevisionSchema = createInsertSchema(cmsPageRevisions);

// Component type (from page builder)
export interface Component {
  id: string;
  type: string;
  content: any;
  style?: any;
  animation?: string;
}

// Page metadata interface
export interface PageMetadata {
  title?: string;
  description?: string;
  keywords?: string[];
  openGraph?: {
    title?: string;
    description?: string;
    image?: string;
  };
  customCSS?: string;
  customJS?: string;
}
