import { sql } from 'drizzle-orm';
import { boolean, index, integer, pgTable, text, timestamp, varchar } from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';

// Plugin lisenser tabell
export const pluginLicenses = pgTable(
  'plugin_licenses',
  {
    id: varchar('id').primaryKey(),
    userId: varchar('user_id').notNull(),
    pluginId: varchar('plugin_id').notNull(),
    licenseKey: text('license_key'),
    purchaseDate: varchar('purchase_date').notNull(),
    expiryDate: varchar('expiry_date'),
    licenseType: varchar('license_type').notNull(), // perpetual, subscription, rental, free
    status: varchar('status').notNull().default('active'), // active, expired, suspended
    installedVersion: varchar('installed_version'),
    lastUpdateCheck: varchar('last_update_check'),
    autoUpdate: boolean('auto_update').default(true),
    purchasePrice: integer('purchase_price'),
    vendor: varchar('vendor').notNull(),
    pluginName: varchar('plugin_name').notNull(),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => [
    index('idx_plugin_licenses_user_id').on(table.userId),
    index('idx_plugin_licenses_plugin_id').on(table.pluginId),
    index('idx_plugin_licenses_expiry').on(table.expiryDate),
    index('idx_plugin_licenses_vendor').on(table.vendor),
  ],
);

// Plugin oppdateringer tabell
export const pluginUpdates = pgTable(
  'plugin_updates',
  {
    id: varchar('id').primaryKey(),
    pluginId: varchar('plugin_id').notNull(),
    userId: varchar('user_id').notNull(),
    fromVersion: varchar('from_version'),
    toVersion: varchar('to_version').notNull(),
    updateDate: varchar('update_date').notNull(),
    status: varchar('status').notNull().default('available'), // available, downloading, installed, failed, completed
    downloadUrl: text('download_url'),
    releaseNotes: text('release_notes'),
    isSecurityUpdate: boolean('is_security_update').default(false),
    isMajorUpdate: boolean('is_major_update').default(false),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => [
    index('idx_plugin_updates_user_id').on(table.userId),
    index('idx_plugin_updates_plugin_id').on(table.pluginId),
    index('idx_plugin_updates_status').on(table.status),
    index('idx_plugin_updates_date').on(table.updateDate),
  ],
);

// Musikk produsent plugins (utstyr kobling)
export const musicProducerPlugins = pgTable(
  'music_producer_plugins',
  {
    id: varchar('id').primaryKey(),
    userId: varchar('user_id').notNull(),
    pluginId: varchar('plugin_id').notNull(),
    category: varchar('category').notNull(), // synthesizer, effect, sample_library, utility, mixing, mastering
    isPrimary: boolean('is_primary').default(false), // hovedverktøy i kategorien
    usage: varchar('usage'), // ofte_brukt, av_og_til, sjelden
    rating: integer('rating'), // 1-5 stjerner
    notes: text('notes'),
    addedDate: varchar('added_date').notNull(),
    lastUsed: varchar('last_used'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => [
    index('idx_music_producer_plugins_user_id').on(table.userId),
    index('idx_music_producer_plugins_category').on(table.category),
    index('idx_music_producer_plugins_primary').on(table.isPrimary),
  ],
);

// Plugin leverandør kontoer (for automatisk innlogging)
export const pluginVendorAccounts = pgTable(
  'plugin_vendor_accounts',
  {
    id: varchar('id').primaryKey(),
    userId: varchar('user_id').notNull(),
    vendor: varchar('vendor').notNull(), // Native Instruments, FabFilter, Waves, etc.
    username: varchar('username'),
    email: varchar('email'),
    isConnected: boolean('is_connected').default(false),
    lastLogin: varchar('last_login'),
    accessToken: text('access_token'), // kryptert
    refreshToken: text('refresh_token'), // kryptert
    tokenExpiry: varchar('token_expiry'),
    accountType: varchar('account_type'), // free, premium, pro
    syncEnabled: boolean('sync_enabled').default(true),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => [
    index('idx_plugin_vendor_accounts_user_id').on(table.userId),
    index('idx_plugin_vendor_accounts_vendor').on(table.vendor),
    index('idx_plugin_vendor_accounts_connected').on(table.isConnected),
  ],
);

// Plugin notifikasjoner
export const pluginNotifications = pgTable(
  'plugin_notifications',
  {
    id: varchar('id').primaryKey(),
    userId: varchar('user_id').notNull(),
    pluginId: varchar('plugin_id'),
    vendor: varchar('vendor'),
    type: varchar('type').notNull(), // update_available, license_expiring, new_plugin, security_alert
    title: varchar('title').notNull(),
    message: text('message').notNull(),
    severity: varchar('severity').default('info'), // info, warning, critical
    isRead: boolean('is_read').default(false),
    actionUrl: text('action_url'),
    expiresAt: varchar('expires_at'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => [
    index('idx_plugin_notifications_user_id').on(table.userId),
    index('idx_plugin_notifications_type').on(table.type),
    index('idx_plugin_notifications_read').on(table.isRead),
    index('idx_plugin_notifications_severity').on(table.severity),
  ],
);

// Zod schemas for validation
export const insertPluginLicenseSchema = createInsertSchema(pluginLicenses).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPluginUpdateSchema = createInsertSchema(pluginUpdates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertMusicProducerPluginSchema = createInsertSchema(musicProducerPlugins).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPluginVendorAccountSchema = createInsertSchema(pluginVendorAccounts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPluginNotificationSchema = createInsertSchema(pluginNotifications).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Types
export type PluginLicense = typeof pluginLicenses.$inferSelect;
export type InsertPluginLicense = z.infer<typeof insertPluginLicenseSchema>;

export type PluginUpdate = typeof pluginUpdates.$inferSelect;
export type InsertPluginUpdate = z.infer<typeof insertPluginUpdateSchema>;

export type MusicProducerPlugin = typeof musicProducerPlugins.$inferSelect;
export type InsertMusicProducerPlugin = z.infer<typeof insertMusicProducerPluginSchema>;

export type PluginVendorAccount = typeof pluginVendorAccounts.$inferSelect;
export type InsertPluginVendorAccount = z.infer<typeof insertPluginVendorAccountSchema>;

export type PluginNotification = typeof pluginNotifications.$inferSelect;
export type InsertPluginNotification = z.infer<typeof insertPluginNotificationSchema>;
