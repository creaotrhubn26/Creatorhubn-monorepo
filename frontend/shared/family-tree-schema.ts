import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  boolean,
  jsonb,
  integer,
  decimal,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';

// Family tree system for wedding couples and VIP clients
export const familyTrees = pgTable('family_trees', {
  id: uuid('id').primaryKey().defaultRandom(),
  eventId: varchar('event_id').notNull(), // Links to event/project
  clientId: varchar('client_id').notNull(), // Primary client/couple
  treeName: varchar('tree_name').notNull(), // "Hansen-Olsen Wedding Family"
  treeType: varchar('tree_type')
    .$type<'wedding' | 'vip_event' | 'corporate' | 'celebration'>()
    .notNull(),

  // Tree configuration
  maxGenerations: integer('max_generations').default(4), // How many generations to display
  displayStyle: varchar('display_style')
    .$type<'traditional' | 'modern' | 'compact' | 'detailed'>()
    .default('modern'),
  privacyLevel: varchar('privacy_level')
    .$type<'public' | 'family_only' | 'couple_only' | 'private'>()
    .default('family_only'),

  // Norwegian wedding specific
  brideFamily: boolean('bride_family').default(true),
  groomFamily: boolean('groom_family').default(true),
  combinedTree: boolean('combined_tree').default(true),

  // Sharing and collaboration
  shareCode: varchar('share_code').unique(), // For family members to upload
  allowGuestUploads: boolean('allow_guest_uploads').default(true),
  moderationRequired: boolean('moderation_required').default(false),

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Individual family members in the tree
export const familyMembers = pgTable('family_members', {
  id: uuid('id').primaryKey().defaultRandom(),
  treeId: uuid('tree_id')
    .notNull()
    .references(() => familyTrees.id, { onDelete: 'cascade' }),

  // Personal information
  firstName: varchar('first_name').notNull(),
  lastName: varchar('last_name'),
  maidenName: varchar('maiden_name'), // For Norwegian naming traditions
  displayName: varchar('display_name'), // How they want to be shown

  // Family relationships
  generation: integer('generation').notNull(), // 0 = couple, -1 = parents, -2 = grandparents, +1 = children
  side: varchar('side').$type<'bride' | 'groom' | 'both' | 'neutral'>().notNull(),
  relationship: varchar('relationship'), // "Mother", "Father", "Sibling", "Grandparent"

  // Contact and connection
  phoneNumber: varchar('phone_number'),
  email: varchar('email'),
  address: text('address'),

  // Personal details
  birthDate: varchar('birth_date'), // Optional, for age display
  occupation: varchar('occupation'),
  hobbies: text('hobbies'),
  specialRole: varchar('special_role'), // "Best Man", "Maid of Honor", "Ring Bearer"

  // Photo and media
  profileImageUrl: text('profile_image_url'),
  profileImagePublicId: varchar('profile_image_public_id'), // For Cloudinary/upload service
  additionalPhotos: jsonb('additional_photos').$type<string[]>().default([]),

  // Tree positioning
  positionX: integer('position_x').default(0),
  positionY: integer('position_y').default(0),
  parentIds: jsonb('parent_ids').$type<string[]>().default([]), // For multiple parents/step-parents
  spouseId: uuid('spouse_id'), // Reference to spouse

  // Privacy and display
  isVisible: boolean('is_visible').default(true),
  showContactInfo: boolean('show_contact_info').default(false),
  showPersonalDetails: boolean('show_personal_details').default(true),

  // Upload metadata
  uploadedBy: varchar('uploaded_by'), // Who added this person
  uploadedAt: timestamp('uploaded_at').defaultNow(),
  approvedBy: varchar('approved_by'), // If moderation required
  approvedAt: timestamp('approved_at'),

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Family member connections/relationships
export const familyConnections = pgTable('family_connections', {
  id: uuid('id').primaryKey().defaultRandom(),
  treeId: uuid('tree_id')
    .notNull()
    .references(() => familyTrees.id, { onDelete: 'cascade' }),

  memberOneId: uuid('member_one_id')
    .notNull()
    .references(() => familyMembers.id, { onDelete: 'cascade' }),
  memberTwoId: uuid('member_two_id')
    .notNull()
    .references(() => familyMembers.id, { onDelete: 'cascade' }),

  connectionType: varchar('connection_type')
    .$type<
      | 'parent_child'
      | 'spouse'
      | 'sibling'
      | 'grandparent_grandchild'
      | 'aunt_uncle_niece_nephew'
      | 'cousin'
      | 'step_relation'
      | 'adopted'
      | 'other'
    >()
    .notNull(),

  description: text('description'), // Custom relationship description
  isBloodRelation: boolean('is_blood_relation').default(true),

  createdAt: timestamp('created_at').defaultNow(),
});

// Vendor management for events
export const eventVendors = pgTable('event_vendors', {
  id: uuid('id').primaryKey().defaultRandom(),
  eventId: varchar('event_id').notNull(),
  treeId: uuid('tree_id').references(() => familyTrees.id), // Optional link to family tree

  // Vendor information
  vendorName: varchar('vendor_name').notNull(),
  vendorType: varchar('vendor_type')
    .$type<
      | 'photographer'
      | 'videographer'
      | 'florist'
      | 'caterer'
      | 'venue'
      | 'music'
      | 'decoration'
      | 'transport'
      | 'accommodation'
      | 'other'
    >()
    .notNull(),

  // Contact details
  contactPerson: varchar('contact_person'),
  phoneNumber: varchar('phone_number'),
  email: varchar('email'),
  website: text('website'),
  address: text('address'),

  // Service details
  serviceDescription: text('service_description'),
  packageDetails: text('package_details'),
  specialRequirements: text('special_requirements'),

  // Pricing and contract
  quotedPrice: decimal('quoted_price', { precision: 10, scale: 2 }),
  finalPrice: decimal('final_price', { precision: 10, scale: 2 }),
  currency: varchar('currency').default('NOK'),
  paymentTerms: text('payment_terms'),
  contractSigned: boolean('contract_signed').default(false),
  contractDate: timestamp('contract_date'),

  // Status and timeline
  status: varchar('status')
    .$type<'inquiry' | 'quoted' | 'booked' | 'confirmed' | 'completed' | 'cancelled'>()
    .default('inquiry'),
  bookingDate: timestamp('booking_date'),
  serviceDate: timestamp('service_date'),

  // Norwegian business compliance
  orgNumber: varchar('org_number'), // Norwegian organization number
  mvaCertified: boolean('mva_certified').default(false),
  insurance: text('insurance_details'),

  // Family tree integration
  hasAccessToFamilyTree: boolean('has_access_to_family_tree').default(false),
  canViewFamilyPhotos: boolean('can_view_family_photos').default(false),
  familyTreeRole: varchar('family_tree_role'), // "Official Photographer", "Videographer"

  // Notes and communication
  notes: text('notes'),
  lastContactDate: timestamp('last_contact_date'),
  nextFollowUpDate: timestamp('next_follow_up_date'),

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Family tree upload sessions for client-side uploads
export const uploadSessions = pgTable('upload_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  treeId: uuid('tree_id')
    .notNull()
    .references(() => familyTrees.id, { onDelete: 'cascade' }),
  sessionCode: varchar('session_code').unique().notNull(), // Unique code for family members

  // Session details
  uploaderName: varchar('uploader_name').notNull(),
  uploaderEmail: varchar('uploader_email'),
  uploaderPhone: varchar('uploader_phone'),
  relationship: varchar('relationship'), // How they're related to couple

  // Permissions
  canAddMembers: boolean('can_add_members').default(true),
  canEditMembers: boolean('can_edit_members').default(false),
  canUploadPhotos: boolean('can_upload_photos').default(true),
  maxUploads: integer('max_uploads').default(50),

  // Session status
  isActive: boolean('is_active').default(true),
  expiresAt: timestamp('expires_at'), // Session expiration
  lastUsedAt: timestamp('last_used_at'),
  uploadsCount: integer('uploads_count').default(0),

  createdAt: timestamp('created_at').defaultNow(),
});

// Relations
export const familyTreesRelations = relations(familyTrees, ({ many }) => ({
  members: many(familyMembers),
  connections: many(familyConnections),
  vendors: many(eventVendors),
  uploadSessions: many(uploadSessions),
}));

export const familyMembersRelations = relations(familyMembers, ({ one, many }) => ({
  tree: one(familyTrees, {
    fields: [familyMembers.treeId],
    references: [familyTrees.id],
  }),
  spouse: one(familyMembers, {
    fields: [familyMembers.spouseId],
    references: [familyMembers.id],
  }),
  connectionsAsOne: many(familyConnections, {
    relationName: 'memberOne',
  }),
  connectionsAsTwo: many(familyConnections, {
    relationName: 'memberTwo',
  }),
}));

export const familyConnectionsRelations = relations(familyConnections, ({ one }) => ({
  tree: one(familyTrees, {
    fields: [familyConnections.treeId],
    references: [familyTrees.id],
  }),
  memberOne: one(familyMembers, {
    fields: [familyConnections.memberOneId],
    references: [familyMembers.id],
    relationName: 'memberOne',
  }),
  memberTwo: one(familyMembers, {
    fields: [familyConnections.memberTwoId],
    references: [familyMembers.id],
    relationName: 'memberTwo',
  }),
}));

export const eventVendorsRelations = relations(eventVendors, ({ one }) => ({
  tree: one(familyTrees, {
    fields: [eventVendors.treeId],
    references: [familyTrees.id],
  }),
}));

export const uploadSessionsRelations = relations(uploadSessions, ({ one }) => ({
  tree: one(familyTrees, {
    fields: [uploadSessions.treeId],
    references: [familyTrees.id],
  }),
}));

// Zod schemas for validation
export const insertFamilyTreeSchema = createInsertSchema(familyTrees).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertFamilyMemberSchema = createInsertSchema(familyMembers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  uploadedAt: true,
  approvedAt: true,
});

export const insertEventVendorSchema = createInsertSchema(eventVendors).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertUploadSessionSchema = createInsertSchema(uploadSessions).omit({
  id: true,
  createdAt: true,
});

// Type exports
export type FamilyTree = typeof familyTrees.$inferSelect;
export type InsertFamilyTree = z.infer<typeof insertFamilyTreeSchema>;

export type FamilyMember = typeof familyMembers.$inferSelect;
export type InsertFamilyMember = z.infer<typeof insertFamilyMemberSchema>;

export type FamilyConnection = typeof familyConnections.$inferSelect;
export type InsertFamilyConnection = typeof familyConnections.$inferInsert;

export type EventVendor = typeof eventVendors.$inferSelect;
export type InsertEventVendor = z.infer<typeof insertEventVendorSchema>;

export type UploadSession = typeof uploadSessions.$inferSelect;
export type InsertUploadSession = z.infer<typeof insertUploadSessionSchema>;
