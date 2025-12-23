/**
 * Pricing System Schema
 * Complete schema definitions for pricing and billing management
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
// PRICING SYSTEM CORE
// ============================================================================

export const priceAdministrations = pgTable('price_administrations', {
  id: uuid('id').primaryKey().defaultRandom(),
  profession: varchar('profession').notNull(),
  pricingStructure: jsonb('pricing_structure').notNull(),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const priceTiers = pgTable('price_tiers', {
  id: uuid('id').primaryKey().defaultRandom(),
  administrationId: uuid('administration_id').notNull(),
  tierName: varchar('tier_name').notNull(),
  tierDescription: text('tier_description'),
  basePrice: decimal('base_price').notNull(),
  features: jsonb('features').notNull().default('[]'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const priceFeatures = pgTable('price_features', {
  id: uuid('id').primaryKey().defaultRandom(),
  tierId: uuid('tier_id').notNull(),
  featureName: varchar('feature_name').notNull(),
  featureDescription: text('feature_description'),
  isIncluded: boolean('is_included').default(true),
  additionalCost: decimal('additional_cost').default('0'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// ============================================================================
// RELATIONS
// ============================================================================

export const priceAdministrationsRelations = relations(priceAdministrations, ({ many }) => ({
  tiers: many(priceTiers),
}));

export const priceTiersRelations = relations(priceTiers, ({ one, many }) => ({
  administration: one(priceAdministrations, {
    fields: [priceTiers.administrationId],
    references: [priceAdministrations.id],
  }),
  features: many(priceFeatures),
}));

export const priceFeaturesRelations = relations(priceFeatures, ({ one }) => ({
  tier: one(priceTiers, {
    fields: [priceFeatures.tierId],
    references: [priceTiers.id],
  }),
}));
