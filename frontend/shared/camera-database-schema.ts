import { pgTable, varchar, text, jsonb, timestamp, boolean } from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import type { z } from 'zod';

// Camera database with detailed specs and memory card compatibility
export const cameras = pgTable('cameras', {
  id: varchar('id').primaryKey(),
  brand: varchar('brand', { length: 50 }).notNull(), // Canon, Nikon, Sony, etc.
  model: varchar('model', { length: 100 }).notNull(),
  fullName: varchar('full_name', { length: 200 }).notNull(),
  imageUrl: text('image_url'),
  releaseYear: varchar('release_year', { length: 4 }),

  // Memory card compatibility
  supportedMemoryCardTypes: jsonb('supported_memory_card_types')
    .$type<string[]>()
    .notNull()
    .default([]),
  primaryCardSlot: varchar('primary_card_slot', { length: 20 }), // CF, SD, CFexpress, XQD
  secondaryCardSlot: varchar('secondary_card_slot', { length: 20 }),

  // Technical specifications
  specs: jsonb('specs').$type<{
    resolution?: string;
    videoCapabilities?: string[];
    iso?: string;
    autofocus?: string;
    fileFormats?: string[];
    weight?: string;
    dimensions?: string;
  }>(),

  // Professional categorization
  category: varchar('category', { length: 50 }), // DSLR, Mirrorless, Cinema, etc.
  isDiscontinued: boolean('is_discontinued').default(false),

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// User's selected cameras for onboarding
export const userCameras = pgTable('user_cameras', {
  id: varchar('id').primaryKey(),
  userId: varchar('user_id').notNull(),
  cameraId: varchar('camera_id').references(() => cameras.id),
  isPrimary: boolean('is_primary').default(false),
  nickname: varchar('nickname', { length: 100 }), // User's custom name for camera
  serialNumber: varchar('serial_number', { length: 100 }),

  createdAt: timestamp('created_at').defaultNow(),
});

// Memory card types and specifications
export const memoryCardTypes = pgTable('memory_card_types', {
  id: varchar('id').primaryKey(),
  name: varchar('name', { length: 50 }).notNull(), // CF, SD, CFexpress Type A, etc.
  fullName: varchar('full_name', { length: 100 }),
  description: text('description'),
  maxCapacity: varchar('max_capacity', { length: 20 }),
  speedClass: varchar('speed_class', { length: 50 }),
  iconName: varchar('icon_name', { length: 50 }), // For UI display

  createdAt: timestamp('created_at').defaultNow(),
});

// Insert schemas for Zod validation
export const insertCameraSchema = createInsertSchema(cameras).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertUserCameraSchema = createInsertSchema(userCameras).omit({
  id: true,
  createdAt: true,
});

export const insertMemoryCardTypeSchema = createInsertSchema(memoryCardTypes).omit({
  id: true,
  createdAt: true,
});

// Types
export type Camera = typeof cameras.$inferSelect;
export type UserCamera = typeof userCameras.$inferSelect;
export type MemoryCardType = typeof memoryCardTypes.$inferSelect;
export type InsertCamera = z.infer<typeof insertCameraSchema>;
export type InsertUserCamera = z.infer<typeof insertUserCameraSchema>;
export type InsertMemoryCardType = z.infer<typeof insertMemoryCardTypeSchema>;

// Camera search response type
export type CameraSearchResult = {
  id: string;
  brand: string;
  model: string;
  fullName: string;
  imageUrl?: string;
  releaseYear?: string;
  supportedMemoryCardTypes: string[];
  category?: string;
  specs?: {
    resolution?: string;
    videoCapabilities?: string[];
    iso?: string;
    weight?: string;
  };
};
