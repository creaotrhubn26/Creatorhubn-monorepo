import { pgTable, text, varchar, timestamp, boolean, jsonb } from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';

// Vendor onboarding profiles table
export const vendorOnboardingProfiles = pgTable('vendor_onboarding_profiles', {
  id: varchar('id').primaryKey().default('gen_random_uuid()'),
  userId: varchar('user_id').notNull(),
  vendorType: varchar('vendor_type').notNull(), // print, audio, design, software, hardware, etc.
  vendorName: varchar('vendor_name').notNull(),

  // Business information
  businessInfo: jsonb('business_info')
    .$type<{
      name: string;
      email: string;
      phone?: string;
      website?: string;
      description: string;
      categories: string[];
      taxId?: string;
    }>()
    .notNull(),

  // Vendor type specific data
  vendorSpecificData: jsonb('vendor_specific_data').$type<{
    // Common fields
    paymentMethods: string[];
    currency: string;

    // Print vendor specific
    designStyles?: string;
    fileFormats?: string;
    printSizes?: string;
    shippingRegions?: string;
    printingPartners?: string;
    turnaroundTime?: string;

    // Audio vendor specific
    audioFormats?: string;
    samplePacks?: string;
    pluginCompatibility?: string;
    licensingType?: string;
    usageRights?: string;

    // Design vendor specific
    softwareSupport?: string;
    brushStyles?: string;
    textureTypes?: string;

    // Software vendor specific
    platforms?: string;
    systemRequirements?: string;
    apiIntegrations?: string;

    // Hardware vendor specific
    productCategories?: string;
    warranty?: string;
    shippingOptions?: string;

    // Expandable for new vendor types
    [key: string]: any;
  }>(),

  // User preferences
  preferences: jsonb('preferences')
    .$type<{
      notifications: boolean;
      marketingEmails: boolean;
      analytics: boolean;
    }>()
    .default({
      notifications: true,
      marketingEmails: true,
      analytics: true,
    }),

  // Integrations
  fikenIntegrationRequested: boolean('fiken_integration_requested').default(false),
  fikenIntegrationRequestedAt: timestamp('fiken_integration_requested_at'),
  fikenIntegrationStatus: varchar('fiken_integration_status').$type<'pending' | 'contacted' | 'connected' | 'declined'>().default('pending'),
  fikenIntegrationNotes: text('fiken_integration_notes'),

  // Onboarding status
  isComplete: boolean('is_complete').default(false),
  completedAt: timestamp('completed_at'),

  // Timestamps
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Vendor onboarding steps progress table
export const vendorOnboardingSteps = pgTable('vendor_onboarding_steps', {
  id: varchar('id').primaryKey().default('gen_random_uuid()'),
  profileId: varchar('profile_id').notNull(),
  stepName: varchar('step_name').notNull(),
  stepIndex: varchar('step_index').notNull(),
  isCompleted: boolean('is_completed').default(false),
  stepData: jsonb('step_data'),
  completedAt: timestamp('completed_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Create Zod schemas for validation
export const insertVendorOnboardingProfileSchema = createInsertSchema(vendorOnboardingProfiles, {
  businessInfo: z.object({
    name: z.string().min(1, 'Business name is required'),
    email: z.string().email('Valid email is required'),
    phone: z.string().optional(),
    website: z.string().url().optional().or(z.literal('')),
    description: z.string().min(10, 'Description must be at least 10 characters'),
    categories: z.array(z.string()),
    taxId: z.string().optional(),
  }),
  vendorSpecificData: z.record(z.string(), z.any()).optional(),
  preferences: z
    .object({
      notifications: z.boolean(),
      marketingEmails: z.boolean(),
      analytics: z.boolean(),
    })
    .optional(),
});

export const insertVendorOnboardingStepSchema = createInsertSchema(vendorOnboardingSteps, {
  stepData: z.record(z.string(), z.any()).optional(),
});

export const selectVendorOnboardingProfileSchema = createSelectSchema(vendorOnboardingProfiles);
export const selectVendorOnboardingStepSchema = createSelectSchema(vendorOnboardingSteps);

// TypeScript types
export type VendorOnboardingProfile = typeof vendorOnboardingProfiles.$inferSelect;
export type InsertVendorOnboardingProfile = typeof vendorOnboardingProfiles.$inferInsert;
export type UpsertVendorOnboardingProfile = z.infer<typeof insertVendorOnboardingProfileSchema>;

export type VendorOnboardingStep = typeof vendorOnboardingSteps.$inferSelect;
export type InsertVendorOnboardingStep = typeof vendorOnboardingSteps.$inferInsert;
export type UpsertVendorOnboardingStep = z.infer<typeof insertVendorOnboardingStepSchema>;
