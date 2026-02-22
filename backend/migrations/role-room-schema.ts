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
