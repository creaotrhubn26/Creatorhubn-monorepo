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
  InsertBusinessProfile,
  InsertUserFile,
  insertBusinessProfileSchema,
  insertUserFileSchema,
} from './business-profiles-schema';

export {
  customProfiles,
  magicCreatorFeatures,
  photoSessions,
  smartNotes,
} from './additional-features-schema';

export {
  InsertProduct,
  Product,
  insertProductSchema,
  products,
} from './admin-schema';

export {
  componentDefinitions,
  improvementTasks,
} from './advanced-system-features-schema';

export {
  prototypeFeedback,
} from './analytics-reporting-schema';

export {
  ChatConversation,
  ChatMessage,
  InsertChatConversation,
  InsertChatMessage,
  chatConversations,
  chatMessages,
  createConversationSchema,
  insertChatConversationSchema,
  insertChatMessageSchema,
  sendMessageSchema,
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
  CmsPage,
  InsertCmsPage,
  cmsPages,
  insertCmsPageSchema,
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
  CrmEmailTemplate,
  InsertCrmEmailTemplate,
  crmContacts,
  crmEmailTemplates,
  crmPipelineStages,
  insertCrmEmailTemplateSchema,
} from './crm-schema';

export {
  CustomerJourneyTemplate,
  InsertCustomerJourneyTemplate,
  customerJourneyTemplates,
  customerJourneyTemplatesRelations,
  insertCustomerJourneyTemplateSchema,
} from './customer-journey-schema';

export {
  CrmDeal,
  InsertCrmDeal,
  InsertUserRole,
  UserRole,
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

export {
  codeGenerationTemplates,
  deploymentHistory,
  deploymentMetrics,
  deploymentValidationRules,
  feedbackAnalysis,
  feedbackDeployments,
} from './feedback-deployment-schema';

export {
  InsertUserConsent,
  UserConsent,
  insertUserConsentSchema,
  userConsents,
} from './gdpr-schema';

export {
  GoogleWalletLoyaltyCard,
  GoogleWalletMembershipCard,
  GoogleWalletPass,
  GoogleWalletTicket,
  googleWalletLoyaltyCards,
  googleWalletMembershipCards,
  googleWalletPasses,
  googleWalletTickets,
} from './google-wallet-schema';

export {
  InsertMeetingNote,
  InsertMeetingWorkspace,
  MeetingNote,
  MeetingWorkspace,
  insertMeetingNoteSchema,
  insertMeetingWorkspaceSchema,
  meetingNotes,
  meetingWorkspaces,
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
  InsertOnboardingProfile,
  OnboardingProfile,
  insertOnboardingProfileSchema,
  onboardingProfiles,
} from './onboarding-schema';

export {
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
  InsertSubscriptionPlan,
  InsertUserSubscription,
  SubscriptionPlan,
  UserSubscription,
  insertSubscriptionPlanSchema,
  insertUserSubscriptionSchema,
  subscriptionPlans,
  userSubscriptions,
} from './price-management-schema';

export {
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

export {
  priceFeatures,
  priceFeaturesRelations,
  priceTiers,
} from './pricing-system-schema';

export {
  InsertProfessionConfiguration,
  ProfessionConfiguration,
  professionConfigurations,
} from './profession-cms-schema';

export {
  HourOverage,
  InsertHourOverage,
  hourOverages,
  hourOveragesRelations,
  insertHourOverageSchema,
} from './project-integration-schema';

export {
  Client,
  Contract,
  InsertClient,
  InsertContract,
  InsertPayment,
  InsertProject,
  Payment,
  Project,
  clients,
  contracts,
  insertClientSchema,
  insertContractSchema,
  insertPaymentSchema,
  insertProjectSchema,
  payments,
  projects,
} from './project-management-schema';

export {
  UserProvisioningRequest,
  UserProvisioningStatus,
  adminProvisioningActions,
  integrationStatus,
  provisioningMetrics,
  provisioningWorkflowSteps,
  provisioningWorkflows,
  userProvisioningRequests,
  userProvisioningStatus,
} from './provisioning-schema';

export {
  InsertSalesActivity,
  InsertSalesConversation,
  InsertSalesLead,
  SalesActivity,
  SalesConversation,
  SalesLead,
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

export {
  InsertSeoBacklink,
  InsertSeoKeyword,
  SeoBacklink,
  SeoKeyword,
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
