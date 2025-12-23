/**
 * CreatorHub Norge - Comprehensive Norwegian Pricing System
 * Professional pricing administration integrated with business workflow
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
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';

// Standard Package Templates
export const standardPackages = pgTable('standard_packages', {
  id: varchar('id').primaryKey().default('gen_random_uuid()'),
  name: varchar('name', { length: 255 }).notNull(), // e.g., "Bryllup Basic", "Bryllup Premium", "Portrett", "Bedrift"
  category: varchar('category')
    .$type<'bryllup' | 'portrett' | 'bedrift' | 'event' | 'reklame'>()
    .notNull(),
  description: text('description'),
  basePrice: decimal('base_price', { precision: 10, scale: 2 }).notNull(),
  currency: varchar('currency').default('NOK'),

  // Package inclusions
  inclusions: jsonb('inclusions')
    .$type<{
      hours: number;
      images: number;
      videos?: number;
      editing: boolean;
      prints?: number;
      albums?: number;
      deliveryDays: number;
    }>()
    .notNull(),

  // Service types included
  serviceTypes: jsonb('service_types')
    .$type<{
      foto: boolean;
      video: boolean;
      redigering: boolean;
      utskrifter: boolean;
      drone?: boolean;
    }>()
    .notNull(),

  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Custom Package Builder
export const customPackages = pgTable('custom_packages', {
  id: varchar('id').primaryKey().default('gen_random_uuid()'),
  clientId: varchar('client_id'), // Link to CRM
  submissionId: varchar('submission_id'), // Link to submission
  name: varchar('name', { length: 255 }).notNull(),

  // Custom configuration
  configuration: jsonb('configuration')
    .$type<{
      hours: number;
      images: number;
      videos?: number;
      editing: boolean;
      prints?: number;
      albums?: number;
      deliveryDays: number;
      customRequests: string[];
    }>()
    .notNull(),

  totalPrice: decimal('total_price', { precision: 10, scale: 2 }).notNull(),
  currency: varchar('currency').default('NOK'),
  status: varchar('status').$type<'draft' | 'quoted' | 'approved' | 'rejected'>().default('draft'),

  createdBy: varchar('created_by').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Pricing Structure Configuration
export const pricingStructure = pgTable('pricing_structure', {
  id: varchar('id').primaryKey().default('gen_random_uuid()'),
  name: varchar('name', { length: 255 }).notNull(),
  type: varchar('type')
    .$type<
      'timespris' | 'heldagspris' | 'halvdagspris' | 'pakkepris' | 'stykkpris' | 'lisenspris'
    >()
    .notNull(),

  // Pricing details
  rates: jsonb('rates')
    .$type<{
      hourlyRate?: number; // kr 1,800/t
      halfDayRate?: number;
      fullDayRate?: number;
      packageRate?: number;
      unitRate?: number; // per image/video
      licenseRate?: number;
    }>()
    .notNull(),

  // License types for commercial use
  licenseTypes: jsonb('license_types').$type<{
    commercial: boolean;
    reklame: boolean;
    buyout: boolean;
    exclusive: boolean;
    duration?: string; // "1 year", "perpetual"
  }>(),

  serviceCategory: varchar('service_category')
    .$type<'foto' | 'video' | 'redigering' | 'utskrifter'>()
    .notNull(),
  paymentTerms: text('payment_terms'),
  extraImagePackages: jsonb('extra_image_packages').$type<{
    per_image: number;
    package_50: number;
    package_100: number;
    package_custom: boolean;
  }>(),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Additional Costs Configuration
export const additionalCosts = pgTable('additional_costs', {
  id: varchar('id').primaryKey().default('gen_random_uuid()'),
  name: varchar('name', { length: 255 }).notNull(),
  type: varchar('type')
    .$type<'reise' | 'ekstra_assistent' | 'ekspresslevering' | 'utstyr' | 'other'>()
    .notNull(),

  // Cost calculation
  costStructure: jsonb('cost_structure')
    .$type<{
      type: 'fixed' | 'per_km' | 'per_hour' | 'percentage';
      amount: number;
      minimumCharge?: number;
      maximumCharge?: number;
    }>()
    .notNull(),

  description: text('description'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
});

// Discounts and Offers
export const discounts = pgTable('discounts', {
  id: varchar('id').primaryKey().default('gen_random_uuid()'),
  name: varchar('name', { length: 255 }).notNull(),
  type: varchar('type').$type<'percentage' | 'fixed_amount' | 'package_combo'>().notNull(),

  // Discount configuration
  discountValue: decimal('discount_value', {
    precision: 10,
    scale: 2,
  }).notNull(),
  isPercentage: boolean('is_percentage').default(true),

  // Conditions
  conditions: jsonb('conditions').$type<{
    minimumAmount?: number;
    clientType?: 'new' | 'returning' | 'vip';
    packageCombo?: string[]; // e.g., ["foto", "video"]
    validFrom?: string;
    validTo?: string;
    usageLimit?: number;
  }>(),

  discountCode: varchar('discount_code', { length: 50 }),
  isActive: boolean('is_active').default(true),
  usageCount: integer('usage_count').default(0),

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Quote Generation
export const quotes = pgTable('quotes', {
  id: varchar('id').primaryKey().default('gen_random_uuid()'),
  quoteNumber: varchar('quote_number', { length: 50 }).notNull().unique(),
  clientId: varchar('client_id').notNull(),
  submissionId: varchar('submission_id'),

  // Quote details
  services: jsonb('services')
    .$type<
      Array<{
        type: string;
        description: string;
        quantity: number;
        unitPrice: number;
        totalPrice: number;
      }>
    >()
    .notNull(),

  additionalCosts: jsonb('additional_costs').$type<
    Array<{
      type: string;
      description: string;
      amount: number;
    }>
  >(),

  discounts: jsonb('discounts').$type<
    Array<{
      type: string;
      description: string;
      amount: number;
    }>
  >(),

  subtotal: decimal('subtotal', { precision: 10, scale: 2 }).notNull(),
  mva: decimal('mva', { precision: 10, scale: 2 }).notNull(), // Norwegian VAT
  totalAmount: decimal('total_amount', { precision: 10, scale: 2 }).notNull(),
  currency: varchar('currency').default('NOK'),

  // Status and workflow
  status: varchar('status')
    .$type<'draft' | 'sent' | 'viewed' | 'accepted' | 'rejected' | 'expired'>()
    .default('draft'),
  validUntil: timestamp('valid_until'),

  // Integration with other systems
  contractId: varchar('contract_id'), // Link to contract when accepted
  invoiceId: varchar('invoice_id'), // Link to invoice

  // Metadata
  notes: text('notes'),
  internalNotes: text('internal_notes'),

  createdBy: varchar('created_by').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  sentAt: timestamp('sent_at'),
  viewedAt: timestamp('viewed_at'),
  respondedAt: timestamp('responded_at'),
});

// Price History for Analytics
export const priceHistory = pgTable('price_history', {
  id: varchar('id').primaryKey().default('gen_random_uuid()'),
  entityType: varchar('entity_type')
    .$type<'standard_package' | 'pricing_structure' | 'additional_cost'>()
    .notNull(),
  entityId: varchar('entity_id').notNull(),

  oldPrice: decimal('old_price', { precision: 10, scale: 2 }),
  newPrice: decimal('new_price', { precision: 10, scale: 2 }),
  changeReason: text('change_reason'),

  changedBy: varchar('changed_by').notNull(),
  changedAt: timestamp('changed_at').defaultNow(),
});

// Relations
export const standardPackageRelations = relations(standardPackages, ({ many }) => ({
  priceHistory: many(priceHistory),
}));

export const customPackageRelations = relations(customPackages, ({ many, one }) => ({
  quotes: many(quotes),
}));

export const quoteRelations = relations(quotes, ({ one }) => ({
  customPackage: one(customPackages, {
    fields: [quotes.submissionId],
    references: [customPackages.submissionId],
  }),
}));

// Zod schemas for validation
export const insertStandardPackageSchema = createInsertSchema(standardPackages);
export const insertCustomPackageSchema = createInsertSchema(customPackages);
export const insertPricingStructureSchema = createInsertSchema(pricingStructure);
export const insertAdditionalCostSchema = createInsertSchema(additionalCosts);
export const insertDiscountSchema = createInsertSchema(discounts);
export const insertQuoteSchema = createInsertSchema(quotes);

// Types
export type StandardPackage = typeof standardPackages.$inferSelect;
export type InsertStandardPackage = typeof standardPackages.$inferInsert;
export type CustomPackage = typeof customPackages.$inferSelect;
export type InsertCustomPackage = typeof customPackages.$inferInsert;
export type PricingStructure = typeof pricingStructure.$inferSelect;
export type InsertPricingStructure = typeof pricingStructure.$inferInsert;
export type AdditionalCost = typeof additionalCosts.$inferSelect;
export type InsertAdditionalCost = typeof additionalCosts.$inferInsert;
export type Discount = typeof discounts.$inferSelect;
export type InsertDiscount = typeof discounts.$inferInsert;
export type Quote = typeof quotes.$inferSelect;
export type InsertQuote = typeof quotes.$inferInsert;
export type PriceHistory = typeof priceHistory.$inferSelect;
