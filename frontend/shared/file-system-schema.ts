import {
  pgTable,
  text,
  varchar,
  integer,
  timestamp,
  boolean,
  jsonb,
  uuid,
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';

// File System Core Tables
export const fileSystems = pgTable('file_systems', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  type: varchar('type', { length: 50 }).notNull(), // 'local', 'aws_s3', 'google_cloud', 'azure', 'dropbox', 'onedrive'
  isActive: boolean('is_active').default(true),
  isDefault: boolean('is_default').default(false),
  configuration: jsonb('configuration').notNull(), // Storage-specific config
  credentials: jsonb('credentials'), // Encrypted storage credentials
  quotaLimit: integer('quota_limit'), // In bytes
  quotaUsed: integer('quota_used').default(0),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const fileCategories = pgTable('file_categories', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  description: text('description'),
  color: varchar('color', { length: 7 }).default('#3B82F6'),
  icon: varchar('icon', { length: 50 }).default('folder'),
  parentId: uuid('parent_id'),
  allowedMimeTypes: jsonb('allowed_mime_types'), // Array of allowed MIME types
  maxFileSize: integer('max_file_size'), // In bytes
  compressionEnabled: boolean('compression_enabled').default(false),
  versioningEnabled: boolean('versioning_enabled').default(true),
  createdAt: timestamp('created_at').defaultNow(),
});

export const fileEntries = pgTable(
  'file_entries',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    fileName: varchar('file_name', { length: 255 }).notNull(),
    originalName: varchar('original_name', { length: 255 }).notNull(),
    filePath: text('file_path').notNull(),
    fileSize: integer('file_size').notNull(),
    mimeType: varchar('mime_type', { length: 100 }).notNull(),
    fileHash: varchar('file_hash', { length: 64 }), // SHA-256 hash for deduplication
    categoryId: uuid('category_id'),
    fileSystemId: uuid('file_system_id').notNull(),
    ownerId: varchar('owner_id').notNull(),
    isPublic: boolean('is_public').default(false),
    isDeleted: boolean('is_deleted').default(false),
    deletedAt: timestamp('deleted_at'),
    metadata: jsonb('metadata'), // File-specific metadata
    tags: jsonb('tags'), // Array of tags
    description: text('description'),
    alternativeText: text('alternative_text'), // For accessibility
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => [
    index('idx_file_entries_owner').on(table.ownerId),
    index('idx_file_entries_category').on(table.categoryId),
    index('idx_file_entries_hash').on(table.fileHash),
    index('idx_file_entries_system').on(table.fileSystemId),
  ],
);

export const fileVersions = pgTable(
  'file_versions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    fileId: uuid('file_id').notNull(),
    versionNumber: integer('version_number').notNull(),
    fileName: varchar('file_name', { length: 255 }).notNull(),
    filePath: text('file_path').notNull(),
    fileSize: integer('file_size').notNull(),
    fileHash: varchar('file_hash', { length: 64 }).notNull(),
    changeDescription: text('change_description'),
    createdBy: varchar('created_by').notNull(),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => [index('idx_file_versions_file').on(table.fileId)],
);

export const fileShares = pgTable(
  'file_shares',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    fileId: uuid('file_id').notNull(),
    sharedBy: varchar('shared_by').notNull(),
    sharedWith: varchar('shared_with'), // User ID or null for public
    shareType: varchar('share_type', { length: 20 }).notNull(), // 'view', 'download', 'edit', 'comment'
    accessLevel: varchar('access_level', { length: 20 }).notNull(), // 'read', 'write', 'admin'
    expiresAt: timestamp('expires_at'),
    shareToken: varchar('share_token', { length: 64 }).unique(),
    downloadCount: integer('download_count').default(0),
    maxDownloads: integer('max_downloads'),
    isActive: boolean('is_active').default(true),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => [
    index('idx_file_shares_file').on(table.fileId),
    index('idx_file_shares_token').on(table.shareToken),
  ],
);

export const fileFolders = pgTable(
  'file_folders',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    parentId: uuid('parent_id'),
    ownerId: varchar('owner_id').notNull(),
    path: text('path').notNull(),
    color: varchar('color', { length: 7 }).default('#F59E0B'),
    icon: varchar('icon', { length: 50 }).default('folder'),
    isShared: boolean('is_shared').default(false),
    isSystem: boolean('is_system').default(false),
    permissions: jsonb('permissions'), // Folder-specific permissions
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => [
    index('idx_file_folders_owner').on(table.ownerId),
    index('idx_file_folders_parent').on(table.parentId),
  ],
);

export const fileActivities = pgTable(
  'file_activities',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    fileId: uuid('file_id'),
    folderId: uuid('folder_id'),
    userId: varchar('user_id').notNull(),
    action: varchar('action', { length: 50 }).notNull(), // 'upload', 'download', 'view', 'edit', 'delete', 'share', 'move'
    details: jsonb('details'), // Additional action details
    ipAddress: varchar('ip_address', { length: 45 }),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => [
    index('idx_file_activities_file').on(table.fileId),
    index('idx_file_activities_user').on(table.userId),
    index('idx_file_activities_action').on(table.action),
  ],
);

// Relations
export const fileSystemsRelations = relations(fileSystems, ({ many }) => ({
  files: many(fileEntries),
}));

export const fileCategoriesRelations = relations(fileCategories, ({ one, many }) => ({
  parent: one(fileCategories, {
    fields: [fileCategories.parentId],
    references: [fileCategories.id],
  }),
  children: many(fileCategories),
  files: many(fileEntries),
}));

export const fileEntriesRelations = relations(fileEntries, ({ one, many }) => ({
  category: one(fileCategories, {
    fields: [fileEntries.categoryId],
    references: [fileCategories.id],
  }),
  fileSystem: one(fileSystems, {
    fields: [fileEntries.fileSystemId],
    references: [fileSystems.id],
  }),
  versions: many(fileVersions),
  shares: many(fileShares),
  activities: many(fileActivities),
}));

export const fileVersionsRelations = relations(fileVersions, ({ one }) => ({
  file: one(fileEntries, {
    fields: [fileVersions.fileId],
    references: [fileEntries.id],
  }),
}));

export const fileSharesRelations = relations(fileShares, ({ one }) => ({
  file: one(fileEntries, {
    fields: [fileShares.fileId],
    references: [fileEntries.id],
  }),
}));

export const fileFoldersRelations = relations(fileFolders, ({ one, many }) => ({
  parent: one(fileFolders, {
    fields: [fileFolders.parentId],
    references: [fileFolders.id],
  }),
  children: many(fileFolders),
  activities: many(fileActivities),
}));

export const fileActivitiesRelations = relations(fileActivities, ({ one }) => ({
  file: one(fileEntries, {
    fields: [fileActivities.fileId],
    references: [fileEntries.id],
  }),
  folder: one(fileFolders, {
    fields: [fileActivities.folderId],
    references: [fileFolders.id],
  }),
}));

// Zod Schemas
export const insertFileSystemSchema = createInsertSchema(fileSystems);
export const insertFileCategorySchema = createInsertSchema(fileCategories);
export const insertFileEntrySchema = createInsertSchema(fileEntries);
export const insertFileVersionSchema = createInsertSchema(fileVersions);
export const insertFileShareSchema = createInsertSchema(fileShares);
export const insertFileFolderSchema = createInsertSchema(fileFolders);
export const insertFileActivitySchema = createInsertSchema(fileActivities);

// Types
export type FileSystem = typeof fileSystems.$inferSelect;
export type InsertFileSystem = z.infer<typeof insertFileSystemSchema>;
export type FileCategory = typeof fileCategories.$inferSelect;
export type InsertFileCategory = z.infer<typeof insertFileCategorySchema>;
export type FileEntry = typeof fileEntries.$inferSelect;
export type InsertFileEntry = z.infer<typeof insertFileEntrySchema>;
export type FileVersion = typeof fileVersions.$inferSelect;
export type InsertFileVersion = z.infer<typeof insertFileVersionSchema>;
export type FileShare = typeof fileShares.$inferSelect;
export type InsertFileShare = z.infer<typeof insertFileShareSchema>;
export type FileFolder = typeof fileFolders.$inferSelect;
export type InsertFileFolder = z.infer<typeof insertFileFolderSchema>;
export type FileActivity = typeof fileActivities.$inferSelect;
export type InsertFileActivity = z.infer<typeof insertFileActivitySchema>;

// Storage Provider Configuration Types
export interface StorageProviderConfig {
  type: 'local' | 'aws_s3' | 'google_cloud' | 'azure' | 'dropbox' | 'onedrive';
  name: string;
  configuration: Record<string, any>;
  credentials?: Record<string, any>;
}

export interface LocalStorageConfig extends StorageProviderConfig {
  type: 'local';
  configuration: {
    basePath: string;
    maxFileSize: number;
    allowedExtensions: string[];
  };
}

export interface AWSS3Config extends StorageProviderConfig {
  type: 'aws_s3';
  configuration: {
    bucket: string;
    region: string;
    endpoint?: string;
    forcePathStyle?: boolean;
  };
  credentials: {
    accessKeyId: string;
    secretAccessKey: string;
  };
}

export interface GoogleCloudConfig extends StorageProviderConfig {
  type: 'google_cloud';
  configuration: {
    bucket: string;
    projectId: string;
  };
  credentials: {
    keyFilename?: string;
    keyFile?: object;
  };
}

export interface AzureBlobConfig extends StorageProviderConfig {
  type: 'azure';
  configuration: {
    containerName: string;
    storageAccount: string;
  };
  credentials: {
    connectionString: string;
  };
}
