/**
 * CreatorHub Norge - Price Administration Schema
 * Complete PostgreSQL schema for price administration with OCR receipts
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
  serial,
  index,
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';

// Price Administration Tables

// Pricing structures table
export const pricingStructures = pgTable(
  'pricing_structures',
  {
    id: serial('id').primaryKey(),
    name: varchar('name', { length: 255 }).notNull(),
    type: varchar('type', { length: 50 }).notNull(), // hourly, daily, package, fixed
    category: varchar('category', { length: 100 }).notNull(), // fotografi, videografi, musikk
    profession: varchar('profession', { length: 50 }).notNull(),
    userId: varchar('user_id', { length: 255 }).notNull(),

    // Pricing details
    hourlyRate: decimal('hourly_rate', { precision: 10, scale: 2 }),
    fullDayRate: decimal('full_day_rate', { precision: 10, scale: 2 }),
    basePrice: decimal('base_price', { precision: 10, scale: 2 }),
    minimumPrice: decimal('minimum_price', { precision: 10, scale: 2 }),
    maximumPrice: decimal('maximum_price', { precision: 10, scale: 2 }),

    // Additional details
    seasonFactor: decimal('season_factor', { precision: 3, scale: 2 }).default('1.00'),
    description: text('description'),
    includedServices: jsonb('included_services'),
    extraCosts: jsonb('extra_costs'),

    // Status and metadata
    status: varchar('status', { length: 20 }).default('active'),
    isDefault: boolean('is_default').default(false),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    userIdIdx: index('pricing_structures_user_id_idx').on(table.userId),
    categoryIdx: index('pricing_structures_category_idx').on(table.category),
    professionIdx: index('pricing_structures_profession_idx').on(table.profession),
  }),
);

// Packages table
export const packages = pgTable(
  'packages',
  {
    id: serial('id').primaryKey(),
    name: varchar('name', { length: 255 }).notNull(),
    category: varchar('category', { length: 100 }).notNull(),
    profession: varchar('profession', { length: 50 }).notNull(),
    userId: varchar('user_id', { length: 255 }).notNull(),

    // Package details
    basePrice: decimal('base_price', { precision: 10, scale: 2 }).notNull(),
    description: text('description'),
    inclusions: jsonb('inclusions'), // hours, images, videos, editing, etc.

    // Package metadata
    popular: boolean('popular').default(false),
    status: varchar('status', { length: 20 }).default('active'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    userIdIdx: index('packages_user_id_idx').on(table.userId),
    categoryIdx: index('packages_category_idx').on(table.category),
    professionIdx: index('packages_profession_idx').on(table.profession),
  }),
);

// Additional costs table
export const additionalCosts = pgTable(
  'additional_costs',
  {
    id: serial('id').primaryKey(),
    name: varchar('name', { length: 255 }).notNull(),
    type: varchar('type', { length: 50 }).notNull(), // travel, equipment, service
    profession: varchar('profession', { length: 50 }).notNull(),
    userId: varchar('user_id', { length: 255 }).notNull(),

    // Cost details
    cost: decimal('cost', { precision: 10, scale: 2 }),
    unit: varchar('unit', { length: 50 }), // per km, per hour, fixed
    description: text('description'),

    // Metadata
    status: varchar('status', { length: 20 }).default('active'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    userIdIdx: index('additional_costs_user_id_idx').on(table.userId),
    typeIdx: index('additional_costs_type_idx').on(table.type),
  }),
);

// Discounts table
export const discounts = pgTable(
  'discounts',
  {
    id: serial('id').primaryKey(),
    name: varchar('name', { length: 255 }).notNull(),
    discountCode: varchar('discount_code', { length: 50 }),
    profession: varchar('profession', { length: 50 }).notNull(),
    userId: varchar('user_id', { length: 255 }).notNull(),

    // Discount details
    discountValue: decimal('discount_value', {
      precision: 10,
      scale: 2,
    }).notNull(),
    isPercentage: boolean('is_percentage').default(true),
    minimumAmount: decimal('minimum_amount', { precision: 10, scale: 2 }),

    // Validity
    validFrom: timestamp('valid_from'),
    validUntil: timestamp('valid_until'),

    // Metadata
    status: varchar('status', { length: 20 }).default('active'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    userIdIdx: index('discounts_user_id_idx').on(table.userId),
    discountCodeIdx: index('discounts_code_idx').on(table.discountCode),
  }),
);

// OCR Receipts table
export const ocrReceipts = pgTable(
  'ocr_receipts',
  {
    id: serial('id').primaryKey(),
    receiptId: varchar('receipt_id', { length: 255 }).notNull().unique(),
    userId: varchar('user_id', { length: 255 }).notNull(),

    // OCR extracted data
    merchant: varchar('merchant', { length: 255 }),
    amount: decimal('amount', { precision: 10, scale: 2 }),
    currency: varchar('currency', { length: 3 }).default('NOK'),
    receiptDate: date('receipt_date'),
    category: varchar('category', { length: 100 }),

    // OCR metadata
    originalText: text('original_text'),
    confidence: varchar('confidence', { length: 10 }), // high, medium, low
    source: varchar('source', { length: 20 }), // camera, upload

    // File information
    fileType: varchar('file_type', { length: 10 }), // PDF, JPG, PNG
    googleDriveUrl: text('google_drive_url'),
    googleDriveFileId: varchar('google_drive_file_id', { length: 255 }),

    // Processing status
    manuallyVerified: boolean('manually_verified').default(false),
    verified: boolean('verified').default(false),
    notes: text('notes'),

    // Archive information
    archiveFolder: varchar('archive_folder', { length: 255 }),
    monthYear: varchar('month_year', { length: 20 }),

    // Timestamps
    scannedAt: timestamp('scanned_at').notNull(),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    userIdIdx: index('ocr_receipts_user_id_idx').on(table.userId),
    receiptIdIdx: index('ocr_receipts_receipt_id_idx').on(table.receiptId),
    categoryIdx: index('ocr_receipts_category_idx').on(table.category),
    monthYearIdx: index('ocr_receipts_month_year_idx').on(table.monthYear),
    scannedAtIdx: index('ocr_receipts_scanned_at_idx').on(table.scannedAt),
  }),
);

// Travel log table (kjørebok)
export const travelLog = pgTable(
  'travel_log',
  {
    id: serial('id').primaryKey(),
    userId: varchar('user_id', { length: 255 }).notNull(),

    // Trip details
    date: date('date').notNull(),
    fromLocation: varchar('from_location', { length: 255 }).notNull(),
    toLocation: varchar('to_location', { length: 255 }).notNull(),
    distance: decimal('distance', { precision: 8, scale: 2 }).notNull(), // km
    purpose: varchar('purpose', { length: 255 }).notNull(),
    projectId: varchar('project_id', { length: 255 }),

    // Vehicle information
    vehicle: varchar('vehicle', { length: 255 }).notNull(),
    vehicleType: varchar('vehicle_type', { length: 50 }).notNull(), // bil, elbil, motorsykkel

    // Norwegian tax rates and calculations
    ratePerKm: decimal('rate_per_km', { precision: 5, scale: 2 }).notNull(),
    travelAmount: decimal('travel_amount', {
      precision: 10,
      scale: 2,
    }).notNull(),

    // Additional costs
    fuelLiters: decimal('fuel_liters', { precision: 6, scale: 2 }),
    fuelCost: decimal('fuel_cost', { precision: 10, scale: 2 }),
    tollCost: decimal('toll_cost', { precision: 10, scale: 2 }), // bompenger
    parkingCost: decimal('parking_cost', { precision: 10, scale: 2 }),
    otherCosts: decimal('other_costs', { precision: 10, scale: 2 }),
    totalCost: decimal('total_cost', { precision: 10, scale: 2 }).notNull(),

    // Tax deduction
    isDeductible: boolean('is_deductible').default(false),

    // Metadata
    notes: text('notes'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    userIdIdx: index('travel_log_user_id_idx').on(table.userId),
    dateIdx: index('travel_log_date_idx').on(table.date),
    projectIdx: index('travel_log_project_id_idx').on(table.projectId),
  }),
);

// Google integration settings
export const googleIntegrationSettings = pgTable(
  'google_integration_settings',
  {
    id: serial('id').primaryKey(),
    userId: varchar('user_id', { length: 255 }).notNull().unique(),

    // Google Drive folder IDs
    priceAdminFolderId: varchar('price_admin_folder_id', { length: 255 }),
    receiptsFolderId: varchar('receipts_folder_id', { length: 255 }),

    // Google Sheets IDs
    priceAdminSpreadsheetId: varchar('price_admin_spreadsheet_id', {
      length: 255,
    }),

    // Settings
    autoSyncEnabled: boolean('auto_sync_enabled').default(true),
    lastSyncAt: timestamp('last_sync_at'),

    // Timestamps
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    userIdIdx: index('google_integration_user_id_idx').on(table.userId),
  }),
);

// Relations
export const pricingStructuresRelations = relations(pricingStructures, ({ many }) => ({
  packages: many(packages),
}));

export const packagesRelations = relations(packages, ({ one }) => ({
  pricingStructure: one(pricingStructures),
}));

export const ocrReceiptsRelations = relations(ocrReceipts, ({ one }) => ({
  googleSettings: one(googleIntegrationSettings),
}));

export const travelLogRelations = relations(travelLog, ({ one }) => ({
  googleSettings: one(googleIntegrationSettings),
}));

// Type exports
export type PricingStructure = typeof pricingStructures.$inferSelect;
export type InsertPricingStructure = typeof pricingStructures.$inferInsert;

export type Package = typeof packages.$inferSelect;
export type InsertPackage = typeof packages.$inferInsert;

export type AdditionalCost = typeof additionalCosts.$inferSelect;
export type InsertAdditionalCost = typeof additionalCosts.$inferInsert;

export type Discount = typeof discounts.$inferSelect;
export type InsertDiscount = typeof discounts.$inferInsert;

export type OcrReceipt = typeof ocrReceipts.$inferSelect;
export type InsertOcrReceipt = typeof ocrReceipts.$inferInsert;

export type TravelLogEntry = typeof travelLog.$inferSelect;
export type InsertTravelLogEntry = typeof travelLog.$inferInsert;

export type GoogleIntegrationSettings = typeof googleIntegrationSettings.$inferSelect;
export type InsertGoogleIntegrationSettings = typeof googleIntegrationSettings.$inferInsert;

// Zod schemas for validation
export const insertPricingStructureSchema = createInsertSchema(pricingStructures);
export const insertPackageSchema = createInsertSchema(packages);
export const insertAdditionalCostSchema = createInsertSchema(additionalCosts);
export const insertDiscountSchema = createInsertSchema(discounts);
export const insertOcrReceiptSchema = createInsertSchema(ocrReceipts);
export const insertTravelLogEntrySchema = createInsertSchema(travelLog);
export const insertGoogleIntegrationSettingsSchema = createInsertSchema(googleIntegrationSettings);
