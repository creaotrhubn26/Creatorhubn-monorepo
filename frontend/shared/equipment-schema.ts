/**
 * Equipment Management Schema with Camera Integration and Firmware Monitoring
 * Connects onboarding camera selection to comprehensive equipment administration
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
  serial,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';
// Note: equipmentBrands and equipmentModels are defined locally in this file

// User Equipment Registry - Links onboarding to equipment management
export const userEquipment = pgTable('user_equipment', {
  id: serial('id').primaryKey(),
  userId: varchar('user_id').notNull(),
  userType: varchar('user_type'), // Maps to profession: photographer, videographer, music_producer, vendor
  category: varchar('category'), // Maps to equipmentType: camera, lens, audio, lighting, etc.
  brand: varchar('brand').notNull(),
  model: varchar('model').notNull(),
  serialNumber: varchar('serial_number'),
  purchaseDate: varchar('purchase_date'), // Actually stored as date in DB
  purchasePrice: decimal('purchase_price', { precision: 10, scale: 2 }),
  currentValue: decimal('current_value', { precision: 10, scale: 2 }),
  condition: varchar('condition'),
  warrantyExpiry: varchar('warranty_expiry'), // Actually stored as date in DB
  lastMaintenance: varchar('last_maintenance'), // Actually stored as date in DB
  nextMaintenance: varchar('next_maintenance'), // Actually stored as date in DB
  maintenanceInterval: integer('maintenance_interval'),
  firmwareVersion: varchar('firmware_version'),
  notes: text('notes'),
  imageUrl: varchar('image_url'),
  settings: jsonb('settings'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Firmware Updates Database - Sourced from manufacturers
export const firmwareUpdates = pgTable('firmware_updates', {
  id: serial('id').primaryKey(),
  brand: varchar('brand').notNull(),
  model: varchar('model').notNull(),
  category: varchar('category').default('lighting'), // lighting, audio, video, camera

  // Version Information
  version: varchar('version').notNull(),
  updateType: varchar('update_type').default('firmware'), // firmware, software, driver
  releaseDate: timestamp('release_date').notNull(),
  isLatest: boolean('is_latest').default(false),
  isCritical: boolean('is_critical').default(false),

  // Update Details
  downloadUrl: varchar('download_url'),
  downloadSize: varchar('download_size'), // "45.2 MB"
  installationTime: varchar('installation_time'), // "15-20 minutes"

  // Professional Benefits
  photographerBenefits: jsonb('photographer_benefits'), // Array of benefits for photographers
  videographerBenefits: jsonb('videographer_benefits'), // Array of benefits for videographers
  musicProducerBenefits: jsonb('music_producer_benefits'), // Array of benefits for music producers
  generalImprovements: jsonb('general_improvements'), // General improvements
  bugFixes: jsonb('bug_fixes'), // Array of bug fixes
  newFeatures: jsonb('new_features'), // Array of new features

  // Technical Requirements
  requirements: jsonb('requirements'), // System requirements, prerequisites
  compatibility: jsonb('compatibility'), // Compatible accessories, lenses, etc.
  knownIssues: jsonb('known_issues'), // Known issues with this version

  // Installation Instructions
  installationSteps: jsonb('installation_steps'), // Step-by-step installation guide
  rollbackInstructions: jsonb('rollback_instructions'), // How to revert if needed

  // Professional Recommendations
  photographerRecommendation: varchar('photographer_recommendation'), // recommended, optional, critical
  videographerRecommendation: varchar('videographer_recommendation'),
  musicProducerRecommendation: varchar('music_producer_recommendation'),
  riskLevel: varchar('risk_level').default('low'), // low, medium, high

  // Source Information
  sourceUrl: varchar('source_url'), // Manufacturer's release page
  lastVerified: timestamp('last_verified'),

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Equipment Brands Database - moved to main database-persistence-schema.ts to avoid conflicts

// Equipment Models Database - moved to main database-persistence-schema.ts to avoid conflicts

// Comprehensive Lens Database
export const lensDatabase = pgTable('lens_database', {
  id: varchar('id').primaryKey(),
  brand: varchar('brand'),
  model: varchar('model'),
  mount: varchar('mount'), // Canon RF, Sony E, Nikon Z, etc.
  focalLength: varchar('focal_length'), // "24-70mm", "50mm", etc.
  aperture: varchar('aperture'), // "f/2.8", "f/1.4-2.8", etc.
  lensType: varchar('lens_type'), // prime, zoom, macro, telephoto
  weight: varchar('weight'),
  dimensions: varchar('dimensions'),
  imageStabilization: boolean('image_stabilization').default(false),
  weatherSealing: boolean('weather_sealing').default(false),
  autofocus: boolean('autofocus').default(true),
  releaseYear: integer('release_year'),
  msrpPrice: decimal('msrp_price', { precision: 10, scale: 2 }),
  currentPrice: decimal('current_price', { precision: 10, scale: 2 }),
  availability: varchar('availability').default('available'), // available, discontinued, limited
  description: text('description'),
  specifications: jsonb('specifications'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Equipment Maintenance Records
export const equipmentMaintenance = pgTable('equipment_maintenance', {
  id: serial('id').primaryKey(),
  equipmentId: integer('equipment_id').references(() => userEquipment.id),
  userId: varchar('user_id').notNull(),

  // Maintenance Details
  maintenanceType: varchar('maintenance_type').notNull(), // cleaning, calibration, repair, upgrade, inspection
  description: text('description').notNull(),
  serviceProvider: varchar('service_provider'), // Official service, third-party, self-service
  cost: decimal('cost', { precision: 10, scale: 2 }),

  // Scheduling
  scheduledDate: timestamp('scheduled_date'),
  completedDate: timestamp('completed_date'),
  nextScheduledDate: timestamp('next_scheduled_date'),

  // Parts and Labor
  partsReplaced: jsonb('parts_replaced'), // Array of replaced parts
  laborHours: decimal('labor_hours', { precision: 5, scale: 2 }),
  warrantyExtended: boolean('warranty_extended').default(false),

  // Documentation
  receiptUrl: varchar('receipt_url'),
  beforePhotos: jsonb('before_photos'), // Array of photo URLs
  afterPhotos: jsonb('after_photos'), // Array of photo URLs
  serviceNotes: text('service_notes'),

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Equipment Rentals
export const equipmentRentals = pgTable('equipment_rentals', {
  id: serial('id').primaryKey(),
  equipmentId: integer('equipment_id').references(() => userEquipment.id),
  userId: varchar('user_id').notNull(),

  // Rental Details
  rentalCompany: varchar('rental_company'),
  rentalStartDate: timestamp('rental_start_date').notNull(),
  rentalEndDate: timestamp('rental_end_date').notNull(),
  rentalCost: decimal('rental_cost', { precision: 10, scale: 2 }),

  // Project Integration
  projectId: varchar('project_id'),
  clientName: varchar('client_name'),

  // Rental Status
  status: varchar('status').default('active'), // active, returned, overdue, damaged
  returnCondition: varchar('return_condition'), // excellent, good, fair, damaged
  lateFees: decimal('late_fees', { precision: 10, scale: 2 }).default('0'),

  // Documentation
  rentalAgreementUrl: varchar('rental_agreement_url'),
  pickupPhotos: jsonb('pickup_photos'),
  returnPhotos: jsonb('return_photos'),
  damageNotes: text('damage_notes'),

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Market Equipment Database - Global equipment catalog
export const marketEquipment = pgTable('market_equipment', {
  id: serial('id').primaryKey(),

  // Basic Information
  brand: varchar('brand').notNull(),
  model: varchar('model').notNull(),
  category: varchar('category').notNull(), // camera, lens, lighting, audio, accessory
  subcategory: varchar('subcategory'), // dslr, mirrorless, prime, zoom, etc.

  // Market Information
  msrp: decimal('msrp', { precision: 10, scale: 2 }), // Manufacturer's suggested retail price
  currentMarketPrice: decimal('current_market_price', {
    precision: 10,
    scale: 2,
  }),
  usedMarketPrice: decimal('used_market_price', { precision: 10, scale: 2 }),
  releaseDate: timestamp('release_date'),
  discontinuedDate: timestamp('discontinued_date'),

  // Technical Specifications
  specifications: jsonb('specifications'),
  features: jsonb('features'),
  dimensions: jsonb('dimensions'), // width, height, depth, weight

  // Professional Ratings
  photographerRating: decimal('photographer_rating', {
    precision: 3,
    scale: 2,
  }), // 0.00 to 5.00
  videographerRating: decimal('videographer_rating', {
    precision: 3,
    scale: 2,
  }),
  musicProducerRating: decimal('music_producer_rating', {
    precision: 3,
    scale: 2,
  }),
  overallRating: decimal('overall_rating', { precision: 3, scale: 2 }),

  // Availability
  isAvailable: boolean('is_available').default(true),
  norwegianSuppliers: jsonb('norwegian_suppliers'), // Array of Norwegian suppliers
  estimatedDelivery: varchar('estimated_delivery'), // "1-3 days", "1-2 weeks"

  // SEO and Search
  searchKeywords: jsonb('search_keywords'),
  popularityScore: integer('popularity_score').default(0),

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Relations
export const userEquipmentRelations = relations(userEquipment, ({ many }) => ({
  maintenanceRecords: many(equipmentMaintenance),
  rentalHistory: many(equipmentRentals),
}));

export const equipmentMaintenanceRelations = relations(equipmentMaintenance, ({ one }) => ({
  equipment: one(userEquipment, {
    fields: [equipmentMaintenance.equipmentId],
    references: [userEquipment.id],
  }),
}));

export const equipmentRentalsRelations = relations(equipmentRentals, ({ one }) => ({
  equipment: one(userEquipment, {
    fields: [equipmentRentals.equipmentId],
    references: [userEquipment.id],
  }),
}));

export const firmwareUpdatesRelations = relations(firmwareUpdates, ({ many }) => ({}));

// equipmentBrandsRelations moved to main database-persistence-schema.ts

// equipmentModelsRelations moved to main database-persistence-schema.ts

export const lensDatabaseRelations = relations(lensDatabase, ({ many }) => ({}));

// Zod schemas for validation
export const insertUserEquipmentSchema = createInsertSchema(userEquipment);
export const insertFirmwareUpdateSchema = createInsertSchema(firmwareUpdates);
export const insertEquipmentMaintenanceSchema = createInsertSchema(equipmentMaintenance);
export const insertEquipmentRentalSchema = createInsertSchema(equipmentRentals);
export const insertMarketEquipmentSchema = createInsertSchema(marketEquipment);

// Types
export type UserEquipment = typeof userEquipment.$inferSelect;
export type InsertUserEquipment = typeof userEquipment.$inferInsert;
export type FirmwareUpdate = typeof firmwareUpdates.$inferSelect;
export type InsertFirmwareUpdate = typeof firmwareUpdates.$inferInsert;
export type EquipmentMaintenance = typeof equipmentMaintenance.$inferSelect;
export type InsertEquipmentMaintenance = typeof equipmentMaintenance.$inferInsert;
export type EquipmentRental = typeof equipmentRentals.$inferSelect;
export type InsertEquipmentRental = typeof equipmentRentals.$inferInsert;
export type MarketEquipment = typeof marketEquipment.$inferSelect;
export type InsertMarketEquipment = typeof marketEquipment.$inferInsert;
// EquipmentBrand types moved to main database-persistence-schema.ts
// EquipmentModel types moved to main database-persistence-schema.ts
export type LensDatabase = typeof lensDatabase.$inferSelect;
export type InsertLensDatabase = typeof lensDatabase.$inferInsert;

// Software Updates Database - Professional photography software tracking
export const softwareUpdates = pgTable('software_updates', {
  id: varchar('id').primaryKey(),
  software: varchar('software').notNull(),
  vendor: varchar('vendor').notNull(),
  category: varchar('category').notNull(), // photo_editing, video_editing, hybrid, specialized, music_production, audio_processing, free_audio

  // Version Information
  version: varchar('version').notNull(),
  previousVersion: varchar('previous_version'),
  releaseDate: timestamp('release_date').notNull(),
  updateType: varchar('update_type').notNull(), // major, minor, patch, security
  isLatest: boolean('is_latest').default(true),

  // Professional Benefits
  photographerBenefits: jsonb('photographer_benefits'), // Array of benefits for photographers
  newFeatures: jsonb('new_features'), // Array of new features
  performanceImprovements: jsonb('performance_improvements'), // Array of performance improvements
  bugFixes: jsonb('bug_fixes'), // Array of bug fixes

  // Pricing and Requirements
  pricingChanges: text('pricing_changes'),
  systemRequirements: jsonb('system_requirements'),
  downloadSize: varchar('download_size'),
  installationNotes: text('installation_notes'),

  // Priority and Recommendations
  priority: varchar('priority').default('optional'), // critical, recommended, optional
  photographerRecommendation: varchar('photographer_recommendation'), // strongly_recommended, recommended, optional

  // Source and Verification
  sourceUrl: varchar('source_url'),
  lastVerified: timestamp('last_verified'),

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Software Database - Master catalog of photography software
export const softwareDatabase = pgTable('software_database', {
  id: varchar('id').primaryKey(),
  name: varchar('name').notNull(),
  vendor: varchar('vendor').notNull(),
  category: varchar('category').notNull(), // photo_editing, video_editing, hybrid, specialized, music_production, audio_processing, free_audio
  subcategory: varchar('subcategory'), // raw_processor, compositing, color_grading, etc.

  // Current Information
  currentVersion: varchar('current_version'),
  releaseDate: timestamp('release_date'),
  platform: jsonb('platform'), // windows, mac, linux, web

  // Professional Features
  professionalFeatures: jsonb('professional_features'), // Array of pro features
  workflowBenefits: jsonb('workflow_benefits'), // How it helps photographer workflow
  integrations: jsonb('integrations'), // Compatible with other software

  // Pricing
  pricingModel: varchar('pricing_model'), // subscription, one_time, freemium, free
  price: decimal('price', { precision: 10, scale: 2 }),
  currency: varchar('currency').default('NOK'),

  // Specifications
  systemRequirements: jsonb('system_requirements'),
  supportedFormats: jsonb('supported_formats'), // RAW, JPEG, TIFF, etc.

  // Professional Ratings
  photographerRating: decimal('photographer_rating', {
    precision: 3,
    scale: 2,
  }),
  videographerRating: decimal('videographer_rating', {
    precision: 3,
    scale: 2,
  }),
  overallRating: decimal('overall_rating', { precision: 3, scale: 2 }),

  // Availability
  isActive: boolean('is_active').default(true),
  isRecommended: boolean('is_recommended').default(false),

  // SEO and Discovery
  description: text('description'),
  website: varchar('website'),
  downloadUrl: varchar('download_url'),

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Software Relations
export const softwareUpdatesRelations = relations(softwareUpdates, ({ one }) => ({
  software: one(softwareDatabase, {
    fields: [softwareUpdates.software],
    references: [softwareDatabase.name],
  }),
}));

export const softwareDatabaseRelations = relations(softwareDatabase, ({ many }) => ({
  updates: many(softwareUpdates),
}));

// Product Catalog Images Database - Lagrer ekte produktbilder fra Google Custom Search Engine
// ⭐ RENAMED from 'equipmentImages' to avoid conflict with user equipment images in database-persistence-schema.ts
export const productCatalogImages = pgTable('product_catalog_images', {
  id: serial('id').primaryKey(),
  brand: varchar('brand').notNull(),
  model: varchar('model').notNull(),
  category: varchar('category'), // Kameraer, Objektiver, Blits, Lyd, Stativer

  // Image Details
  imageUrl: varchar('image_url').notNull(),
  title: varchar('title'),
  source: varchar('source'), // Website where image was found
  width: integer('width').default(800),
  height: integer('height').default(600),

  // Search Engine Information
  searchEngine: varchar('search_engine').notNull(), // "Google Custom Search Engine", "Workload Identity", etc.
  searchEngineId: varchar('search_engine_id'), // For tracking which CSE was used

  // Quality Control
  verified: boolean('verified').default(false),
  isPrimary: boolean('is_primary').default(false), // Primary image for this product
  isOfficial: boolean('is_official').default(false), // From official manufacturer site

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Software Types
export type SoftwareUpdate = typeof softwareUpdates.$inferSelect;
export type InsertSoftwareUpdate = typeof softwareUpdates.$inferInsert;
export type SoftwareDatabase = typeof softwareDatabase.$inferSelect;
export type InsertSoftwareDatabase = typeof softwareDatabase.$inferInsert;

// Product Catalog Images Types (renamed from EquipmentImage)
export type ProductCatalogImage = typeof productCatalogImages.$inferSelect;
export type InsertProductCatalogImage = typeof productCatalogImages.$inferInsert;
