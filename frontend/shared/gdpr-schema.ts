/**
 * CreatorHub Norge - GDPR Compliance Database Schema
 * Complete GDPR compliance system for Norwegian privacy regulations
 */

import { sql } from 'drizzle-orm';
import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  boolean,
  integer,
  varchar,
  pgEnum,
  serial,
} from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';

// GDPR Request Types
export const gdprRequestTypeEnum = pgEnum('gdpr_request_type', [
  'data_export', // Rett til utlevering (Art. 20)
  'data_deletion', // Rett til å bli glemt (Art. 17)
  'data_correction', // Rett til retting (Art. 16)
  'data_portability', // Rett til dataportabilitet (Art. 20)
  'processing_restriction', // Rett til begrensing (Art. 18)
  'objection_to_processing', // Rett til innsigelse (Art. 21)
]);

// GDPR Request Status
export const gdprRequestStatusEnum = pgEnum('gdpr_request_status', [
  'pending', // Venter på behandling
  'in_progress', // Under behandling
  'completed', // Fullført
  'rejected', // Avvist
  'cancelled', // Kansellert
]);

// Audit Action Types
export const auditActionEnum = pgEnum('audit_action', [
  'data_access', // Datainnsyns
  'data_modification', // Dataendring
  'data_deletion', // Datasletting
  'login_attempt', // Innloggingsforsøk
  'consent_given', // Samtykke gitt
  'consent_withdrawn', // Samtykke trukket tilbake
  'privacy_settings_changed', // Personverninnstillinger endret
  'export_requested', // Eksport forespurt
  'account_created', // Konto opprettet
  'account_deleted', // Konto slettet
]);

// Consent Types
export const consentTypeEnum = pgEnum('consent_type', [
  'essential', // Nødvendige cookies
  'functional', // Funksjonelle cookies
  'analytics', // Analytiske cookies
  'marketing', // Markedsføring
  'data_processing', // Databehandling
  'email_marketing', // E-postmarkedsføring
  'third_party_sharing', // Deling med tredjeparter
]);

// Data Categories
export const dataCategoryEnum = pgEnum('data_category', [
  'personal_info', // Personopplysninger
  'contact_info', // Kontaktinformasjon
  'professional_info', // Faglig informasjon
  'project_data', // Prosjektdata
  'financial_data', // Økonomisk informasjon
  'usage_analytics', // Bruksanalyse
  'communication_data', // Kommunikasjonsdata
  'media_files', // Mediefiler
]);

// =============================================================================
// GDPR AUDIT TRAILS
// =============================================================================

export const gdprAuditTrails = pgTable('gdpr_audit_trails', {
  id: serial('id').primaryKey(),
  userId: varchar('user_id', { length: 100 }).notNull(),
  userEmail: varchar('user_email', { length: 255 }),
  action: auditActionEnum('action').notNull(),
  dataCategory: dataCategoryEnum('data_category'),
  resourceType: varchar('resource_type', { length: 100 }), // e.g., 'user_profile', 'project', 'invoice'
  resourceId: varchar('resource_id', { length: 100 }),
  oldValues: jsonb('old_values'), // Data før endring
  newValues: jsonb('new_values'), // Data etter endring
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: text('user_agent'),
  sessionId: varchar('session_id', { length: 100 }),
  legalBasis: text('legal_basis'), // Rettsgrunnlag for behandling
  purpose: text('purpose'), // Formål med behandling
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  expiresAt: timestamp('expires_at'), // For automatisk sletting
});

// =============================================================================
// PRIVACY REQUESTS (Data Subject Rights)
// =============================================================================

export const privacyRequests = pgTable('privacy_requests', {
  id: serial('id').primaryKey(),
  requestNumber: varchar('request_number', { length: 20 }).notNull().unique(),
  userId: varchar('user_id', { length: 100 }).notNull(),
  userEmail: varchar('user_email', { length: 255 }).notNull(),
  requestType: gdprRequestTypeEnum('request_type').notNull(),
  status: gdprRequestStatusEnum('status').notNull().default('pending'),
  description: text('description'),
  dataCategories: dataCategoryEnum('data_categories').array(),
  requestedData: jsonb('requested_data'), // Spesifikke data forespurt
  responseData: jsonb('response_data'), // Data levert som respons
  processingNotes: text('processing_notes'),
  completionDate: timestamp('completion_date'),
  dueDate: timestamp('due_date').notNull(), // 30 dager fra forespørsel
  processedBy: varchar('processed_by', { length: 255 }),
  verificationMethod: varchar('verification_method', { length: 100 }),
  rejectionReason: text('rejection_reason'),
  attachments: jsonb('attachments'), // Vedlegg eller dokumenter
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// =============================================================================
// CONSENT MANAGEMENT
// =============================================================================

export const userConsents = pgTable('user_consents', {
  id: serial('id').primaryKey(),
  userId: varchar('user_id', { length: 100 }).notNull(),
  consentType: consentTypeEnum('consent_type').notNull(),
  isGranted: boolean('is_granted').notNull().default(false),
  consentVersion: varchar('consent_version', { length: 20 }).notNull(), // Versjon av samtykketekst
  consentText: text('consent_text'), // Aktuel samtykketekst
  grantedAt: timestamp('granted_at'),
  withdrawnAt: timestamp('withdrawn_at'),
  expiresAt: timestamp('expires_at'), // Automatisk utløp
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: text('user_agent'),
  consentMethod: varchar('consent_method', { length: 100 }), // 'checkbox', 'button', 'opt_in'
  parentConsentId: integer('parent_consent_id'), // For child consents
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// =============================================================================
// DATA RETENTION POLICIES
// =============================================================================

export const dataRetentionPolicies = pgTable('data_retention_policies', {
  id: serial('id').primaryKey(),
  policyName: varchar('policy_name', { length: 255 }).notNull(),
  dataCategory: dataCategoryEnum('data_category').notNull(),
  resourceType: varchar('resource_type', { length: 100 }).notNull(),
  retentionPeriodDays: integer('retention_period_days').notNull(),
  gracePeriodDays: integer('grace_period_days').default(30), // Periode før permanent sletting
  autoDeleteEnabled: boolean('auto_delete_enabled').notNull().default(true),
  legalBasis: text('legal_basis').notNull(),
  description: text('description'),
  exceptions: jsonb('exceptions'), // Unntak fra regelen
  isActive: boolean('is_active').notNull().default(true),
  createdBy: varchar('created_by', { length: 255 }).notNull(),
  approvedBy: varchar('approved_by', { length: 255 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// =============================================================================
// SECURITY INCIDENTS
// =============================================================================

export const securityIncidents = pgTable('security_incidents', {
  id: serial('id').primaryKey(),
  incidentNumber: varchar('incident_number', { length: 20 }).notNull().unique(),
  severity: varchar('severity', { length: 50 }).notNull(), // 'low', 'medium', 'high', 'critical'
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description').notNull(),
  affectedUsers: integer('affected_users').default(0),
  affectedDataCategories: dataCategoryEnum('affected_data_categories').array(),
  breachType: varchar('breach_type', { length: 100 }), // 'confidentiality', 'integrity', 'availability'
  incidentDate: timestamp('incident_date').notNull(),
  discoveryDate: timestamp('discovery_date').notNull(),
  containmentDate: timestamp('containment_date'),
  resolutionDate: timestamp('resolution_date'),
  reportedToAuthority: boolean('reported_to_authority').default(false),
  authorityReportDate: timestamp('authority_report_date'),
  dataSubjectsNotified: boolean('data_subjects_notified').default(false),
  notificationDate: timestamp('notification_date'),
  rootCause: text('root_cause'),
  remediationActions: text('remediation_actions'),
  preventiveActions: text('preventive_actions'),
  status: varchar('status', { length: 50 }).notNull().default('open'), // 'open', 'investigating', 'contained', 'resolved', 'closed'
  assignedTo: varchar('assigned_to', { length: 255 }),
  reportedBy: varchar('reported_by', { length: 255 }).notNull(),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

export type GdprAuditTrail = typeof gdprAuditTrails.$inferSelect;
export type InsertGdprAuditTrail = typeof gdprAuditTrails.$inferInsert;

export type PrivacyRequest = typeof privacyRequests.$inferSelect;
export type InsertPrivacyRequest = typeof privacyRequests.$inferInsert;

export type UserConsent = typeof userConsents.$inferSelect;
export type InsertUserConsent = typeof userConsents.$inferInsert;

export type DataRetentionPolicy = typeof dataRetentionPolicies.$inferSelect;
export type InsertDataRetentionPolicy = typeof dataRetentionPolicies.$inferInsert;

export type SecurityIncident = typeof securityIncidents.$inferSelect;
export type InsertSecurityIncident = typeof securityIncidents.$inferInsert;

// =============================================================================
// ZOD VALIDATION SCHEMAS
// =============================================================================

export const insertGdprAuditTrailSchema = createInsertSchema(gdprAuditTrails).omit({
  id: true,
  createdAt: true,
});

export const insertPrivacyRequestSchema = createInsertSchema(privacyRequests)
  .omit({
    id: true,
    requestNumber: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    description: z.string().min(10, 'Beskrivelse må være minst 10 tegn'),
  });

export const insertUserConsentSchema = createInsertSchema(userConsents).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertDataRetentionPolicySchema = createInsertSchema(dataRetentionPolicies)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    policyName: z.string().min(3, 'Policynavn må være minst 3 tegn'),
    retentionPeriodDays: z.number().min(1, 'Lagringsperiode må være minst 1 dag'),
    legalBasis: z.string().min(10, 'Rettsgrunnlag må spesifiseres'),
  });

export const insertSecurityIncidentSchema = createInsertSchema(securityIncidents)
  .omit({
    id: true,
    incidentNumber: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    title: z.string().min(5, 'Tittel må være minst 5 tegn'),
    description: z.string().min(20, 'Beskrivelse må være minst 20 tegn'),
  });

// Export types for validation
export type InsertGdprAuditTrailInput = z.infer<typeof insertGdprAuditTrailSchema>;
export type InsertPrivacyRequestInput = z.infer<typeof insertPrivacyRequestSchema>;
export type InsertUserConsentInput = z.infer<typeof insertUserConsentSchema>;
export type InsertDataRetentionPolicyInput = z.infer<typeof insertDataRetentionPolicySchema>;
export type InsertSecurityIncidentInput = z.infer<typeof insertSecurityIncidentSchema>;
