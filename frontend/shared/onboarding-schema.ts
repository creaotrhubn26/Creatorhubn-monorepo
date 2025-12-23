import {
  pgTable,
  text,
  varchar,
  timestamp,
  jsonb,
  integer,
  boolean,
  uuid,
} from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';

// Onboarding Profiles - Main user onboarding data
export const onboardingProfiles = pgTable('onboarding_profiles', {
  id: varchar('id').primaryKey().notNull(),
  userId: varchar('user_id').notNull(),
  userType: varchar('user_type')
    .$type<'photographer' | 'videographer' | 'music_producer' | 'creator' | 'vendor'>()
    .notNull(),
  experienceLevel: varchar('experience_level')
    .$type<'beginner' | 'intermediate' | 'advanced' | 'expert'>()
    .default('beginner'),
  learningStyle: varchar('learning_style')
    .$type<'step_by_step' | 'video_based' | 'hands_on' | 'documentation'>()
    .default('step_by_step'),
  preferredLanguage: varchar('preferred_language').default('norwegian'),

  // User goals and preferences
  goals: jsonb('goals').$type<string[]>().default([]),
  completedSteps: jsonb('completed_steps').$type<string[]>().default([]),
  currentPath: varchar('current_path'),

  // User profile customization
  profilePhoto: varchar('profile_photo'), // URL to uploaded photo
  brandingColor: varchar('branding_color').default('#ff8c00'), // Custom brand color
  businessName: varchar('business_name'), // Custom business/studio name
  tagline: varchar('tagline'), // Personal/business tagline
  customLogo: varchar('custom_logo'), // URL to uploaded logo

  // Business information for professional documents
  email: varchar('email'), // Business email
  phone: varchar('phone'), // Business phone
  businessAddress: varchar('business_address'), // Full business address
  organizationNumber: varchar('organization_number'), // Norwegian organization number
  website: varchar('website'), // Business website URL
  vatNumber: varchar('vat_number'), // MVA number

  // ⭐ Business Lifecycle Management
  businessStatus: varchar('business_status')
    .$type<'active' | 'suspended' | 'bankrupt' | 'cancelled' | 'pending_closure'>()
    .default('active'),
  businessStatusReason: text('business_status_reason'),
  businessStatusChangedAt: timestamp('business_status_changed_at'),
  businessStatusChangedBy: varchar('business_status_changed_by'),

  // ⭐ Financial Health Tracking
  lastFinancialCheck: timestamp('last_financial_check'),
  creditRating: varchar('credit_rating'), // From Proff.no (AAA, AA, A, BBB, etc.)
  riskLevel: varchar('risk_level').$type<'low' | 'medium' | 'high' | 'critical'>(),
  riskIndicators: jsonb('risk_indicators').$type<
    Array<{
      type: string;
      severity: string;
      description: string;
      detectedAt: string;
    }>
  >(),

  // ⭐ GDPR Compliance & Data Retention
  dataRetentionUntil: timestamp('data_retention_until'),
  markedForDeletion: boolean('marked_for_deletion').default(false),
  deletionRequestedAt: timestamp('deletion_requested_at'),
  deletionRequestedBy: varchar('deletion_requested_by'),
  deletionCompletedAt: timestamp('deletion_completed_at'),

  // ⭐ Service Access Control
  serviceRestrictions: jsonb('service_restrictions')
    .$type<{
      canCreateProjects: boolean;
      canSignContracts: boolean;
      canReceivePayments: boolean;
      canAccessBooking: boolean;
      canUploadFiles: boolean;
      canDownloadFiles: boolean;
      canEditProfile: boolean;
    }>()
    .default({
      canCreateProjects: true,
      canSignContracts: true,
      canReceivePayments: true,
      canAccessBooking: true,
      canUploadFiles: true,
      canDownloadFiles: true,
      canEditProfile: true,
    }),

  // ⭐ Onboarding completion tracking
  onboardingCompleted: boolean('onboarding_completed').default(false),

  // Personalized recommendations
  personalizedRecommendations: jsonb('personalized_recommendations').$type<{
    nextSteps: string[];
    recommendedFeatures: string[];
    learningResources: string[];
    timeEstimates: Record<string, number>;
  }>(),

  // Progress tracking data
  progressData: jsonb('progress_data').$type<{
    totalSteps: number;
    completedSteps: number;
    timeSpent: number;
    lastActiveStep: string;
    skillAssessments: Record<string, number>;
  }>(),

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Learning Paths - Structured learning sequences
export const learningPaths = pgTable('learning_paths', {
  id: uuid('id').primaryKey().defaultRandom(),
  pathName: varchar('path_name').notNull(),
  userType: varchar('user_type')
    .$type<'photographer' | 'videographer' | 'music_producer' | 'creator' | 'vendor'>()
    .notNull(),
  difficulty: varchar('difficulty').$type<'beginner' | 'intermediate' | 'advanced'>().notNull(),
  estimatedDuration: integer('estimated_duration').notNull(), // in minutes

  // Path structure
  steps: jsonb('steps')
    .$type<
      Array<{
        stepId: string;
        title: string;
        description: string;
        estimatedTime: number;
        prerequisites: string[];
        objectives: string[];
        resources: string[];
      }>
    >()
    .notNull(),

  // Path metadata
  completionCriteria: jsonb('completion_criteria').$type<{
    requiredSteps: string[];
    optionalSteps: string[];
    assessmentRequired: boolean;
    minimumScore?: number;
  }>(),

  // Norwegian localization
  norwegianContent: jsonb('norwegian_content').$type<{
    title: string;
    description: string;
    steps: Record<string, { title: string; description: string }>;
  }>(),

  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Onboarding Progress - Individual step tracking
export const onboardingProgress = pgTable('onboarding_progress', {
  id: uuid('id').primaryKey().defaultRandom(),
  profileId: varchar('profile_id')
    .references(() => onboardingProfiles.id)
    .notNull(),
  stepId: varchar('step_id').notNull(),
  pathId: uuid('path_id').references(() => learningPaths.id),

  // Progress metrics
  status: varchar('status')
    .$type<'not_started' | 'in_progress' | 'completed' | 'skipped'>()
    .default('not_started'),
  timeSpent: integer('time_spent').default(0), // in seconds
  attempts: integer('attempts').default(0),
  score: integer('score'), // 0-100

  // Step-specific data
  stepData: jsonb('step_data').$type<Record<string, any>>(),
  userFeedback: text('user_feedback'),
  systemFeedback: jsonb('system_feedback').$type<{
    suggestions: string[];
    warnings: string[];
    achievements: string[];
  }>(),

  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Adaptive Recommendations - Intelligent user guidance
export const adaptiveRecommendations = pgTable('adaptive_recommendations', {
  id: uuid('id').primaryKey().defaultRandom(),
  profileId: varchar('profile_id')
    .references(() => onboardingProfiles.id)
    .notNull(),

  // Recommendation data
  recommendationType: varchar('recommendation_type')
    .$type<'next_step' | 'skill_gap' | 'resource' | 'feature' | 'learning_path'>()
    .notNull(),
  priority: varchar('priority').$type<'low' | 'medium' | 'high' | 'critical'>().default('medium'),

  // Recommendation content
  title: varchar('title').notNull(),
  description: text('description').notNull(),
  actionableSteps: jsonb('actionable_steps').$type<string[]>().default([]),

  // Context and reasoning
  context: jsonb('context').$type<{
    userBehavior: Record<string, any>;
    performanceMetrics: Record<string, number>;
    learningPattern: string;
    triggers: string[];
  }>(),

  // Norwegian localization
  norwegianContent: jsonb('norwegian_content').$type<{
    title: string;
    description: string;
    actionableSteps: string[];
  }>(),

  // Recommendation lifecycle
  isActive: boolean('is_active').default(true),
  isAccepted: boolean('is_accepted'),
  acceptedAt: timestamp('accepted_at'),
  dismissedAt: timestamp('dismissed_at'),

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Zod schemas for validation
export const insertOnboardingProfileSchema = createInsertSchema(onboardingProfiles);
export const insertLearningPathSchema = createInsertSchema(learningPaths);
export const insertOnboardingProgressSchema = createInsertSchema(onboardingProgress);
export const insertAdaptiveRecommendationSchema = createInsertSchema(adaptiveRecommendations);

// TypeScript types
export type OnboardingProfile = typeof onboardingProfiles.$inferSelect;
export type InsertOnboardingProfile = z.infer<typeof insertOnboardingProfileSchema>;

export type LearningPath = typeof learningPaths.$inferSelect;
export type InsertLearningPath = z.infer<typeof insertLearningPathSchema>;

export type OnboardingProgress = typeof onboardingProgress.$inferSelect;
export type InsertOnboardingProgress = z.infer<typeof insertOnboardingProgressSchema>;

export type AdaptiveRecommendation = typeof adaptiveRecommendations.$inferSelect;
export type InsertAdaptiveRecommendation = z.infer<typeof insertAdaptiveRecommendationSchema>;

// Learning Path Templates
export const LEARNING_PATH_TEMPLATES = {
  photographer_beginner: {
    id: 'photographer_beginner',
    pathName: 'Fotograf - Begynner',
    userType: 'photographer' as const,
    experienceLevel: 'beginner' as const,
    estimatedDuration: 120,
    steps: [
      {
        stepId: 'basic_camera',
        title: 'Lær kameraets grunnfunksjoner',
        description: 'Bli kjent med kameraet ditt og grunnleggende innstillinger',
        estimatedTime: 30,
        prerequisites: [],
        objectives: ['Forstå ISO, blender og lukkertid', 'Kunne ta skarpe bilder'],
        resources: ['Kameraguide', 'Praksis øvelser'],
      },
    ],
    completionCriteria: {
      requiredSteps: ['basic_camera'],
      optionalSteps: [],
      assessmentRequired: false,
    },
    norwegianContent: {
      title: 'Fotograf - Begynner',
      description: 'Grunnleggende fotografering for nybegynnere',
      steps: {
        basic_camera: {
          title: 'Lær kameraets grunnfunksjoner',
          description: 'Bli kjent med kameraet ditt og grunnleggende innstillinger',
        },
      },
    },
  },
  music_producer_beginner: {
    id: 'music_producer_beginner',
    pathName: 'Musikkprodusent - Begynner',
    userType: 'music_producer' as const,
    experienceLevel: 'beginner' as const,
    estimatedDuration: 150,
    steps: [
      {
        stepId: 'basic_daw',
        title: 'Lær DAW grunnfunksjoner',
        description: 'Bli kjent med Digital Audio Workstation',
        estimatedTime: 45,
        prerequisites: [],
        objectives: ['Forstå spor og kanaler', 'Kunne ta opp lyd'],
        resources: ['DAW guide', 'Øvelsesprosjekter'],
      },
    ],
    completionCriteria: {
      requiredSteps: ['basic_daw'],
      optionalSteps: [],
      assessmentRequired: false,
    },
    norwegianContent: {
      title: 'Musikkprodusent - Begynner',
      description: 'Grunnleggende musikproduksjon for nybegynnere',
      steps: {
        basic_daw: {
          title: 'Lær DAW grunnfunksjoner',
          description: 'Bli kjent med Digital Audio Workstation',
        },
      },
    },
  },
  videographer_beginner: {
    id: 'videographer_beginner',
    pathName: 'Videograf - Begynner',
    userType: 'videographer' as const,
    experienceLevel: 'beginner' as const,
    estimatedDuration: 135,
    steps: [
      {
        stepId: 'basic_video',
        title: 'Lær video grunnfunksjoner',
        description: 'Bli kjent med videokamera og grunnleggende innstillinger',
        estimatedTime: 40,
        prerequisites: [],
        objectives: ['Forstå frame rate og oppløsning', 'Kunne filme stabilt'],
        resources: ['Video guide', 'Praksis øvelser'],
      },
    ],
    completionCriteria: {
      requiredSteps: ['basic_video'],
      optionalSteps: [],
      assessmentRequired: false,
    },
    norwegianContent: {
      title: 'Videograf - Begynner',
      description: 'Grunnleggende videografi for nybegynnere',
      steps: {
        basic_video: {
          title: 'Lær video grunnfunksjoner',
          description: 'Bli kjent med videokamera og grunnleggende innstillinger',
        },
      },
    },
  },
  vendor_beginner: {
    id: 'vendor_beginner',
    pathName: 'Leverandør - Begynner',
    userType: 'vendor' as const,
    experienceLevel: 'beginner' as const,
    estimatedDuration: 90,
    steps: [
      {
        stepId: 'basic_products',
        title: 'Produktkatalog grunnfunksjoner',
        description: 'Lær å administrere produkter og bestillinger',
        estimatedTime: 30,
        prerequisites: [],
        objectives: ['Kunne legge til produkter', 'Håndtere bestillinger'],
        resources: ['Leverandør guide', 'Eksempel produkter'],
      },
    ],
    completionCriteria: {
      requiredSteps: ['basic_products'],
      optionalSteps: [],
      assessmentRequired: false,
    },
    norwegianContent: {
      title: 'Leverandør - Begynner',
      description: 'Grunnleggende leverandør administrasjon',
      steps: {
        basic_products: {
          title: 'Produktkatalog grunnfunksjoner',
          description: 'Lær å administrere produkter og bestillinger',
        },
      },
    },
  },
} as const;
