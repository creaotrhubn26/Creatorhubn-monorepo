// Additional schema definitions for mock data replacement
import {
  pgTable,
  text,
  varchar,
  integer,
  timestamp,
  boolean,
  jsonb,
  decimal,
  uuid,
} from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';

// Client Galleries
export const galleries = pgTable('galleries', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  coverPhoto: varchar('cover_photo', { length: 500 }),
  totalPhotos: integer('total_photos').default(0),
  status: varchar('status', { length: 50 }).default('active'),
  accessType: varchar('access_type', { length: 50 }).default('password_protected'),
  downloadEnabled: boolean('download_enabled').default(true),
  commentsEnabled: boolean('comments_enabled').default(true),
  favoritesEnabled: boolean('favorites_enabled').default(true),
  socialSharingEnabled: boolean('social_sharing_enabled').default(true),
  customBranding: boolean('custom_branding').default(false),
  clientEmail: varchar('client_email', { length: 255 }),
  eventDate: varchar('event_date', { length: 50 }),
  eventType: varchar('event_type', { length: 100 }),
  createdAt: timestamp('created_at').defaultNow(),
  lastUpdated: timestamp('last_updated').defaultNow(),
});

// Studio Clients
export const studioClients = pgTable('studio_clients', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull(),
  phone: varchar('phone', { length: 50 }),
  address: text('address'),
  weddingDate: varchar('wedding_date', { length: 50 }),
  venue: varchar('venue', { length: 255 }),
  packageType: varchar('package_type', { length: 255 }),
  totalValue: decimal('total_value', { precision: 10, scale: 2 }),
  paidAmount: decimal('paid_amount', { precision: 10, scale: 2 }),
  status: varchar('status', { length: 50 }).default('inquiry'),
  notes: text('notes'),
  photographer: varchar('photographer', { length: 255 }),
  tags: jsonb('tags'),
  createdAt: timestamp('created_at').defaultNow(),
  lastContact: timestamp('last_contact'),
});

// Products for Online Store
export const products = pgTable('products', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  category: varchar('category', { length: 100 }),
  basePrice: decimal('base_price', { precision: 10, scale: 2 }),
  images: jsonb('images'),
  options: jsonb('options'),
  isActive: boolean('is_active').default(true),
  sales: integer('sales').default(0),
  revenue: decimal('revenue', { precision: 10, scale: 2 }).default('0'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Collaboration Projects
export const projects = pgTable('projects', {
  id: integer('id').primaryKey(),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  projectType: varchar('project_type', { length: 100 }),
  status: varchar('status', { length: 50 }).default('active'),
  priority: varchar('priority', { length: 50 }).default('medium'),
  budget: decimal('budget', { precision: 10, scale: 2 }),
  clientName: varchar('client_name', { length: 255 }),
  leadCreator: varchar('lead_creator', { length: 255 }),
  memberCount: integer('member_count').default(1),
  completionPercentage: integer('completion_percentage').default(0),
  dueDate: varchar('due_date', { length: 50 }),
  tags: jsonb('tags'),
  createdAt: timestamp('created_at').defaultNow(),
});

// RSVP Guests
export const guests = pgTable('guests', {
  id: integer('id').primaryKey(),
  firstName: varchar('first_name', { length: 255 }).notNull(),
  lastName: varchar('last_name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }),
  phone: varchar('phone', { length: 50 }),
  address: jsonb('address'),
  relationship: varchar('relationship', { length: 100 }),
  group: varchar('group', { length: 100 }),
  category: varchar('category', { length: 50 }),
  invitationSent: boolean('invitation_sent').default(false),
  invitationSentDate: timestamp('invitation_sent_date'),
  rsvpStatus: varchar('rsvp_status', { length: 50 }).default('pending'),
  rsvpDate: timestamp('rsvp_date'),
  attendeeCount: integer('attendee_count').default(1),
  plusOneAllowed: boolean('plus_one_allowed').default(false),
  plusOneName: varchar('plus_one_name', { length: 255 }),
  dietaryRestrictions: jsonb('dietary_restrictions'),
  allergies: jsonb('allergies'),
  accessibility: jsonb('accessibility'),
  accommodationNeeds: text('accommodation_needs'),
  tableNumber: integer('table_number'),
  notes: text('notes'),
  eventPreferences: jsonb('event_preferences'),
  children: jsonb('children'),
  transportation: jsonb('transportation'),
  gift: jsonb('gift'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Team Members
export const teamMembers = pgTable('team_members', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull(),
  userType: varchar('user_type', { length: 100 }),
  profileImage: varchar('profile_image', { length: 500 }),
  specialties: jsonb('specialties'),
  isAvailable: boolean('is_available').default(true),
  createdAt: timestamp('created_at').defaultNow(),
});

// Project Members
export const projectMembers = pgTable('project_members', {
  id: integer('id').primaryKey(),
  projectId: integer('project_id').references(() => projects.id),
  userId: varchar('user_id', { length: 255 }),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }),
  role: varchar('role', { length: 100 }),
  permissions: jsonb('permissions'),
  userType: varchar('user_type', { length: 100 }),
  profileImage: varchar('profile_image', { length: 500 }),
  isActive: boolean('is_active').default(true),
  isLead: boolean('is_lead').default(false),
  completedTasks: integer('completed_tasks').default(0),
  totalTasks: integer('total_tasks').default(0),
  joinedAt: timestamp('joined_at').defaultNow(),
  lastActive: timestamp('last_active'),
});

// Family Members
export const familyMembers = pgTable('family_members', {
  id: integer('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  relationship: varchar('relationship', { length: 100 }),
  side: varchar('side', { length: 50 }),
  isVip: boolean('is_vip').default(false),
  role: varchar('role', { length: 255 }),
  specialNotes: text('special_notes'),
  position: jsonb('position'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Content Creators
export const contentCreators = pgTable('content_creators', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: varchar('user_id', { length: 255 }),
  creatorName: varchar('creator_name', { length: 255 }).notNull(),
  specializations: jsonb('specializations'),
  portfolio: jsonb('portfolio'),
  rates: jsonb('rates'),
  availability: varchar('availability', { length: 50 }).default('available'),
  responseTime: varchar('response_time', { length: 100 }),
  languages: jsonb('languages'),
  equipment: jsonb('equipment'),
  experience: integer('experience'),
  certifications: jsonb('certifications'),
  socialMedia: jsonb('social_media'),
  rating: decimal('rating', { precision: 3, scale: 2 }),
  reviewCount: integer('review_count').default(0),
  completedCollaborations: integer('completed_collaborations').default(0),
  createdAt: timestamp('created_at').defaultNow(),
});

// Custom Quick Actions for FloatingActionButtons
export const customQuickActions = pgTable('custom_quick_actions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: varchar('user_id', { length: 255 }).notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  icon: varchar('icon', { length: 50 }).default('Add'), // Material UI icon name
  color: varchar('color', { length: 20 }).default('primary'), // Material UI color
  actionType: varchar('action_type', { length: 50 }).notNull(), // 'project', 'meeting', 'showcase', 'custom'
  actionData: jsonb('action_data'), // JSON data for the action (form fields, defaults, etc.)
  isActive: boolean('is_active').default(true),
  sortOrder: integer('sort_order').default(0),
  profession: varchar('profession', { length: 50 }), // 'photographer', 'videographer', 'music_producer', 'vendor'
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Schema exports
export const insertGallerySchema = createInsertSchema(galleries);
export const insertStudioClientSchema = createInsertSchema(studioClients);
export const insertProductSchema = createInsertSchema(products);
export const insertProjectSchema = createInsertSchema(projects);
export const insertGuestSchema = createInsertSchema(guests);
export const insertTeamMemberSchema = createInsertSchema(teamMembers);
export const insertProjectMemberSchema = createInsertSchema(projectMembers);
export const insertFamilyMemberSchema = createInsertSchema(familyMembers);
export const insertContentCreatorSchema = createInsertSchema(contentCreators);
export const insertCustomQuickActionSchema = createInsertSchema(customQuickActions);

export type Gallery = typeof galleries.$inferSelect;
export type StudioClient = typeof studioClients.$inferSelect;
export type Product = typeof products.$inferSelect;
export type Project = typeof projects.$inferSelect;
export type Guest = typeof guests.$inferSelect;
export type TeamMember = typeof teamMembers.$inferSelect;
export type ProjectMember = typeof projectMembers.$inferSelect;
export type FamilyMember = typeof familyMembers.$inferSelect;
export type ContentCreator = typeof contentCreators.$inferSelect;
export type CustomQuickAction = typeof customQuickActions.$inferSelect;

export type InsertGallery = z.infer<typeof insertGallerySchema>;
export type InsertStudioClient = z.infer<typeof insertStudioClientSchema>;
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type InsertGuest = z.infer<typeof insertGuestSchema>;
export type InsertTeamMember = z.infer<typeof insertTeamMemberSchema>;
export type InsertProjectMember = z.infer<typeof insertProjectMemberSchema>;
export type InsertFamilyMember = z.infer<typeof insertFamilyMemberSchema>;
export type InsertContentCreator = z.infer<typeof insertContentCreatorSchema>;
export type InsertCustomQuickAction = z.infer<typeof insertCustomQuickActionSchema>;
