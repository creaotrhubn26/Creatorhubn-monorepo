import {
  pgTable,
  text,
  varchar,
  timestamp,
  boolean,
  integer,
  jsonb,
  uuid,
  decimal,
} from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';

// Photographer Client Galleries
export const photographerClientGalleries = pgTable('photographer_client_galleries', {
  id: uuid('id').primaryKey().defaultRandom(),
  photographerId: varchar('photographer_id').notNull(),
  clientName: varchar('client_name').notNull(),
  clientEmail: varchar('client_email').notNull(),
  projectTitle: varchar('project_title').notNull(),
  accessToken: varchar('access_token').notNull().unique(),
  gallerySettings: jsonb('gallery_settings')
    .$type<{
      maxSelections: number;
      pricePerImage: number;
      currency: string;
      contractedImages: number;
      allowDownload: boolean;
      allowComments: boolean;
      watermarkEnabled: boolean;
      expiresAt?: string;
    }>()
    .notNull(),
  status: varchar('status').default('active'), // 'active', 'completed', 'expired', 'suspended'
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  completedAt: timestamp('completed_at'),
});

// Images in Client Galleries
export const clientGalleryImages = pgTable('client_gallery_images', {
  id: uuid('id').primaryKey().defaultRandom(),
  galleryId: uuid('gallery_id').notNull(),
  photographerId: varchar('photographer_id').notNull(),
  imageTitle: varchar('image_title').notNull(),
  imageDescription: text('image_description'),
  thumbnailUrl: varchar('thumbnail_url').notNull(),
  fullSizeUrl: varchar('full_size_url').notNull(),
  watermarkedUrl: varchar('watermarked_url'),
  imageMetadata: jsonb('image_metadata').$type<{
    width: number;
    height: number;
    fileSize: number;
    format: string;
    cameraSettings?: {
      camera: string;
      lens: string;
      iso: number;
      aperture: string;
      shutterSpeed: string;
    };
    location?: string;
    dateTaken?: string;
  }>(),
  tags: jsonb('tags').$type<string[]>().default([]),
  sortOrder: integer('sort_order').default(0),
  isVisible: boolean('is_visible').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Client Image Selections and Favorites
export const clientImageSelections = pgTable('client_image_selections', {
  id: uuid('id').primaryKey().defaultRandom(),
  galleryId: uuid('gallery_id').notNull(),
  imageId: uuid('image_id').notNull(),
  clientEmail: varchar('client_email').notNull(),
  selectionType: varchar('selection_type').notNull(), // 'favorite', 'selected', 'rejected'
  priority: integer('priority').default(0), // For ranking favorites
  clientNotes: text('client_notes'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Client Comments on Images
export const clientImageComments = pgTable('client_image_comments', {
  id: uuid('id').primaryKey().defaultRandom(),
  galleryId: uuid('gallery_id').notNull(),
  imageId: uuid('image_id').notNull(),
  clientName: varchar('client_name').notNull(),
  clientEmail: varchar('client_email').notNull(),
  comment: text('comment').notNull(),
  commentType: varchar('comment_type').default('general'), // 'general', 'edit_request', 'question'
  status: varchar('status').default('open'), // 'open', 'responded', 'resolved'
  photographerResponse: text('photographer_response'),
  respondedAt: timestamp('responded_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Payment Records for Image Downloads
export const clientImagePayments = pgTable('client_image_payments', {
  id: uuid('id').primaryKey().defaultRandom(),
  galleryId: uuid('gallery_id').notNull(),
  clientEmail: varchar('client_email').notNull(),
  photographerId: varchar('photographer_id').notNull(),
  stripePaymentIntentId: varchar('stripe_payment_intent_id'),
  totalAmount: decimal('total_amount', { precision: 10, scale: 2 }).notNull(),
  currency: varchar('currency').default('NOK'),
  additionalImages: integer('additional_images').default(0),
  selectedImageIds: jsonb('selected_image_ids').$type<string[]>().notNull(),
  paymentStatus: varchar('payment_status').default('pending'), // 'pending', 'completed', 'failed', 'refunded'
  paymentDate: timestamp('payment_date'),
  downloadToken: varchar('download_token'),
  downloadExpiresAt: timestamp('download_expires_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Photographer Pricing Settings
export const photographerPricingSettings = pgTable('photographer_pricing_settings', {
  id: uuid('id').primaryKey().defaultRandom(),
  photographerId: varchar('photographer_id').notNull().unique(),
  defaultPricePerImage: decimal('default_price_per_image', {
    precision: 8,
    scale: 2,
  }).default('150.00'),
  currency: varchar('currency').default('NOK'),
  contractSettings: jsonb('contract_settings')
    .$type<{
      defaultIncludedImages: number;
      bulkDiscounts: Array<{
        minImages: number;
        discountPercent: number;
      }>;
      rushDeliveryPrice?: number;
      printRightsPrice?: number;
      commercialRightsPrice?: number;
    }>()
    .default({
      defaultIncludedImages: 50,
      bulkDiscounts: [],
    }),
  paymentTerms: jsonb('payment_terms')
    .$type<{
      acceptsCreditCard: boolean;
      acceptsVipps: boolean;
      acceptsBankTransfer: boolean;
      requiresUpfrontPayment: boolean;
      refundPolicy: string;
    }>()
    .default({
      acceptsCreditCard: true,
      acceptsVipps: true,
      acceptsBankTransfer: false,
      requiresUpfrontPayment: true,
      refundPolicy: 'No refunds after download',
    }),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Schema exports for TypeScript types
export const insertPhotographerClientGallerySchema = createInsertSchema(
  photographerClientGalleries,
);
export const insertClientGalleryImageSchema = createInsertSchema(clientGalleryImages);
export const insertClientImageSelectionSchema = createInsertSchema(clientImageSelections);
export const insertClientImageCommentSchema = createInsertSchema(clientImageComments);
export const insertClientImagePaymentSchema = createInsertSchema(clientImagePayments);
export const insertPhotographerPricingSettingsSchema = createInsertSchema(
  photographerPricingSettings,
);

export type PhotographerClientGallery = typeof photographerClientGalleries.$inferSelect;
export type InsertPhotographerClientGallery = z.infer<typeof insertPhotographerClientGallerySchema>;

export type ClientGalleryImage = typeof clientGalleryImages.$inferSelect;
export type InsertClientGalleryImage = z.infer<typeof insertClientGalleryImageSchema>;

export type ClientImageSelection = typeof clientImageSelections.$inferSelect;
export type InsertClientImageSelection = z.infer<typeof insertClientImageSelectionSchema>;

export type ClientImageComment = typeof clientImageComments.$inferSelect;
export type InsertClientImageComment = z.infer<typeof insertClientImageCommentSchema>;

export type ClientImagePayment = typeof clientImagePayments.$inferSelect;
export type InsertClientImagePayment = z.infer<typeof insertClientImagePaymentSchema>;

export type PhotographerPricingSettings = typeof photographerPricingSettings.$inferSelect;
export type InsertPhotographerPricingSettings = z.infer<
  typeof insertPhotographerPricingSettingsSchema
>;
