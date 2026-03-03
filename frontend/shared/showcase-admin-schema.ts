/**
 * CreatorHub Norge - Comprehensive Administrative Showcase Schema
 * Full administrative control for different professions with extensive display options
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
  index,
  bigint,
  AnyPgColumn,
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';

// Showcase Configuration for Each Profession
export const showcaseConfigurations = pgTable('showcase_configurations', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  profession: varchar('profession')
    .$type<'photographer' | 'videographer' | 'music_producer' | 'vendor'>()
    .notNull(),
  userId: varchar('user_id').notNull(),
  configName: varchar('config_name').notNull(), // "Standard", "Premium", "Custom", etc.
  isActive: boolean('is_active').default(true),

  // Layout Options
  layoutType: varchar('layout_type')
    .$type<
      | 'grid'
      | 'masonry'
      | 'slideshow'
      | 'timeline'
      | 'magazine'
      | 'portfolio'
      | 'split_screen'
      | 'full_width'
    >()
    .default('grid'),
  columnsDesktop: integer('columns_desktop').default(3), // 1-6 columns
  columnsMobile: integer('columns_mobile').default(1),
  gridSpacing: integer('grid_spacing').default(16), // px
  aspectRatio: varchar('aspect_ratio')
    .$type<'auto' | 'square' | '16:9' | '4:3' | '3:2' | '21:9'>()
    .default('auto'),

  // Display Options
  showTitles: boolean('show_titles').default(true),
  showDescriptions: boolean('show_descriptions').default(false),
  showClientNames: boolean('show_client_names').default(true),
  showDates: boolean('show_dates').default(false),
  showTags: boolean('show_tags').default(true),
  showViewCounts: boolean('show_view_counts').default(false),
  showLikeCounts: boolean('show_like_counts').default(false),

  // Interaction Options
  enableHover: boolean('enable_hover').default(true),
  hoverEffect: varchar('hover_effect')
    .$type<'zoom' | 'fade' | 'slide' | 'flip' | 'none'>()
    .default('zoom'),
  enableLightbox: boolean('enable_lightbox').default(true),
  enableFullscreen: boolean('enable_fullscreen').default(true),
  enableShare: boolean('enable_share').default(true),
  enableDownload: boolean('enable_download').default(false),
  enableComments: boolean('enable_comments').default(false),

  // Filtering & Sorting
  enableFiltering: boolean('enable_filtering').default(true),
  enableSorting: boolean('enable_sorting').default(true),
  enableSearch: boolean('enable_search').default(true),
  defaultSortBy: varchar('default_sort_by')
    .$type<'newest' | 'oldest' | 'popular' | 'title' | 'client'>()
    .default('newest'),
  availableFilters: jsonb('available_filters')
    .$type<string[]>()
    .default(['all', 'featured', 'recent']),

  // Visual Styling
  primaryColor: varchar('primary_color').default('#FF6B35'),
  secondaryColor: varchar('secondary_color').default('#F7931E'),
  backgroundColor: varchar('background_color').default('#ffffff'),
  textColor: varchar('text_color').default('#333333'),
  borderRadius: integer('border_radius').default(8), // px
  shadowLevel: varchar('shadow_level')
    .$type<'none' | 'light' | 'medium' | 'heavy'>()
    .default('medium'),

  // Animation & Transitions
  enableAnimations: boolean('enable_animations').default(true),
  animationType: varchar('animation_type')
    .$type<'fade' | 'slide' | 'bounce' | 'none'>()
    .default('fade'),
  animationDuration: integer('animation_duration').default(300), // ms

  // SEO & Performance
  lazyLoading: boolean('lazy_loading').default(true),
  enableSEO: boolean('enable_seo').default(true),
  enableAnalytics: boolean('enable_analytics').default(true),

  // Custom CSS & Branding
  customCSS: text('custom_css'),
  logoUrl: varchar('logo_url'),
  watermarkUrl: varchar('watermark_url'),
  watermarkPosition: varchar('watermark_position')
    .$type<'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center'>()
    .default('bottom-right'),
  watermarkOpacity: decimal('watermark_opacity', {
    precision: 3,
    scale: 2,
  }).default('0.7'),

  // Mobile Responsive Options
  mobileLayoutType: varchar('mobile_layout_type')
    .$type<'stack' | 'grid' | 'carousel' | 'list'>()
    .default('stack'),
  enableMobileGestures: boolean('enable_mobile_gestures').default(true),
  mobileMenuStyle: varchar('mobile_menu_style')
    .$type<'dropdown' | 'sidebar' | 'bottom_sheet'>()
    .default('dropdown'),

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Showcase Items with Rich Metadata
export const showcaseItems = pgTable('showcase_items', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  configurationId: varchar('configuration_id').references(() => showcaseConfigurations.id),
  profession: varchar('profession')
    .$type<'photographer' | 'videographer' | 'music_producer' | 'vendor'>()
    .notNull(),
  userId: varchar('user_id').notNull(),

  // Basic Information
  title: varchar('title').notNull(),
  description: text('description'),
  clientName: varchar('client_name'),
  projectId: varchar('project_id'), // Link to existing projects

  // File Information
  fileType: varchar('file_type')
    .$type<'photo' | 'video' | 'audio' | 'document' | 'youtube' | 'embed'>()
    .notNull(),
  fileUrl: varchar('file_url').notNull(),
  thumbnailUrl: varchar('thumbnail_url'),
  previewUrl: varchar('preview_url'), // Lower quality preview

  // Media Specific
  dimensions: jsonb('dimensions').$type<{ width: number; height: number }>(),
  duration: integer('duration'), // seconds for video/audio
  fileSize: bigint('file_size', { mode: 'number' }), // bytes
  format: varchar('format'), // jpg, mp4, mp3, etc.

  // YouTube Integration
  youtubeVideoId: varchar('youtube_video_id'),
  youtubePlaylistId: varchar('youtube_playlist_id'),
  youtubeChannelId: varchar('youtube_channel_id'),

  // Categorization & Organization
  category: varchar('category').notNull(),
  subcategory: varchar('subcategory'),
  tags: jsonb('tags').$type<string[]>().default([]),
  location: varchar('location'),
  eventDate: timestamp('event_date'),
  eventDates: jsonb('event_dates').$type<Record<number, string>>(), // For multi-day events: { 1: '2024-06-15', 2: '2024-06-16' }

  // Status & Visibility
  status: varchar('status')
    .$type<'draft' | 'published' | 'archived' | 'private'>()
    .default('draft'),
  isPublic: boolean('is_public').default(false),
  isFeatured: boolean('is_featured').default(false),
  isPromoted: boolean('is_promoted').default(false),

  // Engagement & Analytics
  viewCount: integer('view_count').default(0),
  likeCount: integer('like_count').default(0),
  shareCount: integer('share_count').default(0),
  downloadCount: integer('download_count').default(0),
  commentCount: integer('comment_count').default(0),

  // SEO & Social
  seoTitle: varchar('seo_title'),
  seoDescription: text('seo_description'),
  socialImageUrl: varchar('social_image_url'),

  // Sorting & Display
  sortOrder: integer('sort_order').default(0),
  displayPriority: integer('display_priority').default(0),

  // Technical Metadata
  exifData: jsonb('exif_data'), // For photos
  videoCodec: varchar('video_codec'), // For videos
  audioCodec: varchar('audio_codec'), // For audio
  bitrate: integer('bitrate'), // For media files

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Showcase Categories for Each Profession
export const showcaseCategories = pgTable('showcase_categories', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  profession: varchar('profession')
    .$type<'photographer' | 'videographer' | 'music_producer' | 'vendor'>()
    .notNull(),
  userId: varchar('user_id').notNull(),
  name: varchar('name').notNull(),
  displayName: varchar('display_name').notNull(),
  description: text('description'),
  color: varchar('color').default('#FF6B35'),
  icon: varchar('icon'), // Material UI icon name
  sortOrder: integer('sort_order').default(0),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
});

// Showcase Templates for Quick Setup
export const showcaseTemplates = pgTable('showcase_templates', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: varchar('name').notNull(),
  profession: varchar('profession')
    .$type<'photographer' | 'videographer' | 'music_producer' | 'vendor'>()
    .notNull(),
  description: text('description'),
  previewImageUrl: varchar('preview_image_url'),
  configuration: jsonb('configuration').notNull(), // Template settings
  isBuiltIn: boolean('is_built_in').default(false),
  isPremium: boolean('is_premium').default(false),
  isPopular: boolean('is_popular').default(false),
  usageCount: integer('usage_count').default(0),
  createdAt: timestamp('created_at').defaultNow(),
});

// Showcase Comments & Reviews
export const showcaseComments = pgTable('showcase_comments', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  showcaseItemId: varchar('showcase_item_id')
    .references(() => showcaseItems.id)
    .notNull(),
  authorName: varchar('author_name').notNull(),
  authorEmail: varchar('author_email'),
  content: text('content').notNull(),
  rating: integer('rating'), // 1-5 stars
  isApproved: boolean('is_approved').default(false),
  parentCommentId: varchar('parent_comment_id').references(
    (): AnyPgColumn => showcaseComments.id,
  ),
  createdAt: timestamp('created_at').defaultNow(),
});

// Showcase Analytics for Performance Tracking
export const showcaseAnalytics = pgTable('showcase_analytics', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  showcaseItemId: varchar('showcase_item_id').references(() => showcaseItems.id),
  configurationId: varchar('configuration_id').references(() => showcaseConfigurations.id),

  // Engagement Metrics
  views: integer('views').default(0),
  uniqueViews: integer('unique_views').default(0),
  likes: integer('likes').default(0),
  shares: integer('shares').default(0),
  downloads: integer('downloads').default(0),
  timeSpent: integer('time_spent').default(0), // seconds

  // Traffic Sources
  referrer: varchar('referrer'),
  deviceType: varchar('device_type').$type<'desktop' | 'mobile' | 'tablet'>(),
  browser: varchar('browser'),
  country: varchar('country'),

  // Date for aggregation
  date: timestamp('date').defaultNow(),

  createdAt: timestamp('created_at').defaultNow(),
});

// Client Gallery Sessions - For proofing and selection process
export const clientGallerySessions = pgTable('client_gallery_sessions', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  photographerId: varchar('photographer_id').notNull(),
  clientEmail: varchar('client_email').notNull(),
  clientName: varchar('client_name').notNull(),
  projectId: varchar('project_id'), // Optional link to project

  // Session Configuration
  sessionName: varchar('session_name').notNull(), // "Bryllup - Emma & Lars"
  description: text('description'),
  accessPin: varchar('access_pin'), // 4-6 digit PIN
  accessPassword: varchar('access_password'), // Alternative to PIN

  // Selection Configuration
  maxSelections: integer('max_selections'), // e.g. 60 for album
  minSelections: integer('min_selections').default(0),
  selectionDeadline: timestamp('selection_deadline'),
  allowComments: boolean('allow_comments').default(true),
  allowDownloads: boolean('allow_downloads').default(false),

  // Proofing Process
  proofingRound: integer('proofing_round').default(1), // R1, R2, etc.
  status: varchar('status')
    .$type<'setup' | 'active' | 'selections_made' | 'approved' | 'delivered' | 'expired'>()
    .default('setup'),

  // Watermark & Protection
  watermarkEnabled: boolean('watermark_enabled').default(true),
  lowResPreview: boolean('low_res_preview').default(true),

  // FASE 2: Enhanced Security and Access Control
  requiresPassword: boolean('requires_password').default(false),
  passwordHash: varchar('password_hash'),
  allowedIpAddresses: text('allowed_ip_addresses').array(),
  maxLoginAttempts: integer('max_login_attempts').default(3),
  loginAttempts: integer('login_attempts').default(0),
  lastLoginAttempt: timestamp('last_login_attempt'),
  isLocked: boolean('is_locked').default(false),
  lockoutUntil: timestamp('lockout_until'),
  requiresApproval: boolean('requires_approval').default(false),
  downloadProtectionLevel: varchar('download_protection_level')
    .$type<'none' | 'watermark' | 'disabled' | 'approval_required'>()
    .default('watermark'),
  rightClickDisabled: boolean('right_click_disabled').default(true),
  screenshotProtection: boolean('screenshot_protection').default(false),
  sessionTimeoutMinutes: integer('session_timeout_minutes').default(60),

  // Timestamps
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  expiresAt: timestamp('expires_at'), // Auto-archive after X days
  lastAccessedAt: timestamp('last_accessed_at'),
});

// Client Selections - Track what clients have selected/favorited
export const clientSelections = pgTable('client_selections', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  sessionId: varchar('session_id')
    .references(() => clientGallerySessions.id)
    .notNull(),
  showcaseItemId: varchar('showcase_item_id')
    .references(() => showcaseItems.id)
    .notNull(),
  clientEmail: varchar('client_email').notNull(),

  // Selection Details
  isSelected: boolean('is_selected').default(true),
  priority: integer('priority'), // 1 = highest priority
  clientComment: text('client_comment'),

  // Status
  photographerApproved: boolean('photographer_approved'),
  photographerComment: text('photographer_comment'),

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Session Activity Log - Track client actions
export const sessionActivityLog = pgTable('session_activity_log', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  sessionId: varchar('session_id')
    .references(() => clientGallerySessions.id)
    .notNull(),
  clientEmail: varchar('client_email').notNull(),

  // Activity Details
  action: varchar('action')
    .$type<'login' | 'view_image' | 'select' | 'deselect' | 'comment' | 'download'>()
    .notNull(),
  itemId: varchar('item_id'), // Optional reference to specific image
  metadata: jsonb('metadata'), // Additional action data

  createdAt: timestamp('created_at').defaultNow(),
});

// Session Email Notifications - Track sent reminders
export const sessionNotifications = pgTable('session_notifications', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  sessionId: varchar('session_id')
    .references(() => clientGallerySessions.id)
    .notNull(),
  clientEmail: varchar('client_email').notNull(),

  // Notification Details
  type: varchar('type')
    .$type<'invitation' | 'reminder' | 'deadline_warning' | 'approved' | 'delivered'>()
    .notNull(),
  subject: varchar('subject').notNull(),
  content: text('content').notNull(),
  status: varchar('status')
    .$type<'pending' | 'sent' | 'failed' | 'opened' | 'clicked'>()
    .default('pending'),

  // Scheduling
  scheduledFor: timestamp('scheduled_for'),
  sentAt: timestamp('sent_at'),
  openedAt: timestamp('opened_at'),

  createdAt: timestamp('created_at').defaultNow(),
});

// FASE 3: Smart Albums - Intelligent photo collections with AI-based categorization
export const smartAlbums = pgTable('smart_albums', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar('user_id').notNull(),
  profession: varchar('profession')
    .$type<'photographer' | 'videographer' | 'music_producer' | 'vendor'>()
    .notNull(),

  // Album Configuration
  name: varchar('name').notNull(),
  description: text('description'),
  albumType: varchar('album_type')
    .$type<'manual' | 'smart_rule' | 'ai_generated' | 'client_selection'>()
    .default('smart_rule'),

  // Smart Rules Configuration
  smartRules: jsonb('smart_rules')
    .$type<{
      dateRange?: { start: string; end: string };
      tags?: string[];
      categories?: string[];
      clients?: string[];
      locations?: string[];
      ratings?: number[];
      fileTypes?: string[];
      aiFeatures?: string[]; // e.g., 'faces', 'landscape', 'indoor'
    }>()
    .default({}),

  // Display Configuration
  coverImageId: varchar('cover_image_id'), // Reference to showcaseItems.id
  layoutStyle: varchar('layout_style')
    .$type<'grid' | 'masonry' | 'timeline' | 'magazine'>()
    .default('grid'),
  sortBy: varchar('sort_by')
    .$type<'date' | 'rating' | 'filename' | 'client' | 'manual'>()
    .default('date'),
  sortOrder: varchar('sort_order').$type<'asc' | 'desc'>().default('desc'),

  // Sharing & Access
  isPublic: boolean('is_public').default(false),
  shareUrl: varchar('share_url'),
  accessPassword: varchar('access_password'),

  // Statistics
  itemCount: integer('item_count').default(0),
  lastAutoUpdate: timestamp('last_auto_update'),

  // Status
  status: varchar('status').$type<'active' | 'archived' | 'draft'>().default('active'),

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Smart Album Items - Many-to-many relationship between albums and showcase items
export const smartAlbumItems = pgTable('smart_album_items', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  albumId: varchar('album_id')
    .references(() => smartAlbums.id)
    .notNull(),
  showcaseItemId: varchar('showcase_item_id')
    .references(() => showcaseItems.id)
    .notNull(),

  // Position within album (for manual ordering)
  sortOrder: integer('sort_order').default(0),

  // Auto-assignment tracking
  wasAutoAssigned: boolean('was_auto_assigned').default(false),
  assignmentReason: varchar('assignment_reason'), // Which rule caused inclusion

  addedAt: timestamp('added_at').defaultNow(),
});

// Relations
export const showcaseConfigurationsRelations = relations(showcaseConfigurations, ({ many }) => ({
  items: many(showcaseItems),
  analytics: many(showcaseAnalytics),
}));

export const showcaseItemsRelations = relations(showcaseItems, ({ one, many }) => ({
  configuration: one(showcaseConfigurations, {
    fields: [showcaseItems.configurationId],
    references: [showcaseConfigurations.id],
  }),
  comments: many(showcaseComments),
  analytics: many(showcaseAnalytics),
}));

export const showcaseCategoriesRelations = relations(showcaseCategories, ({ many }) => ({}));

export const showcaseTemplatesRelations = relations(showcaseTemplates, ({ many }) => ({}));

export const showcaseCommentsRelations = relations(showcaseComments, ({ one, many }) => ({
  showcaseItem: one(showcaseItems, {
    fields: [showcaseComments.showcaseItemId],
    references: [showcaseItems.id],
  }),
  parentComment: one(showcaseComments, {
    fields: [showcaseComments.parentCommentId],
    references: [showcaseComments.id],
  }),
  replies: many(showcaseComments),
}));

export const showcaseAnalyticsRelations = relations(showcaseAnalytics, ({ one }) => ({
  showcaseItem: one(showcaseItems, {
    fields: [showcaseAnalytics.showcaseItemId],
    references: [showcaseItems.id],
  }),
  configuration: one(showcaseConfigurations, {
    fields: [showcaseAnalytics.configurationId],
    references: [showcaseConfigurations.id],
  }),
}));

export const clientGallerySessionsRelations = relations(clientGallerySessions, ({ many }) => ({
  selections: many(clientSelections),
  activityLog: many(sessionActivityLog),
  notifications: many(sessionNotifications),
}));

export const clientSelectionsRelations = relations(clientSelections, ({ one }) => ({
  session: one(clientGallerySessions, {
    fields: [clientSelections.sessionId],
    references: [clientGallerySessions.id],
  }),
  showcaseItem: one(showcaseItems, {
    fields: [clientSelections.showcaseItemId],
    references: [showcaseItems.id],
  }),
}));

export const sessionActivityLogRelations = relations(sessionActivityLog, ({ one }) => ({
  session: one(clientGallerySessions, {
    fields: [sessionActivityLog.sessionId],
    references: [clientGallerySessions.id],
  }),
}));

export const sessionNotificationsRelations = relations(sessionNotifications, ({ one }) => ({
  session: one(clientGallerySessions, {
    fields: [sessionNotifications.sessionId],
    references: [clientGallerySessions.id],
  }),
}));

// FASE 3: Smart Albums Relations
export const smartAlbumsRelations = relations(smartAlbums, ({ many }) => ({
  albumItems: many(smartAlbumItems),
}));

export const smartAlbumItemsRelations = relations(smartAlbumItems, ({ one }) => ({
  album: one(smartAlbums, {
    fields: [smartAlbumItems.albumId],
    references: [smartAlbums.id],
  }),
  showcaseItem: one(showcaseItems, {
    fields: [smartAlbumItems.showcaseItemId],
    references: [showcaseItems.id],
  }),
}));

// Zod Schemas
export const insertShowcaseConfigurationSchema = createInsertSchema(showcaseConfigurations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertShowcaseItemSchema = createInsertSchema(showcaseItems).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertShowcaseCategorySchema = createInsertSchema(showcaseCategories).omit({
  id: true,
  createdAt: true,
});

export const insertShowcaseTemplateSchema = createInsertSchema(showcaseTemplates).omit({
  id: true,
  createdAt: true,
});

export const insertShowcaseCommentSchema = createInsertSchema(showcaseComments).omit({
  id: true,
  createdAt: true,
});

export const insertShowcaseAnalyticsSchema = createInsertSchema(showcaseAnalytics).omit({
  id: true,
  createdAt: true,
});

export const insertClientGallerySessionSchema = createInsertSchema(clientGallerySessions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastAccessedAt: true,
});

export const insertClientSelectionSchema = createInsertSchema(clientSelections).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSessionActivityLogSchema = createInsertSchema(sessionActivityLog).omit({
  id: true,
  createdAt: true,
});

export const insertSessionNotificationSchema = createInsertSchema(sessionNotifications).omit({
  id: true,
  createdAt: true,
});

// FASE 3: Smart Albums Zod Schemas
export const insertSmartAlbumSchema = createInsertSchema(smartAlbums).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSmartAlbumItemSchema = createInsertSchema(smartAlbumItems).omit({
  id: true,
  addedAt: true,
});

// TypeScript Types
export type InsertShowcaseConfiguration = z.infer<typeof insertShowcaseConfigurationSchema>;
export type ShowcaseConfiguration = typeof showcaseConfigurations.$inferSelect;

export type InsertShowcaseItem = z.infer<typeof insertShowcaseItemSchema>;
export type ShowcaseItem = typeof showcaseItems.$inferSelect;

export type InsertShowcaseCategory = z.infer<typeof insertShowcaseCategorySchema>;
export type ShowcaseCategory = typeof showcaseCategories.$inferSelect;

export type InsertShowcaseTemplate = z.infer<typeof insertShowcaseTemplateSchema>;
export type ShowcaseTemplate = typeof showcaseTemplates.$inferSelect;

export type InsertShowcaseComment = z.infer<typeof insertShowcaseCommentSchema>;
export type ShowcaseComment = typeof showcaseComments.$inferSelect;

export type InsertShowcaseAnalytics = z.infer<typeof insertShowcaseAnalyticsSchema>;
export type ShowcaseAnalytics = typeof showcaseAnalytics.$inferSelect;

export type InsertClientGallerySession = z.infer<typeof insertClientGallerySessionSchema>;
export type ClientGallerySession = typeof clientGallerySessions.$inferSelect;

export type InsertClientSelection = z.infer<typeof insertClientSelectionSchema>;
export type ClientSelection = typeof clientSelections.$inferSelect;

export type InsertSessionActivityLog = z.infer<typeof insertSessionActivityLogSchema>;
export type SessionActivityLog = typeof sessionActivityLog.$inferSelect;

export type InsertSessionNotification = z.infer<typeof insertSessionNotificationSchema>;
export type SessionNotification = typeof sessionNotifications.$inferSelect;

// FASE 3: Smart Albums TypeScript Types
export type InsertSmartAlbum = z.infer<typeof insertSmartAlbumSchema>;
export type SmartAlbum = typeof smartAlbums.$inferSelect;

export type InsertSmartAlbumItem = z.infer<typeof insertSmartAlbumItemSchema>;
export type SmartAlbumItem = typeof smartAlbumItems.$inferSelect;

// Built-in Templates for Each Profession
export const builtInTemplates = {
  photographer: [
    {
      name: 'Elegant Gallery',
      description: 'Classic grid layout with hover effects',
      configuration: {
        layoutType: 'grid',
        columnsDesktop: 3,
        hoverEffect: 'zoom',
        enableLightbox: true,
        primaryColor: '#FF6B35',
      },
    },
    {
      name: 'Magazine Style',
      description: 'Magazine-style layout with varied sizes',
      configuration: {
        layoutType: 'masonry',
        columnsDesktop: 4,
        hoverEffect: 'fade',
        showDescriptions: true,
        primaryColor: '#2C3E50',
      },
    },
    {
      name: 'Minimal Portfolio',
      description: 'Clean, minimal design focused on images',
      configuration: {
        layoutType: 'grid',
        columnsDesktop: 2,
        showTitles: false,
        showClientNames: false,
        backgroundColor: '#f8f9fa',
      },
    },
  ],
  videographer: [
    {
      name: 'Cinema Showcase',
      description: 'Wide format for video content',
      configuration: {
        layoutType: 'full_width',
        aspectRatio: '21:9',
        hoverEffect: 'slide',
        primaryColor: '#E74C3C',
      },
    },
    {
      name: 'Video Grid',
      description: 'Grid layout optimized for video thumbnails',
      configuration: {
        layoutType: 'grid',
        columnsDesktop: 3,
        aspectRatio: '16:9',
        showDates: true,
        primaryColor: '#8E44AD',
      },
    },
  ],
  music_producer: [
    {
      name: 'Audio Waves',
      description: 'Audio-focused layout with waveform previews',
      configuration: {
        layoutType: 'list',
        showDescriptions: true,
        enableDownload: true,
        primaryColor: '#9B59B6',
      },
    },
    {
      name: 'Album Collection',
      description: 'Album-style grid for music releases',
      configuration: {
        layoutType: 'grid',
        columnsDesktop: 4,
        aspectRatio: 'square',
        primaryColor: '#1DB954',
      },
    },
  ],
  vendor: [
    {
      name: 'Product Catalog',
      description: 'E-commerce style product showcase',
      configuration: {
        layoutType: 'grid',
        columnsDesktop: 4,
        showDescriptions: true,
        enableShare: true,
        primaryColor: '#007bff',
      },
    },
  ],
};

// FASE 1: Proofing System - Client selection with deadlines and counting
export const proofingSessions = pgTable('proofing_sessions', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  showcaseId: varchar('showcase_id').notNull(),
  clientName: varchar('client_name').notNull(),
  clientEmail: varchar('client_email').notNull(),

  // Selection Requirements
  maxSelections: integer('max_selections').notNull().default(60), // "Velg 60 bilder"
  minSelections: integer('min_selections').default(1),
  currentSelections: integer('current_selections').default(0),

  // Deadlines & Status
  deadline: timestamp('deadline').notNull(), // "innen 01.10.2025"
  status: varchar('status')
    .$type<'pending' | 'in_progress' | 'completed' | 'overdue' | 'approved'>()
    .default('pending'),
  round: integer('round').default(1), // R1, R2, R3 etc.

  // Access Control
  accessPin: varchar('access_pin', { length: 6 }), // PIN for easy access
  accessToken: varchar('access_token').notNull(), // Secure token for direct links

  // Instructions & Messages
  instructions: text('instructions'), // Custom message from photographer
  photographerNotes: text('photographer_notes'),
  clientNotes: text('client_notes'),

  // Progress Tracking
  lastActivity: timestamp('last_activity').defaultNow(),
  completedAt: timestamp('completed_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Zod schemas and types for proofing
export const insertProofingSession = createInsertSchema(proofingSessions);
export type ProofingSession = typeof proofingSessions.$inferSelect;
export type InsertProofingSession = typeof proofingSessions.$inferInsert;
