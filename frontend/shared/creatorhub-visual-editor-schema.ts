/**
 * CreatorHub Visual Editor Schema
 * Complete schema definitions for all Visual Editor components
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
// CORE BUSINESS ENTITIES
// ============================================================================

export const meetings = pgTable('meetings', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: varchar('title').notNull(),
  date: timestamp('date').notNull(),
  participants: jsonb('participants').notNull().default('[]'),
  agenda: jsonb('agenda').notNull().default('[]'),
  notes: text('notes'),
  recordingUrl: varchar('recording_url'),
  status: varchar('status')
    .$type<'scheduled' | 'in-progress' | 'completed' | 'cancelled'>()
    .default('scheduled'),
  description: text('description'),
  clientName: varchar('client_name'),
  startTime: varchar('start_time'),
  clientEmail: varchar('client_email'),
  endTime: varchar('end_time'),
  type: varchar('type'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const worklogs = pgTable('worklogs', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull(),
  task: varchar('task').notNull(),
  description: text('description').notNull(),
  timeSpent: integer('time_spent').notNull().default(0),
  date: timestamp('date').notNull(),
  status: varchar('status').$type<'in-progress' | 'completed'>().default('in-progress'),
  tags: jsonb('tags').notNull().default('[]'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const clients = pgTable('clients', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name').notNull(),
  email: varchar('email').notNull(),
  phone: varchar('phone'),
  company: varchar('company'),
  address: text('address'),
  notes: text('notes'),
  status: varchar('status').$type<'active' | 'inactive' | 'prospect'>().default('active'),
  projects: jsonb('projects').notNull().default('[]'),
  lastContact: timestamp('last_contact'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const fileUploads = pgTable('file_uploads', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name').notNull(),
  type: varchar('type').notNull(),
  size: bigint('size', { mode: 'number' }).notNull(),
  url: varchar('url').notNull(),
  uploadedAt: timestamp('uploaded_at').defaultNow(),
  projectId: uuid('project_id'),
  clientId: uuid('client_id'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const fileDownloads = pgTable('file_downloads', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name').notNull(),
  type: varchar('type').notNull(),
  size: bigint('size', { mode: 'number' }).notNull(),
  url: varchar('url').notNull(),
  downloadedAt: timestamp('downloaded_at').defaultNow(),
  projectId: uuid('project_id'),
  clientId: uuid('client_id'),
  filename: varchar('filename'),
  exportedAt: timestamp('exported_at'),
  source: varchar('source'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const mediaAssets = pgTable('media_assets', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name').notNull(),
  type: varchar('type').notNull(),
  url: varchar('url').notNull(),
  thumbnailUrl: varchar('thumbnail_url'),
  size: bigint('size', { mode: 'number' }).notNull(),
  width: integer('width'),
  height: integer('height'),
  duration: integer('duration'),
  format: varchar('format').notNull(),
  uploadedAt: timestamp('uploaded_at').defaultNow(),
  tags: jsonb('tags').notNull().default('[]'),
  metadata: jsonb('metadata').notNull().default('{}'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const settings = pgTable('settings', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: varchar('user_id').notNull(),
  theme: varchar('theme').default('light'),
  language: varchar('language').default('en'),
  timezone: varchar('timezone').default('UTC'),
  notifications: boolean('notifications').default(true),
  autoSave: boolean('auto_save').default(true),
  gridSize: integer('grid_size').default(10),
  snapToGrid: boolean('snap_to_grid').default(true),
  showRulers: boolean('show_rulers').default(true),
  defaultFont: varchar('default_font').default('Arial'),
  defaultFontSize: integer('default_font_size').default(14),
  colorPalette: jsonb('color_palette').notNull().default('[]'),
  shortcuts: jsonb('shortcuts').notNull().default('{}'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// ============================================================================
// VISUAL EDITOR CORE
// ============================================================================

export const editorProjects = pgTable('editor_projects', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name').notNull(),
  elements: jsonb('elements').notNull().default('{}'),
  pageSettings: jsonb('page_settings').notNull().default('{}'),
  userId: varchar('user_id').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const editorElements = pgTable('editor_elements', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull(),
  elementType: varchar('element_type').notNull(),
  xPosition: integer('x_position').notNull(),
  yPosition: integer('y_position').notNull(),
  width: integer('width').notNull(),
  height: integer('height').notNull(),
  styles: jsonb('styles').notNull().default('{}'),
  props: jsonb('props').notNull().default('{}'),
  children: jsonb('children').notNull().default('[]'),
  parentId: uuid('parent_id'),
  icon: varchar('icon'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// ============================================================================
// ANIMATION & EFFECTS
// ============================================================================

export const animations = pgTable('animations', {
  id: uuid('id').primaryKey().defaultRandom(),
  elementId: uuid('element_id').notNull(),
  animationType: varchar('animation_type').notNull(),
  duration: integer('duration').notNull(),
  delay: integer('delay').default(0),
  easing: varchar('easing').notNull(),
  direction: varchar('direction'),
  iterations: integer('iterations'),
  fillMode: varchar('fill_mode'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const hoverEffects = pgTable('hover_effects', {
  id: uuid('id').primaryKey().defaultRandom(),
  elementId: uuid('element_id').notNull(),
  effectType: varchar('effect_type').notNull(),
  value: varchar('value').notNull(),
  duration: integer('duration').notNull(),
  easing: varchar('easing').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const clickAnimations = pgTable('click_animations', {
  id: uuid('id').primaryKey().defaultRandom(),
  elementId: uuid('element_id').notNull(),
  animationType: varchar('animation_type').notNull(),
  duration: integer('duration').notNull(),
  intensity: integer('intensity').notNull(),
  easing: varchar('easing').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const parallaxEffects = pgTable('parallax_effects', {
  id: uuid('id').primaryKey().defaultRandom(),
  elementId: uuid('element_id').notNull(),
  speed: decimal('speed').notNull(),
  direction: varchar('direction').notNull(),
  intensity: decimal('intensity').notNull(),
  enabled: boolean('enabled').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const particleSystems = pgTable('particle_systems', {
  id: uuid('id').primaryKey().defaultRandom(),
  elementId: uuid('element_id').notNull(),
  particleType: varchar('particle_type').notNull(),
  count: integer('count').notNull(),
  speed: decimal('speed').notNull(),
  size: decimal('size').notNull(),
  color: varchar('color').notNull(),
  enabled: boolean('enabled').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const scrollAnimations = pgTable('scroll_animations', {
  id: uuid('id').primaryKey().defaultRandom(),
  elementId: uuid('element_id').notNull(),
  triggerPoint: decimal('trigger_point').notNull(),
  animationData: jsonb('animation_data').notNull(),
  enabled: boolean('enabled').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const advancedAnimations = pgTable('advanced_animations', {
  id: uuid('id').primaryKey().defaultRandom(),
  elementId: uuid('element_id').notNull(),
  animationType: varchar('animation_type').notNull(),
  properties: jsonb('properties').notNull(),
  duration: integer('duration').notNull(),
  easing: varchar('easing').notNull(),
  loop: boolean('loop').default(false),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// ============================================================================
// COLLABORATION
// ============================================================================

export const comments = pgTable('comments', {
  id: uuid('id').primaryKey().defaultRandom(),
  author: varchar('author').notNull(),
  content: text('content').notNull(),
  timestamp: timestamp('timestamp').defaultNow(),
  elementId: uuid('element_id').notNull(),
  resolved: boolean('resolved').default(false),
  replies: jsonb('replies').notNull().default('[]'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// ============================================================================
// SEO & ANALYTICS
// ============================================================================

export const seoCrawlResults = pgTable('seo_crawl_results', {
  id: uuid('id').primaryKey().defaultRandom(),
  totalPages: integer('total_pages').notNull(),
  crawledPages: jsonb('crawled_pages').notNull(),
  issues: jsonb('issues').notNull(),
  siteArchitecture: jsonb('site_architecture').notNull(),
  performance: jsonb('performance').notNull(),
  contentAnalysis: jsonb('content_analysis').notNull(),
  technicalSeo: jsonb('technical_seo').notNull(),
  lastCrawled: timestamp('last_crawled').defaultNow(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const seoIssues = pgTable('seo_issues', {
  id: uuid('id').primaryKey().defaultRandom(),
  issueType: varchar('issue_type').notNull(),
  category: varchar('category').notNull(),
  title: varchar('title').notNull(),
  description: text('description').notNull(),
  affectedPages: jsonb('affected_pages').notNull(),
  severity: varchar('severity').notNull(),
  fixable: boolean('fixable').default(false),
  fixSuggestion: text('fix_suggestion'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const crawledPages = pgTable('crawled_pages', {
  id: uuid('id').primaryKey().defaultRandom(),
  url: varchar('url').notNull(),
  title: varchar('title'),
  metaDescription: text('meta_description'),
  headings: jsonb('headings').notNull().default('[]'),
  images: jsonb('images').notNull().default('[]'),
  links: jsonb('links').notNull().default('[]'),
  statusCode: integer('status_code'),
  loadTime: integer('load_time'),
  wordCount: integer('word_count'),
  canonicalUrl: varchar('canonical_url'),
  robotsDirective: varchar('robots_directive'),
  hreflang: jsonb('hreflang').notNull().default('[]'),
  structuredData: jsonb('structured_data').notNull().default('[]'),
  socialMeta: jsonb('social_meta').notNull().default('{}'),
  accessibility: jsonb('accessibility').notNull().default('[]'),
  lastCrawled: timestamp('last_crawled').defaultNow(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const structuredDataItems = pgTable('structured_data_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  pageId: uuid('page_id').notNull(),
  dataType: varchar('data_type').notNull(),
  schema: varchar('schema').notNull(),
  properties: jsonb('properties').notNull(),
  validation: jsonb('validation').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const socialMetaData = pgTable('social_meta_data', {
  id: uuid('id').primaryKey().defaultRandom(),
  pageId: uuid('page_id').notNull(),
  ogTitle: varchar('og_title'),
  ogDescription: text('og_description'),
  ogImage: varchar('og_image'),
  ogType: varchar('og_type'),
  twitterCard: varchar('twitter_card'),
  twitterTitle: varchar('twitter_title'),
  twitterDescription: text('twitter_description'),
  twitterImage: varchar('twitter_image'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const accessibilityChecks = pgTable('accessibility_checks', {
  id: uuid('id').primaryKey().defaultRandom(),
  pageId: uuid('page_id').notNull(),
  checkType: varchar('check_type').notNull(),
  message: text('message').notNull(),
  element: varchar('element'),
  wcagLevel: varchar('wcag_level'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// ============================================================================
// QUALITY ANALYSIS
// ============================================================================

export const qualityAnalysisResults = pgTable('quality_analysis_results', {
  id: uuid('id').primaryKey().defaultRandom(),
  overallScore: integer('overall_score').notNull(),
  categories: jsonb('categories').notNull(),
  criticalIssues: jsonb('critical_issues').notNull().default('[]'),
  warnings: jsonb('warnings').notNull().default('[]'),
  recommendations: jsonb('recommendations').notNull().default('[]'),
  lastAnalyzed: timestamp('last_analyzed').defaultNow(),
  componentAnalyses: jsonb('component_analyses').notNull().default('[]'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const componentAnalyses = pgTable('component_analyses', {
  id: uuid('id').primaryKey().defaultRandom(),
  analysisId: uuid('analysis_id').notNull(),
  componentName: varchar('component_name').notNull(),
  filePath: varchar('file_path').notNull(),
  issues: jsonb('issues').notNull(),
  score: integer('score').notNull(),
  suggestions: jsonb('suggestions').notNull().default('[]'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// ============================================================================
// GOOGLE INTEGRATION
// ============================================================================

export const googleDocs = pgTable('google_docs', {
  id: uuid('id').primaryKey().defaultRandom(),
  documentId: varchar('document_id').notNull().unique(),
  title: varchar('title').notNull(),
  content: text('content'),
  webViewLink: varchar('web_view_link'),
  lastModified: timestamp('last_modified'),
  lastSynced: timestamp('last_synced').defaultNow(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const googlePhotos = pgTable('google_photos', {
  id: uuid('id').primaryKey().defaultRandom(),
  mediaItemId: varchar('media_item_id').notNull().unique(),
  filename: varchar('filename').notNull(),
  mimeType: varchar('mime_type').notNull(),
  baseUrl: varchar('base_url').notNull(),
  width: integer('width'),
  height: integer('height'),
  creationTime: timestamp('creation_time'),
  lastSynced: timestamp('last_synced').defaultNow(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const youtubeVideos = pgTable('youtube_videos', {
  id: uuid('id').primaryKey().defaultRandom(),
  videoId: varchar('video_id').notNull().unique(),
  title: varchar('title').notNull(),
  description: text('description'),
  thumbnailUrl: varchar('thumbnail_url'),
  duration: varchar('duration'),
  viewCount: bigint('view_count', { mode: 'number' }),
  likeCount: bigint('like_count', { mode: 'number' }),
  publishedAt: timestamp('published_at'),
  lastSynced: timestamp('last_synced').defaultNow(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const googleAnalyticsData = pgTable('google_analytics_data', {
  id: uuid('id').primaryKey().defaultRandom(),
  propertyId: varchar('property_id').notNull(),
  data: jsonb('data').notNull(),
  dateRangeStart: timestamp('date_range_start').notNull(),
  dateRangeEnd: timestamp('date_range_end').notNull(),
  lastSynced: timestamp('last_synced').defaultNow(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// ============================================================================
// CONTENT PROCESSING
// ============================================================================

export const pdfDocuments = pgTable('pdf_documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  filename: varchar('filename').notNull(),
  filePath: varchar('file_path').notNull(),
  pageCount: integer('page_count').notNull(),
  textContent: jsonb('text_content').notNull().default('[]'),
  extractedContent: jsonb('extracted_content').notNull().default('[]'),
  processedAt: timestamp('processed_at').defaultNow(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const scrollStories = pgTable('scroll_stories', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name').notNull(),
  description: text('description'),
  elements: jsonb('elements').notNull().default('[]'),
  settings: jsonb('settings').notNull().default('{}'),
  source: varchar('source').notNull(),
  mediaData: jsonb('media_data').notNull().default('[]'),
  googleData: jsonb('google_data').notNull().default('[]'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const textEffects = pgTable('text_effects', {
  id: uuid('id').primaryKey().defaultRandom(),
  elementId: uuid('element_id').notNull(),
  effectType: varchar('effect_type').notNull(),
  value: varchar('value').notNull(),
  color: varchar('color'),
  intensity: integer('intensity'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// ============================================================================
// RELATIONS
// ============================================================================

export const editorElementsRelations = relations(editorElements, ({ one, many }) => ({
  project: one(editorProjects, {
    fields: [editorElements.projectId],
    references: [editorProjects.id],
  }),
  parent: one(editorElements, {
    fields: [editorElements.parentId],
    references: [editorElements.id],
  }),
  children: many(editorElements),
  animations: many(animations),
  hoverEffects: many(hoverEffects),
  clickAnimations: many(clickAnimations),
  parallaxEffects: many(parallaxEffects),
  particleSystems: many(particleSystems),
  scrollAnimations: many(scrollAnimations),
  advancedAnimations: many(advancedAnimations),
  comments: many(comments),
  textEffects: many(textEffects),
}));

export const editorProjectsRelations = relations(editorProjects, ({ many }) => ({
  elements: many(editorElements),
}));

export const meetingsRelations = relations(meetings, ({ many }) => ({
  worklogs: many(worklogs),
}));

export const worklogsRelations = relations(worklogs, ({ one }) => ({
  meeting: one(meetings, {
    fields: [worklogs.projectId],
    references: [meetings.id],
  }),
}));

export const clientsRelations = relations(clients, ({ many }) => ({
  projects: many(editorProjects),
  fileUploads: many(fileUploads),
  fileDownloads: many(fileDownloads),
}));
