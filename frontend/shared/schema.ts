/**
 * CreatorHub Norge - Complete Schema Export
 * Centralized export of all database schemas
 */

// Core schemas
export * from './database-persistence-schema';
export * from './event-timeline-schema';

// Feature schemas (A-C)
export * from './achievement-schema';
export * from './business-profiles-schema';
export * from './additional-features-schema';
export * from './admin-schema';
export * from './advanced-protocols-schema';
export * from './advanced-system-features-schema';
export * from './analytics-reporting-schema';
export * from './analytics-schema';
export * from './api-integrations-schema';
export * from './booking-schema';
export * from './camera-database-schema';
export * from './chat-schema';
export * from './client-portal-schema';
export * from './cms-advanced-features-schema';
export * from './cms-history-schema';
export * from './cms-schema';
export * from './code-generator-schema';
export * from './communication-schema';
export * from './content-management-schema';
export * from './course-schema';
export * from './creatorhub-visual-editor-schema';
export * from './crm-schema';
export * from './customer-journey-schema';

// Feature schemas (D-G)
export * from './dam-schema';
export * from './deletion-audit-schema';
export * from './dashboard-schema';
export * from './enterprise-schema';
export * from './event-notification-schema';
export * from './family-tree-schema';
export * from './feedback-deployment-schema';
export * from './file-system-schema';
export * from './gamification-schema';
export * from './gdpr-schema';
export * from './google-chat-schema';
export * from './google-wallet-schema';

// Feature schemas (I-P)
export * from './integration-services-schema';
export * from './keyboard-shortcuts-schema';
export * from './learning-academy-schema';
export * from './meeting-schema';
export * from './memory-card-schema';
export * from './notification-schema';
export * from './onboarding-schema';
export * from './photographer-client-schema';
export * from './photography-tips-schema';
export * from './platform-status-schema';
export * from './plugin-management-schema';
export * from './plugin-schema';
export * from './portfolio-template-schema';
export * from './price-administration-schema';
export * from './price-management-schema';
export * from './pricing-schema';
export * from './pricing-system-schema';
export * from './production-schema';
export * from './profession-cms-schema';
export * from './project-integration-schema';
export * from './project-management-schema';
export * from './protools-schema';
export * from './provisioning-schema';

// Feature schemas (R-Z)
export * from './resume-schema';
export * from './sales-schema';
export * from './seo-schema';
export * from './seo-specialist-schema';
export * from './showcase-admin-schema';
export * from './smart-timing-schema';
export * from './story-arc-schema';
export * from './text-enhancement-schema';
export * from './theme-schema';
export * from './trial-management-schema';
export * from './tutorial-schema';
export * from './vendor-onboarding-schema';
export * from './vendor-showcase-schema';
export * from './video-schema';
export * from './video-standards-schema';
export * from './visual-cms-schema';
export * from './wedding-schema';
export * from './wedding-timeline-schema';

// Server-side schemas
export * from '@server/db/schema/feature-management-schema';
export * from '@server/db/schema/academy-monetization-schema';

// Export Zod schemas for validation
export { createInsertSchema } from 'drizzle-zod';
export { z } from 'zod';
