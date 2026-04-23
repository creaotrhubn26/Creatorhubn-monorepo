import {
  pgTable,
  varchar,
  text,
  timestamp,
  integer,
  bigint,
  boolean,
  jsonb,
  uuid,
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const captureSessions = pgTable(
  'capture_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerUserId: varchar('owner_user_id', { length: 255 }).notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    clientId: uuid('client_id'),
    /// Optional link to a UniversalDashboard project. Set when the iPad
    /// photographer either picks an existing project at sign-in or
    /// auto-creates one for a "simple photo session". Lets the bridge
    /// pull showcase prefs + shot list off the project, and the project
    /// dashboard surface every Capture session under the right wedding /
    /// event without manual tagging. Stored as varchar to match the
    /// legacy `projects.id` (varchar UUID-as-text).
    projectId: varchar('project_id', { length: 255 }),
    startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
    endsAt: timestamp('ends_at', { withTimezone: true }),
    status: varchar('status', { length: 32 }).notNull().default('active'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    ownerIdx: index('capture_sessions_owner_idx').on(t.ownerUserId),
    clientIdx: index('capture_sessions_client_idx').on(t.clientId),
    projectIdx: index('capture_sessions_project_idx').on(t.projectId),
  }),
);

export type AssetSignalsJson = {
  sharpness?: number;
  eyesOpen?: boolean;
  faceCount?: number;
  duplicateGroupId?: string;
  /// Written by the Claude Vision analyze route so the review surface can
  /// sort / filter on AI findings without asking the iPad to re-send them.
  /// Separate from the on-device signals above so the two never collide.
  ai?: {
    subject?: string;
    confidence?: number;
    tonality?: string;
    qualityNotes?: string[];
    analyzedAt?: string; // ISO timestamp
  };
};

export const captureAssets = pgTable(
  'capture_assets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => captureSessions.id, { onDelete: 'cascade' }),
    originalFilename: varchar('original_filename', { length: 512 }).notNull(),
    captureTime: timestamp('capture_time', { withTimezone: true }).notNull(),

    previewKey: varchar('preview_key', { length: 1024 }),
    fullKey: varchar('full_key', { length: 1024 }),
    rawKey: varchar('raw_key', { length: 1024 }),
    checksumSha256: varchar('checksum_sha256', { length: 64 }),
    mime: varchar('mime', { length: 128 }).notNull(),
    sizeBytes: bigint('size_bytes', { mode: 'number' }),

    state: varchar('state', { length: 32 }).notNull().default('anticipated'),
    signals: jsonb('signals').$type<AssetSignalsJson>().notNull().default({}),

    rating: integer('rating').notNull().default(0),
    colorLabel: varchar('color_label', { length: 16 }),
    flaggedForClient: boolean('flagged_for_client').notNull().default(false),
    rejected: boolean('rejected').notNull().default(false),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    sessionIdx: index('capture_assets_session_idx').on(t.sessionId, t.captureTime),
    stateIdx: index('capture_assets_state_idx').on(t.state),
  }),
);

export const captureReviews = pgTable(
  'capture_reviews',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    assetId: uuid('asset_id')
      .notNull()
      .references(() => captureAssets.id, { onDelete: 'cascade' }),
    reviewerId: varchar('reviewer_id', { length: 255 }).notNull(),
    reviewerType: varchar('reviewer_type', { length: 32 }).notNull(),
    heart: boolean('heart'),
    rating: integer('rating'),
    comment: text('comment'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    assetIdx: index('capture_reviews_asset_idx').on(t.assetId),
  }),
);

export const captureEvents = pgTable(
  'capture_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => captureSessions.id, { onDelete: 'cascade' }),
    assetId: uuid('asset_id').references(() => captureAssets.id, { onDelete: 'cascade' }),
    actorId: varchar('actor_id', { length: 255 }).notNull(),
    eventType: varchar('event_type', { length: 64 }).notNull(),
    metadata: jsonb('metadata').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    sessionIdx: index('capture_events_session_idx').on(t.sessionId, t.createdAt),
    assetIdx: index('capture_events_asset_idx').on(t.assetId),
  }),
);

export const captureSessionsRelations = relations(captureSessions, ({ many }) => ({
  assets: many(captureAssets),
  events: many(captureEvents),
}));

export const captureAssetsRelations = relations(captureAssets, ({ one, many }) => ({
  session: one(captureSessions, {
    fields: [captureAssets.sessionId],
    references: [captureSessions.id],
  }),
  reviews: many(captureReviews),
  events: many(captureEvents),
}));

export const captureReviewsRelations = relations(captureReviews, ({ one }) => ({
  asset: one(captureAssets, {
    fields: [captureReviews.assetId],
    references: [captureAssets.id],
  }),
}));

export const captureClientTokens = pgTable(
  'capture_client_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => captureSessions.id, { onDelete: 'cascade' }),
    tokenHash: varchar('token_hash', { length: 64 }).notNull().unique(),
    pinHash: varchar('pin_hash', { length: 64 }),
    clientLabel: varchar('client_label', { length: 255 }),
    reviewerId: varchar('reviewer_id', { length: 255 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
  },
  (t) => ({
    sessionIdx: index('capture_client_tokens_session_idx').on(t.sessionId),
    hashIdx: index('capture_client_tokens_hash_idx').on(t.tokenHash),
  }),
);

export const captureClientTokensRelations = relations(captureClientTokens, ({ one }) => ({
  session: one(captureSessions, {
    fields: [captureClientTokens.sessionId],
    references: [captureSessions.id],
  }),
}));

export type CaptureClientToken = typeof captureClientTokens.$inferSelect;
export type InsertCaptureClientToken = typeof captureClientTokens.$inferInsert;

export const captureEventsRelations = relations(captureEvents, ({ one }) => ({
  session: one(captureSessions, {
    fields: [captureEvents.sessionId],
    references: [captureSessions.id],
  }),
  asset: one(captureAssets, {
    fields: [captureEvents.assetId],
    references: [captureAssets.id],
  }),
}));

export type CaptureSession = typeof captureSessions.$inferSelect;
export type InsertCaptureSession = typeof captureSessions.$inferInsert;
export type CaptureAsset = typeof captureAssets.$inferSelect;
export type InsertCaptureAsset = typeof captureAssets.$inferInsert;
export type CaptureReview = typeof captureReviews.$inferSelect;
export type InsertCaptureReview = typeof captureReviews.$inferInsert;
export type CaptureEvent = typeof captureEvents.$inferSelect;
export type InsertCaptureEvent = typeof captureEvents.$inferInsert;
