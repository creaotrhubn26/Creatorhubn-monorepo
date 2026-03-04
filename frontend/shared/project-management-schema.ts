import {
  pgTable,
  text,
  varchar,
  timestamp,
  numeric,
  jsonb,
  boolean,
  integer,
} from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import type { z } from 'zod';

// Core schemas
export const clients = pgTable('clients', {
  id: varchar('id').primaryKey(),
  userId: varchar('user_id').notNull(),
  name: varchar('name').notNull(),
  email: varchar('email').notNull(),
  phone: varchar('phone'),
  company: varchar('company'),
  projectType: varchar('project_type'),
  address: varchar('address'),
  city: varchar('city'),
  postalCode: varchar('postal_code'),
  status: varchar('status').default('active'),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const projects = pgTable('projects', {
  id: varchar('id').primaryKey(),
  title: varchar('title').notNull(),
  description: text('description'),
  projectType: varchar('project_type'),
  status: varchar('status').notNull(),
  priority: varchar('priority'),
  budget: numeric('budget'),
  clientName: varchar('client_name'),
  leadCreator: varchar('lead_creator'),
  memberCount: integer('member_count').default(1),
  completionPercentage: integer('completion_percentage').default(0),
  dueDate: varchar('due_date'),
  tags: jsonb('tags'),
  createdAt: timestamp('created_at').defaultNow(),
  userId: varchar('user_id'),
  clientId: varchar('client_id'),
  name: varchar('name'),
  eventDate: timestamp('event_date'),
  location: varchar('location'),
  packageType: varchar('package_type'),
  totalPrice: numeric('total_price'),
  eventType: varchar('event_type'),
  depositAmount: numeric('deposit_amount'),
  depositPaid: boolean('deposit_paid').default(false),
  finalAmount: numeric('final_amount'),
  currency: varchar('currency').default('NOK'),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const contractors = pgTable('contractors', {
  id: varchar('id').primaryKey(),
  name: varchar('name').notNull(),
  email: varchar('email').notNull().unique(),
  phone: varchar('phone'),
  specialization: varchar('specialization').notNull(), // photographer, videographer, editor, assistant
  skills: jsonb('skills'),
  portfolio: jsonb('portfolio'),
  hourlyRate: numeric('hourly_rate'),
  dayRate: numeric('day_rate'),
  availability: jsonb('availability'),
  active: boolean('active').default(true),
  rating: numeric('rating'),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const project_assignments = pgTable('project_assignments', {
  id: varchar('id').primaryKey(),
  projectId: varchar('project_id').notNull(),
  contractorId: varchar('contractor_id').notNull(),
  role: varchar('role').notNull(), // lead_photographer, assistant_photographer, videographer, editor
  startDate: timestamp('start_date').notNull(),
  endDate: timestamp('end_date'),
  status: varchar('status').notNull(), // assigned, confirmed, in_progress, completed, cancelled
  rate: numeric('rate'),
  rateType: varchar('rate_type'), // hourly, daily, fixed
  estimatedHours: numeric('estimated_hours'),
  actualHours: numeric('actual_hours'),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const contracts = pgTable('contracts', {
  id: varchar('id').primaryKey(),
  projectId: varchar('project_id').notNull(),
  contractorId: varchar('contractor_id'),
  clientId: varchar('client_id'),
  type: varchar('type').notNull(), // client_contract, contractor_agreement
  status: varchar('status').notNull(), // draft, sent, signed, completed, cancelled
  terms: jsonb('terms'),
  paymentTerms: jsonb('payment_terms'),
  deliverables: jsonb('deliverables'),
  signedDate: timestamp('signed_date'),
  expiryDate: timestamp('expiry_date'),
  documentUrl: varchar('document_url'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const payments = pgTable('payments', {
  id: varchar('id').primaryKey(),
  projectId: varchar('project_id').notNull(),
  clientId: varchar('client_id'),
  contractorId: varchar('contractor_id'),
  type: varchar('type').notNull(), // deposit, milestone, final, contractor_payment
  amount: numeric('amount').notNull(),
  currency: varchar('currency').default('NOK'),
  status: varchar('status').notNull(), // pending, processing, completed, failed, refunded
  method: varchar('method'), // bank_transfer, cash, invoice, check
  description: text('description'),
  dueDate: timestamp('due_date'),
  paidDate: timestamp('paid_date'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const project_files = pgTable('project_files', {
  id: varchar('id').primaryKey(),
  projectId: varchar('project_id').notNull(),
  name: varchar('name').notNull(),
  type: varchar('type').notNull(), // image, video, document, contract
  category: varchar('category'), // raw, edited, final, contract, invoice
  url: varchar('url').notNull(),
  size: integer('size'),
  metadata: jsonb('metadata'),
  uploadedBy: varchar('uploaded_by'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const project_communications = pgTable('project_communications', {
  id: varchar('id').primaryKey(),
  projectId: varchar('project_id').notNull(),
  type: varchar('type').notNull(), // email, call, meeting, message
  subject: varchar('subject'),
  content: text('content'),
  participants: jsonb('participants'),
  scheduledDate: timestamp('scheduled_date'),
  completedDate: timestamp('completed_date'),
  status: varchar('status').notNull(), // scheduled, completed, cancelled
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Insert schemas
export const insertClientSchema = createInsertSchema(clients).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertProjectSchema = createInsertSchema(projects).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertContractorSchema = createInsertSchema(contractors).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertProjectAssignmentSchema = createInsertSchema(project_assignments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertContractSchema = createInsertSchema(contracts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPaymentSchema = createInsertSchema(payments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertProjectFileSchema = createInsertSchema(project_files).omit({
  id: true,
  createdAt: true,
});

export const insertProjectCommunicationSchema = createInsertSchema(project_communications).omit({
  id: true,
  createdAt: true,
});

// Types
export type Client = typeof clients.$inferSelect;
export type InsertClient = z.infer<typeof insertClientSchema>;

export type Project = typeof projects.$inferSelect;
export type InsertProject = z.infer<typeof insertProjectSchema>;

export type Contractor = typeof contractors.$inferSelect;
export type InsertContractor = z.infer<typeof insertContractorSchema>;

export type ProjectAssignment = typeof project_assignments.$inferSelect;
export type InsertProjectAssignment = z.infer<typeof insertProjectAssignmentSchema>;

export type Contract = typeof contracts.$inferSelect;
export type InsertContract = z.infer<typeof insertContractSchema>;

export type Payment = typeof payments.$inferSelect;
export type InsertPayment = z.infer<typeof insertPaymentSchema>;

export type ProjectFile = typeof project_files.$inferSelect;
export type InsertProjectFile = z.infer<typeof insertProjectFileSchema>;

export type ProjectCommunication = typeof project_communications.$inferSelect;
export type InsertProjectCommunication = z.infer<typeof insertProjectCommunicationSchema>;
