import {
  pgTable,
  text,
  varchar,
  timestamp,
  jsonb,
  serial,
  boolean,
  integer,
} from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';

// Educational Courses Table
export const educationalCourses = pgTable('educational_courses', {
  id: serial('id').primaryKey(),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description').notNull(),
  creatorId: varchar('creator_id').notNull(), // User who created the course
  targetAudience: varchar('target_audience').notNull(), // 'photographer' | 'videographer' | 'both'
  equipmentType: varchar('equipment_type').notNull(), // 'camera', 'lens', 'lighting', 'audio', etc.
  difficultyLevel: varchar('difficulty_level').notNull(), // 'beginner', 'intermediate', 'advanced'
  estimatedDuration: integer('estimated_duration').notNull(), // in minutes
  status: varchar('status').notNull().default('draft'), // 'draft', 'published', 'archived'
  curriculum: jsonb('curriculum').$type<CourseModule[]>().notNull(),
  prerequisites: text('prerequisites'),
  learningObjectives: jsonb('learning_objectives').$type<string[]>().notNull(),
  tags: jsonb('tags').$type<string[]>().default([]),
  thumbnailUrl: varchar('thumbnail_url'),
  previewVideoUrl: varchar('preview_video_url'),
  enrollmentCount: integer('enrollment_count').default(0),
  rating: integer('rating').default(0), // 1-5 stars
  reviewCount: integer('review_count').default(0),
  isPublic: boolean('is_public').default(false),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Course Modules/Lessons Table
export const courseModules = pgTable('course_modules', {
  id: serial('id').primaryKey(),
  courseId: integer('course_id').notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  orderIndex: integer('order_index').notNull(),
  moduleType: varchar('module_type').notNull(), // 'theory', 'practical', 'hands_on', 'quiz'
  content: jsonb('content').$type<ModuleContent>().notNull(),
  script: text('script'), // Generated teaching script
  estimatedDuration: integer('estimated_duration').notNull(), // in minutes
  videoUrl: varchar('video_url'),
  resourceFiles: jsonb('resource_files').$type<ResourceFile[]>().default([]),
  isRequired: boolean('is_required').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// User Course Progress Table
export const userCourseProgress = pgTable('user_course_progress', {
  id: serial('id').primaryKey(),
  userId: varchar('user_id').notNull(),
  courseId: integer('course_id').notNull(),
  moduleId: integer('module_id'),
  status: varchar('status').notNull().default('not_started'), // 'not_started', 'in_progress', 'completed'
  progressPercentage: integer('progress_percentage').default(0),
  timeSpent: integer('time_spent').default(0), // in minutes
  lastAccessedAt: timestamp('last_accessed_at'),
  completedAt: timestamp('completed_at'),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Course Reviews Table
export const courseReviews = pgTable('course_reviews', {
  id: serial('id').primaryKey(),
  courseId: integer('course_id').notNull(),
  userId: varchar('user_id').notNull(),
  rating: integer('rating').notNull(), // 1-5 stars
  review: text('review'),
  helpful: boolean('helpful').default(false),
  isPublic: boolean('is_public').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Course Templates for Equipment Types
export const courseTemplates = pgTable('course_templates', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  equipmentType: varchar('equipment_type').notNull(),
  targetAudience: varchar('target_audience').notNull(),
  template: jsonb('template').$type<CourseTemplate>().notNull(),
  isDefault: boolean('is_default').default(false),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Advanced Course Builder Components
export const courseBuilderComponents = pgTable('course_builder_components', {
  id: serial('id').primaryKey(),
  courseId: integer('course_id').notNull(),
  componentType: varchar('component_type').notNull(), // 'video', 'text', 'quiz', 'interactive', 'assignment'
  orderIndex: integer('order_index').notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  content: jsonb('content').$type<ComponentContent>().notNull(),
  settings: jsonb('settings').$type<ComponentSettings>().notNull(),
  isPublished: boolean('is_published').default(false),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Live Workshop Sessions
export const liveWorkshops = pgTable('live_workshops', {
  id: serial('id').primaryKey(),
  courseId: integer('course_id').notNull(),
  instructorId: varchar('instructor_id').notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  scheduledDate: timestamp('scheduled_date').notNull(),
  duration: integer('duration').notNull(), // in minutes
  maxParticipants: integer('max_participants').default(50),
  currentParticipants: integer('current_participants').default(0),
  workshopType: varchar('workshop_type').notNull(), // 'live_demo', 'q_and_a', 'hands_on', 'review'
  streamUrl: varchar('stream_url'),
  recordingUrl: varchar('recording_url'),
  status: varchar('status').notNull().default('scheduled'), // 'scheduled', 'live', 'completed', 'cancelled'
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Workshop Participants
export const workshopParticipants = pgTable('workshop_participants', {
  id: serial('id').primaryKey(),
  workshopId: integer('workshop_id').notNull(),
  userId: varchar('user_id').notNull(),
  registrationDate: timestamp('registration_date').defaultNow(),
  attendanceStatus: varchar('attendance_status').default('registered'), // 'registered', 'attended', 'missed'
  feedbackRating: integer('feedback_rating'), // 1-5 stars
  feedbackComment: text('feedback_comment'),
  certificateIssued: boolean('certificate_issued').default(false),
});

// Norwegian Industry Certifications
export const norwegianCertifications = pgTable('norwegian_certifications', {
  id: serial('id').primaryKey(),
  courseId: integer('course_id').notNull(),
  certificateName: varchar('certificate_name', { length: 255 }).notNull(),
  issuingOrganization: varchar('issuing_organization').notNull(),
  industryStandard: varchar('industry_standard').notNull(), // 'NFI', 'NKFS', 'Custom'
  validityPeriod: integer('validity_period'), // in months
  requirements: jsonb('requirements').$type<CertificationRequirements>().notNull(),
  templateUrl: varchar('template_url'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// User Certificates
export const userCertificates = pgTable('user_certificates', {
  id: serial('id').primaryKey(),
  userId: varchar('user_id').notNull(),
  certificationId: integer('certification_id').notNull(),
  courseId: integer('course_id').notNull(),
  issueDate: timestamp('issue_date').defaultNow(),
  expiryDate: timestamp('expiry_date'),
  certificateUrl: varchar('certificate_url'),
  verificationCode: varchar('verification_code').notNull(),
  isValid: boolean('is_valid').default(true),
  completionScore: integer('completion_score'), // percentage
  skillsAchieved: jsonb('skills_achieved').$type<string[]>().notNull(),
});

// Advanced Progress Analytics
export const progressAnalytics = pgTable('progress_analytics', {
  id: serial('id').primaryKey(),
  userId: varchar('user_id').notNull(),
  courseId: integer('course_id').notNull(),
  sessionId: varchar('session_id').notNull(),
  activityType: varchar('activity_type').notNull(), // 'video_watch', 'quiz_complete', 'assignment_submit'
  timeSpent: integer('time_spent').notNull(), // in seconds
  engagementScore: integer('engagement_score'), // 1-100
  completionRate: integer('completion_rate'), // percentage
  strugglingAreas: jsonb('struggling_areas').$type<string[]>().default([]),
  strengthAreas: jsonb('strength_areas').$type<string[]>().default([]),
  sessionDate: timestamp('session_date').defaultNow(),
  deviceType: varchar('device_type'), // 'desktop', 'mobile', 'tablet'
  learningPath: varchar('learning_path'), // 'linear', 'adaptive', 'custom'
});

// Type definitions for the JSON fields
export interface CourseModule {
  id: string;
  title: string;
  description: string;
  moduleType: 'theory' | 'practical' | 'hands_on' | 'quiz';
  estimatedDuration: number;
  content: ModuleContent;
  script?: string;
  orderIndex: number;
  isRequired: boolean;
}

export interface ModuleContent {
  sections: ContentSection[];
  practicalExercises?: PracticalExercise[];
  quizQuestions?: QuizQuestion[];
  resources?: ResourceFile[];
}

export interface ContentSection {
  id: string;
  title: string;
  content: string;
  type: 'text' | 'video' | 'image' | 'interactive';
  mediaUrl?: string;
  duration?: number;
}

export interface PracticalExercise {
  id: string;
  title: string;
  instructions: string;
  equipmentNeeded: string[];
  expectedOutcome: string;
  tips: string[];
}

export interface QuizQuestion {
  id: string;
  question: string;
  type: 'multiple_choice' | 'true_false' | 'short_answer';
  options?: string[];
  correctAnswer: string | string[];
  explanation: string;
}

export interface ResourceFile {
  id: string;
  name: string;
  type: 'pdf' | 'image' | 'video' | 'document';
  url: string;
  size: number;
  description?: string;
}

export interface CourseTemplate {
  id: string;
  name: string;
  description: string;
  modules: CourseModuleTemplate[];
  totalDuration: number;
  defaultObjectives: string[];
  defaultPrerequisites: string;
}

export interface CourseModuleTemplate {
  title: string;
  description: string;
  moduleType: 'theory' | 'practical' | 'hands_on' | 'quiz';
  estimatedDuration: number;
  contentOutline: string[];
  practicalElements: string[];
}

// Enhanced Course Builder Types
export interface ComponentContent {
  type: 'video' | 'text' | 'quiz' | 'interactive' | 'assignment';
  data: any;
  metadata?: {
    version: string;
    createdBy: string;
    lastModified: string;
  };
}

export interface ComponentSettings {
  visibility: 'public' | 'private' | 'members_only';
  autoPlay?: boolean;
  allowDownload?: boolean;
  timeLimit?: number;
  passingScore?: number;
  attempts?: number;
  prerequisites?: string[];
}

export interface CertificationRequirements {
  minScore: number;
  requiredModules: string[];
  practicalAssessment: boolean;
  timeLimit?: number;
  renewalRequired: boolean;
  industryStandards: string[];
}

export interface WorkshopSession {
  id: string;
  startTime: string;
  endTime: string;
  topic: string;
  instructor: string;
  participants: string[];
  recordingUrl?: string;
  materials: ResourceFile[];
}

// Zod schemas for validation
export const insertEducationalCourseSchema = createInsertSchema(educationalCourses);
export const insertCourseModuleSchema = createInsertSchema(courseModules);
export const insertUserCourseProgressSchema = createInsertSchema(userCourseProgress);
export const insertCourseReviewSchema = createInsertSchema(courseReviews);
export const insertCourseTemplateSchema = createInsertSchema(courseTemplates);
export const insertCourseBuilderComponentSchema = createInsertSchema(courseBuilderComponents);
export const insertLiveWorkshopSchema = createInsertSchema(liveWorkshops);
export const insertWorkshopParticipantSchema = createInsertSchema(workshopParticipants);
export const insertNorwegianCertificationSchema = createInsertSchema(norwegianCertifications);
export const insertUserCertificateSchema = createInsertSchema(userCertificates);
export const insertProgressAnalyticsSchema = createInsertSchema(progressAnalytics);

// Type exports
export type EducationalCourse = typeof educationalCourses.$inferSelect;
export type InsertEducationalCourse = z.infer<typeof insertEducationalCourseSchema>;
export type CourseModuleType = typeof courseModules.$inferSelect;
export type InsertCourseModule = z.infer<typeof insertCourseModuleSchema>;
export type UserCourseProgress = typeof userCourseProgress.$inferSelect;
export type InsertUserCourseProgress = z.infer<typeof insertUserCourseProgressSchema>;
export type CourseReview = typeof courseReviews.$inferSelect;
export type InsertCourseReview = z.infer<typeof insertCourseReviewSchema>;
export type CourseTemplateType = typeof courseTemplates.$inferSelect;
export type InsertCourseTemplate = z.infer<typeof insertCourseTemplateSchema>;
export type CourseBuilderComponent = typeof courseBuilderComponents.$inferSelect;
export type InsertCourseBuilderComponent = z.infer<typeof insertCourseBuilderComponentSchema>;
export type LiveWorkshop = typeof liveWorkshops.$inferSelect;
export type InsertLiveWorkshop = z.infer<typeof insertLiveWorkshopSchema>;
export type WorkshopParticipant = typeof workshopParticipants.$inferSelect;
export type InsertWorkshopParticipant = z.infer<typeof insertWorkshopParticipantSchema>;
export type NorwegianCertification = typeof norwegianCertifications.$inferSelect;
export type InsertNorwegianCertification = z.infer<typeof insertNorwegianCertificationSchema>;
export type UserCertificate = typeof userCertificates.$inferSelect;
export type InsertUserCertificate = z.infer<typeof insertUserCertificateSchema>;
export type ProgressAnalytics = typeof progressAnalytics.$inferSelect;
export type InsertProgressAnalytics = z.infer<typeof insertProgressAnalyticsSchema>;
