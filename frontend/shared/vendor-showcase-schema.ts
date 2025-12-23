import { sql } from 'drizzle-orm';
import { boolean, index, integer, pgTable, text, timestamp, varchar } from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';

// Vendor Showcase Products tabell - Dedikert til vendor showcase
export const vendorShowcaseProducts = pgTable(
  'vendor_showcase_products',
  {
    id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
    vendorId: varchar('vendor_id').notNull(),
    vendorName: varchar('vendor_name'),
    productName: varchar('product_name').notNull(),
    productType: varchar('product_type').notNull(), // plugin, sample_pack, preset, software, hardware
    price: integer('price').default(0), // i øre/cents
    description: text('description'),
    imageUrl: varchar('image_url'),
    audioSamples: text('audio_samples').array().default([]),
    videoSamples: text('video_samples').array().default([]),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => [
    index('idx_vendor_showcase_vendor_id').on(table.vendorId),
    index('idx_vendor_showcase_product_type').on(table.productType),
  ],
);

// Vendor Showcase Statistics tabell
export const vendorShowcaseStats = pgTable(
  'vendor_showcase_stats',
  {
    id: varchar('id').primaryKey(),
    vendorId: varchar('vendor_id').notNull(),
    totalProducts: integer('total_products').default(0),
    totalDownloads: integer('total_downloads').default(0),
    totalRevenue: integer('total_revenue').default(0), // i øre/cents
    averageRating: integer('average_rating').default(0),
    featuredProducts: integer('featured_products').default(0),
    activeProducts: integer('active_products').default(0),
    popularityScore: integer('popularity_score').default(0),
    lastCalculated: timestamp('last_calculated').defaultNow(),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => [
    index('idx_vendor_showcase_stats_vendor_id').on(table.vendorId),
    index('idx_vendor_showcase_stats_score').on(table.popularityScore),
    index('idx_vendor_showcase_stats_revenue').on(table.totalRevenue),
  ],
);

// Product Reviews tabell
export const vendorProductReviews = pgTable(
  'vendor_product_reviews',
  {
    id: varchar('id').primaryKey(),
    productId: varchar('product_id').notNull(),
    userId: varchar('user_id').notNull(),
    userName: varchar('user_name').notNull(),
    rating: integer('rating').notNull(), // 1-5 stars
    title: varchar('title'),
    comment: text('comment'),
    verified: boolean('verified').default(false), // Verified purchase
    helpful: integer('helpful').default(0), // Helpful votes
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => [
    index('idx_vendor_reviews_product_id').on(table.productId),
    index('idx_vendor_reviews_user_id').on(table.userId),
    index('idx_vendor_reviews_rating').on(table.rating),
    index('idx_vendor_reviews_verified').on(table.verified),
  ],
);

// Product Downloads tabell - Track download analytics
export const vendorProductDownloads = pgTable(
  'vendor_product_downloads',
  {
    id: varchar('id').primaryKey(),
    productId: varchar('product_id').notNull(),
    userId: varchar('user_id'),
    ipAddress: varchar('ip_address'),
    userAgent: text('user_agent'),
    downloadDate: timestamp('download_date').defaultNow(),
    fileSize: integer('file_size'),
    downloadDuration: integer('download_duration'), // seconds
    completed: boolean('completed').default(false),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => [
    index('idx_vendor_downloads_product_id').on(table.productId),
    index('idx_vendor_downloads_user_id').on(table.userId),
    index('idx_vendor_downloads_date').on(table.downloadDate),
    index('idx_vendor_downloads_completed').on(table.completed),
  ],
);

// Zod schemas for validation
export const insertVendorShowcaseProductSchema = createInsertSchema(vendorShowcaseProducts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertVendorShowcaseStatsSchema = createInsertSchema(vendorShowcaseStats).omit({
  id: true,
  lastCalculated: true,
  createdAt: true,
  updatedAt: true,
});

export const insertVendorProductReviewSchema = createInsertSchema(vendorProductReviews).omit({
  id: true,
  helpful: true,
  createdAt: true,
  updatedAt: true,
});

export const insertVendorProductDownloadSchema = createInsertSchema(vendorProductDownloads).omit({
  id: true,
  createdAt: true,
});

// Types
export type VendorShowcaseProduct = typeof vendorShowcaseProducts.$inferSelect;
export type InsertVendorShowcaseProduct = z.infer<typeof insertVendorShowcaseProductSchema>;

export type VendorShowcaseStats = typeof vendorShowcaseStats.$inferSelect;
export type InsertVendorShowcaseStats = z.infer<typeof insertVendorShowcaseStatsSchema>;

export type VendorProductReview = typeof vendorProductReviews.$inferSelect;
export type InsertVendorProductReview = z.infer<typeof insertVendorProductReviewSchema>;

export type VendorProductDownload = typeof vendorProductDownloads.$inferSelect;
export type InsertVendorProductDownload = z.infer<typeof insertVendorProductDownloadSchema>;
