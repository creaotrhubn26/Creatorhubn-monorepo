// business-profiles-schema.ts - Database schema for business profiles with logos
// Note: businessProfiles and userFiles tables are defined in the main database-persistence-schema.ts
// This file is kept for any additional business profile specific functionality

import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';
import { businessProfiles, userFiles } from './database-persistence-schema';

// Re-export from main schema to maintain compatibility
export {
  businessProfiles,
  userFiles,
  type BusinessProfile,
  type UserFile,
} from './database-persistence-schema';

// Create the missing schemas
export const insertBusinessProfileSchema = createInsertSchema(businessProfiles);
export const insertUserFileSchema = createInsertSchema(userFiles);

// Create the missing types
export type InsertBusinessProfile = typeof businessProfiles.$inferInsert;
export type InsertUserFile = typeof userFiles.$inferInsert;

// Update business profile schema
export const updateBusinessProfileSchema = insertBusinessProfileSchema.partial().extend({
  id: z.string(),
});
