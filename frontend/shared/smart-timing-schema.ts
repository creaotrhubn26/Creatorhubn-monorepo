// =============================================================================
// SMART TIMING & PLANNER SYSTEM SCHEMA - INTELLIGENT TIME MANAGEMENT FOR NORWEGIAN CREATIVE PROFESSIONALS
// =============================================================================

import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  jsonb,
  decimal,
  integer,
  boolean,
} from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';

// Smart Timing Preferences - Photographer's time requirements for different activities
export const smartTimingPreferences = pgTable('smart_timing_preferences', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: varchar('user_id').notNull(),
  userType: varchar('user_type')
    .$type<'photographer' | 'videographer' | 'music_producer'>()
    .notNull(),

  // Activity-based timing preferences
  timingConfiguration: jsonb('timing_configuration')
    .$type<{
      coupleShoot: {
        hours: number;
        description: string;
        isRequired: boolean;
      };
      ceremonySetup: {
        hours: number;
        description: string;
        isRequired: boolean;
      };
      receptionSetup: {
        hours: number;
        description: string;
        isRequired: boolean;
      };
      groupPhotos: {
        hours: number;
        description: string;
        isRequired: boolean;
      };
      cocktailHour: {
        hours: number;
        description: string;
        isRequired: boolean;
      };
      danceFloor: {
        hours: number;
        description: string;
        isRequired: boolean;
      };
      equipmentSetup: {
        hours: number;
        description: string;
        isRequired: boolean;
      };
      locationScouting: {
        hours: number;
        description: string;
        isRequired: boolean;
      };
      postProcessing: {
        hoursPerHourShot: number;
        description: string;
        isIncludedInQuote: boolean;
      };
      customActivities: {
        name: string;
        hours: number;
        description: string;
        isRequired: boolean;
      }[];
    }>()
    .notNull(),

  // Norwegian market specializations
  norwegianWeddingSettings: jsonb('norwegian_wedding_settings')
    .$type<{
      includesPolarNightConsiderations: boolean;
      midnightSunAdjustments: boolean;
      fjordLocationFactors: boolean;
      traditionelleVigselCeremonies: boolean;
      samiskWeddingTraditions: boolean;
      seasonalWeatherBuffers: boolean;
      citySpecificTimings: {
        oslo: number;
        bergen: number;
        trondheim: number;
        stavanger: number;
        tromso: number;
      };
    }>()
    .default({
      includesPolarNightConsiderations: false,
      midnightSunAdjustments: false,
      fjordLocationFactors: false,
      traditionelleVigselCeremonies: false,
      samiskWeddingTraditions: false,
      seasonalWeatherBuffers: false,
      citySpecificTimings: {
        oslo: 0,
        bergen: 0,
        trondheim: 0,
        stavanger: 0,
        tromso: 0,
      },
    }),

  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Smart Event Planner - Collaborative event planning with intelligent time calculations
export const smartEventPlanners = pgTable('smart_event_planners', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: varchar('project_id').notNull(),
  userId: varchar('user_id').notNull(), // Creative professional
  clientId: varchar('client_id'), // Wedding couple or event manager

  // Collaborative features
  primaryProfessionalId: varchar('primary_professional_id').notNull(),
  collaboratingProfessionals: jsonb('collaborating_professionals')
    .$type<
      {
        professionalId: string;
        professionalType: 'photographer' | 'videographer' | 'music_producer';
        name: string;
        email: string;
        role: string;
        permissions: {
          canEditTimeline: boolean;
          canAddEvents: boolean;
          canInviteOthers: boolean;
          canViewClientInfo: boolean;
        };
        specialization: string[];
        locationCoverage: string[];
        addedAt: string;
        confirmedAt?: string;
        status: 'invited' | 'confirmed' | 'declined' | 'removed';
      }[]
    >()
    .default([]),
  collaborationType: varchar('collaboration_type')
    .$type<
      | 'single_professional'
      | 'photographer_videographer'
      | 'full_creative_team'
      | 'multi_specialist'
    >()
    .default('single_professional'),
  teamCoordinationSettings: jsonb('team_coordination_settings')
    .$type<{
      requiresSetupCoordination: boolean;
      sharedEquipmentList: string[];
      communicationMethod: 'platform_chat' | 'email' | 'phone' | 'whatsapp';
      meetingScheduled: boolean;
      combinedQuoteRequested: boolean;
      conflictResolutionMethod: 'automatic' | 'manual_review' | 'client_decides';
      norwegianLogistics: {
        travelCoordination: boolean;
        accommodationSharing: boolean;
        ferryBookings?: boolean;
        weatherContingencyPlan: boolean;
      };
    }>()
    .default({
      requiresSetupCoordination: false,
      sharedEquipmentList: [],
      communicationMethod: 'platform_chat',
      meetingScheduled: false,
      combinedQuoteRequested: false,
      conflictResolutionMethod: 'automatic',
      norwegianLogistics: {
        travelCoordination: false,
        accommodationSharing: false,
        ferryBookings: false,
        weatherContingencyPlan: false,
      },
    }),
  combinedTimelineStatus: varchar('combined_timeline_status')
    .$type<
      | 'draft'
      | 'professionals_reviewing'
      | 'conflicts_detected'
      | 'approved'
      | 'client_review'
      | 'finalized'
    >()
    .default('draft'),

  // Basic event information
  eventType: varchar('event_type')
    .$type<
      | 'wedding'
      | 'corporate_event'
      | 'music_event'
      | 'portrait_session'
      | 'commercial_shoot'
      | 'product_photography'
    >()
    .notNull(),
  eventName: varchar('event_name').notNull(),
  eventDate: timestamp('event_date').notNull(),
  totalBookedHours: decimal('total_booked_hours', {
    precision: 4,
    scale: 2,
  }).notNull(),

  // Location and logistics
  eventLocation: jsonb('event_location')
    .$type<{
      venue: string;
      address: string;
      city: string;
      region: string;
      country: string;
      coordinates?: {
        lat: number;
        lng: number;
      };
      venueType:
        | 'church'
        | 'hotel'
        | 'outdoor'
        | 'restaurant'
        | 'private_home'
        | 'corporate_venue'
        | 'studio';
      accessibilityNotes?: string;
      parkingInformation?: string;
      wifiAvailable?: boolean;
      powerOutletsAvailable?: boolean;
    }>()
    .notNull(),

  // Smart timing calculations
  intelligentTimeAllocation: jsonb('intelligent_time_allocation')
    .$type<{
      automaticDeductions: {
        activityName: string;
        allocatedHours: number;
        isUserDefined: boolean;
        importance: 'critical' | 'high' | 'medium' | 'low';
        dependsOnWeather?: boolean;
        requiresSpecialEquipment?: boolean;
      }[];
      remainingFlexibleTime: number;
      bufferTime: number;
      totalAllocatedTime: number;
      overallocationWarning?: boolean;
    }>()
    .notNull(),

  // Collaboration settings
  collaborationSettings: jsonb('collaboration_settings')
    .$type<{
      clientCanEditTimeline: boolean;
      clientCanAddEvents: boolean;
      clientCanUploadInspiration: boolean;
      autoNotifyChanges: boolean;
      requireApprovalForChanges: boolean;
      allowComments: boolean;
      sharingPermissions: 'private' | 'client_only' | 'extended_family' | 'public_link';
    }>()
    .default({
      clientCanEditTimeline: false,
      clientCanAddEvents: false,
      clientCanUploadInspiration: false,
      autoNotifyChanges: true,
      requireApprovalForChanges: false,
      allowComments: true,
      sharingPermissions: 'private',
    }),

  // Status and workflow
  plannerStatus: varchar('planner_status')
    .$type<
      'draft' | 'shared_with_client' | 'approved' | 'in_progress' | 'completed' | 'cancelled'
    >()
    .default('draft'),
  lastClientInteraction: timestamp('last_client_interaction'),

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Event Timeline Entries - Detailed timeline with inspiration photos and client collaboration
export const eventTimelineEntries = pgTable('event_timeline_entries', {
  id: uuid('id').primaryKey().defaultRandom(),
  plannerId: uuid('planner_id').notNull(),

  // Timeline details
  timeSlotStart: timestamp('time_slot_start').notNull(),
  timeSlotEnd: timestamp('time_slot_end').notNull(),
  activityName: varchar('activity_name').notNull(),
  activityType: varchar('activity_type')
    .$type<
      | 'photography'
      | 'videography'
      | 'setup'
      | 'breakdown'
      | 'travel'
      | 'break'
      | 'ceremony'
      | 'reception'
      | 'custom'
    >()
    .notNull(),

  // Detailed activity information
  activityDetails: jsonb('activity_details')
    .$type<{
      description: string;
      specialRequirements?: string[];
      equipmentNeeded?: string[];
      crewMembers?: string[];
      shotList?: string[];
      deliverables?: string[];
      priority: 'critical' | 'high' | 'medium' | 'low';
      estimatedOutputs?: {
        photos?: number;
        videoMinutes?: number;
        audioTracks?: number;
      };
      norwegianCulturalNotes?: string;
    }>()
    .notNull(),

  // Client collaboration
  clientInput: jsonb('client_input')
    .$type<{
      clientNotes?: string;
      specialRequests?: string[];
      vipGuests?: string[];
      mustHaveShots?: string[];
      avoidanceList?: string[];
      inspirationDescription?: string;
      clientApprovalStatus: 'pending' | 'approved' | 'needs_revision' | 'rejected';
      clientPriority: 'critical' | 'high' | 'medium' | 'low';
    }>()
    .default({
      clientApprovalStatus: 'pending',
      clientPriority: 'medium',
    }),

  // Inspiration and reference management
  inspirationPhotos: jsonb('inspiration_photos')
    .$type<
      {
        photoId: string;
        sourceUrl?: string;
        description: string;
        tags: string[];
        relevanceScore: number;
        uploadedBy: 'photographer' | 'client' | 'planner';
        uploadedAt: string;
        googleDriveFileId?: string;
      }[]
    >()
    .default([]),

  // Time management
  isFlexibleTiming: boolean('is_flexible_timing').default(false),
  bufferTimeBefore: integer('buffer_time_before').default(0), // minutes
  bufferTimeAfter: integer('buffer_time_after').default(0), // minutes
  weatherDependant: boolean('weather_dependant').default(false),
  indoorBackupPlan: text('indoor_backup_plan'),

  // Norwegian specific considerations
  norwegianEventFactors: jsonb('norwegian_event_factors')
    .$type<{
      seasonalConsiderations?: {
        lightingChallenges: boolean;
        weatherContingency: boolean;
        seasonal_clothing: boolean;
      };
      culturalElements?: {
        traditionalCeremonies: string[];
        languagePreferences: 'norwegian' | 'sami' | 'english' | 'mixed';
        religiousConsiderations: string[];
      };
      logisticalFactors?: {
        ferrySchedules?: boolean;
        mountainAccessibility?: boolean;
        polarNightAdjustments?: boolean;
        midnightSunOpportunities?: boolean;
      };
    }>()
    .default({
      seasonalConsiderations: {
        lightingChallenges: false,
        weatherContingency: false,
        seasonal_clothing: false,
      },
      culturalElements: {
        traditionalCeremonies: [],
        languagePreferences: 'norwegian',
        religiousConsiderations: [],
      },
      logisticalFactors: {
        ferrySchedules: false,
        mountainAccessibility: false,
        polarNightAdjustments: false,
        midnightSunOpportunities: false,
      },
    }),

  // Status tracking
  entryStatus: varchar('entry_status')
    .$type<'planned' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'rescheduled'>()
    .default('planned'),
  completionNotes: text('completion_notes'),
  actualStartTime: timestamp('actual_start_time'),
  actualEndTime: timestamp('actual_end_time'),

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Inspiration Photo Management - Photos uploaded by clients and professionals
export const plannerInspirationPhotos = pgTable('planner_inspiration_photos', {
  id: uuid('id').primaryKey().defaultRandom(),
  timelineEntryId: uuid('timeline_entry_id').notNull(),
  plannerId: uuid('planner_id').notNull(),

  // Photo metadata
  originalFileName: varchar('original_file_name').notNull(),
  googleDriveFileId: varchar('google_drive_file_id'),
  webViewLink: text('web_view_link'),
  thumbnailLink: text('thumbnail_link'),

  // Categorization and tagging
  photoCategory: varchar('photo_category')
    .$type<
      | 'pose_inspiration'
      | 'lighting_reference'
      | 'composition_example'
      | 'outfit_inspiration'
      | 'venue_layout'
      | 'decoration_ideas'
      | 'cultural_tradition'
    >()
    .notNull(),
  tags: jsonb('tags').$type<string[]>().default([]),
  description: text('description'),

  // Usage and relevance
  relevanceScore: integer('relevance_score').default(5), // 1-10 scale
  usageNotes: text('usage_notes'),
  shotPriority: varchar('shot_priority')
    .$type<'must_have' | 'nice_to_have' | 'inspiration_only'>()
    .default('inspiration_only'),

  // Upload tracking
  uploadedBy: varchar('uploaded_by')
    .$type<'photographer' | 'videographer' | 'music_producer' | 'client' | 'event_planner'>()
    .notNull(),
  uploadedByUserId: varchar('uploaded_by_user_id').notNull(),
  clientApproved: boolean('client_approved').default(false),
  photographerReviewed: boolean('photographer_reviewed').default(false),

  // Norwegian creative context
  norwegianRelevance: jsonb('norwegian_relevance')
    .$type<{
      seasonAppropriate: boolean;
      locationSpecific: boolean;
      culturallyRelevant: boolean;
      lightingConditions:
        | 'polar_night'
        | 'midnight_sun'
        | 'normal_daylight'
        | 'aurora'
        | 'fjord_lighting';
      weatherConditions: string[];
    }>()
    .default({
      seasonAppropriate: false,
      locationSpecific: false,
      culturallyRelevant: false,
      lightingConditions: 'normal_daylight',
      weatherConditions: [],
    }),

  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Project Integration - Connect smart timing to existing project administration
export const smartTimingProjectIntegration = pgTable('smart_timing_project_integration', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: varchar('project_id').notNull(),
  plannerId: uuid('planner_id').notNull(),

  // Integration with submission system
  submissionDataUsed: jsonb('submission_data_used')
    .$type<{
      estimatedHours?: number;
      eventType?: string;
      guestCount?: number;
      venueInformation?: any;
      specialRequirements?: string[];
      budgetRange?: string;
      clientPreferences?: any;
      autoPopulatedFields: string[];
    }>()
    .default({
      autoPopulatedFields: [],
    }),

  // Professional confirmation and adjustments
  professionalAdjustments: jsonb('professional_adjustments')
    .$type<{
      modifiedEstimatedHours?: number;
      addedActivities?: string[];
      removedActivities?: string[];
      timingAdjustments?: {
        activityName: string;
        originalHours: number;
        adjustedHours: number;
        reason: string;
      }[];
      professionalNotes?: string;
      quoteAdjustmentReasons?: string[];
    }>()
    .default({
      addedActivities: [],
      removedActivities: [],
      timingAdjustments: [],
      quoteAdjustmentReasons: [],
    }),

  // Confirmation workflow
  submissionConfirmed: boolean('submission_confirmed').default(false),
  professionalReviewCompleted: boolean('professional_review_completed').default(false),
  clientFinalApproval: boolean('client_final_approval').default(false),
  integrationStatus: varchar('integration_status')
    .$type<'pending' | 'reviewed' | 'confirmed' | 'finalized'>()
    .default('pending'),

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Smart timing collaboration comments and communication
export const smartTimingComments = pgTable('smart_timing_comments', {
  id: uuid('id').primaryKey().defaultRandom(),
  plannerId: uuid('planner_id').notNull(),
  timelineEntryId: uuid('timeline_entry_id'),

  // Comment details
  commentText: text('comment_text').notNull(),
  commentType: varchar('comment_type')
    .$type<
      | 'general'
      | 'timing_adjustment'
      | 'inspiration_feedback'
      | 'client_request'
      | 'professional_note'
      | 'system_notification'
    >()
    .notNull(),

  // Author information
  authorId: varchar('author_id').notNull(),
  authorType: varchar('author_type')
    .$type<
      'photographer' | 'videographer' | 'music_producer' | 'client' | 'event_planner' | 'system'
    >()
    .notNull(),
  authorName: varchar('author_name').notNull(),

  // Threading and responses
  parentCommentId: uuid('parent_comment_id'),
  isResolved: boolean('is_resolved').default(false),
  priority: varchar('priority')
    .$type<'urgent' | 'high' | 'medium' | 'low' | 'info'>()
    .default('medium'),

  // Norwegian language support
  commentLanguage: varchar('comment_language')
    .$type<'norwegian' | 'english' | 'sami'>()
    .default('norwegian'),
  translationAvailable: boolean('translation_available').default(false),

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Insert schemas for validation
export const insertSmartTimingPreferencesSchema = createInsertSchema(smartTimingPreferences);
export const insertSmartEventPlannersSchema = createInsertSchema(smartEventPlanners);
export const insertEventTimelineEntriesSchema = createInsertSchema(eventTimelineEntries);
export const insertPlannerInspirationPhotosSchema = createInsertSchema(plannerInspirationPhotos);
export const insertSmartTimingProjectIntegrationSchema = createInsertSchema(
  smartTimingProjectIntegration,
);
export const insertSmartTimingCommentsSchema = createInsertSchema(smartTimingComments);

// Type exports
export type SmartTimingPreferences = typeof smartTimingPreferences.$inferSelect;
export type InsertSmartTimingPreferences = typeof smartTimingPreferences.$inferInsert;
export type SmartEventPlanners = typeof smartEventPlanners.$inferSelect;
export type InsertSmartEventPlanners = typeof smartEventPlanners.$inferInsert;
export type EventTimelineEntries = typeof eventTimelineEntries.$inferSelect;
export type InsertEventTimelineEntries = typeof eventTimelineEntries.$inferInsert;
export type PlannerInspirationPhotos = typeof plannerInspirationPhotos.$inferSelect;
export type InsertPlannerInspirationPhotos = typeof plannerInspirationPhotos.$inferInsert;
export type SmartTimingProjectIntegration = typeof smartTimingProjectIntegration.$inferSelect;
export type InsertSmartTimingProjectIntegration = typeof smartTimingProjectIntegration.$inferInsert;
export type SmartTimingComments = typeof smartTimingComments.$inferSelect;
export type InsertSmartTimingComments = typeof smartTimingComments.$inferInsert;

// Professional Collaboration Invites - System for inviting and managing team members
export const professionalCollaborationInvites = pgTable('professional_collaboration_invites', {
  id: uuid('id').primaryKey().defaultRandom(),
  plannerId: uuid('planner_id').notNull(),
  invitingProfessionalId: varchar('inviting_professional_id').notNull(),
  invitedProfessionalEmail: varchar('invited_professional_email'),
  invitedProfessionalId: varchar('invited_professional_id'),

  // Professional requirements
  professionalType: varchar('professional_type')
    .$type<'photographer' | 'videographer' | 'music_producer'>()
    .notNull(),
  invitationStatus: varchar('invitation_status')
    .$type<'pending' | 'accepted' | 'declined' | 'expired' | 'cancelled'>()
    .default('pending'),
  invitationMessage: text('invitation_message'),

  // Requirements and specifications
  specializationRequirements: jsonb('specialization_requirements')
    .$type<{
      requiredSkills: string[];
      preferredExperience: string;
      equipmentRequirements: string[];
      norwegianLanguageRequired: boolean;
      locationFlexibility: string[];
      budgetRange?: {
        min: number;
        max: number;
        currency: string;
      };
    }>()
    .default({
      requiredSkills: [],
      preferredExperience: '',
      equipmentRequirements: [],
      norwegianLanguageRequired: false,
      locationFlexibility: [],
    }),
  locationRequirements: varchar('location_requirements'),

  // Timing and workflow
  invitationExpiresAt: timestamp('invitation_expires_at'),
  acceptedAt: timestamp('accepted_at'),
  declinedAt: timestamp('declined_at'),

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Collaborative Timeline Entries - Timeline entries that involve multiple professionals
export const collaborativeTimelineEntries = pgTable('collaborative_timeline_entries', {
  id: uuid('id').primaryKey().defaultRandom(),
  plannerId: uuid('planner_id').notNull(),
  primaryTimelineEntryId: uuid('primary_timeline_entry_id'),

  // Professional assignment
  professionalId: varchar('professional_id').notNull(),
  professionalType: varchar('professional_type')
    .$type<'photographer' | 'videographer' | 'music_producer'>()
    .notNull(),
  activityName: varchar('activity_name').notNull(),

  // Timing coordination
  timeSlotStart: timestamp('time_slot_start').notNull(),
  timeSlotEnd: timestamp('time_slot_end').notNull(),
  coordinationType: varchar('coordination_type')
    .$type<'parallel' | 'sequential' | 'overlapping' | 'independent'>()
    .default('parallel'),

  // Equipment and resource sharing
  equipmentSharing: jsonb('equipment_sharing')
    .$type<{
      sharedEquipment: string[];
      equipmentConflicts: string[];
      resolutionPlan: string;
      setupCoordination: boolean;
      storageArrangements: string;
    }>()
    .default({
      sharedEquipment: [],
      equipmentConflicts: [],
      resolutionPlan: '',
      setupCoordination: false,
      storageArrangements: '',
    }),

  // Professional coordination
  professionalNotes: text('professional_notes'),
  requiresCoordination: boolean('requires_coordination').default(true),
  conflictDetected: boolean('conflict_detected').default(false),
  conflictResolution: jsonb('conflict_resolution')
    .$type<{
      conflictType: 'timing' | 'equipment' | 'location' | 'client_attention';
      resolutionStatus: 'unresolved' | 'proposed' | 'accepted' | 'resolved';
      proposedSolution: string;
      resolvedBy: string;
      resolvedAt: string;
    }>()
    .default({
      conflictType: 'timing',
      resolutionStatus: 'unresolved',
      proposedSolution: '',
      resolvedBy: '',
      resolvedAt: '',
    }),

  // Norwegian-specific logistics
  norwegianLogistics: jsonb('norwegian_logistics')
    .$type<{
      weatherDependency: boolean;
      travelCoordination: {
        departure: string;
        arrival: string;
        transportMethod: 'car' | 'train' | 'ferry' | 'plane';
        meetingPoint: string;
      };
      accommodationNeeds: boolean;
      localSupplierCoordination: string[];
      culturalConsiderations: string[];
    }>()
    .default({
      weatherDependency: false,
      travelCoordination: {
        departure: '',
        arrival: '',
        transportMethod: 'car',
        meetingPoint: '',
      },
      accommodationNeeds: false,
      localSupplierCoordination: [],
      culturalConsiderations: [],
    }),

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Export new schemas
export const insertProfessionalCollaborationInvitesSchema = createInsertSchema(
  professionalCollaborationInvites,
);
export const insertCollaborativeTimelineEntriesSchema = createInsertSchema(
  collaborativeTimelineEntries,
);

// Export new types
export type ProfessionalCollaborationInvites = typeof professionalCollaborationInvites.$inferSelect;
export type InsertProfessionalCollaborationInvites =
  typeof professionalCollaborationInvites.$inferInsert;
export type CollaborativeTimelineEntries = typeof collaborativeTimelineEntries.$inferSelect;
export type InsertCollaborativeTimelineEntries = typeof collaborativeTimelineEntries.$inferInsert;
