/**
 * Content Management Schema
 * Complete schema definitions for content management system
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
// CONTENT MANAGEMENT CORE
// ============================================================================

export const contentArticles = pgTable('content_articles', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: varchar('title').notNull(),
  content: text('content').notNull(),
  excerpt: text('excerpt'),
  status: varchar('status').$type<'draft' | 'published' | 'archived'>().default('draft'),
  authorId: varchar('author_id').notNull(),
  publishedAt: timestamp('published_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const contentCategories = pgTable(
  'content_categories',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name').notNull(),
    slug: varchar('slug').notNull().unique(),
    description: text('description'),
    parentId: uuid('parent_id'),
    isActive: boolean('is_active').default(true),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    slugIdx: index('content_categories_slug_idx').on(table.slug),
  }),
);

export const contentTags = pgTable(
  'content_tags',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name').notNull().unique(),
    slug: varchar('slug').notNull().unique(),
    description: text('description'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    nameIdx: index('content_tags_name_idx').on(table.name),
    slugIdx: index('content_tags_slug_idx').on(table.slug),
  }),
);

export const contentMedia = pgTable('content_media', {
  id: uuid('id').primaryKey().defaultRandom(),
  filename: varchar('filename').notNull(),
  originalFilename: varchar('original_filename').notNull(),
  filePath: varchar('file_path').notNull(),
  fileSize: bigint('file_size', { mode: 'number' }).notNull(),
  mimeType: varchar('mime_type').notNull(),
  altText: text('alt_text'),
  caption: text('caption'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// ============================================================================
// RELATIONS
// ============================================================================

export const contentCategoriesRelations = relations(contentCategories, ({ one, many }) => ({
  parent: one(contentCategories, {
    fields: [contentCategories.parentId],
    references: [contentCategories.id],
  }),
  children: many(contentCategories),
}));

export const contentTagsRelations = relations(contentTags, ({ many }) => ({
  articles: many(contentArticles),
}));

export const contentMediaRelations = relations(contentMedia, ({ many }) => ({
  articles: many(contentArticles),
}));
