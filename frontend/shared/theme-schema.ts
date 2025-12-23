import { pgTable, text, integer, timestamp, boolean, json } from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';

export const themes = pgTable('themes', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  displayName: text('display_name').notNull(),
  category: text('category').notNull(), // 'brand', 'professional', 'creative', 'seasonal'
  colors: json('colors').notNull().$type<{
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    surface: string;
    text: string;
    textSecondary: string;
    border: string;
    success: string;
    warning: string;
    error: string;
    info: string;
  }>(),
  isDefault: boolean('is_default').default(false),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const userThemePreferences = pgTable('user_theme_preferences', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  userId: text('user_id').notNull(),
  themeId: text('theme_id')
    .notNull()
    .references(() => themes.id),
  dashboardType: text('dashboard_type'), // 'photographer', 'videographer', 'music_producer', 'vendor', 'admin'
  customizations: json('customizations').$type<{
    fontSize?: 'small' | 'medium' | 'large';
    spacing?: 'compact' | 'normal' | 'spacious';
    borderRadius?: 'none' | 'small' | 'medium' | 'large';
    animations?: boolean;
  }>(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const insertThemeSchema = createInsertSchema(themes).omit({
  createdAt: true,
  updatedAt: true,
});

export const insertUserThemePreferenceSchema = createInsertSchema(userThemePreferences).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type Theme = typeof themes.$inferSelect;
export type InsertTheme = z.infer<typeof insertThemeSchema>;
export type UserThemePreference = typeof userThemePreferences.$inferSelect;
export type InsertUserThemePreference = z.infer<typeof insertUserThemePreferenceSchema>;

// Brand-consistent color palettes
export const BRAND_COLOR_PALETTES = {
  'creatorhub-default': {
    primary: 'hsl(25, 65%, 45%)', // CreatorHub amber-orange
    secondary: 'hsl(30, 60%, 35%)', // Rich brown
    accent: 'hsl(35, 70%, 55%)', // Warm amber
    background: 'hsl(0, 0%, 100%)', // White
    surface: 'hsl(25, 50%, 98%)', // Light amber tint
    text: 'hsl(20, 70%, 25%)', // Dark brown
    textSecondary: 'hsl(25, 40%, 45%)', // Medium brown
    border: 'hsl(25, 30%, 85%)', // Light amber border
    success: 'hsl(120, 60%, 50%)', // Green
    warning: 'hsl(45, 90%, 60%)', // Yellow
    error: 'hsl(0, 70%, 50%)', // Red
    info: 'hsl(200, 80%, 50%)', // Blue
  },
  'amber-professional': {
    primary: 'hsl(25, 80%, 40%)', // Deeper amber
    secondary: 'hsl(20, 70%, 30%)', // Dark brown
    accent: 'hsl(40, 85%, 60%)', // Bright amber
    background: 'hsl(0, 0%, 99%)', // Off-white
    surface: 'hsl(25, 40%, 96%)', // Subtle amber
    text: 'hsl(15, 80%, 20%)', // Deep brown
    textSecondary: 'hsl(25, 50%, 40%)', // Warm gray
    border: 'hsl(25, 25%, 80%)', // Amber border
    success: 'hsl(120, 65%, 45%)', // Professional green
    warning: 'hsl(45, 85%, 55%)', // Amber warning
    error: 'hsl(0, 75%, 45%)', // Professional red
    info: 'hsl(200, 75%, 45%)', // Professional blue
  },
  'warm-creative': {
    primary: 'hsl(30, 75%, 50%)', // Warm orange
    secondary: 'hsl(35, 65%, 40%)', // Burnt orange
    accent: 'hsl(25, 85%, 65%)', // Light orange
    background: 'hsl(30, 15%, 98%)', // Warm white
    surface: 'hsl(30, 25%, 95%)', // Warm surface
    text: 'hsl(25, 75%, 25%)', // Warm dark
    textSecondary: 'hsl(30, 55%, 45%)', // Warm medium
    border: 'hsl(30, 20%, 85%)', // Warm border
    success: 'hsl(120, 70%, 50%)', // Warm green
    warning: 'hsl(45, 95%, 65%)', // Warm yellow
    error: 'hsl(5, 80%, 55%)', // Warm red
    info: 'hsl(200, 85%, 55%)', // Warm blue
  },
  'golden-elegance': {
    primary: 'hsl(40, 70%, 50%)', // Golden
    secondary: 'hsl(35, 60%, 35%)', // Deep gold
    accent: 'hsl(45, 80%, 65%)', // Light gold
    background: 'hsl(0, 0%, 100%)', // Pure white
    surface: 'hsl(40, 30%, 97%)', // Golden tint
    text: 'hsl(30, 70%, 20%)', // Dark gold
    textSecondary: 'hsl(35, 45%, 40%)', // Medium gold
    border: 'hsl(40, 25%, 85%)', // Gold border
    success: 'hsl(120, 60%, 45%)', // Elegant green
    warning: 'hsl(50, 90%, 60%)', // Golden warning
    error: 'hsl(0, 65%, 50%)', // Elegant red
    info: 'hsl(200, 75%, 50%)', // Elegant blue
  },
} as const;
