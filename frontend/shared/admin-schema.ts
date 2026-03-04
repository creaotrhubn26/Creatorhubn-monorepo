import {
  pgTable,
  varchar,
  text,
  timestamp,
  integer,
  boolean,
  jsonb,
  decimal,
  uuid,
  serial,
  index,
} from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { sql } from 'drizzle-orm';
import type { z } from 'zod';

// Utvidet produktschema basert på spesifikasjonen
export const products = pgTable('products', {
  id: uuid('id').primaryKey().defaultRandom(),
  type: varchar('type', { length: 50 }).notNull(), // camera | lens | accessory
  brand: varchar('brand', { length: 100 }).notNull(),
  series: varchar('series', { length: 100 }),
  model: varchar('model', { length: 200 }).notNull(),
  mount: varchar('mount', { length: 50 }), // RF, E, Z, X
  sensorFormat: varchar('sensor_format', { length: 50 }), // FF, APS-C, MFT
  announcedAt: timestamp('announced_at'),
  releasedAt: timestamp('released_at'),
  discontinuedAt: timestamp('discontinued_at'),

  // Tekniske spesifikasjoner (JSONB for fleksibilitet)
  technicalSpecs: jsonb('technical_specs').$type<{
    mp?: number;
    isoRange?: string;
    shutterRange?: string;
    weightG?: number;
    sizeMm?: string;
    stabilization?: boolean;
    videoSpecs?: string;
    codecProfiles?: string[];
  }>(),

  // Kilde og opphavsrett
  sourceUrl: text('source_url'),
  license: varchar('license', { length: 50 }), // proprietary | cc-by | editorial-use-only
  attribution: text('attribution'),

  // SEO
  slug: varchar('slug', { length: 300 }).notNull().unique(),
  metaTitle: varchar('meta_title', { length: 200 }),
  metaDescription: text('meta_description'),

  // Revisjon
  version: integer('version').default(1),
  lastScrapedAt: timestamp('last_scraped_at'),

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Utvidet bildeschema
export const productImages = pgTable('product_images', {
  id: uuid('id').primaryKey().defaultRandom(),
  productId: uuid('product_id')
    .references(() => products.id)
    .notNull(),

  // Bildevinkel og rolle
  angle: varchar('angle', { length: 50 }).notNull(), // front | back | top | left | right | three_quarter | ports | in_hand | with_lens | exploded
  role: varchar('role', { length: 50 }).notNull(), // hero | gallery | thumbnail | lifestyle

  // Filformater og URL-er
  format: varchar('format', { length: 10 }).notNull(), // jpg | png | webp | avif
  urlOriginal: text('url_original').notNull(),
  urlWebp2k: text('url_webp_2k'),
  urlWebp1k: text('url_webp_1k'),
  urlThumb: text('url_thumb'),

  // Bildemetadata
  width: integer('width'),
  height: integer('height'),
  filesize: integer('filesize'),
  colorProfile: varchar('color_profile', { length: 50 }),

  // Deduplisering
  hashPerceptual: varchar('hash_perceptual', { length: 64 }), // pHash

  // Lisens og kilde
  license: varchar('license', { length: 50 }),
  attribution: text('attribution'),
  sourceUrl: text('source_url'),

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Firmware-tabell
export const productFirmware = pgTable('product_firmware', {
  id: uuid('id').primaryKey().defaultRandom(),
  productId: uuid('product_id')
    .references(() => products.id)
    .notNull(),

  version: varchar('version', { length: 50 }).notNull(),
  releasedAt: timestamp('released_at'),
  downloadUrl: text('download_url'),
  releaseNotes: text('release_notes'),
  checksumSha256: varchar('checksum_sha256', { length: 64 }),
  region: varchar('region', { length: 10 }), // US | EU | JP

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Kompatibilitetstabell
export const productCompatibility = pgTable('product_compatibility', {
  id: uuid('id').primaryKey().defaultRandom(),
  productId: uuid('product_id')
    .references(() => products.id)
    .notNull(),
  compatibleWithProductId: uuid('compatible_with_product_id').references(() => products.id),

  // For objektiver
  minFocalMm: integer('min_focal_mm'),
  maxFocalMm: integer('max_focal_mm'),
  apertureMin: decimal('aperture_min', { precision: 3, scale: 1 }),
  apertureMax: decimal('aperture_max', { precision: 3, scale: 1 }),

  notes: text('notes'),

  createdAt: timestamp('created_at').defaultNow(),
});

// Pris og forhandlere
export const productPrices = pgTable('product_prices', {
  id: uuid('id').primaryKey().defaultRandom(),
  productId: uuid('product_id')
    .references(() => products.id)
    .notNull(),

  retailer: varchar('retailer', { length: 100 }).notNull(),
  currency: varchar('currency', { length: 3 }).notNull(),
  price: decimal('price', { precision: 10, scale: 2 }).notNull(),
  url: text('url'),
  lastSeenAt: timestamp('last_seen_at').defaultNow(),

  createdAt: timestamp('created_at').defaultNow(),
});

// Tagging system
export const tags = pgTable('tags', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 50 }).notNull().unique(),
  description: text('description'),

  createdAt: timestamp('created_at').defaultNow(),
});

export const productTags = pgTable('product_tags', {
  id: uuid('id').primaryKey().defaultRandom(),
  productId: uuid('product_id')
    .references(() => products.id)
    .notNull(),
  tagId: uuid('tag_id')
    .references(() => tags.id)
    .notNull(),

  createdAt: timestamp('created_at').defaultNow(),
});

// Zod schemas for validation
export const insertProductSchema = createInsertSchema(products);
export const insertProductImageSchema = createInsertSchema(productImages);
export const insertProductFirmwareSchema = createInsertSchema(productFirmware);
export const insertProductCompatibilitySchema = createInsertSchema(productCompatibility);
export const insertProductPriceSchema = createInsertSchema(productPrices);
export const insertTagSchema = createInsertSchema(tags);

// Types
export type Product = typeof products.$inferSelect;
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type ProductImage = typeof productImages.$inferSelect;
export type InsertProductImage = z.infer<typeof insertProductImageSchema>;
export type ProductFirmware = typeof productFirmware.$inferSelect;
export type InsertProductFirmware = z.infer<typeof insertProductFirmwareSchema>;
export type ProductCompatibility = typeof productCompatibility.$inferSelect;
export type ProductPrice = typeof productPrices.$inferSelect;
export type Tag = typeof tags.$inferSelect;

// Admin action usage statistics for intelligent SpeedDial sorting
export const adminActionUsageStats = pgTable('admin_action_usage_stats', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  sessionId: varchar('session_id').notNull(),
  actionName: varchar('action_name').notNull(),
  usageCount: integer('usage_count').default(1),
  lastUsed: timestamp('last_used').defaultNow(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Admin smart learning preferences for UI optimization
export const adminSmartPreferences = pgTable('admin_smart_preferences', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  sessionId: varchar('session_id').notNull().unique(),
  sortingPreference: varchar('sorting_preference').default('smart'), // 'smart', 'priority', 'alphabetical'
  learningMode: boolean('learning_mode').default(true),
  totalActions: integer('total_actions').default(0),
  speedDialOrder: jsonb('speed_dial_order'), // Custom order array
  hiddenActions: jsonb('hidden_actions'), // Hidden action array
  lastOptimization: timestamp('last_optimization').defaultNow(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Zod schemas for admin features
export const insertAdminActionUsageStatsSchema = createInsertSchema(adminActionUsageStats);
export const insertAdminSmartPreferencesSchema = createInsertSchema(adminSmartPreferences);

// Types for admin features
export type AdminActionUsageStats = typeof adminActionUsageStats.$inferSelect;
export type InsertAdminActionUsageStats = z.infer<typeof insertAdminActionUsageStatsSchema>;
export type AdminSmartPreferences = typeof adminSmartPreferences.$inferSelect;
export type InsertAdminSmartPreferences = z.infer<typeof insertAdminSmartPreferencesSchema>;

// Enums for validation
export const productTypes = ['camera', 'lens', 'accessory'] as const;
export const imageAngles = [
  'front',
  'back',
  'top',
  'left',
  'right',
  'three_quarter',
  'ports',
  'in_hand',
  'with_lens',
  'exploded',
] as const;
export const imageRoles = ['hero', 'gallery', 'thumbnail', 'lifestyle'] as const;
export const licenseTypes = ['proprietary', 'cc-by', 'editorial-use-only'] as const;
export const sensorFormats = ['FF', 'APS-C', 'MFT', '1-inch', '2/3-inch'] as const;
export const mountTypes = ['RF', 'EF', 'E', 'FE', 'Z', 'F', 'X', 'MFT', 'L'] as const;
