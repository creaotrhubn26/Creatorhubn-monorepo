import { pgTable, varchar, boolean, timestamp, text } from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { sql } from 'drizzle-orm';
import { z } from 'zod';
import { users } from './database-persistence-schema';

// Two-factor authentication table
export const twoFactorAuth = pgTable('two_factor_auth', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar('user_id')
    .notNull()
    .references(() => users.id),
  secret: varchar('secret').notNull(), // TOTP secret
  isEnabled: boolean('is_enabled').default(false),
  backupCodes: text('backup_codes').array(), // Array of backup codes
  lastUsed: timestamp('last_used'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Daniel Qazi's pre-configured 2FA
export const danielTwoFactorConfig = {
  userId: 'daniel@creatorhubn.com',
  secret: 'YS7T2E2INWALSWA5JLXAQPB2OF6XS7R',
  isEnabled: true,
  setupDate: '2025-08-07',
  serviceName: 'CreatorHub Norge',
  issuer: 'CreatorHubn.com',
};

export const insertTwoFactorAuthSchema = createInsertSchema(twoFactorAuth).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertTwoFactorAuth = z.infer<typeof insertTwoFactorAuthSchema>;
export type TwoFactorAuth = typeof twoFactorAuth.$inferSelect;
