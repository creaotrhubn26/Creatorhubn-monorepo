/**
 * Role Room (Casting System) Database Schema — Drizzle ORM
 * Migrated from Virtualstudio casting tables into Creatorhub
 */

import {
  pgTable,
  varchar,
  text,
  boolean,
  integer,
  numeric,
  jsonb,
  timestamp,
  index,
  uniqueIndex,
  uuid,
  date,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// ── Core Casting Tables ──────────────────────────────────────

export const castingProjects = pgTable('casting_projects', {
  id: varchar('id', { length: 255 }).primaryKey().notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  status: varchar('status', { length: 50 }).default('active'),
  createdBy: varchar('created_by', { length: 255 }),
  genre: varchar('genre', { length: 100 }),
  projectType: varchar('project_type', { length: 100 }),
  startDate: date('start_date'),
  endDate: date('end_date'),
  budget: numeric('budget', { precision: 12, scale: 2 }),
  currency: varchar('currency', { length: 10 }).default('NOK'),
  settings: jsonb('settings').default({}),
  metadata: jsonb('metadata').default({}),
  /** Link to Creatorhub project ID for bidirectional sync */
  creatorhubProjectId: varchar('creatorhub_project_id', { length: 255 }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
  index('casting_projects_created_by_idx').using('btree', table.createdBy),
  index('casting_projects_status_idx').using('btree', table.status),
  index('casting_projects_creatorhub_project_id_idx').using('btree', table.creatorhubProjectId),
]);

export const castingRoles = pgTable('casting_roles', {
  id: varchar('id', { length: 255 }).primaryKey().notNull(),
  projectId: varchar('project_id', { length: 255 }).notNull().references(() => castingProjects.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  ageRange: varchar('age_range', { length: 50 }),
  gender: varchar('gender', { length: 50 }),
  ethnicity: varchar('ethnicity', { length: 100 }),
  roleType: varchar('role_type', { length: 100 }),
  sceneIds: jsonb('scene_ids').default([]),
  requirements: jsonb('requirements').default({}),
  status: varchar('status', { length: 50 }).default('open'),
  assignedCandidateId: varchar('assigned_candidate_id', { length: 255 }),
  candidateIds: jsonb('candidate_ids').default([]),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
  index('casting_roles_project_id_idx').using('btree', table.projectId),
]);

export const castingCandidates = pgTable('casting_candidates', {
  id: varchar('id', { length: 255 }).primaryKey().notNull(),
  projectId: varchar('project_id', { length: 255 }).notNull().references(() => castingProjects.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }),
  phone: varchar('phone', { length: 50 }),
  agency: varchar('agency', { length: 255 }),
  photos: jsonb('photos').default([]),
  videos: jsonb('videos').default([]),
  notes: text('notes'),
  status: varchar('status', { length: 50 }).default('pending'),
  assignedRoles: jsonb('assigned_roles').default([]),
  rating: integer('rating'),
  metadata: jsonb('metadata').default({}),
  emergencyContact: jsonb('emergency_contact').default({}),
  consentStatus: varchar('consent_status', { length: 50 }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
  index('casting_candidates_project_id_idx').using('btree', table.projectId),
]);

export const castingSchedules = pgTable('casting_schedules', {
  id: varchar('id', { length: 255 }).primaryKey().notNull(),
  projectId: varchar('project_id', { length: 255 }).notNull().references(() => castingProjects.id, { onDelete: 'cascade' }),
  candidateId: varchar('candidate_id', { length: 255 }),
  roleId: varchar('role_id', { length: 255 }),
  sceneId: varchar('scene_id', { length: 255 }),
  locationId: varchar('location_id', { length: 255 }),
  date: date('date'),
  startTime: varchar('start_time', { length: 10 }),
  endTime: varchar('end_time', { length: 10 }),
  type: varchar('type', { length: 50 }),
  status: varchar('status', { length: 50 }).default('scheduled'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
  index('casting_schedules_project_id_idx').using('btree', table.projectId),
]);

export const castingCrew = pgTable('casting_crew', {
  id: varchar('id', { length: 255 }).primaryKey().notNull(),
  projectId: varchar('project_id', { length: 255 }).notNull().references(() => castingProjects.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  role: varchar('role', { length: 100 }).notNull(),
  email: varchar('email', { length: 255 }),
  phone: varchar('phone', { length: 50 }),
  department: varchar('department', { length: 100 }),
  rate: numeric('rate', { precision: 10, scale: 2 }),
  availability: jsonb('availability').default({}),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
  index('casting_crew_project_id_idx').using('btree', table.projectId),
]);

export const castingLocations = pgTable('casting_locations', {
  id: varchar('id', { length: 255 }).primaryKey().notNull(),
  projectId: varchar('project_id', { length: 255 }).notNull().references(() => castingProjects.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  address: text('address'),
  coordinates: jsonb('coordinates'),
  type: varchar('type', { length: 100 }),
  contactInfo: jsonb('contact_info').default({}),
  accessNotes: text('access_notes'),
  photos: jsonb('photos').default([]),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
  index('casting_locations_project_id_idx').using('btree', table.projectId),
]);

export const castingProps = pgTable('casting_props', {
  id: varchar('id', { length: 255 }).primaryKey().notNull(),
  projectId: varchar('project_id', { length: 255 }).notNull().references(() => castingProjects.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  category: varchar('category', { length: 100 }),
  description: text('description'),
  images: jsonb('images').default([]),
  availability: varchar('availability', { length: 50 }).default('available'),
  quantity: integer('quantity').default(1),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
  index('casting_props_project_id_idx').using('btree', table.projectId),
]);

export const castingProductionDays = pgTable('casting_production_days', {
  id: varchar('id', { length: 255 }).primaryKey().notNull(),
  projectId: varchar('project_id', { length: 255 }).notNull().references(() => castingProjects.id, { onDelete: 'cascade' }),
  date: date('date').notNull(),
  sceneIds: jsonb('scene_ids').default([]),
  crewIds: jsonb('crew_ids').default([]),
  locationId: varchar('location_id', { length: 255 }),
  propIds: jsonb('prop_ids').default([]),
  status: varchar('status', { length: 50 }).default('planned'),
  notes: text('notes'),
  weatherForecast: jsonb('weather_forecast'),
  auditLog: jsonb('audit_log').default([]),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
  index('casting_production_days_project_id_idx').using('btree', table.projectId),
]);

export const castingShotLists = pgTable('casting_shot_lists', {
  id: varchar('id', { length: 255 }).primaryKey().notNull(),
  projectId: varchar('project_id', { length: 255 }).notNull().references(() => castingProjects.id, { onDelete: 'cascade' }),
  sceneId: varchar('scene_id', { length: 255 }),
  shots: jsonb('shots').default([]),
  cameraSettings: jsonb('camera_settings').default({}),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
  index('casting_shot_lists_project_id_idx').using('btree', table.projectId),
]);

// ── User Roles & Permissions ─────────────────────────────────

export const castingUserRoles = pgTable('casting_user_roles', {
  id: varchar('id', { length: 255 }).primaryKey().notNull(),
  projectId: varchar('project_id', { length: 255 }).notNull().references(() => castingProjects.id, { onDelete: 'cascade' }),
  userId: varchar('user_id', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }),
  role: varchar('role', { length: 50 }).notNull(),
  permissions: jsonb('permissions').default({}),
  addedBy: varchar('added_by', { length: 255 }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex('casting_user_roles_project_user_unique').using('btree', table.projectId, table.userId),
  index('casting_user_roles_user_id_idx').using('btree', table.userId),
]);

// ── Consent Management ───────────────────────────────────────

export const castingConsents = pgTable('casting_consents', {
  id: varchar('id', { length: 255 }).primaryKey().notNull(),
  projectId: varchar('project_id', { length: 255 }).notNull().references(() => castingProjects.id, { onDelete: 'cascade' }),
  candidateId: varchar('candidate_id', { length: 255 }).notNull(),
  type: varchar('type', { length: 50 }),
  status: varchar('status', { length: 50 }).default('pending'),
  signatureData: text('signature_data'),
  accessCode: varchar('access_code', { length: 20 }),
  pin: varchar('pin', { length: 10 }),
  expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'string' }),
  signedAt: timestamp('signed_at', { withTimezone: true, mode: 'string' }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
  index('casting_consents_project_id_idx').using('btree', table.projectId),
  index('casting_consents_candidate_id_idx').using('btree', table.candidateId),
]);

// ── Manuscript & Script System ───────────────────────────────

export const castingManuscripts = pgTable('casting_manuscripts', {
  id: varchar('id', { length: 255 }).primaryKey().notNull(),
  projectId: varchar('project_id', { length: 255 }).notNull().references(() => castingProjects.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 255 }).notNull(),
  format: varchar('format', { length: 50 }),
  content: text('content'),
  version: integer('version').default(1),
  status: varchar('status', { length: 50 }).default('draft'),
  lockedBy: varchar('locked_by', { length: 255 }),
  metadata: jsonb('metadata').default({}),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
  index('casting_manuscripts_project_id_idx').using('btree', table.projectId),
]);

export const castingScenes = pgTable('casting_scenes', {
  id: varchar('id', { length: 255 }).primaryKey().notNull(),
  projectId: varchar('project_id', { length: 255 }).notNull().references(() => castingProjects.id, { onDelete: 'cascade' }),
  manuscriptId: varchar('manuscript_id', { length: 255 }).references(() => castingManuscripts.id),
  actId: varchar('act_id', { length: 255 }),
  sceneNumber: integer('scene_number'),
  title: varchar('title', { length: 255 }),
  description: text('description'),
  setting: varchar('setting', { length: 255 }),
  timeOfDay: varchar('time_of_day', { length: 50 }),
  intExt: varchar('int_ext', { length: 20 }),
  characters: jsonb('characters').default([]),
  productionBreakdown: jsonb('production_breakdown').default({}),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
  index('casting_scenes_project_id_idx').using('btree', table.projectId),
  index('casting_scenes_manuscript_id_idx').using('btree', table.manuscriptId),
]);

// ── Project Sync Log (for Creatorhub ↔ Role Room sync) ──────

export const castingProjectSync = pgTable('casting_project_sync', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  creatorhubProjectId: varchar('creatorhub_project_id', { length: 255 }).notNull(),
  castingProjectId: varchar('casting_project_id', { length: 255 }).notNull().references(() => castingProjects.id, { onDelete: 'cascade' }),
  syncDirection: varchar('sync_direction', { length: 20 }).notNull(), // 'creatorhub_to_roleroom' | 'roleroom_to_creatorhub'
  syncStatus: varchar('sync_status', { length: 20 }).default('pending'),
  syncData: jsonb('sync_data').default({}),
  errorMessage: text('error_message'),
  syncedAt: timestamp('synced_at', { withTimezone: true, mode: 'string' }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
  index('casting_project_sync_creatorhub_idx').using('btree', table.creatorhubProjectId),
  index('casting_project_sync_casting_idx').using('btree', table.castingProjectId),
]);

// ── API Key Management ───────────────────────────────────────

export const roleRoomApiKeys = pgTable('role_room_api_keys', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  keyHash: varchar('key_hash', { length: 128 }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  userId: varchar('user_id', { length: 255 }).notNull(),
  scopes: jsonb('scopes').default(['read']),
  isActive: boolean('is_active').default(true),
  lastUsedAt: timestamp('last_used_at', { withTimezone: true, mode: 'string' }),
  expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'string' }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex('role_room_api_keys_hash_unique').using('btree', table.keyHash),
  index('role_room_api_keys_user_id_idx').using('btree', table.userId),
]);

// ── Marketplace Installation Tracking ────────────────────────

export const marketplaceInstallations = pgTable('marketplace_installations', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  userId: varchar('user_id', { length: 255 }).notNull(),
  appId: varchar('app_id', { length: 100 }).notNull(),
  installedAt: timestamp('installed_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  isActive: boolean('is_active').default(true),
  settings: jsonb('settings').default({}),
}, (table) => [
  uniqueIndex('marketplace_installations_user_app_unique').using('btree', table.userId, table.appId),
]);

// ── Equipment Management System ──────────────────────────────

export const castingEquipment = pgTable('casting_equipment', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  projectId: varchar('project_id', { length: 255 }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  brand: varchar('brand', { length: 100 }),
  model: varchar('model', { length: 100 }),
  category: varchar('category', { length: 100 }),
  status: varchar('status', { length: 50 }).default('available').notNull(),
  condition: varchar('condition', { length: 50 }).default('good').notNull(),
  serialNumber: varchar('serial_number', { length: 150 }),
  purchaseDate: date('purchase_date'),
  purchasePrice: numeric('purchase_price', { precision: 12, scale: 2 }),
  rentalRateDay: numeric('rental_rate_day', { precision: 10, scale: 2 }),
  quantity: integer('quantity').default(1).notNull(),
  notes: text('notes'),
  imageUrl: text('image_url'),
  vendorUrl: text('vendor_url'),
  isGlobal: boolean('is_global').default(false).notNull(),
  tags: jsonb('tags').default([]).notNull(),
  location: varchar('location', { length: 200 }),
  assignees: jsonb('assignees').default([]).notNull(),
  bookingStart: timestamp('booking_start', { withTimezone: true, mode: 'string' }),
  bookingEnd: timestamp('booking_end', { withTimezone: true, mode: 'string' }),
  metadata: jsonb('metadata').default({}).notNull(),
  createdBy: varchar('created_by', { length: 255 }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
  index('idx_casting_equipment_project').using('btree', table.projectId),
  index('idx_casting_equipment_status').using('btree', table.status),
  index('idx_casting_equipment_category').using('btree', table.category),
]);

export const equipmentBookings = pgTable('equipment_bookings', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  equipmentId: uuid('equipment_id').notNull(),
  projectId: varchar('project_id', { length: 255 }).notNull(),
  bookedBy: varchar('booked_by', { length: 255 }).notNull(),
  eventId: varchar('event_id', { length: 255 }),
  startDate: timestamp('start_date', { withTimezone: true, mode: 'string' }).notNull(),
  endDate: timestamp('end_date', { withTimezone: true, mode: 'string' }).notNull(),
  status: varchar('status', { length: 30 }).default('confirmed').notNull(),
  quantity: integer('quantity').default(1).notNull(),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
  index('idx_equipment_bookings_equipment').using('btree', table.equipmentId),
  index('idx_equipment_bookings_project').using('btree', table.projectId),
]);

export const equipmentCheckouts = pgTable('equipment_checkouts', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  equipmentId: uuid('equipment_id').notNull(),
  projectId: varchar('project_id', { length: 255 }).notNull(),
  checkedOutTo: varchar('checked_out_to', { length: 255 }).notNull(),
  checkedOutBy: varchar('checked_out_by', { length: 255 }),
  checkedOutAt: timestamp('checked_out_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  checkedInAt: timestamp('checked_in_at', { withTimezone: true, mode: 'string' }),
  quantity: integer('quantity').default(1).notNull(),
  purpose: text('purpose'),
  conditionOnReturn: varchar('condition_on_return', { length: 50 }),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
  index('idx_equipment_checkouts_equipment').using('btree', table.equipmentId),
  index('idx_equipment_checkouts_project').using('btree', table.projectId),
]);

export const equipmentTemplates = pgTable('equipment_templates', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  projectId: varchar('project_id', { length: 255 }).notNull(),
  name: varchar('name', { length: 200 }).notNull(),
  description: text('description'),
  category: varchar('category', { length: 100 }),
  items: jsonb('items').default([]).notNull(),
  createdBy: varchar('created_by', { length: 255 }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
  index('idx_equipment_templates_project').using('btree', table.projectId),
]);

// ── Producer Workflow (Content Producer + Client Reviewer) ────────────────

export const roleRoomPhaseTimelineItems = pgTable('role_room_phase_timeline_items', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  projectId: varchar('project_id', { length: 255 }).notNull().references(() => castingProjects.id, { onDelete: 'cascade' }),
  phase: varchar('phase', { length: 32 }).notNull(), // preproduction | production | postproduction
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  ownerUserId: varchar('owner_user_id', { length: 255 }),
  dueAt: timestamp('due_at', { withTimezone: true, mode: 'string' }),
  status: varchar('status', { length: 32 }).default('planned').notNull(),
  linkedEntityType: varchar('linked_entity_type', { length: 100 }),
  linkedEntityId: varchar('linked_entity_id', { length: 255 }),
  sortOrder: integer('sort_order').default(0).notNull(),
  metadata: jsonb('metadata').default({}).notNull(),
  createdBy: varchar('created_by', { length: 255 }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
  index('idx_rr_phase_timeline_project').using('btree', table.projectId),
  index('idx_rr_phase_timeline_phase').using('btree', table.phase),
  index('idx_rr_phase_timeline_status').using('btree', table.status),
]);

export const roleRoomBudgetItems = pgTable('role_room_budget_items', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  projectId: varchar('project_id', { length: 255 }).notNull().references(() => castingProjects.id, { onDelete: 'cascade' }),
  phase: varchar('phase', { length: 32 }).notNull(), // preproduction | production | postproduction
  category: varchar('category', { length: 120 }).notNull(),
  itemName: varchar('item_name', { length: 255 }).notNull(),
  description: text('description'),
  estimate: numeric('estimate', { precision: 12, scale: 2 }).default('0'),
  approved: numeric('approved', { precision: 12, scale: 2 }).default('0'),
  actual: numeric('actual', { precision: 12, scale: 2 }).default('0'),
  currency: varchar('currency', { length: 10 }).default('NOK').notNull(),
  status: varchar('status', { length: 32 }).default('draft').notNull(),
  clientVisible: boolean('client_visible').default(true).notNull(),
  linkedEntityType: varchar('linked_entity_type', { length: 100 }),
  linkedEntityId: varchar('linked_entity_id', { length: 255 }),
  sortOrder: integer('sort_order').default(0).notNull(),
  metadata: jsonb('metadata').default({}).notNull(),
  createdBy: varchar('created_by', { length: 255 }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
  index('idx_rr_budget_project').using('btree', table.projectId),
  index('idx_rr_budget_phase').using('btree', table.phase),
  index('idx_rr_budget_status').using('btree', table.status),
]);

export const roleRoomClientReviews = pgTable('role_room_client_reviews', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  projectId: varchar('project_id', { length: 255 }).notNull().references(() => castingProjects.id, { onDelete: 'cascade' }),
  reviewType: varchar('review_type', { length: 80 }).notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  targetEntityType: varchar('target_entity_type', { length: 100 }),
  targetEntityId: varchar('target_entity_id', { length: 255 }),
  requestedByUserId: varchar('requested_by_user_id', { length: 255 }),
  requestedAt: timestamp('requested_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  dueAt: timestamp('due_at', { withTimezone: true, mode: 'string' }),
  status: varchar('status', { length: 40 }).default('pending').notNull(), // pending | approved | rejected | changes_requested
  decisionByUserId: varchar('decision_by_user_id', { length: 255 }),
  decisionAt: timestamp('decision_at', { withTimezone: true, mode: 'string' }),
  decisionReason: text('decision_reason'),
  metadata: jsonb('metadata').default({}).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
  index('idx_rr_client_reviews_project').using('btree', table.projectId),
  index('idx_rr_client_reviews_status').using('btree', table.status),
  index('idx_rr_client_reviews_type').using('btree', table.reviewType),
]);

export const roleRoomClientReviewComments = pgTable('role_room_client_review_comments', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  reviewId: uuid('review_id').notNull().references(() => roleRoomClientReviews.id, { onDelete: 'cascade' }),
  projectId: varchar('project_id', { length: 255 }).notNull().references(() => castingProjects.id, { onDelete: 'cascade' }),
  authorUserId: varchar('author_user_id', { length: 255 }),
  authorRole: varchar('author_role', { length: 80 }),
  commentText: text('comment_text').notNull(),
  timestampSeconds: integer('timestamp_seconds'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
  index('idx_rr_review_comments_project').using('btree', table.projectId),
  index('idx_rr_review_comments_review').using('btree', table.reviewId),
]);

export const roleRoomClientIntake = pgTable('role_room_client_intake', {
  projectId: varchar('project_id', { length: 255 }).primaryKey().notNull().references(() => castingProjects.id, { onDelete: 'cascade' }),
  projectGoal: text('project_goal'),
  deliverables: text('deliverables'),
  targetAudience: text('target_audience'),
  keyMessage: text('key_message'),
  timingConstraints: text('timing_constraints'),
  brandNotes: text('brand_notes'),
  materialOverview: text('material_overview'),
  referenceLinks: text('reference_links'),
  contactName: text('contact_name'),
  contactEmail: text('contact_email'),
  contactPhone: text('contact_phone'),
  additionalNotes: text('additional_notes'),
  metadata: jsonb('metadata').default({}),
  updatedByUserId: text('updated_by_user_id'),
  updatedByRole: text('updated_by_role'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

export const roleRoomClientMaterials = pgTable('role_room_client_materials', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  projectId: varchar('project_id', { length: 255 }).notNull().references(() => castingProjects.id, { onDelete: 'cascade' }),
  entryType: text('entry_type').notNull(),
  title: text('title').notNull(),
  description: text('description'),
  externalUrl: text('external_url'),
  phase: text('phase'),
  linkedShotListId: text('linked_shot_list_id'),
  status: text('status').default('provided'),
  metadata: jsonb('metadata').default({}),
  createdByUserId: text('created_by_user_id'),
  createdByRole: text('created_by_role'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
  index('idx_rr_client_materials_project').using('btree', table.projectId),
  index('idx_rr_client_materials_phase').using('btree', table.phase),
]);

export const roleRoomGoogleConnections = pgTable('role_room_google_connections', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  userId: varchar('user_id', { length: 255 }).notNull(),
  roleRoomEmail: varchar('role_room_email', { length: 255 }),
  googleEmail: varchar('google_email', { length: 255 }),
  googleSubject: varchar('google_subject', { length: 255 }),
  accessTokenEncrypted: text('access_token_encrypted'),
  refreshTokenEncrypted: text('refresh_token_encrypted'),
  expiryDate: timestamp('expiry_date', { withTimezone: true, mode: 'string' }),
  scopes: jsonb('scopes').default([]).notNull(),
  connectionState: varchar('connection_state', { length: 32 }).default('disconnected').notNull(),
  lastError: text('last_error'),
  profile: jsonb('profile').default({}).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  lastUsedAt: timestamp('last_used_at', { withTimezone: true, mode: 'string' }),
}, (table) => [
  uniqueIndex('idx_rr_google_connections_user_id_unique').using('btree', table.userId),
  uniqueIndex('idx_rr_google_connections_subject_unique').using('btree', table.googleSubject),
  index('idx_rr_google_connections_email').using('btree', table.googleEmail),
]);

export const roleRoomLinkedInConnections = pgTable('role_room_linkedin_connections', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  userId: varchar('user_id', { length: 255 }).notNull(),
  roleRoomEmail: varchar('role_room_email', { length: 255 }),
  linkedInMemberId: varchar('linkedin_member_id', { length: 255 }),
  linkedInEmail: varchar('linkedin_email', { length: 255 }),
  linkedInName: varchar('linkedin_name', { length: 255 }),
  accessTokenEncrypted: text('access_token_encrypted'),
  refreshTokenEncrypted: text('refresh_token_encrypted'),
  expiryDate: timestamp('expiry_date', { withTimezone: true, mode: 'string' }),
  scopes: jsonb('scopes').default([]).notNull(),
  connectionState: varchar('connection_state', { length: 32 }).default('disconnected').notNull(),
  lastError: text('last_error'),
  profile: jsonb('profile').default({}).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  lastUsedAt: timestamp('last_used_at', { withTimezone: true, mode: 'string' }),
}, (table) => [
  uniqueIndex('idx_rr_linkedin_connections_user_id_unique').using('btree', table.userId),
  uniqueIndex('idx_rr_linkedin_connections_member_id_unique').using('btree', table.linkedInMemberId),
  index('idx_rr_linkedin_connections_email').using('btree', table.linkedInEmail),
]);

export const roleRoomGoogleProjectBindings = pgTable('role_room_google_project_bindings', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  projectId: varchar('project_id', { length: 255 }).notNull().references(() => castingProjects.id, { onDelete: 'cascade' }),
  connectedUserId: varchar('connected_user_id', { length: 255 }),
  driveRootFolderId: varchar('drive_root_folder_id', { length: 255 }),
  calendarId: varchar('calendar_id', { length: 255 }),
  contactsContext: jsonb('contacts_context').default({}).notNull(),
  meetCreationEnabled: boolean('meet_creation_enabled').default(true).notNull(),
  auditSignatureStorageEnabled: boolean('audit_signature_storage_enabled').default(true).notNull(),
  folderLayout: jsonb('folder_layout').default({}).notNull(),
  syncStatus: jsonb('sync_status').default({}).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  lastDriveSyncAt: timestamp('last_drive_sync_at', { withTimezone: true, mode: 'string' }),
  lastCalendarSyncAt: timestamp('last_calendar_sync_at', { withTimezone: true, mode: 'string' }),
}, (table) => [
  uniqueIndex('idx_rr_google_project_binding_project_unique').using('btree', table.projectId),
]);

export const roleRoomGoogleArtifacts = pgTable('role_room_google_artifacts', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  projectId: varchar('project_id', { length: 255 }).notNull().references(() => castingProjects.id, { onDelete: 'cascade' }),
  localEntityType: varchar('local_entity_type', { length: 100 }).notNull(),
  localEntityId: varchar('local_entity_id', { length: 255 }).notNull(),
  artifactType: varchar('artifact_type', { length: 64 }).notNull(),
  sourceLabel: varchar('source_label', { length: 255 }),
  driveFileId: varchar('drive_file_id', { length: 255 }),
  calendarEventId: varchar('calendar_event_id', { length: 255 }),
  meetUrl: text('meet_url'),
  webViewUrl: text('web_view_url'),
  webContentLink: text('web_content_link'),
  mimeType: varchar('mime_type', { length: 255 }),
  folderKey: varchar('folder_key', { length: 64 }),
  syncStatus: varchar('sync_status', { length: 32 }).default('synced').notNull(),
  metadata: jsonb('metadata').default({}).notNull(),
  createdBy: varchar('created_by', { length: 255 }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex('idx_rr_google_artifact_local_unique').using(
    'btree',
    table.projectId,
    table.localEntityType,
    table.localEntityId,
    table.artifactType,
  ),
  index('idx_rr_google_artifacts_project').using('btree', table.projectId),
  index('idx_rr_google_artifacts_drive_file').using('btree', table.driveFileId),
  index('idx_rr_google_artifacts_calendar_event').using('btree', table.calendarEventId),
]);

export const roleRoomGoogleAgreementSignatures = pgTable('role_room_google_agreement_signatures', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  projectId: varchar('project_id', { length: 255 }).notNull().references(() => castingProjects.id, { onDelete: 'cascade' }),
  agreementId: varchar('agreement_id', { length: 255 }).notNull(),
  provider: varchar('provider', { length: 64 }).default('google_workspace').notNull(),
  status: varchar('status', { length: 64 }).default('not_started').notNull(),
  documentTitle: text('document_title'),
  driveSourceFileId: varchar('drive_source_file_id', { length: 255 }),
  signedDriveFileId: varchar('signed_drive_file_id', { length: 255 }),
  auditArtifactId: varchar('audit_artifact_id', { length: 255 }),
  requestUrl: text('request_url'),
  webViewUrl: text('web_view_url'),
  requestedBy: varchar('requested_by', { length: 255 }),
  requestedByEmail: varchar('requested_by_email', { length: 255 }),
  counterpartyName: text('counterparty_name'),
  counterpartyEmail: varchar('counterparty_email', { length: 255 }),
  preparedAt: timestamp('prepared_at', { withTimezone: true, mode: 'string' }),
  sentAt: timestamp('sent_at', { withTimezone: true, mode: 'string' }),
  signedAt: timestamp('signed_at', { withTimezone: true, mode: 'string' }),
  declinedAt: timestamp('declined_at', { withTimezone: true, mode: 'string' }),
  lastOpenedAt: timestamp('last_opened_at', { withTimezone: true, mode: 'string' }),
  lastSyncedAt: timestamp('last_synced_at', { withTimezone: true, mode: 'string' }),
  signatureHash: text('signature_hash'),
  metadata: jsonb('metadata').default({}).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex('idx_rr_google_agreement_signature_unique').using('btree', table.projectId, table.agreementId),
  index('idx_rr_google_agreement_signatures_project').using('btree', table.projectId),
  index('idx_rr_google_agreement_signatures_status').using('btree', table.status),
  index('idx_rr_google_agreement_signatures_drive_source').using('btree', table.driveSourceFileId),
  index('idx_rr_google_agreement_signatures_signed_drive').using('btree', table.signedDriveFileId),
]);

export const roleRoomIntegrationAccounts = pgTable('role_room_integration_accounts', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  slug: varchar('slug', { length: 120 }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  ownerUserId: varchar('owner_user_id', { length: 255 }).notNull(),
  status: varchar('status', { length: 32 }).default('active').notNull(),
  allowedScopes: jsonb('allowed_scopes').default([]).notNull(),
  rateLimitPerMinute: integer('rate_limit_per_minute').default(120).notNull(),
  metadata: jsonb('metadata').default({}).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex('idx_rr_integration_accounts_slug_unique').using('btree', table.slug),
  index('idx_rr_integration_accounts_owner').using('btree', table.ownerUserId),
]);

export const roleRoomIntegrationApiKeys = pgTable('role_room_integration_api_keys', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  integrationAccountId: uuid('integration_account_id').notNull().references(() => roleRoomIntegrationAccounts.id, { onDelete: 'cascade' }),
  label: varchar('label', { length: 255 }).notNull(),
  keyHash: varchar('key_hash', { length: 128 }).notNull(),
  createdForUserId: varchar('created_for_user_id', { length: 255 }).notNull(),
  scopes: jsonb('scopes').default([]).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  lastUsedAt: timestamp('last_used_at', { withTimezone: true, mode: 'string' }),
  expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'string' }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex('idx_rr_integration_api_keys_hash_unique').using('btree', table.keyHash),
  index('idx_rr_integration_api_keys_account').using('btree', table.integrationAccountId),
]);

export const roleRoomIntegrationObjectMappings = pgTable('role_room_integration_object_mappings', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  integrationAccountId: uuid('integration_account_id').notNull().references(() => roleRoomIntegrationAccounts.id, { onDelete: 'cascade' }),
  projectId: varchar('project_id', { length: 255 }).notNull().references(() => castingProjects.id, { onDelete: 'cascade' }),
  localObjectType: varchar('local_object_type', { length: 100 }).notNull(),
  localObjectId: varchar('local_object_id', { length: 255 }).notNull(),
  externalObjectType: varchar('external_object_type', { length: 100 }).notNull(),
  externalObjectId: varchar('external_object_id', { length: 255 }).notNull(),
  direction: varchar('direction', { length: 20 }).default('bidirectional').notNull(),
  metadata: jsonb('metadata').default({}).notNull(),
  lastSyncedAt: timestamp('last_synced_at', { withTimezone: true, mode: 'string' }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex('idx_rr_integration_mappings_local_unique').using(
    'btree',
    table.integrationAccountId,
    table.projectId,
    table.localObjectType,
    table.localObjectId,
    table.externalObjectType,
  ),
  uniqueIndex('idx_rr_integration_mappings_external_unique').using(
    'btree',
    table.integrationAccountId,
    table.projectId,
    table.externalObjectType,
    table.externalObjectId,
    table.localObjectType,
  ),
  index('idx_rr_integration_mappings_project').using('btree', table.projectId),
]);

export const roleRoomIntegrationWebhooks = pgTable('role_room_integration_webhooks', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  integrationAccountId: uuid('integration_account_id').notNull().references(() => roleRoomIntegrationAccounts.id, { onDelete: 'cascade' }),
  label: varchar('label', { length: 255 }),
  endpointUrl: text('endpoint_url').notNull(),
  signingSecretEncrypted: text('signing_secret_encrypted').notNull(),
  eventTypes: jsonb('event_types').default(['*']).notNull(),
  status: varchar('status', { length: 32 }).default('active').notNull(),
  lastDeliveredAt: timestamp('last_delivered_at', { withTimezone: true, mode: 'string' }),
  lastFailureAt: timestamp('last_failure_at', { withTimezone: true, mode: 'string' }),
  lastError: text('last_error'),
  metadata: jsonb('metadata').default({}).notNull(),
  createdByUserId: varchar('created_by_user_id', { length: 255 }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
  index('idx_rr_integration_webhooks_account').using('btree', table.integrationAccountId),
]);

export const roleRoomIntegrationEventOutbox = pgTable('role_room_integration_event_outbox', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  integrationAccountId: uuid('integration_account_id').notNull().references(() => roleRoomIntegrationAccounts.id, { onDelete: 'cascade' }),
  webhookId: uuid('webhook_id').notNull().references(() => roleRoomIntegrationWebhooks.id, { onDelete: 'cascade' }),
  eventType: varchar('event_type', { length: 120 }).notNull(),
  aggregateType: varchar('aggregate_type', { length: 120 }).notNull(),
  aggregateId: varchar('aggregate_id', { length: 255 }).notNull(),
  projectId: varchar('project_id', { length: 255 }).references(() => castingProjects.id, { onDelete: 'set null' }),
  payload: jsonb('payload').default({}).notNull(),
  status: varchar('status', { length: 30 }).default('pending').notNull(),
  attemptCount: integer('attempt_count').default(0).notNull(),
  nextAttemptAt: timestamp('next_attempt_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  lastAttemptAt: timestamp('last_attempt_at', { withTimezone: true, mode: 'string' }),
  deliveredAt: timestamp('delivered_at', { withTimezone: true, mode: 'string' }),
  lastError: text('last_error'),
  lastResponseStatus: integer('last_response_status'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
  index('idx_rr_integration_outbox_pending').using('btree', table.status, table.nextAttemptAt),
  index('idx_rr_integration_outbox_account').using('btree', table.integrationAccountId),
]);

export const roleRoomIntegrationIdempotencyKeys = pgTable('role_room_integration_idempotency_keys', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  scopeKey: varchar('scope_key', { length: 255 }).notNull(),
  integrationAccountId: uuid('integration_account_id').references(() => roleRoomIntegrationAccounts.id, { onDelete: 'cascade' }),
  requestMethod: varchar('request_method', { length: 10 }).notNull(),
  requestPath: text('request_path').notNull(),
  idempotencyKey: varchar('idempotency_key', { length: 255 }).notNull(),
  requestHash: varchar('request_hash', { length: 128 }).notNull(),
  status: varchar('status', { length: 20 }).default('processing').notNull(),
  responseStatus: integer('response_status'),
  responseBody: jsonb('response_body'),
  resourceType: varchar('resource_type', { length: 120 }),
  resourceId: varchar('resource_id', { length: 255 }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex('idx_rr_integration_idempotency_unique').using('btree', table.scopeKey, table.requestMethod, table.requestPath, table.idempotencyKey),
  index('idx_rr_integration_idempotency_account').using('btree', table.integrationAccountId),
]);
