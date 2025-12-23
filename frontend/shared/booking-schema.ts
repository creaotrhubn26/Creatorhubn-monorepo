import {
  pgTable,
  text,
  varchar,
  timestamp,
  boolean,
  integer,
  decimal,
  jsonb,
  uuid,
  serial,
  date,
  time,
  index,
  unique,
} from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';

// Service Providers (Photographers, Salons, etc.)
export const serviceProviders = pgTable('service_providers', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: varchar('user_id').notNull(), // Links to main user system
  businessName: varchar('business_name').notNull(),
  businessType: varchar('business_type').notNull(), // 'photography', 'salon', 'beauty', 'fitness', etc.
  description: text('description'),
  address: text('address'),
  phone: varchar('phone'),
  email: varchar('email'),
  website: varchar('website'),

  // Business branding - solve Fresha's customization limitation
  brandColors: jsonb('brand_colors').$type<{
    primary: string;
    secondary: string;
    accent: string;
  }>(),
  logo: varchar('logo_url'),
  coverImages: jsonb('cover_images').$type<string[]>().default([]),

  // Business settings
  timezone: varchar('timezone').default('Europe/Oslo'),
  currency: varchar('currency').default('NOK'),

  // Advanced features - solve Fresha's limitations
  customBookingPageUrl: varchar('custom_booking_page_url'), // Custom URL like business.creatorhubn.com
  requireClientAccount: boolean('require_client_account').default(false), // Solve forced account creation

  // Payment settings - solve Fresha's payment issues
  stripeAccountId: varchar('stripe_account_id'),
  acceptsOnlinePayments: boolean('accepts_online_payments').default(false),
  depositPercentage: decimal('deposit_percentage', { precision: 5, scale: 2 }),

  // Review settings - solve Fresha's review manipulation
  allowPublicReviews: boolean('allow_public_reviews').default(true),
  reviewModerationEnabled: boolean('review_moderation_enabled').default(false),

  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Service Categories
export const serviceCategories = pgTable('service_categories', {
  id: uuid('id').defaultRandom().primaryKey(),
  providerId: uuid('provider_id').references(() => serviceProviders.id, {
    onDelete: 'cascade',
  }),
  name: varchar('name').notNull(),
  description: text('description'),
  displayOrder: integer('display_order').default(0),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
});

// Services - solve Timma's complex service management
export const services = pgTable('services', {
  id: uuid('id').defaultRandom().primaryKey(),
  providerId: uuid('provider_id').references(() => serviceProviders.id, {
    onDelete: 'cascade',
  }),
  categoryId: uuid('category_id').references(() => serviceCategories.id, {
    onDelete: 'set null',
  }),

  name: varchar('name').notNull(),
  description: text('description'),
  duration: integer('duration_minutes').notNull(), // Clear duration in minutes
  price: decimal('price', { precision: 10, scale: 2 }),

  // Advanced pricing - solve both platforms' pricing issues
  dynamicPricing: boolean('dynamic_pricing').default(false),
  peakHourMultiplier: decimal('peak_hour_multiplier', {
    precision: 3,
    scale: 2,
  }).default('1.00'),
  weekendMultiplier: decimal('weekend_multiplier', {
    precision: 3,
    scale: 2,
  }).default('1.00'),

  // Booking settings
  advanceBookingDays: integer('advance_booking_days').default(30),
  minimumNoticeHours: integer('minimum_notice_hours').default(24),
  maxBookingsPerDay: integer('max_bookings_per_day'),

  // Service specific settings
  requiresDeposit: boolean('requires_deposit').default(false),
  depositAmount: decimal('deposit_amount', { precision: 10, scale: 2 }),

  // Photos for each service - solve Fresha's limitation
  serviceImages: jsonb('service_images').$type<string[]>().default([]),

  // Staff assignments - solve Timma's user-service complexity
  availableStaff: jsonb('available_staff').$type<string[]>().default([]), // Staff member IDs

  isOnlineBookable: boolean('is_online_bookable').default(true),
  isActive: boolean('is_active').default(true),
  displayOrder: integer('display_order').default(0),

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Staff Members
export const staffMembers = pgTable('staff_members', {
  id: uuid('id').defaultRandom().primaryKey(),
  providerId: uuid('provider_id').references(() => serviceProviders.id, {
    onDelete: 'cascade',
  }),

  firstName: varchar('first_name').notNull(),
  lastName: varchar('last_name').notNull(),
  email: varchar('email'),
  phone: varchar('phone'),

  title: varchar('title'), // "Senior Photographer", "Hair Stylist", etc.
  bio: text('bio'),
  profileImage: varchar('profile_image'),

  // Availability settings - solve Timma's complex working hours
  defaultWorkingHours: jsonb('default_working_hours').$type<{
    monday: { start: string; end: string; isWorking: boolean };
    tuesday: { start: string; end: string; isWorking: boolean };
    wednesday: { start: string; end: string; isWorking: boolean };
    thursday: { start: string; end: string; isWorking: boolean };
    friday: { start: string; end: string; isWorking: boolean };
    saturday: { start: string; end: string; isWorking: boolean };
    sunday: { start: string; end: string; isWorking: boolean };
  }>(),

  // Individual pricing - solve both platforms' pricing complexity
  hasIndividualPricing: boolean('has_individual_pricing').default(false),
  pricingMultiplier: decimal('pricing_multiplier', {
    precision: 3,
    scale: 2,
  }).default('1.00'),

  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Custom working hours for specific dates - solve Timma's vacation management
export const staffScheduleOverrides = pgTable(
  'staff_schedule_overrides',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    staffId: uuid('staff_id').references(() => staffMembers.id, {
      onDelete: 'cascade',
    }),
    date: date('date').notNull(),

    isWorking: boolean('is_working').default(true),
    startTime: time('start_time'),
    endTime: time('end_time'),

    reason: varchar('reason'), // "Vacation", "Sick", "Conference", etc.
    notes: text('notes'),

    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => ({
    uniqueStaffDate: unique().on(table.staffId, table.date),
  }),
);

// Clients - solve Fresha's forced account creation
export const clients = pgTable(
  'clients',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    // Optional account creation
    userId: varchar('user_id'), // Only set if client creates account

    // Required booking info
    firstName: varchar('first_name').notNull(),
    lastName: varchar('last_name').notNull(),
    email: varchar('email').notNull(),
    phone: varchar('phone'),

    // Client preferences
    preferredLanguage: varchar('preferred_language').default('no'),
    communicationPreferences: jsonb('communication_preferences')
      .$type<{
        emailReminders: boolean;
        smsReminders: boolean;
        marketingEmails: boolean;
      }>()
      .default({
        emailReminders: true,
        smsReminders: true,
        marketingEmails: false,
      }),

    // Client history
    totalBookings: integer('total_bookings').default(0),
    totalSpent: decimal('total_spent', { precision: 10, scale: 2 }).default('0.00'),
    lastBookingDate: timestamp('last_booking_date'),

    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    emailIdx: index('idx_clients_email').on(table.email),
  }),
);

// Bookings - the core of the system
export const bookings = pgTable(
  'bookings',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    bookingNumber: varchar('booking_number').notNull().unique(), // Human-readable booking reference

    providerId: uuid('provider_id').references(() => serviceProviders.id, {
      onDelete: 'cascade',
    }),
    serviceId: uuid('service_id').references(() => services.id),
    staffId: uuid('staff_id').references(() => staffMembers.id),
    clientId: uuid('client_id').references(() => clients.id),

    // Booking details
    bookingDate: date('booking_date').notNull(),
    startTime: time('start_time').notNull(),
    endTime: time('end_time').notNull(),

    // Pricing
    servicePrice: decimal('service_price', {
      precision: 10,
      scale: 2,
    }).notNull(),
    depositRequired: decimal('deposit_required', { precision: 10, scale: 2 }),
    depositPaid: decimal('deposit_paid', { precision: 10, scale: 2 }).default('0.00'),
    totalPrice: decimal('total_price', { precision: 10, scale: 2 }).notNull(),

    // Status tracking
    status: varchar('status').notNull().default('pending'), // pending, confirmed, cancelled, completed, no_show

    // Payment tracking - solve Fresha's payment issues
    paymentStatus: varchar('payment_status').default('pending'), // pending, paid, refunded, failed
    paymentIntentId: varchar('payment_intent_id'), // Stripe payment intent

    // Booking source tracking
    bookingSource: varchar('booking_source').default('online'), // online, phone, walk_in, recurring

    // Notes and special requests
    clientNotes: text('client_notes'),
    staffNotes: text('staff_notes'),
    internalNotes: text('internal_notes'),

    // Cancellation tracking
    cancellationReason: text('cancellation_reason'),
    cancelledAt: timestamp('cancelled_at'),
    cancelledBy: varchar('cancelled_by'), // client, staff, system

    // Automatic confirmations - solve both platforms' communication gaps
    confirmationSentAt: timestamp('confirmation_sent_at'),
    reminderSentAt: timestamp('reminder_sent_at'),

    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    bookingDateIdx: index('idx_bookings_date').on(table.bookingDate),
    providerDateIdx: index('idx_bookings_provider_date').on(table.providerId, table.bookingDate),
    statusIdx: index('idx_bookings_status').on(table.status),
  }),
);

// Reviews - solve Fresha's review manipulation issues
export const reviews = pgTable(
  'reviews',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    bookingId: uuid('booking_id').references(() => bookings.id, {
      onDelete: 'cascade',
    }),
    providerId: uuid('provider_id').references(() => serviceProviders.id, {
      onDelete: 'cascade',
    }),
    clientId: uuid('client_id').references(() => clients.id),

    rating: integer('rating').notNull(), // 1-5 stars
    title: varchar('title'),
    comment: text('comment'),

    // Review verification
    isVerified: boolean('is_verified').default(true), // Based on actual booking
    moderationStatus: varchar('moderation_status').default('approved'), // pending, approved, rejected

    // Response from business
    businessResponse: text('business_response'),
    businessResponseAt: timestamp('business_response_at'),

    isPublic: boolean('is_public').default(true),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    providerRatingIdx: index('idx_reviews_provider_rating').on(table.providerId, table.rating),
  }),
);

// Discount codes - solve Fresha's limitation
export const discountCodes = pgTable(
  'discount_codes',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    providerId: uuid('provider_id').references(() => serviceProviders.id, {
      onDelete: 'cascade',
    }),

    code: varchar('code').notNull(),
    description: text('description'),

    discountType: varchar('discount_type').notNull(), // percentage, fixed_amount
    discountValue: decimal('discount_value', {
      precision: 10,
      scale: 2,
    }).notNull(),

    // Usage limits
    maxUses: integer('max_uses'),
    currentUses: integer('current_uses').default(0),
    maxUsesPerClient: integer('max_uses_per_client').default(1),

    // Validity
    validFrom: timestamp('valid_from').notNull(),
    validTo: timestamp('valid_to').notNull(),

    // Conditions
    minimumSpend: decimal('minimum_spend', { precision: 10, scale: 2 }),
    applicableServices: jsonb('applicable_services').$type<string[]>().default([]), // Service IDs

    isActive: boolean('is_active').default(true),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => ({
    uniqueProviderCode: unique().on(table.providerId, table.code),
  }),
);

// Booking addons/extras
export const bookingAddons = pgTable('booking_addons', {
  id: uuid('id').defaultRandom().primaryKey(),
  bookingId: uuid('booking_id').references(() => bookings.id, {
    onDelete: 'cascade',
  }),

  name: varchar('name').notNull(),
  description: text('description'),
  price: decimal('price', { precision: 10, scale: 2 }).notNull(),
  duration: integer('duration_minutes').default(0),

  createdAt: timestamp('created_at').defaultNow(),
});

// Notification preferences and templates
export const notificationTemplates = pgTable(
  'notification_templates',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    providerId: uuid('provider_id').references(() => serviceProviders.id, {
      onDelete: 'cascade',
    }),

    templateType: varchar('template_type').notNull(), // booking_confirmation, reminder, cancellation, etc.
    channel: varchar('channel').notNull(), // email, sms

    subject: varchar('subject'), // For emails
    content: text('content').notNull(),

    // Template variables: {{clientName}}, {{bookingDate}}, {{serviceName}}, etc.

    isActive: boolean('is_active').default(true),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    uniqueProviderTypeChannel: unique().on(table.providerId, table.templateType, table.channel),
  }),
);

// Analytics and reporting
export const bookingAnalytics = pgTable(
  'booking_analytics',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    providerId: uuid('provider_id').references(() => serviceProviders.id, {
      onDelete: 'cascade',
    }),

    date: date('date').notNull(),

    // Daily metrics
    totalBookings: integer('total_bookings').default(0),
    confirmedBookings: integer('confirmed_bookings').default(0),
    cancelledBookings: integer('cancelled_bookings').default(0),
    noShowBookings: integer('no_show_bookings').default(0),

    totalRevenue: decimal('total_revenue', { precision: 10, scale: 2 }).default('0.00'),
    avgBookingValue: decimal('avg_booking_value', {
      precision: 10,
      scale: 2,
    }).default('0.00'),

    // New vs returning clients
    newClients: integer('new_clients').default(0),
    returningClients: integer('returning_clients').default(0),

    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => ({
    uniqueProviderDate: unique().on(table.providerId, table.date),
  }),
);

// Type exports
export type ServiceProvider = typeof serviceProviders.$inferSelect;
export type InsertServiceProvider = typeof serviceProviders.$inferInsert;

export type Service = typeof services.$inferSelect;
export type InsertService = typeof services.$inferInsert;

export type StaffMember = typeof staffMembers.$inferSelect;
export type InsertStaffMember = typeof staffMembers.$inferInsert;

export type Client = typeof clients.$inferSelect;
export type InsertClient = typeof clients.$inferInsert;

export type Booking = typeof bookings.$inferSelect;
export type InsertBooking = typeof bookings.$inferInsert;

export type Review = typeof reviews.$inferSelect;
export type InsertReview = typeof reviews.$inferInsert;

// Zod schemas
export const insertServiceProviderSchema = createInsertSchema(serviceProviders);
export const insertServiceSchema = createInsertSchema(services);
export const insertStaffMemberSchema = createInsertSchema(staffMembers);
export const insertClientSchema = createInsertSchema(clients);
export const insertBookingSchema = createInsertSchema(bookings);
export const insertReviewSchema = createInsertSchema(reviews);
