/**
 * Plugin Management Schema
 * Complete schema definitions for plugin licenses, updates, and vendor accounts
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
// PLUGIN LICENSES & UPDATES
// ============================================================================

export const pluginLicenses = pgTable('plugin_licenses', {
  id: uuid('id').primaryKey().defaultRandom(),
  pluginId: varchar('plugin_id').notNull(),
  licenseKey: varchar('license_key').notNull().unique(),
  licenseType: varchar('license_type')
    .$type<'trial' | 'standard' | 'premium' | 'enterprise'>()
    .notNull(),
  userId: varchar('user_id').notNull(),
  status: varchar('status')
    .$type<'active' | 'expired' | 'suspended' | 'cancelled'>()
    .default('active'),
  expiresAt: timestamp('expires_at'),
  activatedAt: timestamp('activated_at').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const pluginUpdates = pgTable('plugin_updates', {
  id: uuid('id').primaryKey().defaultRandom(),
  pluginId: varchar('plugin_id').notNull(),
  version: varchar('version').notNull(),
  updateType: varchar('update_type').$type<'patch' | 'minor' | 'major'>().notNull(),
  changelog: text('changelog'),
  downloadUrl: varchar('download_url').notNull(),
  fileSize: bigint('file_size', { mode: 'number' }).notNull(),
  checksum: varchar('checksum').notNull(),
  isRequired: boolean('is_required').default(false),
  releasedAt: timestamp('released_at').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const pluginNotifications = pgTable('plugin_notifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  pluginId: varchar('plugin_id').notNull(),
  userId: varchar('user_id').notNull(),
  notificationType: varchar('notification_type')
    .$type<'update' | 'license_expiry' | 'security' | 'feature'>()
    .notNull(),
  title: varchar('title').notNull(),
  message: text('message').notNull(),
  isRead: boolean('is_read').default(false),
  actionUrl: varchar('action_url'),
  createdAt: timestamp('created_at').defaultNow(),
  readAt: timestamp('read_at'),
});

// ============================================================================
// VENDOR MANAGEMENT
// ============================================================================

export const pluginVendorAccounts = pgTable('plugin_vendor_accounts', {
  id: uuid('id').primaryKey().defaultRandom(),
  vendorName: varchar('vendor_name').notNull(),
  contactEmail: varchar('contact_email').notNull(),
  companyName: varchar('company_name'),
  website: varchar('website'),
  status: varchar('status').$type<'active' | 'inactive' | 'suspended'>().default('active'),
  apiKey: varchar('api_key').notNull().unique(),
  webhookUrl: varchar('webhook_url'),
  settings: jsonb('settings').notNull().default('{}'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const vendorOnboardingProfiles = pgTable('vendor_onboarding_profiles', {
  id: uuid('id').primaryKey().defaultRandom(),
  vendorId: uuid('vendor_id').notNull(),
  profileData: jsonb('profile_data').notNull(),
  verificationStatus: varchar('verification_status')
    .$type<'pending' | 'verified' | 'rejected'>()
    .default('pending'),
  documents: jsonb('documents').notNull().default('[]'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const vendorOnboardingSteps = pgTable('vendor_onboarding_steps', {
  id: uuid('id').primaryKey().defaultRandom(),
  vendorId: uuid('vendor_id').notNull(),
  stepName: varchar('step_name').notNull(),
  stepOrder: integer('step_order').notNull(),
  isCompleted: boolean('is_completed').default(false),
  completedAt: timestamp('completed_at'),
  stepData: jsonb('step_data').notNull().default('{}'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const vendorProductDownloads = pgTable('vendor_product_downloads', {
  id: uuid('id').primaryKey().defaultRandom(),
  vendorId: uuid('vendor_id').notNull(),
  productId: varchar('product_id').notNull(),
  downloadCount: integer('download_count').default(0),
  lastDownloaded: timestamp('last_downloaded'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const vendorProductReviews = pgTable('vendor_product_reviews', {
  id: uuid('id').primaryKey().defaultRandom(),
  vendorId: uuid('vendor_id').notNull(),
  productId: varchar('product_id').notNull(),
  userId: varchar('user_id').notNull(),
  rating: integer('rating').notNull(),
  review: text('review'),
  isVerified: boolean('is_verified').default(false),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const vendorShowcaseProducts = pgTable('vendor_showcase_products', {
  id: uuid('id').primaryKey().defaultRandom(),
  vendorId: uuid('vendor_id').notNull(),
  productName: varchar('product_name').notNull(),
  productDescription: text('product_description'),
  productType: varchar('product_type').notNull(),
  price: decimal('price'),
  currency: varchar('currency').default('USD'),
  features: jsonb('features').notNull().default('[]'),
  images: jsonb('images').notNull().default('[]'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const vendorShowcaseStats = pgTable('vendor_showcase_stats', {
  id: uuid('id').primaryKey().defaultRandom(),
  vendorId: uuid('vendor_id').notNull(),
  productId: uuid('product_id').notNull(),
  views: integer('views').default(0),
  downloads: integer('downloads').default(0),
  reviews: integer('reviews').default(0),
  averageRating: decimal('average_rating'),
  lastUpdated: timestamp('last_updated').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// ============================================================================
// MUSIC PRODUCER PLUGINS
// ============================================================================

export const musicProducerPlugins = pgTable('music_producer_plugins', {
  id: uuid('id').primaryKey().defaultRandom(),
  pluginName: varchar('plugin_name').notNull(),
  pluginType: varchar('plugin_type').notNull(),
  manufacturer: varchar('manufacturer').notNull(),
  version: varchar('version').notNull(),
  category: varchar('category').notNull(),
  description: text('description'),
  price: decimal('price'),
  currency: varchar('currency').default('USD'),
  downloadUrl: varchar('download_url'),
  isFree: boolean('is_free').default(false),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// ============================================================================
// PACKAGES & DEPENDENCIES
// ============================================================================

export const packages = pgTable('packages', {
  id: uuid('id').primaryKey().defaultRandom(),
  packageName: varchar('package_name').notNull().unique(),
  packageType: varchar('package_type').notNull(),
  version: varchar('version').notNull(),
  description: text('description'),
  dependencies: jsonb('dependencies').notNull().default('[]'),
  isActive: boolean('is_active').default(true),
  lastUpdated: timestamp('last_updated').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// ============================================================================
// RELATIONS
// ============================================================================

export const pluginLicensesRelations = relations(pluginLicenses, ({ many }) => ({
  notifications: many(pluginNotifications),
}));

export const pluginNotificationsRelations = relations(pluginNotifications, ({ one }) => ({
  license: one(pluginLicenses, {
    fields: [pluginNotifications.pluginId],
    references: [pluginLicenses.pluginId],
  }),
}));

export const pluginVendorAccountsRelations = relations(pluginVendorAccounts, ({ many }) => ({
  profiles: many(vendorOnboardingProfiles),
  steps: many(vendorOnboardingSteps),
  downloads: many(vendorProductDownloads),
  reviews: many(vendorProductReviews),
  products: many(vendorShowcaseProducts),
  stats: many(vendorShowcaseStats),
}));

export const vendorOnboardingProfilesRelations = relations(vendorOnboardingProfiles, ({ one }) => ({
  vendor: one(pluginVendorAccounts, {
    fields: [vendorOnboardingProfiles.vendorId],
    references: [pluginVendorAccounts.id],
  }),
}));

export const vendorOnboardingStepsRelations = relations(vendorOnboardingSteps, ({ one }) => ({
  vendor: one(pluginVendorAccounts, {
    fields: [vendorOnboardingSteps.vendorId],
    references: [pluginVendorAccounts.id],
  }),
}));

export const vendorProductDownloadsRelations = relations(vendorProductDownloads, ({ one }) => ({
  vendor: one(pluginVendorAccounts, {
    fields: [vendorProductDownloads.vendorId],
    references: [pluginVendorAccounts.id],
  }),
}));

export const vendorProductReviewsRelations = relations(vendorProductReviews, ({ one }) => ({
  vendor: one(pluginVendorAccounts, {
    fields: [vendorProductReviews.vendorId],
    references: [pluginVendorAccounts.id],
  }),
}));

export const vendorShowcaseProductsRelations = relations(
  vendorShowcaseProducts,
  ({ one, many }) => ({
    vendor: one(pluginVendorAccounts, {
      fields: [vendorShowcaseProducts.vendorId],
      references: [pluginVendorAccounts.id],
    }),
    stats: many(vendorShowcaseStats),
  }),
);

export const vendorShowcaseStatsRelations = relations(vendorShowcaseStats, ({ one }) => ({
  vendor: one(pluginVendorAccounts, {
    fields: [vendorShowcaseStats.vendorId],
    references: [pluginVendorAccounts.id],
  }),
  product: one(vendorShowcaseProducts, {
    fields: [vendorShowcaseStats.productId],
    references: [vendorShowcaseProducts.id],
  }),
}));
