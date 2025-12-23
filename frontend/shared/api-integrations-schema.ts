/**
 * CreatorHub Norge - API Integrations Schema
 * Schema for managing third-party API integrations through admin dashboard
 */

import { pgTable, varchar, text, jsonb, boolean, timestamp, serial } from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';

// API Integration Providers table
export const apiIntegrationProviders = pgTable('api_integration_providers', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(), // e.g., "Fiken", "Tripletex", "PowerOffice"
  displayName: varchar('display_name', { length: 255 }).notNull(),
  description: text('description'),
  category: varchar('category', { length: 100 }).notNull(), // accounting, crm, email, storage
  logoUrl: text('logo_url'),
  websiteUrl: text('website_url'),
  documentationUrl: text('documentation_url'),
  baseApiUrl: text('base_api_url'),
  authType: varchar('auth_type', { length: 50 }).notNull(), // oauth2, api_key, basic_auth
  configSchema: jsonb('config_schema').notNull(), // JSON schema for configuration fields
  supportedFeatures: jsonb('supported_features'), // Array of features this provider supports
  active: boolean('active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// User API Integration Configurations
export const userApiIntegrations = pgTable('user_api_integrations', {
  id: serial('id').primaryKey(),
  userId: varchar('user_id', { length: 255 }).notNull(),
  providerId: varchar('provider_id', { length: 255 }).notNull(), // References provider name
  displayName: varchar('display_name', { length: 255 }), // Custom name for this integration
  configuration: jsonb('configuration').notNull(), // Encrypted API keys and settings
  clientId: text('client_id'), // OAuth Client ID (encrypted)
  clientSecret: text('client_secret'), // OAuth Client Secret (encrypted)
  apiKey: text('api_key'), // API Key (encrypted)
  accessToken: text('access_token'), // OAuth Access Token (encrypted)
  refreshToken: text('refresh_token'), // OAuth Refresh Token (encrypted)
  tokenExpiresAt: timestamp('token_expires_at'), // Token expiration
  isActive: boolean('is_active').default(true),
  isEnabled: boolean('is_enabled').default(false), // User can enable/disable
  lastSyncAt: timestamp('last_sync_at'),
  syncStatus: varchar('sync_status', { length: 50 }).default('pending'), // pending, active, error, disabled
  errorMessage: text('error_message'),
  syncFrequency: varchar('sync_frequency', { length: 50 }).default('manual'), // manual, hourly, daily, weekly
  webhookUrl: text('webhook_url'), // For webhook-based integrations
  environment: varchar('environment', { length: 50 }).default('production'), // sandbox, production
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Integration Sync Logs
export const integrationSyncLogs = pgTable('integration_sync_logs', {
  id: serial('id').primaryKey(),
  userIntegrationId: serial('user_integration_id').references(() => userApiIntegrations.id),
  syncType: varchar('sync_type', { length: 100 }).notNull(), // full_sync, incremental, manual
  status: varchar('status', { length: 50 }).notNull(), // success, error, partial
  recordsProcessed: serial('records_processed').default(0),
  recordsSuccessful: serial('records_successful').default(0),
  recordsFailed: serial('records_failed').default(0),
  startedAt: timestamp('started_at').defaultNow(),
  completedAt: timestamp('completed_at'),
  errorDetails: jsonb('error_details'),
  syncData: jsonb('sync_data'), // Details about what was synced
});

// Pre-defined Integration Templates (for Visual CMS management)
export const integrationTemplates = pgTable('integration_templates', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  displayName: varchar('display_name', { length: 255 }).notNull(),
  category: varchar('category', { length: 100 }).notNull(),
  description: text('description'),
  configurationTemplate: jsonb('configuration_template').notNull(),
  setupInstructions: jsonb('setup_instructions'), // Step-by-step setup guide
  features: jsonb('features'), // List of supported features
  requiredFields: jsonb('required_fields'), // Required configuration fields
  optionalFields: jsonb('optional_fields'), // Optional configuration fields
  validationRules: jsonb('validation_rules'), // Field validation rules
  testEndpoint: text('test_endpoint'), // Endpoint to test connection
  active: boolean('active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Type definitions
export type ApiIntegrationProvider = typeof apiIntegrationProviders.$inferSelect;
export type InsertApiIntegrationProvider = typeof apiIntegrationProviders.$inferInsert;

export type UserApiIntegration = typeof userApiIntegrations.$inferSelect;
export type InsertUserApiIntegration = typeof userApiIntegrations.$inferInsert;

export type IntegrationSyncLog = typeof integrationSyncLogs.$inferSelect;
export type InsertIntegrationSyncLog = typeof integrationSyncLogs.$inferInsert;

export type IntegrationTemplate = typeof integrationTemplates.$inferSelect;
export type InsertIntegrationTemplate = typeof integrationTemplates.$inferInsert;

// Zod schemas for validation
export const insertApiIntegrationProviderSchema = createInsertSchema(apiIntegrationProviders);
export const selectApiIntegrationProviderSchema = createSelectSchema(apiIntegrationProviders);

export const insertUserApiIntegrationSchema = createInsertSchema(userApiIntegrations);
export const selectUserApiIntegrationSchema = createSelectSchema(userApiIntegrations);

export const insertIntegrationSyncLogSchema = createInsertSchema(integrationSyncLogs);
export const selectIntegrationSyncLogSchema = createSelectSchema(integrationSyncLogs);

export const insertIntegrationTemplateSchema = createInsertSchema(integrationTemplates);
export const selectIntegrationTemplateSchema = createSelectSchema(integrationTemplates);

// Specific Fiken integration schema
export const fikenConfigSchema = z.object({
  apiKey: z.string().min(1, 'API-nøkkel er påkrevd'),
  companySlug: z.string().min(1, 'Firmaslug er påkrevd'),
  environment: z.enum(['sandbox', 'production']).default('sandbox'),
  syncInvoices: z.boolean().default(true),
  syncCustomers: z.boolean().default(true),
  syncProducts: z.boolean().default(false),
  webhookUrl: z.string().url().optional(),
  autoCreateCustomers: z.boolean().default(false),
  defaultVatRate: z.number().min(0).max(100).default(25),
});

export type FikenConfig = z.infer<typeof fikenConfigSchema>;
