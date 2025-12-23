/**
 * CreatorHub Norge - Simplified Schema Export
 * Single source of truth: database-persistence-schema.ts
 */

// Export everything from the main database persistence schema
export * from './database-persistence-schema';

// Export Zod schemas for validation
export { createInsertSchema } from 'drizzle-zod';
export { z } from 'zod';
