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
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { createInsertSchema } from 'drizzle-zod';

// ============================================================================
// CREATORHUB VIRTUAL STUDIO
// Advanced 3D pre-visualization and virtual production system
// ============================================================================

/**
 * Virtual Studio Projects
 * Main container for all virtual studio work
 */
export const virtualStudioProjects = pgTable(
  'virtual_studio_projects',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: varchar('user_id', { length: 255 }).notNull(),

    // Project Info
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    projectType: varchar('project_type', { length: 50 })
      .$type<'photography' | 'videography' | 'commercial' | 'wedding' | 'event' | 'product'>()
      .notNull()
      .default('photography'),

    // Project Status
    status: varchar('status', { length: 20 })
      .$type<'draft' | 'active' | 'review' | 'completed' | 'archived'>()
      .default('draft'),

    // Technical Settings
    resolution: varchar('resolution', { length: 50 }).default('4K (3840x2160)'),
    aspectRatio: varchar('aspect_ratio', { length: 20 }).default('16:9'),
    frameRate: integer('frame_rate').default(25),
    colorSpace: varchar('color_space', { length: 50 }).default('Rec.709'),

    // Google Drive Integration
    googleDriveFolderId: varchar('google_drive_folder_id', { length: 255 }),
    googleDriveFolderPath: text('google_drive_folder_path'),
    autoSyncEnabled: boolean('auto_sync_enabled').default(true),
    lastSyncedAt: timestamp('last_synced_at'),

    // Project Settings
    settings: jsonb('settings'), // Lighting presets, render quality, etc.
    metadata: jsonb('metadata'), // Custom fields, tags, client info

    // Stats
    sceneCount: integer('scene_count').default(0),
    renderCount: integer('render_count').default(0),
    exportCount: integer('export_count').default(0),

    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    userIdIdx: index('virtual_studio_projects_user_id_idx').on(table.userId),
    statusIdx: index('virtual_studio_projects_status_idx').on(table.status),
    projectTypeIdx: index('virtual_studio_projects_type_idx').on(table.projectType),
    createdAtIdx: index('virtual_studio_projects_created_at_idx').on(table.createdAt),
  }),
);

export type VirtualStudioProject = typeof virtualStudioProjects.$inferSelect;
export type InsertVirtualStudioProject = typeof virtualStudioProjects.$inferInsert;

/**
 * Virtual Studio Scenes
 * Individual 3D scenes within a project
 */
export const virtualStudioScenes = pgTable(
  'virtual_studio_scenes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id').notNull(),
    userId: varchar('user_id', { length: 255 }).notNull(),

    // Scene Info
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    thumbnailUrl: text('thumbnail_url'),

    // Scene Data
    sceneData: jsonb('scene_data').notNull(), // Complete 3D scene structure

    // 3D Elements
    objects: jsonb('objects'), // 3D models, props, furniture
    lighting: jsonb('lighting'), // Lights, HDRIs, IES profiles
    environment: jsonb('environment'), // Background, sky, ground
    cameras: jsonb('cameras'), // Camera positions and settings

    // Render Settings
    renderQuality: varchar('render_quality', { length: 20 })
      .$type<'draft' | 'preview' | 'high' | 'ultra'>()
      .default('preview'),
    renderResolution: varchar('render_resolution', { length: 50 }).default('1920x1080'),
    samplesCount: integer('samples_count').default(128),

    // Version Control
    version: integer('version').default(1),
    parentSceneId: uuid('parent_scene_id'), // For scene versions/copies
    isTemplate: boolean('is_template').default(false),

    // Stats
    viewCount: integer('view_count').default(0),
    renderTime: integer('render_time'), // Seconds
    lastRenderedAt: timestamp('last_rendered_at'),

    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    projectIdIdx: index('virtual_studio_scenes_project_id_idx').on(table.projectId),
    userIdIdx: index('virtual_studio_scenes_user_id_idx').on(table.userId),
    isTemplateIdx: index('virtual_studio_scenes_template_idx').on(table.isTemplate),
  }),
);

export type VirtualStudioScene = typeof virtualStudioScenes.$inferSelect;
export type InsertVirtualStudioScene = typeof virtualStudioScenes.$inferInsert;

/**
 * Camera Paths
 * Animated camera movements for video previsualization
 */
export const virtualStudioCameraPaths = pgTable(
  'virtual_studio_camera_paths',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sceneId: uuid('scene_id').notNull(),
    projectId: uuid('project_id').notNull(),
    userId: varchar('user_id', { length: 255 }).notNull(),

    // Path Info
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    pathType: varchar('path_type', { length: 50 })
      .$type<'static' | 'linear' | 'bezier' | 'orbit' | 'dolly' | 'crane' | 'gimbal'>()
      .default('linear'),

    // Camera Path Data
    keyframes: jsonb('keyframes').notNull(), // Array of camera positions with timestamps
    duration: integer('duration').notNull(), // Duration in seconds

    // Camera Settings at each keyframe
    focalLength: jsonb('focal_length'), // Focal length changes over time
    aperture: jsonb('aperture'), // F-stop changes over time
    focusDistance: jsonb('focus_distance'), // Focus changes over time

    // Movement Settings
    easingType: varchar('easing_type', { length: 50 }).default('smooth'),
    speed: decimal('speed', { precision: 5, scale: 2 }).default('1.0'),
    smoothness: integer('smoothness').default(50), // 0-100

    // Preview
    previewUrl: text('preview_url'), // Rendered preview video
    thumbnailUrl: text('thumbnail_url'),

    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    sceneIdIdx: index('virtual_studio_camera_paths_scene_id_idx').on(table.sceneId),
    projectIdIdx: index('virtual_studio_camera_paths_project_id_idx').on(table.projectId),
  }),
);

export type VirtualStudioCameraPath = typeof virtualStudioCameraPaths.$inferSelect;
export type InsertVirtualStudioCameraPath = typeof virtualStudioCameraPaths.$inferInsert;

/**
 * Virtual Studio Assets
 * 3D models, textures, HDRIs, and other assets
 */
export const virtualStudioAssets = pgTable(
  'virtual_studio_assets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: varchar('user_id', { length: 255 }).notNull(),

    // Asset Info
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    assetType: varchar('asset_type', { length: 50 })
      .$type<'model_3d' | 'texture' | 'hdri' | 'ies_light' | 'material' | 'lut' | 'background'>()
      .notNull(),
    category: varchar('category', { length: 100 }), // furniture, props, lighting, etc.

    // File Info
    filePath: text('file_path').notNull(),
    fileSize: integer('file_size'), // Bytes
    fileFormat: varchar('file_format', { length: 20 }), // .obj, .fbx, .exr, .hdr
    thumbnailUrl: text('thumbnail_url'),
    previewUrl: text('preview_url'),

    // Asset Properties
    dimensions: jsonb('dimensions'), // {width, height, depth} for 3D models
    resolution: varchar('resolution', { length: 50 }), // For textures/HDRIs
    polyCount: integer('poly_count'), // For 3D models

    // Metadata
    tags: jsonb('tags'), // Array of search tags
    metadata: jsonb('metadata'), // Custom properties

    // Access Control
    isPublic: boolean('is_public').default(false),
    isSystem: boolean('is_system').default(false), // System/default assets

    // Google Drive
    googleDriveFileId: varchar('google_drive_file_id', { length: 255 }),
    googleDriveUrl: text('google_drive_url'),

    // Stats
    usageCount: integer('usage_count').default(0),
    downloadCount: integer('download_count').default(0),

    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    userIdIdx: index('virtual_studio_assets_user_id_idx').on(table.userId),
    assetTypeIdx: index('virtual_studio_assets_type_idx').on(table.assetType),
    categoryIdx: index('virtual_studio_assets_category_idx').on(table.category),
    isPublicIdx: index('virtual_studio_assets_public_idx').on(table.isPublic),
  }),
);

export type VirtualStudioAsset = typeof virtualStudioAssets.$inferSelect;
export type InsertVirtualStudioAsset = typeof virtualStudioAssets.$inferInsert;

/**
 * Virtual Studio Renders
 * Track render jobs and outputs
 */
export const virtualStudioRenders = pgTable(
  'virtual_studio_renders',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sceneId: uuid('scene_id').notNull(),
    projectId: uuid('project_id').notNull(),
    userId: varchar('user_id', { length: 255 }).notNull(),

    // Render Info
    name: varchar('name', { length: 255 }).notNull(),
    renderType: varchar('render_type', { length: 50 })
      .$type<'image' | 'video' | 'animation' | '360_panorama'>()
      .notNull(),

    // Render Settings
    resolution: varchar('resolution', { length: 50 }).notNull(),
    quality: varchar('quality', { length: 20 })
      .$type<'draft' | 'preview' | 'high' | 'ultra'>()
      .notNull(),
    samplesCount: integer('samples_count').default(128),
    frameRate: integer('frame_rate'), // For videos
    frameCount: integer('frame_count'), // For animations/videos

    // Render Job Status
    status: varchar('status', { length: 20 })
      .$type<'queued' | 'rendering' | 'completed' | 'failed' | 'cancelled'>()
      .default('queued'),
    progress: integer('progress').default(0), // 0-100

    // Output
    outputUrl: text('output_url'),
    outputFormat: varchar('output_format', { length: 20 }), // .png, .jpg, .mp4, .exr
    fileSize: integer('file_size'), // Bytes

    // Performance
    renderTime: integer('render_time'), // Seconds
    startedAt: timestamp('started_at'),
    completedAt: timestamp('completed_at'),

    // Error Handling
    errorMessage: text('error_message'),
    retryCount: integer('retry_count').default(0),

    // Google Drive
    googleDriveFileId: varchar('google_drive_file_id', { length: 255 }),
    googleDriveUrl: text('google_drive_url'),

    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    sceneIdIdx: index('virtual_studio_renders_scene_id_idx').on(table.sceneId),
    projectIdIdx: index('virtual_studio_renders_project_id_idx').on(table.projectId),
    statusIdx: index('virtual_studio_renders_status_idx').on(table.status),
    userIdIdx: index('virtual_studio_renders_user_id_idx').on(table.userId),
  }),
);

export type VirtualStudioRender = typeof virtualStudioRenders.$inferSelect;
export type InsertVirtualStudioRender = typeof virtualStudioRenders.$inferInsert;

/**
 * Virtual Studio Templates
 * Pre-made scenes and setups
 */
export const virtualStudioTemplates = pgTable(
  'virtual_studio_templates',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: varchar('user_id', { length: 255 }), // Null for system templates

    // Template Info
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    category: varchar('category', { length: 100 }).notNull(), // studio, outdoor, product, etc.
    subcategory: varchar('subcategory', { length: 100 }),

    // Template Data
    templateData: jsonb('template_data').notNull(), // Complete scene setup
    thumbnailUrl: text('thumbnail_url'),
    previewImages: jsonb('preview_images'), // Array of preview image URLs

    // Template Type
    templateType: varchar('template_type', { length: 50 })
      .$type<'scene' | 'lighting' | 'camera_setup' | 'complete_project'>()
      .notNull(),

    // Profession Specific
    targetProfession: varchar('target_profession', { length: 50 })
      .$type<'photographer' | 'videographer' | 'all'>()
      .default('all'),

    // Access Control
    isPublic: boolean('is_public').default(true),
    isSystem: boolean('is_system').default(false),
    isPremium: boolean('is_premium').default(false),

    // Stats
    usageCount: integer('usage_count').default(0),
    rating: decimal('rating', { precision: 3, scale: 2 }), // 0.00-5.00
    ratingCount: integer('rating_count').default(0),

    // Tags for search
    tags: jsonb('tags'), // Array of search tags

    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    categoryIdx: index('virtual_studio_templates_category_idx').on(table.category),
    templateTypeIdx: index('virtual_studio_templates_type_idx').on(table.templateType),
    targetProfessionIdx: index('virtual_studio_templates_profession_idx').on(
      table.targetProfession,
    ),
    isPublicIdx: index('virtual_studio_templates_public_idx').on(table.isPublic),
  }),
);

export type VirtualStudioTemplate = typeof virtualStudioTemplates.$inferSelect;
export type InsertVirtualStudioTemplate = typeof virtualStudioTemplates.$inferInsert;

/**
 * Virtual Studio Exports
 * Track exported files (images, videos, project files)
 */
export const virtualStudioExports = pgTable(
  'virtual_studio_exports',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id').notNull(),
    sceneId: uuid('scene_id'),
    userId: varchar('user_id', { length: 255 }).notNull(),

    // Export Info
    exportType: varchar('export_type', { length: 50 })
      .$type<'render' | 'scene' | 'project' | 'camera_path' | 'storyboard'>()
      .notNull(),
    format: varchar('format', { length: 20 }).notNull(), // .png, .mp4, .json, .pdf

    // File Info
    fileName: varchar('file_name', { length: 255 }).notNull(),
    filePath: text('file_path'),
    fileSize: integer('file_size'), // Bytes

    // Export Settings
    settings: jsonb('settings'), // Resolution, quality, etc.

    // Google Drive
    googleDriveFileId: varchar('google_drive_file_id', { length: 255 }),
    googleDriveUrl: text('google_drive_url'),
    googleDriveFolderId: varchar('google_drive_folder_id', { length: 255 }),

    // Status
    status: varchar('status', { length: 20 })
      .$type<'pending' | 'processing' | 'completed' | 'failed'>()
      .default('pending'),

    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    projectIdIdx: index('virtual_studio_exports_project_id_idx').on(table.projectId),
    userIdIdx: index('virtual_studio_exports_user_id_idx').on(table.userId),
    exportTypeIdx: index('virtual_studio_exports_type_idx').on(table.exportType),
  }),
);

export type VirtualStudioExport = typeof virtualStudioExports.$inferSelect;
export type InsertVirtualStudioExport = typeof virtualStudioExports.$inferInsert;

/**
 * Google Drive Folder Mapping
 * Track folder structure in user's Google Drive
 */
export const googleDriveFolders = pgTable(
  'google_drive_folders',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: varchar('user_id', { length: 255 }).notNull(),

    // Folder Info
    folderId: varchar('folder_id', { length: 255 }).notNull(), // Google Drive folder ID
    folderName: varchar('folder_name', { length: 255 }).notNull(),
    folderPath: text('folder_path'), // Full path in Drive

    // Folder Type
    folderType: varchar('folder_type', { length: 50 })
      .$type<
        'root' | 'projects' | 'camera_paths' | 'exports' | 'assets' | 'templates' | 'renders'
      >()
      .notNull(),

    // Parent Relationship
    parentFolderId: varchar('parent_folder_id', { length: 255 }),

    // Sync Status
    lastSyncedAt: timestamp('last_synced_at'),
    syncStatus: varchar('sync_status', { length: 20 })
      .$type<'synced' | 'syncing' | 'error' | 'pending'>()
      .default('synced'),

    // Metadata
    fileCount: integer('file_count').default(0),
    metadata: jsonb('metadata'),

    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    userIdIdx: index('google_drive_folders_user_id_idx').on(table.userId),
    folderIdIdx: index('google_drive_folders_folder_id_idx').on(table.folderId),
    folderTypeIdx: index('google_drive_folders_type_idx').on(table.folderType),
  }),
);

export type GoogleDriveFolder = typeof googleDriveFolders.$inferSelect;
export type InsertGoogleDriveFolder = typeof googleDriveFolders.$inferInsert;

/**
 * Google Drive File Mapping
 * Track individual files synced to Google Drive
 */
export const googleDriveFiles = pgTable(
  'google_drive_files',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: varchar('user_id', { length: 255 }).notNull(),

    // File Info
    fileId: varchar('file_id', { length: 255 }).notNull(), // Google Drive file ID
    fileName: varchar('file_name', { length: 255 }).notNull(),
    mimeType: varchar('mime_type', { length: 100 }),
    fileSize: integer('file_size'), // Bytes

    // Location
    folderId: varchar('folder_id', { length: 255 }).notNull(),
    filePath: text('file_path'), // Full path in Drive

    // Virtual Studio Reference
    projectId: uuid('project_id'),
    sceneId: uuid('scene_id'),
    assetId: uuid('asset_id'),
    renderId: uuid('render_id'),
    exportId: uuid('export_id'),

    // File Type
    fileType: varchar('file_type', { length: 50 })
      .$type<'project' | 'scene' | 'asset' | 'render' | 'export' | 'thumbnail' | 'preview'>()
      .notNull(),

    // Sync Status
    lastSyncedAt: timestamp('last_synced_at'),
    syncStatus: varchar('sync_status', { length: 20 })
      .$type<'synced' | 'syncing' | 'error' | 'pending' | 'deleted'>()
      .default('synced'),

    // Google Drive URLs
    webViewLink: text('web_view_link'),
    webContentLink: text('web_content_link'),
    thumbnailLink: text('thumbnail_link'),

    // Metadata
    metadata: jsonb('metadata'),

    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    userIdIdx: index('google_drive_files_user_id_idx').on(table.userId),
    fileIdIdx: index('google_drive_files_file_id_idx').on(table.fileId),
    projectIdIdx: index('google_drive_files_project_id_idx').on(table.projectId),
    fileTypeIdx: index('google_drive_files_type_idx').on(table.fileType),
  }),
);

export type GoogleDriveFile = typeof googleDriveFiles.$inferSelect;
export type InsertGoogleDriveFile = typeof googleDriveFiles.$inferInsert;

// Zod Schema
export const insertGoogleDriveFileSchema = createInsertSchema(googleDriveFiles);

// ============================================================================
// Relations
// ============================================================================

export const virtualStudioProjectsRelations = relations(virtualStudioProjects, ({ many }) => ({
  scenes: many(virtualStudioScenes),
  cameraPaths: many(virtualStudioCameraPaths),
  renders: many(virtualStudioRenders),
  exports: many(virtualStudioExports),
}));

export const virtualStudioScenesRelations = relations(virtualStudioScenes, ({ one, many }) => ({
  project: one(virtualStudioProjects, {
    fields: [virtualStudioScenes.projectId],
    references: [virtualStudioProjects.id],
  }),
  cameraPaths: many(virtualStudioCameraPaths),
  renders: many(virtualStudioRenders),
}));

export const virtualStudioCameraPathsRelations = relations(virtualStudioCameraPaths, ({ one }) => ({
  scene: one(virtualStudioScenes, {
    fields: [virtualStudioCameraPaths.sceneId],
    references: [virtualStudioScenes.id],
  }),
  project: one(virtualStudioProjects, {
    fields: [virtualStudioCameraPaths.projectId],
    references: [virtualStudioProjects.id],
  }),
}));

export const virtualStudioRendersRelations = relations(virtualStudioRenders, ({ one }) => ({
  scene: one(virtualStudioScenes, {
    fields: [virtualStudioRenders.sceneId],
    references: [virtualStudioScenes.id],
  }),
  project: one(virtualStudioProjects, {
    fields: [virtualStudioRenders.projectId],
    references: [virtualStudioProjects.id],
  }),
}));
