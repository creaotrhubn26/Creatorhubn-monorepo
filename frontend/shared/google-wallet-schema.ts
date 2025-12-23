/**
 * CreatorHub Norge - Google Wallet Integration Schema
 * Digital Passes, Tickets, and Loyalty Cards
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
  serial,
  bigint,
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';

// ============================================================================
// GOOGLE WALLET INTEGRATION TABLES
// ============================================================================

// Google Wallet Digital Passes - Main table for all digital passes
export const googleWalletPasses = pgTable('google_wallet_passes', {
  id: serial('id').primaryKey(),
  classId: varchar('class_id').notNull(), // Google Wallet class ID
  objectId: varchar('object_id').notNull(), // Google Wallet object ID
  state: varchar('state').$type<'ACTIVE' | 'EXPIRED' | 'INACTIVE'>().notNull().default('ACTIVE'),
  passType: varchar('pass_type')
    .$type<'EVENT_TICKET' | 'LOYALTY_CARD' | 'MEMBERSHIP_CARD' | 'GIFT_CARD'>()
    .notNull(),
  userId: varchar('user_id').notNull(),

  // Pass data (flexible JSON structure)
  passData: jsonb('pass_data').notNull().default({}),

  // QR Code and Barcode
  qrCode: text('qr_code'),
  barcode: text('barcode'),

  // Timestamps
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  expiresAt: timestamp('expires_at'),

  // Metadata
  metadata: jsonb('metadata').default({}),
});

// Event Tickets - Specific table for event tickets
export const googleWalletTickets = pgTable('google_wallet_tickets', {
  id: serial('id').primaryKey(),
  passId: integer('pass_id')
    .notNull()
    .references(() => googleWalletPasses.id),
  userId: varchar('user_id').notNull(),

  // Event details
  eventName: varchar('event_name').notNull(),
  eventDate: timestamp('event_date').notNull(),
  venue: varchar('venue').notNull(),
  seatNumber: varchar('seat_number'),
  ticketType: varchar('ticket_type')
    .$type<'VIP' | 'STANDARD' | 'STUDENT' | 'EARLY_BIRD'>()
    .notNull()
    .default('STANDARD'),

  // Pricing
  price: decimal('price', { precision: 10, scale: 2 }).notNull(),
  currency: varchar('currency').notNull().default('NOK'),

  // Status
  status: varchar('status')
    .$type<'VALID' | 'USED' | 'CANCELLED' | 'EXPIRED'>()
    .notNull()
    .default('VALID'),

  // Timestamps
  createdAt: timestamp('created_at').notNull().defaultNow(),
  usedAt: timestamp('used_at'),
});

// Loyalty Cards - Specific table for loyalty programs
export const googleWalletLoyaltyCards = pgTable('google_wallet_loyalty_cards', {
  id: serial('id').primaryKey(),
  passId: integer('pass_id')
    .notNull()
    .references(() => googleWalletPasses.id),
  userId: varchar('user_id').notNull(),

  // Program details
  programName: varchar('program_name').notNull(),
  programDescription: text('program_description'),

  // Points and rewards
  points: integer('points').notNull().default(0),
  tier: varchar('tier')
    .$type<'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM'>()
    .notNull()
    .default('BRONZE'),
  nextReward: text('next_reward'),
  totalSpent: decimal('total_spent', { precision: 10, scale: 2 }).default('0'),

  // Status
  isActive: boolean('is_active').notNull().default(true),
  expiryDate: timestamp('expiry_date'),

  // Timestamps
  createdAt: timestamp('created_at').notNull().defaultNow(),
  lastUsedAt: timestamp('last_used_at'),
});

// Membership Cards - Specific table for membership programs
export const googleWalletMembershipCards = pgTable('google_wallet_membership_cards', {
  id: serial('id').primaryKey(),
  passId: integer('pass_id')
    .notNull()
    .references(() => googleWalletPasses.id),
  userId: varchar('user_id').notNull(),

  // Organization details
  organizationName: varchar('organization_name').notNull(),
  membershipType: varchar('membership_type').notNull(),
  memberNumber: varchar('member_number').notNull(),

  // Membership details
  memberSince: timestamp('member_since').notNull(),
  benefits: jsonb('benefits').default([]), // Array of benefit strings
  renewalDate: timestamp('renewal_date'),

  // Status
  isActive: boolean('is_active').notNull().default(true),
  autoRenew: boolean('auto_renew').notNull().default(false),

  // Timestamps
  createdAt: timestamp('created_at').notNull().defaultNow(),
  lastRenewedAt: timestamp('last_renewed_at'),
});

// ============================================================================
// RELATIONS
// ============================================================================

export const googleWalletPassesRelations = relations(googleWalletPasses, ({ many }) => ({
  tickets: many(googleWalletTickets),
  loyaltyCards: many(googleWalletLoyaltyCards),
  membershipCards: many(googleWalletMembershipCards),
}));

export const googleWalletTicketsRelations = relations(googleWalletTickets, ({ one }) => ({
  pass: one(googleWalletPasses, {
    fields: [googleWalletTickets.passId],
    references: [googleWalletPasses.id],
  }),
}));

export const googleWalletLoyaltyCardsRelations = relations(googleWalletLoyaltyCards, ({ one }) => ({
  pass: one(googleWalletPasses, {
    fields: [googleWalletLoyaltyCards.passId],
    references: [googleWalletPasses.id],
  }),
}));

export const googleWalletMembershipCardsRelations = relations(
  googleWalletMembershipCards,
  ({ one }) => ({
    pass: one(googleWalletPasses, {
      fields: [googleWalletMembershipCards.passId],
      references: [googleWalletPasses.id],
    }),
  }),
);

// ============================================================================
// ZOD SCHEMAS
// ============================================================================

export const createGoogleWalletPassSchema = createInsertSchema(googleWalletPasses);
export const createGoogleWalletTicketSchema = createInsertSchema(googleWalletTickets);
export const createGoogleWalletLoyaltyCardSchema = createInsertSchema(googleWalletLoyaltyCards);
export const createGoogleWalletMembershipCardSchema = createInsertSchema(
  googleWalletMembershipCards,
);

// ============================================================================
// TYPES
// ============================================================================

export type GoogleWalletPass = typeof googleWalletPasses.$inferSelect;
export type NewGoogleWalletPass = typeof googleWalletPasses.$inferInsert;

export type GoogleWalletTicket = typeof googleWalletTickets.$inferSelect;
export type NewGoogleWalletTicket = typeof googleWalletTickets.$inferInsert;

export type GoogleWalletLoyaltyCard = typeof googleWalletLoyaltyCards.$inferSelect;
export type NewGoogleWalletLoyaltyCard = typeof googleWalletLoyaltyCards.$inferInsert;

export type GoogleWalletMembershipCard = typeof googleWalletMembershipCards.$inferSelect;
export type NewGoogleWalletMembershipCard = typeof googleWalletMembershipCards.$inferInsert;
