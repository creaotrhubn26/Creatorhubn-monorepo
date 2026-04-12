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
export * from './smart-timing-schema';
export * from './theme-schema';
export * from './tutorial-schema';
export * from './wedding-schema';
export * from './wedding-timeline-schema';

// Export Zod schemas for validation
export { createInsertSchema } from 'drizzle-zod';
export { z } from 'zod';

// Resolve overlapping star-exports by choosing one canonical public export per symbol.
export {
  insertBusinessProfileSchema,
  insertUserFileSchema,
} from './business-profiles-schema';
export type {
  InsertBusinessProfile,
  InsertUserFile,
} from './business-profiles-schema';

export {
  customProfiles,
  magicCreatorFeatures,
  photoSessions,
  smartNotes,
} from './additional-features-schema';

export {
  insertProductSchema,
  products,
} from './admin-schema';
export type {
  InsertProduct,
  Product,
} from './admin-schema';

export {
  componentDefinitions,
  improvementTasks,
} from './advanced-system-features-schema';

export {
  prototypeFeedback,
} from './analytics-reporting-schema';

export {
  chatConversations,
  chatMessages,
  createConversationSchema,
  insertChatConversationSchema,
  insertChatMessageSchema,
  sendMessageSchema,
} from './chat-schema';
export type {
  ChatConversation,
  ChatMessage,
  InsertChatConversation,
  InsertChatMessage,
} from './chat-schema';

export {
  cmsAssets,
  cmsThemes,
  designTokens,
  pageTemplates,
  pageVersions,
  workflowStates,
} from './cms-advanced-features-schema';

export {
  cmsChangeTracking,
  cmsCollaborationSessions,
  cmsComponentLibrary,
  cmsRollbackPoints,
  cmsVersionHistory,
} from './cms-history-schema';

export {
  cmsPages,
  insertCmsPageSchema,
} from './cms-schema';
export type {
  CmsPage,
  InsertCmsPage,
} from './cms-schema';

export {
  automatedTestSuites,
  automatedTestSuitesRelations,
  codeAnalysisResults,
  codeTemplates,
  generatedCodeHistory,
  generatedCodeHistoryRelations,
  liveTestResults,
  liveTestResultsRelations,
  templateAnalytics,
} from './code-generator-schema';

export {
  communicationChannels,
  communicationIntegrations,
  communicationMessages,
  communicationParticipants,
  communicationTemplates,
  messageAttachments,
  messageReactions,
} from './communication-schema';

export {
  clientsRelations,
} from './creatorhub-visual-editor-schema';

export {
  crmContacts,
  crmEmailTemplates,
  crmPipelineStages,
  insertCrmEmailTemplateSchema,
} from './crm-schema';
export type {
  CrmEmailTemplate,
  InsertCrmEmailTemplate,
} from './crm-schema';

export {
  customerJourneyTemplates,
  customerJourneyTemplatesRelations,
  insertCustomerJourneyTemplateSchema,
} from './customer-journey-schema';
export type {
  CustomerJourneyTemplate,
  InsertCustomerJourneyTemplate,
} from './customer-journey-schema';

export {
  crmDeals,
  crmDealsRelations,
  insertCrmDealSchema,
  insertInvoiceSchema,
  insertUserRoleSchema,
  invoices,
  userRoles,
  userRolesRelations,
  userSubscriptionsRelations,
} from './enterprise-schema';
export type {
  CrmDeal,
  InsertCrmDeal,
  InsertUserRole,
  UserRole,
} from './enterprise-schema';

export {
  codeGenerationTemplates,
  deploymentHistory,
  deploymentMetrics,
  deploymentValidationRules,
  feedbackAnalysis,
  feedbackDeployments,
} from './feedback-deployment-schema';

export {
  insertUserConsentSchema,
  userConsents,
} from './gdpr-schema';
export type {
  InsertUserConsent,
  UserConsent,
} from './gdpr-schema';

export {
  googleWalletLoyaltyCards,
  googleWalletMembershipCards,
  googleWalletPasses,
  googleWalletTickets,
} from './google-wallet-schema';
export type {
  GoogleWalletLoyaltyCard,
  GoogleWalletMembershipCard,
  GoogleWalletPass,
  GoogleWalletTicket,
} from './google-wallet-schema';

export {
  insertMeetingNoteSchema,
  insertMeetingWorkspaceSchema,
  meetingNotes,
  meetingWorkspaces,
} from './meeting-schema';
export type {
  InsertMeetingNote,
  InsertMeetingWorkspace,
  MeetingNote,
  MeetingWorkspace,
} from './meeting-schema';

export {
  backupLogs,
  backupTips,
  memoryCardSessions,
  memoryCards,
} from './memory-card-schema';

export {
  notificationDeliveryLog,
  notificationPreferences,
  notificationTemplates,
} from './notification-schema';

export {
  insertOnboardingProfileSchema,
  onboardingProfiles,
} from './onboarding-schema';
export type {
  InsertOnboardingProfile,
  OnboardingProfile,
} from './onboarding-schema';

export {
  clientGalleryImages,
  clientImageComments,
  clientImagePayments,
  clientImageSelections,
  insertClientGalleryImageSchema,
  insertClientImageCommentSchema,
  insertClientImagePaymentSchema,
  insertClientImageSelectionSchema,
  insertPhotographerClientGallerySchema,
  photographerClientGalleries,
} from './photographer-client-schema';
export type {
  ClientGalleryImage,
  ClientImageComment,
  ClientImagePayment,
  ClientImageSelection,
  InsertClientGalleryImage,
  InsertClientImageComment,
  InsertClientImagePayment,
  InsertClientImageSelection,
  InsertPhotographerClientGallery,
  PhotographerClientGallery,
} from './photographer-client-schema';

export {
  musicProducerPlugins,
  pluginLicenses,
  pluginNotifications,
  pluginUpdates,
  pluginVendorAccounts,
} from './plugin-schema';

export {
  googleIntegrationSettings,
  ocrReceipts,
  packages,
  pricingStructures,
  pricingStructuresRelations,
  travelLog,
  travelLogRelations,
} from './price-administration-schema';

export {
  insertSubscriptionPlanSchema,
  insertUserSubscriptionSchema,
  subscriptionPlans,
  userSubscriptions,
} from './price-management-schema';
export type {
  InsertSubscriptionPlan,
  InsertUserSubscription,
  SubscriptionPlan,
  UserSubscription,
} from './price-management-schema';

export {
  additionalCosts,
  customPackages,
  discounts,
  insertAdditionalCostSchema,
  insertCustomPackageSchema,
  insertDiscountSchema,
  insertPricingStructureSchema,
  insertQuoteSchema,
  insertStandardPackageSchema,
  pricingStructure,
  quotes,
  standardPackages,
} from './pricing-schema';
export type {
  AdditionalCost,
  CustomPackage,
  Discount,
  InsertAdditionalCost,
  InsertCustomPackage,
  InsertDiscount,
  InsertPricingStructure,
  InsertQuote,
  InsertStandardPackage,
  PricingStructure,
  Quote,
  StandardPackage,
} from './pricing-schema';

export {
  priceFeatures,
  priceFeaturesRelations,
  priceTiers,
} from './pricing-system-schema';

export {
  professionConfigurations,
} from './profession-cms-schema';
export type {
  InsertProfessionConfiguration,
  ProfessionConfiguration,
} from './profession-cms-schema';

export {
  hourOverages,
  hourOveragesRelations,
  insertHourOverageSchema,
} from './project-integration-schema';
export type {
  HourOverage,
  InsertHourOverage,
} from './project-integration-schema';

export {
  clients,
  contracts,
  insertClientSchema,
  insertContractSchema,
  insertPaymentSchema,
  insertProjectSchema,
  payments,
  projects,
} from './project-management-schema';
export type {
  Client,
  Contract,
  InsertClient,
  InsertContract,
  InsertPayment,
  InsertProject,
  Payment,
  Project,
} from './project-management-schema';

export {
  adminProvisioningActions,
  integrationStatus,
  provisioningMetrics,
  provisioningWorkflowSteps,
  provisioningWorkflows,
  userProvisioningRequests,
  userProvisioningStatus,
} from './provisioning-schema';
export type {
  UserProvisioningRequest,
  UserProvisioningStatus,
} from './provisioning-schema';

export {
  insertSalesActivitySchema,
  insertSalesConversationSchema,
  insertSalesLeadSchema,
  salesActivities,
  salesAnalytics,
  salesAnalyticsRelations,
  salesConversations,
  salesConversationsRelations,
  salesLeads,
  salesLeadsRelations,
} from './sales-schema';
export type {
  InsertSalesActivity,
  InsertSalesConversation,
  InsertSalesLead,
  SalesActivity,
  SalesConversation,
  SalesLead,
} from './sales-schema';

export {
  googleAnalyticsIntegration,
  insertSeoBacklinkSchema,
  insertSeoKeywordSchema,
  seoAlerts,
  seoAnalyticsData,
  seoBacklinks,
  seoContentAnalysis,
  seoLocalBusiness,
  seoProjects,
} from './seo-schema';
export type {
  InsertSeoBacklink,
  InsertSeoKeyword,
  SeoBacklink,
  SeoKeyword,
} from './seo-schema';

export {
  seoCampaigns,
  seoCampaignsRelations,
  seoKeywords,
  seoKeywordsRelations,
  seoRankings,
} from './seo-specialist-schema';

export {
  insertWeddingTimelineSchema,
} from './wedding-schema';
