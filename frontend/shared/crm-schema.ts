import {
  pgTable,
  text,
  varchar,
  timestamp,
  jsonb,
  serial,
  integer,
  boolean,
  decimal,
  date,
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';

// CRM Contacts - Main customer/client database
export const crmContacts = pgTable('crm_contacts', {
  id: serial('id').primaryKey(),
  firstName: varchar('first_name', { length: 100 }).notNull(),
  lastName: varchar('last_name', { length: 100 }).notNull(),
  email: varchar('email', { length: 255 }).unique(),
  phone: varchar('phone', { length: 50 }),
  company: varchar('company', { length: 200 }),
  jobTitle: varchar('job_title', { length: 150 }),
  industry: varchar('industry', { length: 100 }),
  source: varchar('source', { length: 100 }), // Website form, referral, social media, etc.

  // Address information
  street: varchar('street', { length: 255 }),
  city: varchar('city', { length: 100 }),
  state: varchar('state', { length: 100 }),
  postalCode: varchar('postal_code', { length: 20 }),
  country: varchar('country', { length: 100 }).default('Norway'),

  // Social media and web presence
  website: varchar('website', { length: 255 }),
  linkedinUrl: varchar('linkedin_url', { length: 255 }),
  instagramHandle: varchar('instagram_handle', { length: 100 }),
  facebookUrl: varchar('facebook_url', { length: 255 }),

  // CRM specific fields
  status: varchar('status', {
    enum: ['lead', 'prospect', 'customer', 'inactive', 'lost'],
  }).default('lead'),
  priority: varchar('priority', {
    enum: ['low', 'medium', 'high', 'urgent'],
  }).default('medium'),

  // Relationship information
  assignedTo: varchar('assigned_to'), // User ID of sales rep/account manager

  // Financial information
  estimatedValue: decimal('estimated_value', { precision: 10, scale: 2 }),
  totalSpent: decimal('total_spent', { precision: 10, scale: 2 }).default('0'),

  // Tags and categories for creative services
  tags: text('tags').array(), // photography, videography, music, wedding, etc.
  preferredServices: text('preferred_services').array(),

  // Communication preferences
  communicationPreference: varchar('communication_preference', {
    enum: ['email', 'phone', 'sms', 'social'],
  }).default('email'),

  // Custom fields for creative industry
  projectTypes: text('project_types').array(), // weddings, corporate, events, etc.
  budget: varchar('budget', { length: 50 }),
  timeline: varchar('timeline', { length: 100 }),

  // Metadata
  notes: text('notes'),
  customFields: jsonb('custom_fields'), // Flexible storage for additional data

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  lastContactedAt: timestamp('last_contacted_at'),
});

// CRM Deals/Opportunities - Sales pipeline management
export const crmDeals = pgTable('crm_deals', {
  id: serial('id').primaryKey(),
  title: varchar('title', { length: 200 }).notNull(),
  contactId: integer('contact_id').references(() => crmContacts.id),

  // Deal information
  value: decimal('value', { precision: 10, scale: 2 }).notNull(),
  currency: varchar('currency', { length: 3 }).default('NOK'),
  probability: integer('probability').default(50), // 0-100%

  // Pipeline stage
  stage: varchar('stage', {
    enum: ['prospecting', 'qualification', 'proposal', 'negotiation', 'closed_won', 'closed_lost'],
  }).default('prospecting'),

  // Norwegian creative services specific stages
  serviceType: varchar('service_type', {
    enum: [
      'photography',
      'videography',
      'music_production',
      'lighting',
      'wedding_package',
      'corporate',
      'event',
    ],
  }),

  // Deal management
  assignedTo: varchar('assigned_to'), // Sales rep/account manager
  expectedCloseDate: date('expected_close_date'),
  actualCloseDate: date('actual_close_date'),

  // Project details for creative services
  projectDescription: text('project_description'),
  deliverables: text('deliverables').array(),
  timeline: varchar('timeline', { length: 100 }),
  location: varchar('location', { length: 200 }),

  // Competition and market info
  competitors: text('competitors').array(),
  lostReason: varchar('lost_reason', { length: 255 }),

  // Tags and categorization
  tags: text('tags').array(),
  priority: varchar('priority', {
    enum: ['low', 'medium', 'high', 'urgent'],
  }).default('medium'),

  notes: text('notes'),
  customFields: jsonb('custom_fields'),

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// CRM Activities - Communication and interaction tracking
export const crmActivities = pgTable('crm_activities', {
  id: serial('id').primaryKey(),
  contactId: integer('contact_id').references(() => crmContacts.id),
  dealId: integer('deal_id').references(() => crmDeals.id),

  // Activity details
  type: varchar('type', {
    enum: [
      'call',
      'email',
      'meeting',
      'task',
      'note',
      'proposal_sent',
      'contract_signed',
      'payment_received',
    ],
  }).notNull(),

  subject: varchar('subject', { length: 200 }).notNull(),
  description: text('description'),

  // Timing
  scheduledAt: timestamp('scheduled_at'),
  completedAt: timestamp('completed_at'),
  duration: integer('duration'), // in minutes

  // Participants
  assignedTo: varchar('assigned_to'), // User who performed the activity
  participants: text('participants').array(), // Other people involved

  // Communication details
  direction: varchar('direction', { enum: ['inbound', 'outbound'] }),
  outcome: varchar('outcome', {
    enum: ['successful', 'no_answer', 'busy', 'rescheduled', 'cancelled'],
  }),

  // Follow-up
  requiresFollowUp: boolean('requires_follow_up').default(false),
  followUpDate: date('follow_up_date'),
  followUpNotes: text('follow_up_notes'),

  // Attachments and references
  attachments: text('attachments').array(), // File paths or URLs
  relatedEmails: text('related_emails').array(),

  tags: text('tags').array(),
  customFields: jsonb('custom_fields'),

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// CRM Tasks - To-do items and reminders
export const crmTasks = pgTable('crm_tasks', {
  id: serial('id').primaryKey(),
  title: varchar('title', { length: 200 }).notNull(),
  description: text('description'),

  // Relationships
  contactId: integer('contact_id').references(() => crmContacts.id),
  dealId: integer('deal_id').references(() => crmDeals.id),

  // Task management
  assignedTo: varchar('assigned_to').notNull(),
  priority: varchar('priority', {
    enum: ['low', 'medium', 'high', 'urgent'],
  }).default('medium'),

  status: varchar('status', {
    enum: ['pending', 'in_progress', 'completed', 'cancelled'],
  }).default('pending'),

  // Timing
  dueDate: date('due_date'),
  reminderDate: timestamp('reminder_date'),
  completedAt: timestamp('completed_at'),

  // Task type for creative services
  taskType: varchar('task_type', {
    enum: [
      'follow_up',
      'proposal',
      'meeting_prep',
      'contract_review',
      'project_delivery',
      'payment_follow_up',
    ],
  }),

  tags: text('tags').array(),
  customFields: jsonb('custom_fields'),

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// CRM Pipeline Stages - Customizable sales stages
export const crmPipelineStages = pgTable('crm_pipeline_stages', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: varchar('name', { length: 100 }).notNull(),
  stage_order: integer('stage_order').notNull(),
  color: varchar('color', { length: 7 }).default('#3B82F6'),
  description: text('description'),
  is_active: boolean('is_active').default(true),
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').defaultNow(),
});

// CRM Email Templates - For automated and consistent communication
export const crmEmailTemplates = pgTable('crm_email_templates', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 200 }).notNull(),
  subject: varchar('subject', { length: 300 }).notNull(),
  content: text('content').notNull(),

  // Template categorization
  category: varchar('category', {
    enum: ['welcome', 'follow_up', 'proposal', 'contract', 'thank_you', 'reminder', 'newsletter'],
  }),

  // Creative services specific
  serviceType: varchar('service_type', {
    enum: ['photography', 'videography', 'music_production', 'general'],
  }),

  // Template settings
  isActive: boolean('is_active').default(true),
  language: varchar('language', { length: 5 }).default('no'),

  // Usage tracking
  useCount: integer('use_count').default(0),
  lastUsed: timestamp('last_used'),

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Advanced Lead Scoring System
export const leadScoringRules = pgTable('lead_scoring_rules', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 200 }).notNull(),
  description: text('description'),

  // Scoring criteria
  criteriaType: varchar('criteria_type', {
    enum: ['demographic', 'behavioral', 'firmographic', 'engagement', 'norwegian_market'],
  }).notNull(),

  // Rule configuration
  field: varchar('field', { length: 100 }).notNull(), // Field to evaluate
  operator: varchar('operator', {
    enum: ['equals', 'contains', 'greater_than', 'less_than', 'in_range', 'exists'],
  }).notNull(),
  value: varchar('value', { length: 500 }), // Value to compare against

  // Scoring
  score: integer('score').notNull(), // Points to add/subtract
  maxScore: integer('max_score'), // Maximum points from this rule

  // Norwegian creative industry specific
  industryWeight: decimal('industry_weight', {
    precision: 3,
    scale: 2,
  }).default('1.0'),
  serviceRelevance: text('service_relevance').array(), // Which services this applies to

  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Lead Scoring History
export const leadScoringHistory = pgTable('lead_scoring_history', {
  id: serial('id').primaryKey(),
  contactId: integer('contact_id')
    .references(() => crmContacts.id)
    .notNull(),

  // Scoring details
  previousScore: integer('previous_score').default(0),
  newScore: integer('new_score').notNull(),
  scoreDelta: integer('score_delta').notNull(),

  // Trigger information
  triggerEvent: varchar('trigger_event', { length: 200 }), // What caused the score change
  ruleApplied: varchar('rule_applied', { length: 200 }), // Which rule was applied

  // Norwegian market factors
  marketSegment: varchar('market_segment', { length: 100 }),
  regionalInfluence: decimal('regional_influence', { precision: 3, scale: 2 }),

  scoredAt: timestamp('scored_at').defaultNow(),
});

// Automated Follow-up Sequences
export const followUpSequences = pgTable('follow_up_sequences', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 200 }).notNull(),
  description: text('description'),

  // Sequence configuration
  triggerEvent: varchar('trigger_event', {
    enum: ['new_lead', 'demo_request', 'proposal_sent', 'no_response', 'contract_expired'],
  }).notNull(),

  // Norwegian creative industry focus
  serviceType: varchar('service_type', {
    enum: ['photography', 'videography', 'music_production', 'lighting', 'wedding', 'corporate'],
  }),

  // Sequence steps
  steps: jsonb('steps').$type<SequenceStep[]>().notNull(),

  // Settings
  isActive: boolean('is_active').default(true),
  maxExecutions: integer('max_executions').default(1), // How many times can this run per contact

  // Performance tracking
  totalExecutions: integer('total_executions').default(0),
  successRate: decimal('success_rate', { precision: 5, scale: 2 }),

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Sequence Executions
export const sequenceExecutions = pgTable('sequence_executions', {
  id: serial('id').primaryKey(),
  sequenceId: integer('sequence_id')
    .references(() => followUpSequences.id)
    .notNull(),
  contactId: integer('contact_id')
    .references(() => crmContacts.id)
    .notNull(),

  // Execution status
  status: varchar('status', {
    enum: ['active', 'paused', 'completed', 'cancelled'],
  }).default('active'),

  currentStep: integer('current_step').default(0),

  // Timing
  startedAt: timestamp('started_at').defaultNow(),
  nextActionAt: timestamp('next_action_at'),
  completedAt: timestamp('completed_at'),

  // Results
  successfulSteps: integer('successful_steps').default(0),
  skippedSteps: integer('skipped_steps').default(0),

  // Norwegian market tracking
  marketResponse: varchar('market_response', { length: 100 }),
  culturalAdaptation: text('cultural_adaptation'),
});

// Revenue Forecasting
export const revenueForecast = pgTable('revenue_forecast', {
  id: serial('id').primaryKey(),

  // Forecast period
  forecastPeriod: varchar('forecast_period', {
    enum: ['monthly', 'quarterly', 'yearly'],
  }).notNull(),
  startDate: date('start_date').notNull(),
  endDate: date('end_date').notNull(),

  // Service type breakdown
  serviceType: varchar('service_type', {
    enum: [
      'photography',
      'videography',
      'music_production',
      'lighting',
      'wedding_package',
      'corporate',
    ],
  }),

  // Forecast data
  predictedRevenue: decimal('predicted_revenue', {
    precision: 12,
    scale: 2,
  }).notNull(),
  confidence: integer('confidence'), // 0-100%

  // Norwegian market factors
  seasonalAdjustment: decimal('seasonal_adjustment', {
    precision: 5,
    scale: 2,
  }),
  marketTrends: jsonb('market_trends').$type<MarketTrend[]>(),
  competitorInfluence: decimal('competitor_influence', {
    precision: 5,
    scale: 2,
  }),

  // Contributing deals
  pipelineValue: decimal('pipeline_value', { precision: 12, scale: 2 }),
  weightedPipelineValue: decimal('weighted_pipeline_value', {
    precision: 12,
    scale: 2,
  }),

  // Model information
  modelVersion: varchar('model_version', { length: 50 }),
  dataPoints: integer('data_points'), // Number of data points used

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Norwegian Payment Integration
export const norwegianPayments = pgTable('norwegian_payments', {
  id: serial('id').primaryKey(),
  dealId: integer('deal_id')
    .references(() => crmDeals.id)
    .notNull(),
  contactId: integer('contact_id')
    .references(() => crmContacts.id)
    .notNull(),

  // Payment details
  amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
  currency: varchar('currency', { length: 3 }).default('NOK'),

  // Norwegian payment methods
  paymentMethod: varchar('payment_method', {
    enum: ['vipps', 'bank_transfer', 'credit_card', 'bankid', 'invoice'],
  }).notNull(),

  // Tax compliance
  mvaRate: decimal('mva_rate', { precision: 5, scale: 2 }).default('25.00'), // 25% Norwegian VAT
  mvaAmount: decimal('mva_amount', { precision: 10, scale: 2 }),
  netAmount: decimal('net_amount', { precision: 10, scale: 2 }),

  // Invoice information
  invoiceNumber: varchar('invoice_number', { length: 50 }),
  invoiceDate: date('invoice_date'),
  dueDate: date('due_date'),

  // Payment status
  status: varchar('status', {
    enum: ['pending', 'processing', 'completed', 'failed', 'refunded'],
  }).default('pending'),

  // Norwegian business requirements
  organizationNumber: varchar('organization_number', { length: 20 }), // Customer's org number
  referenceNumber: varchar('reference_number', { length: 100 }),

  // Payment tracking
  transactionId: varchar('transaction_id', { length: 200 }),
  processedAt: timestamp('processed_at'),

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Relations
export const crmContactsRelations = relations(crmContacts, ({ many }) => ({
  deals: many(crmDeals),
  activities: many(crmActivities),
  tasks: many(crmTasks),
}));

export const crmDealsRelations = relations(crmDeals, ({ one, many }) => ({
  contact: one(crmContacts, {
    fields: [crmDeals.contactId],
    references: [crmContacts.id],
  }),
  activities: many(crmActivities),
  tasks: many(crmTasks),
}));

export const crmActivitiesRelations = relations(crmActivities, ({ one }) => ({
  contact: one(crmContacts, {
    fields: [crmActivities.contactId],
    references: [crmContacts.id],
  }),
  deal: one(crmDeals, {
    fields: [crmActivities.dealId],
    references: [crmDeals.id],
  }),
}));

export const crmTasksRelations = relations(crmTasks, ({ one }) => ({
  contact: one(crmContacts, {
    fields: [crmTasks.contactId],
    references: [crmContacts.id],
  }),
  deal: one(crmDeals, {
    fields: [crmTasks.dealId],
    references: [crmDeals.id],
  }),
}));

// Enhanced CRM Types
export interface SequenceStep {
  id: string;
  type: 'email' | 'sms' | 'task' | 'wait';
  delay: number; // Days to wait
  templateId?: number;
  subject?: string;
  content?: string;
  taskTitle?: string;
  norwegianContent?: string;
}

export interface MarketTrend {
  factor: string;
  impact: number; // -1 to 1
  confidence: number; // 0-100%
  description: string;
  norwegianContext?: string;
}

// Zod schemas for validation
export const insertCrmContactSchema = createInsertSchema(crmContacts);
export const insertCrmDealSchema = createInsertSchema(crmDeals);
export const insertCrmActivitySchema = createInsertSchema(crmActivities);
export const insertCrmTaskSchema = createInsertSchema(crmTasks);
export const insertCrmEmailTemplateSchema = createInsertSchema(crmEmailTemplates);
export const insertLeadScoringRuleSchema = createInsertSchema(leadScoringRules);
export const insertLeadScoringHistorySchema = createInsertSchema(leadScoringHistory);
export const insertFollowUpSequenceSchema = createInsertSchema(followUpSequences);
export const insertSequenceExecutionSchema = createInsertSchema(sequenceExecutions);
export const insertRevenueForecastSchema = createInsertSchema(revenueForecast);
export const insertNorwegianPaymentSchema = createInsertSchema(norwegianPayments);

// Types
export type CrmContact = typeof crmContacts.$inferSelect;
export type InsertCrmContact = z.infer<typeof insertCrmContactSchema>;
export type CrmDeal = typeof crmDeals.$inferSelect;
export type InsertCrmDeal = z.infer<typeof insertCrmDealSchema>;
export type CrmActivity = typeof crmActivities.$inferSelect;
export type InsertCrmActivity = z.infer<typeof insertCrmActivitySchema>;
export type CrmTask = typeof crmTasks.$inferSelect;
export type InsertCrmTask = z.infer<typeof insertCrmTaskSchema>;
export type CrmEmailTemplate = typeof crmEmailTemplates.$inferSelect;
export type InsertCrmEmailTemplate = z.infer<typeof insertCrmEmailTemplateSchema>;
export type LeadScoringRule = typeof leadScoringRules.$inferSelect;
export type InsertLeadScoringRule = z.infer<typeof insertLeadScoringRuleSchema>;
export type LeadScoringHistory = typeof leadScoringHistory.$inferSelect;
export type InsertLeadScoringHistory = z.infer<typeof insertLeadScoringHistorySchema>;
export type FollowUpSequence = typeof followUpSequences.$inferSelect;
export type InsertFollowUpSequence = z.infer<typeof insertFollowUpSequenceSchema>;
export type SequenceExecution = typeof sequenceExecutions.$inferSelect;
export type InsertSequenceExecution = z.infer<typeof insertSequenceExecutionSchema>;
export type RevenueForecast = typeof revenueForecast.$inferSelect;
export type InsertRevenueForecast = z.infer<typeof insertRevenueForecastSchema>;
export type NorwegianPayment = typeof norwegianPayments.$inferSelect;
export type InsertNorwegianPayment = z.infer<typeof insertNorwegianPaymentSchema>;
