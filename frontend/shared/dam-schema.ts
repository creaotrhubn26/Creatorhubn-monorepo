/**
 * Digital Asset Management (DAM) Schema
 * Professional DAM system inspired by enterprise solutions like Adobe Experience Manager,
 * Bynder, and Brandfolder with comprehensive admin structure
 */

import {
  type AnyPgColumn,
  pgTable,
  varchar,
  text,
  bigint,
  boolean,
  timestamp,
  jsonb,
  uuid,
  integer,
  decimal,
} from 'drizzle-orm/pg-core';

// ============================================================================
// CORE DAM TABLES
// ============================================================================

// Asset Collections (Folders/Projects)
export const assetCollections = pgTable('asset_collections', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  parentId: uuid('parent_id').references((): AnyPgColumn => assetCollections.id),
  path: varchar('path', { length: 1000 }).notNull(), // Full path like /Brand/2024/Campaigns/Summer
  level: integer('level').default(0), // Hierarchy level
  isSystem: boolean('is_system').default(false), // System collections (Brand, Templates, etc.)
  isActive: boolean('is_active').default(true),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  createdBy: varchar('created_by', { length: 255 }).notNull(),
});

// Asset Categories (Taxonomy)
export const assetCategories = pgTable('asset_categories', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 255 }).notNull().unique(),
  description: text('description'),
  parentId: uuid('parent_id').references((): AnyPgColumn => assetCategories.id),
  color: varchar('color', { length: 7 }), // Hex color for UI
  icon: varchar('icon', { length: 100 }), // Icon identifier
  isActive: boolean('is_active').default(true),
  sortOrder: integer('sort_order').default(0),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Asset Tags
export const assetTags = pgTable('asset_tags', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 100 }).notNull().unique(),
  slug: varchar('slug', { length: 100 }).notNull().unique(),
  color: varchar('color', { length: 7 }),
  description: text('description'),
  usageCount: integer('usage_count').default(0),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Main Assets Table
export const damAssets = pgTable('dam_assets', {
  id: uuid('id').primaryKey().defaultRandom(),

  // Basic Info
  name: varchar('name', { length: 255 }).notNull(),
  originalName: varchar('original_name', { length: 255 }).notNull(),
  description: text('description'),
  altText: text('alt_text'),

  // File Information
  fileName: varchar('file_name', { length: 255 }).notNull(),
  filePath: varchar('file_path', { length: 1000 }).notNull(),
  fileSize: bigint('file_size', { mode: 'number' }).notNull(),
  mimeType: varchar('mime_type', { length: 100 }).notNull(),
  fileExtension: varchar('file_extension', { length: 10 }).notNull(),
  fileHash: varchar('file_hash', { length: 64 }).notNull(), // SHA-256

  // Organization
  collectionId: uuid('collection_id').references(() => assetCollections.id),
  categoryId: uuid('category_id').references(() => assetCategories.id),

  // Media Properties
  width: integer('width'),
  height: integer('height'),
  duration: decimal('duration', { precision: 10, scale: 3 }), // For videos/audio
  frameRate: decimal('frame_rate', { precision: 5, scale: 2 }), // For videos
  bitrate: integer('bitrate'), // For audio/video
  channels: integer('channels'), // For audio
  sampleRate: integer('sample_rate'), // For audio

  // Status & Workflow
  status: varchar('status', { length: 50 })
    .$type<'uploading' | 'processing' | 'ready' | 'archived' | 'deleted' | 'error'>()
    .default('uploading'),
  processingStatus: varchar('processing_status', { length: 50 })
    .$type<'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped'>()
    .default('pending'),

  // Access Control
  isPublic: boolean('is_public').default(false),
  isDownloadable: boolean('is_downloadable').default(true),
  isEditable: boolean('is_editable').default(true),
  accessLevel: varchar('access_level', { length: 50 })
    .$type<'public' | 'internal' | 'restricted' | 'confidential'>()
    .default('internal'),

  // Usage & Analytics
  downloadCount: integer('download_count').default(0),
  viewCount: integer('view_count').default(0),
  lastAccessed: timestamp('last_accessed'),

  // Versioning
  version: integer('version').default(1),
  parentAssetId: uuid('parent_asset_id').references((): AnyPgColumn => damAssets.id), // For versions
  isLatestVersion: boolean('is_latest_version').default(true),

  // Metadata
  exifData: jsonb('exif_data'), // EXIF data for images
  iptcData: jsonb('iptc_data'), // IPTC data for images
  customMetadata: jsonb('custom_metadata'),
  aiMetadata: jsonb('ai_metadata'), // AI-generated metadata

  // Storage
  storageProvider: varchar('storage_provider', { length: 50 })
    .$type<'local' | 's3' | 'gcs' | 'azure' | 'google_drive'>()
    .default('local'),
  storagePath: varchar('storage_path', { length: 1000 }),
  cdnUrl: varchar('cdn_url', { length: 1000 }),

  // Timestamps
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  uploadedAt: timestamp('uploaded_at').defaultNow(),
  processedAt: timestamp('processed_at'),
  archivedAt: timestamp('archived_at'),

  // User tracking
  createdBy: varchar('created_by', { length: 255 }).notNull(),
  updatedBy: varchar('updated_by', { length: 255 }),
  uploadedBy: varchar('uploaded_by', { length: 255 }).notNull(),
});

// Asset Tags Junction Table
export const assetTagJunction = pgTable('asset_tag_junction', {
  id: uuid('id').primaryKey().defaultRandom(),
  assetId: uuid('asset_id')
    .references(() => damAssets.id)
    .notNull(),
  tagId: uuid('tag_id')
    .references(() => assetTags.id)
    .notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  createdBy: varchar('created_by', { length: 255 }).notNull(),
});

// Asset Versions
export const assetVersions = pgTable('asset_versions', {
  id: uuid('id').primaryKey().defaultRandom(),
  assetId: uuid('asset_id')
    .references(() => damAssets.id)
    .notNull(),
  version: integer('version').notNull(),
  fileName: varchar('file_name', { length: 255 }).notNull(),
  filePath: varchar('file_path', { length: 1000 }).notNull(),
  fileSize: bigint('file_size', { mode: 'number' }).notNull(),
  mimeType: varchar('mime_type', { length: 100 }).notNull(),
  fileHash: varchar('file_hash', { length: 64 }).notNull(),
  changeDescription: text('change_description'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  createdBy: varchar('created_by', { length: 255 }).notNull(),
});

// Asset Transformations (Different sizes/formats)
export const assetTransformations = pgTable('asset_transformations', {
  id: uuid('id').primaryKey().defaultRandom(),
  assetId: uuid('asset_id')
    .references(() => damAssets.id)
    .notNull(),
  transformationType: varchar('transformation_type', { length: 50 })
    .$type<'thumbnail' | 'preview' | 'web' | 'print' | 'mobile' | 'social' | 'original'>()
    .notNull(),
  width: integer('width'),
  height: integer('height'),
  quality: integer('quality'), // 1-100
  format: varchar('format', { length: 10 }).notNull(), // jpg, png, webp, etc.
  filePath: varchar('file_path', { length: 1000 }).notNull(),
  fileSize: bigint('file_size', { mode: 'number' }).notNull(),
  cdnUrl: varchar('cdn_url', { length: 1000 }),
  isGenerated: boolean('is_generated').default(false),
  createdAt: timestamp('created_at').defaultNow(),
  generatedAt: timestamp('generated_at').defaultNow(),
});

// Asset Usage Tracking
export const assetUsage = pgTable('asset_usage', {
  id: uuid('id').primaryKey().defaultRandom(),
  assetId: uuid('asset_id')
    .references(() => damAssets.id)
    .notNull(),
  userId: varchar('user_id', { length: 255 }).notNull(),
  action: varchar('action', { length: 50 })
    .$type<'view' | 'download' | 'edit' | 'share' | 'delete' | 'restore'>()
    .notNull(),
  context: varchar('context', { length: 100 }), // 'editor', 'gallery', 'api', etc.
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: text('user_agent'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Asset Comments & Annotations
export const assetComments = pgTable('asset_comments', {
  id: uuid('id').primaryKey().defaultRandom(),
  assetId: uuid('asset_id')
    .references(() => damAssets.id)
    .notNull(),
  userId: varchar('user_id', { length: 255 }).notNull(),
  comment: text('comment').notNull(),
  x: decimal('x', { precision: 10, scale: 2 }), // For image annotations
  y: decimal('y', { precision: 10, scale: 2 }),
  width: decimal('width', { precision: 10, scale: 2 }),
  height: decimal('height', { precision: 10, scale: 2 }),
  isResolved: boolean('is_resolved').default(false),
  parentCommentId: uuid('parent_comment_id').references((): AnyPgColumn => assetComments.id),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Asset Sharing & Permissions
export const assetSharing = pgTable('asset_sharing', {
  id: uuid('id').primaryKey().defaultRandom(),
  assetId: uuid('asset_id')
    .references(() => damAssets.id)
    .notNull(),
  sharedWith: varchar('shared_with', { length: 255 }).notNull(), // User ID or email
  permission: varchar('permission', { length: 50 })
    .$type<'view' | 'download' | 'edit' | 'admin'>()
    .notNull(),
  expiresAt: timestamp('expires_at'),
  isActive: boolean('is_active').default(true),
  shareToken: varchar('share_token', { length: 255 }).unique(),
  password: varchar('password', { length: 255 }),
  downloadLimit: integer('download_limit'),
  downloadCount: integer('download_count').default(0),
  createdAt: timestamp('created_at').defaultNow(),
  createdBy: varchar('created_by', { length: 255 }).notNull(),
});

// Asset Workflows (Approval, Review, etc.)
export const assetWorkflows = pgTable('asset_workflows', {
  id: uuid('id').primaryKey().defaultRandom(),
  assetId: uuid('asset_id')
    .references(() => damAssets.id)
    .notNull(),
  workflowType: varchar('workflow_type', { length: 50 })
    .$type<'approval' | 'review' | 'publishing' | 'archival'>()
    .notNull(),
  status: varchar('status', { length: 50 })
    .$type<'pending' | 'in_progress' | 'approved' | 'rejected' | 'completed'>()
    .default('pending'),
  assignedTo: varchar('assigned_to', { length: 255 }),
  dueDate: timestamp('due_date'),
  priority: varchar('priority', { length: 20 })
    .$type<'low' | 'normal' | 'high' | 'urgent'>()
    .default('normal'),
  notes: text('notes'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  createdBy: varchar('created_by', { length: 255 }).notNull(),
});

// Asset Collections (Smart Collections based on criteria)
export const smartCollections = pgTable('smart_collections', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  criteria: jsonb('criteria').notNull(), // Search criteria as JSON
  isActive: boolean('is_active').default(true),
  autoUpdate: boolean('auto_update').default(true),
  assetCount: integer('asset_count').default(0),
  lastUpdated: timestamp('last_updated').defaultNow(),
  createdAt: timestamp('created_at').defaultNow(),
  createdBy: varchar('created_by', { length: 255 }).notNull(),
});

// Asset Analytics & Reports
export const assetAnalytics = pgTable('asset_analytics', {
  id: uuid('id').primaryKey().defaultRandom(),
  assetId: uuid('asset_id')
    .references(() => damAssets.id)
    .notNull(),
  date: timestamp('date').notNull(),
  views: integer('views').default(0),
  downloads: integer('downloads').default(0),
  shares: integer('shares').default(0),
  uniqueViews: integer('unique_views').default(0),
  uniqueDownloads: integer('unique_downloads').default(0),
  avgViewDuration: decimal('avg_view_duration', { precision: 10, scale: 2 }),
  createdAt: timestamp('created_at').defaultNow(),
});

// ============================================================================
// ADMIN STRUCTURE INSPIRED BY ENTERPRISE DAM SYSTEMS
// ============================================================================

/*
PROFESSIONAL DAM FOLDER STRUCTURE:

/Brand Assets/
├── /Logos/
│   ├── /Primary Logos/
│   ├── /Secondary Logos/
│   ├── /Icon Variations/
│   └── /Monochrome/
├── /Typography/
│   ├── /Primary Fonts/
│   └── /Secondary Fonts/
├── /Color Palettes/
├── /Brand Guidelines/
└── /Templates/

/Content Library/
├── /Photography/
│   ├── /Portraits/
│   ├── /Lifestyle/
│   ├── /Product Shots/
│   └── /Stock Photography/
├── /Videos/
│   ├── /Brand Videos/
│   ├── /Tutorials/
│   ├── /Testimonials/
│   └── /B-Roll/
├── /Graphics/
│   ├── /Illustrations/
│   ├── /Icons/
│   ├── /Infographics/
│   └── /Social Media Graphics/
└── /Documents/
    ├── /Presentations/
    ├── /Brochures/
    ├── /Case Studies/
    └── /White Papers/

/Projects/
├── /2024/
│   ├── /Q1/
│   ├── /Q2/
│   ├── /Q3/
│   └── /Q4/
├── /Campaigns/
│   ├── /Summer 2024/
│   ├── /Holiday 2024/
│   └── /Product Launch/
└── /Client Work/
    ├── /Client A/
    ├── /Client B/
    └── /Client C/

/Resources/
├── /Templates/
│   ├── /Email Templates/
│   ├── /Social Media Templates/
│   ├── /Presentation Templates/
│   └── /Document Templates/
├── /Stock Assets/
│   ├── /Shutterstock/
│   ├── /Unsplash/
│   └── /Custom Stock/
└── /Archives/
    ├── /2023/
    ├── /2022/
    └── /Legacy/

/System/
├── /Uploads/
├── /Processing/
├── /Backups/
└── /Temp/
*/
