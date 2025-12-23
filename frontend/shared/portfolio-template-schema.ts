import {
  pgTable,
  serial,
  varchar,
  text,
  timestamp,
  integer,
  boolean,
  jsonb,
} from 'drizzle-orm/pg-core';

// Portfolio templates for professional presentation
export const portfolioTemplates = pgTable('portfolio_templates', {
  id: serial('id').primaryKey(),
  name: varchar('name').notNull(),
  category: varchar('category').notNull(), // "photography", "videography", "design", "mixed"
  description: text('description').notNull(),

  // Template structure
  layoutType: varchar('layout_type').notNull(), // "grid", "masonry", "carousel", "magazine", "minimal"
  colorScheme: varchar('color_scheme').notNull(), // "classic", "modern", "dark", "light", "brand"

  // Visual configuration
  templateConfig: jsonb('template_config').notNull(), // Layout settings, spacing, animations
  previewImage: varchar('preview_image').notNull(), // Template preview URL

  // Template features
  features: text('features').array().notNull(), // ["responsive", "animations", "filters", "lightbox"]
  supportedCategories: text('supported_categories').array().notNull(), // Portfolio categories this works best with

  // Usage and popularity
  usageCount: integer('usage_count').default(0),
  rating: integer('rating').default(0), // 1-5 star rating
  isPremium: boolean('is_premium').default(false),
  isActive: boolean('is_active').default(true),

  // Metadata
  createdBy: varchar('created_by'), // System or admin user
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// User's applied portfolio templates
export const userPortfolioTemplates = pgTable('user_portfolio_templates', {
  id: serial('id').primaryKey(),
  userId: varchar('user_id').notNull(),
  templateId: integer('template_id')
    .notNull()
    .references(() => portfolioTemplates.id),

  // Customization settings
  customizations: jsonb('customizations').default({}), // User's custom colors, spacing, etc.
  isActive: boolean('is_active').default(true),

  appliedAt: timestamp('applied_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export type PortfolioTemplate = typeof portfolioTemplates.$inferSelect;
export type InsertPortfolioTemplate = typeof portfolioTemplates.$inferInsert;
export type UserPortfolioTemplate = typeof userPortfolioTemplates.$inferSelect;
export type InsertUserPortfolioTemplate = typeof userPortfolioTemplates.$inferInsert;
