import { relations } from 'drizzle-orm/relations';
import {
  contracts,
  customerSignatures,
  meetingWorkspaces,
  meetingParticipants,
  meetingNotes,
  meetingAttachments,
  clientSubmissions,
  projectShowcases,
  projectTimelines,
  showcaseItems,
  showcaseInteractions,
  signRequests,
  submissionFollowUps,
  memoryCardSessions,
  backupLogs,
  communicationChannels,
  communicationMessages,
  messageReactions,
  integratedProjects,
  projectContracts,
  projectTimeTracking,
  messageAttachments,
  products,
  productFirmware,
  productImages,
  productPrices,
  productTags,
  tags,
  showcaseAnalytics,
  googleChatSpaces,
  googleChatInvitations,
  emailProjectAssociations,
  meetingActivities,
  showcaseComments,
  projects,
  clientGalleries,
  users,
  equipmentBrands,
  equipmentModels,
  hourOverages,
  salesLeads,
  salesConversations,
  productCompatibility,
  googleChatNotifications,
  googleChatSpaceMembers,
  editingSoftware,
  keyboardShortcuts,
  salesVoiceNotes,
  salesActivities,
  codeTemplates,
  generatedCodeHistory,
  automatedTestSuites,
  templateAnalytics,
  advancedEmailTemplates,
  cmsPages,
  pageVersions,
  pageDrafts,
  autoMonitorConfigs,
  processedFiles,
  storyArcProjects,
  userShortcutPreferences,
  tasks,
  customRoles,
  userRoles,
  automationRules,
  audioProjects,
  audioEnhancements,
  cmsHistory,
  contractTemplates,
  generatedContracts,
  projectPresets,
  presetSuggestions,
  presetUsageHistory,
  printOrders,
  systemFeatures,
  roleFeatures,
  roleHierarchy,
  vendors,
  subcontractorProjects,
  timeEntries,
  userPermissionOverrides,
  userSubscriptions,
  serviceActivations,
  trialNotifications,
  trialUsageTracking,
  clientGallerySessions,
  clientSelections,
  sessionNotifications,
  customerJourneyTemplates,
  journeySteps,
  aiContentGenerations,
  journeyAnalytics,
  sessionActivityLog,
  draftVersions,
  workflowStates,
  apiIntegrationProcesses,
  apiIntegrationLogs,
  projectDraftAutosave,
  projectDraftVersions,
  smartAlbums,
  smartAlbumItems,
  userProvisioningRequests,
  provisioningWorkflows,
  provisioningWorkflowSteps,
  userProvisioningStatus,
  adminProvisioningActions,
  platformSettings,
} from './schema';

export const customerSignaturesRelations = relations(customerSignatures, ({ one }) => ({
  contract: one(contracts, {
    fields: [customerSignatures.contractId],
    references: [contracts.id],
  }),
}));

export const contractsRelations = relations(contracts, ({ many }) => ({
  customerSignatures: many(customerSignatures),
  signRequests: many(signRequests),
}));

export const meetingParticipantsRelations = relations(meetingParticipants, ({ one }) => ({
  meetingWorkspace: one(meetingWorkspaces, {
    fields: [meetingParticipants.workspaceId],
    references: [meetingWorkspaces.id],
  }),
}));

export const meetingWorkspacesRelations = relations(meetingWorkspaces, ({ many }) => ({
  meetingParticipants: many(meetingParticipants),
  meetingActivities: many(meetingActivities),
}));

export const meetingAttachmentsRelations = relations(meetingAttachments, ({ one }) => ({
  meetingNote: one(meetingNotes, {
    fields: [meetingAttachments.meetingNotesId],
    references: [meetingNotes.id],
  }),
}));

export const meetingNotesRelations = relations(meetingNotes, ({ many }) => ({
  meetingAttachments: many(meetingAttachments),
}));

export const projectShowcasesRelations = relations(projectShowcases, ({ one }) => ({
  clientSubmission: one(clientSubmissions, {
    fields: [projectShowcases.projectId],
    references: [clientSubmissions.id],
  }),
}));

export const clientSubmissionsRelations = relations(clientSubmissions, ({ many }) => ({
  projectShowcases: many(projectShowcases),
  projectTimelines: many(projectTimelines),
  submissionFollowUps: many(submissionFollowUps),
  emailProjectAssociations: many(emailProjectAssociations),
}));

export const projectTimelinesRelations = relations(projectTimelines, ({ one }) => ({
  clientSubmission: one(clientSubmissions, {
    fields: [projectTimelines.projectId],
    references: [clientSubmissions.id],
  }),
}));

export const showcaseInteractionsRelations = relations(showcaseInteractions, ({ one }) => ({
  showcaseItem: one(showcaseItems, {
    fields: [showcaseInteractions.showcaseItemId],
    references: [showcaseItems.id],
  }),
}));

export const showcaseItemsRelations = relations(showcaseItems, ({ many }) => ({
  showcaseInteractions: many(showcaseInteractions),
  showcaseAnalytics: many(showcaseAnalytics),
  showcaseComments: many(showcaseComments),
  clientSelections: many(clientSelections),
  smartAlbumItems: many(smartAlbumItems),
}));

export const signRequestsRelations = relations(signRequests, ({ one }) => ({
  contract: one(contracts, {
    fields: [signRequests.contractId],
    references: [contracts.id],
  }),
}));

export const submissionFollowUpsRelations = relations(submissionFollowUps, ({ one }) => ({
  clientSubmission: one(clientSubmissions, {
    fields: [submissionFollowUps.submissionId],
    references: [clientSubmissions.id],
  }),
}));

export const backupLogsRelations = relations(backupLogs, ({ one }) => ({
  memoryCardSession: one(memoryCardSessions, {
    fields: [backupLogs.sessionId],
    references: [memoryCardSessions.id],
  }),
}));

export const memoryCardSessionsRelations = relations(memoryCardSessions, ({ many }) => ({
  backupLogs: many(backupLogs),
}));

export const communicationMessagesRelations = relations(communicationMessages, ({ one, many }) => ({
  communicationChannel: one(communicationChannels, {
    fields: [communicationMessages.channelId],
    references: [communicationChannels.id],
  }),
  messageReactions: many(messageReactions),
  messageAttachments: many(messageAttachments),
}));

export const communicationChannelsRelations = relations(communicationChannels, ({ many }) => ({
  communicationMessages: many(communicationMessages),
}));

export const messageReactionsRelations = relations(messageReactions, ({ one }) => ({
  communicationMessage: one(communicationMessages, {
    fields: [messageReactions.messageId],
    references: [communicationMessages.id],
  }),
}));

export const projectContractsRelations = relations(projectContracts, ({ one, many }) => ({
  integratedProject: one(integratedProjects, {
    fields: [projectContracts.projectId],
    references: [integratedProjects.id],
  }),
  hourOverages: many(hourOverages),
}));

export const integratedProjectsRelations = relations(integratedProjects, ({ many }) => ({
  projectContracts: many(projectContracts),
  projectTimeTrackings: many(projectTimeTracking),
  hourOverages: many(hourOverages),
}));

export const projectTimeTrackingRelations = relations(projectTimeTracking, ({ one }) => ({
  integratedProject: one(integratedProjects, {
    fields: [projectTimeTracking.projectId],
    references: [integratedProjects.id],
  }),
}));

export const messageAttachmentsRelations = relations(messageAttachments, ({ one }) => ({
  communicationMessage: one(communicationMessages, {
    fields: [messageAttachments.messageId],
    references: [communicationMessages.id],
  }),
}));

export const productFirmwareRelations = relations(productFirmware, ({ one }) => ({
  product: one(products, {
    fields: [productFirmware.productId],
    references: [products.id],
  }),
}));

export const productsRelations = relations(products, ({ many }) => ({
  productFirmwares: many(productFirmware),
  productImages: many(productImages),
  productPrices: many(productPrices),
  productTags: many(productTags),
  productCompatibilities_compatibleWithProductId: many(productCompatibility, {
    relationName: 'productCompatibility_compatibleWithProductId_products_id',
  }),
  productCompatibilities_productId: many(productCompatibility, {
    relationName: 'productCompatibility_productId_products_id',
  }),
}));

export const productImagesRelations = relations(productImages, ({ one }) => ({
  product: one(products, {
    fields: [productImages.productId],
    references: [products.id],
  }),
}));

export const productPricesRelations = relations(productPrices, ({ one }) => ({
  product: one(products, {
    fields: [productPrices.productId],
    references: [products.id],
  }),
}));

export const productTagsRelations = relations(productTags, ({ one }) => ({
  product: one(products, {
    fields: [productTags.productId],
    references: [products.id],
  }),
  tag: one(tags, {
    fields: [productTags.tagId],
    references: [tags.id],
  }),
}));

export const tagsRelations = relations(tags, ({ many }) => ({
  productTags: many(productTags),
}));

export const showcaseAnalyticsRelations = relations(showcaseAnalytics, ({ one }) => ({
  showcaseItem: one(showcaseItems, {
    fields: [showcaseAnalytics.showcaseItemId],
    references: [showcaseItems.id],
  }),
}));

export const googleChatInvitationsRelations = relations(googleChatInvitations, ({ one }) => ({
  googleChatSpace: one(googleChatSpaces, {
    fields: [googleChatInvitations.spaceId],
    references: [googleChatSpaces.id],
  }),
}));

export const googleChatSpacesRelations = relations(googleChatSpaces, ({ many }) => ({
  googleChatInvitations: many(googleChatInvitations),
  googleChatNotifications: many(googleChatNotifications),
  googleChatSpaceMembers: many(googleChatSpaceMembers),
}));

export const emailProjectAssociationsRelations = relations(emailProjectAssociations, ({ one }) => ({
  clientSubmission: one(clientSubmissions, {
    fields: [emailProjectAssociations.projectId],
    references: [clientSubmissions.id],
  }),
}));

export const meetingActivitiesRelations = relations(meetingActivities, ({ one }) => ({
  meetingWorkspace: one(meetingWorkspaces, {
    fields: [meetingActivities.workspaceId],
    references: [meetingWorkspaces.id],
  }),
}));

export const showcaseCommentsRelations = relations(showcaseComments, ({ one, many }) => ({
  showcaseComment: one(showcaseComments, {
    fields: [showcaseComments.parentCommentId],
    references: [showcaseComments.id],
    relationName: 'showcaseComments_parentCommentId_showcaseComments_id',
  }),
  showcaseComments: many(showcaseComments, {
    relationName: 'showcaseComments_parentCommentId_showcaseComments_id',
  }),
  showcaseItem: one(showcaseItems, {
    fields: [showcaseComments.showcaseItemId],
    references: [showcaseItems.id],
  }),
}));

export const clientGalleriesRelations = relations(clientGalleries, ({ one, many }) => ({
  project: one(projects, {
    fields: [clientGalleries.projectId],
    references: [projects.id],
  }),
  user: one(users, {
    fields: [clientGalleries.userId],
    references: [users.id],
  }),
  printOrders: many(printOrders),
}));

export const projectsRelations = relations(projects, ({ many }) => ({
  clientGalleries: many(clientGalleries),
}));

export const usersRelations = relations(users, ({ many }) => ({
  clientGalleries: many(clientGalleries),
  advancedEmailTemplates: many(advancedEmailTemplates),
  tasks: many(tasks),
  automationRules: many(automationRules),
  userProvisioningRequests_reviewedBy: many(userProvisioningRequests, {
    relationName: 'userProvisioningRequests_reviewedBy_users_id',
  }),
  userProvisioningRequests_userId: many(userProvisioningRequests, {
    relationName: 'userProvisioningRequests_userId_users_id',
  }),
  cmsPages: many(cmsPages),
  userProvisioningStatuses: many(userProvisioningStatus),
  adminProvisioningActions_adminUserId: many(adminProvisioningActions, {
    relationName: 'adminProvisioningActions_adminUserId_users_id',
  }),
  adminProvisioningActions_targetUserId: many(adminProvisioningActions, {
    relationName: 'adminProvisioningActions_targetUserId_users_id',
  }),
  platformSettings: many(platformSettings),
}));

export const equipmentModelsRelations = relations(equipmentModels, ({ one }) => ({
  equipmentBrand: one(equipmentBrands, {
    fields: [equipmentModels.brandId],
    references: [equipmentBrands.id],
  }),
}));

export const equipmentBrandsRelations = relations(equipmentBrands, ({ many }) => ({
  equipmentModels: many(equipmentModels),
}));

export const hourOveragesRelations = relations(hourOverages, ({ one }) => ({
  projectContract: one(projectContracts, {
    fields: [hourOverages.contractId],
    references: [projectContracts.id],
  }),
  integratedProject: one(integratedProjects, {
    fields: [hourOverages.projectId],
    references: [integratedProjects.id],
  }),
}));

export const salesConversationsRelations = relations(salesConversations, ({ one }) => ({
  salesLead: one(salesLeads, {
    fields: [salesConversations.leadId],
    references: [salesLeads.id],
  }),
}));

export const salesLeadsRelations = relations(salesLeads, ({ many }) => ({
  salesConversations: many(salesConversations),
  salesVoiceNotes: many(salesVoiceNotes),
  salesActivities: many(salesActivities),
}));

export const productCompatibilityRelations = relations(productCompatibility, ({ one }) => ({
  product_compatibleWithProductId: one(products, {
    fields: [productCompatibility.compatibleWithProductId],
    references: [products.id],
    relationName: 'productCompatibility_compatibleWithProductId_products_id',
  }),
  product_productId: one(products, {
    fields: [productCompatibility.productId],
    references: [products.id],
    relationName: 'productCompatibility_productId_products_id',
  }),
}));

export const googleChatNotificationsRelations = relations(googleChatNotifications, ({ one }) => ({
  googleChatSpace: one(googleChatSpaces, {
    fields: [googleChatNotifications.spaceId],
    references: [googleChatSpaces.id],
  }),
}));

export const googleChatSpaceMembersRelations = relations(googleChatSpaceMembers, ({ one }) => ({
  googleChatSpace: one(googleChatSpaces, {
    fields: [googleChatSpaceMembers.spaceId],
    references: [googleChatSpaces.id],
  }),
}));

export const keyboardShortcutsRelations = relations(keyboardShortcuts, ({ one }) => ({
  editingSoftware: one(editingSoftware, {
    fields: [keyboardShortcuts.softwareId],
    references: [editingSoftware.id],
  }),
}));

export const editingSoftwareRelations = relations(editingSoftware, ({ many }) => ({
  keyboardShortcuts: many(keyboardShortcuts),
  userShortcutPreferences: many(userShortcutPreferences),
}));

export const salesVoiceNotesRelations = relations(salesVoiceNotes, ({ one }) => ({
  salesLead: one(salesLeads, {
    fields: [salesVoiceNotes.leadId],
    references: [salesLeads.id],
  }),
}));

export const salesActivitiesRelations = relations(salesActivities, ({ one }) => ({
  salesLead: one(salesLeads, {
    fields: [salesActivities.leadId],
    references: [salesLeads.id],
  }),
}));

export const generatedCodeHistoryRelations = relations(generatedCodeHistory, ({ one }) => ({
  codeTemplate: one(codeTemplates, {
    fields: [generatedCodeHistory.templateId],
    references: [codeTemplates.id],
  }),
}));

export const codeTemplatesRelations = relations(codeTemplates, ({ many }) => ({
  generatedCodeHistories: many(generatedCodeHistory),
  automatedTestSuites: many(automatedTestSuites),
  templateAnalytics: many(templateAnalytics),
}));

export const automatedTestSuitesRelations = relations(automatedTestSuites, ({ one }) => ({
  codeTemplate: one(codeTemplates, {
    fields: [automatedTestSuites.templateId],
    references: [codeTemplates.id],
  }),
}));

export const templateAnalyticsRelations = relations(templateAnalytics, ({ one }) => ({
  codeTemplate: one(codeTemplates, {
    fields: [templateAnalytics.templateId],
    references: [codeTemplates.id],
  }),
}));

export const advancedEmailTemplatesRelations = relations(advancedEmailTemplates, ({ one }) => ({
  user: one(users, {
    fields: [advancedEmailTemplates.userId],
    references: [users.id],
  }),
}));

export const pageVersionsRelations = relations(pageVersions, ({ one }) => ({
  cmsPage: one(cmsPages, {
    fields: [pageVersions.pageId],
    references: [cmsPages.id],
  }),
}));

export const cmsPagesRelations = relations(cmsPages, ({ one, many }) => ({
  pageVersions: many(pageVersions),
  pageDrafts: many(pageDrafts),
  cmsHistories: many(cmsHistory),
  workflowStates: many(workflowStates),
  user: one(users, {
    fields: [cmsPages.userId],
    references: [users.id],
  }),
}));

export const pageDraftsRelations = relations(pageDrafts, ({ one, many }) => ({
  cmsPage: one(cmsPages, {
    fields: [pageDrafts.pageId],
    references: [cmsPages.id],
  }),
  draftVersions: many(draftVersions),
}));

export const processedFilesRelations = relations(processedFiles, ({ one }) => ({
  autoMonitorConfig: one(autoMonitorConfigs, {
    fields: [processedFiles.configId],
    references: [autoMonitorConfigs.id],
  }),
  storyArcProject: one(storyArcProjects, {
    fields: [processedFiles.storyArcProjectId],
    references: [storyArcProjects.id],
  }),
}));

export const autoMonitorConfigsRelations = relations(autoMonitorConfigs, ({ many }) => ({
  processedFiles: many(processedFiles),
}));

export const storyArcProjectsRelations = relations(storyArcProjects, ({ many }) => ({
  processedFiles: many(processedFiles),
}));

export const userShortcutPreferencesRelations = relations(userShortcutPreferences, ({ one }) => ({
  editingSoftware: one(editingSoftware, {
    fields: [userShortcutPreferences.softwareId],
    references: [editingSoftware.id],
  }),
}));

export const tasksRelations = relations(tasks, ({ one, many }) => ({
  task: one(tasks, {
    fields: [tasks.parentTaskId],
    references: [tasks.id],
    relationName: 'tasks_parentTaskId_tasks_id',
  }),
  tasks: many(tasks, {
    relationName: 'tasks_parentTaskId_tasks_id',
  }),
  user: one(users, {
    fields: [tasks.userId],
    references: [users.id],
  }),
  timeEntries: many(timeEntries),
}));

export const userRolesRelations = relations(userRoles, ({ one }) => ({
  customRole: one(customRoles, {
    fields: [userRoles.roleId],
    references: [customRoles.id],
  }),
}));

export const customRolesRelations = relations(customRoles, ({ many }) => ({
  userRoles: many(userRoles),
  roleFeatures: many(roleFeatures),
  roleHierarchies_childRoleId: many(roleHierarchy, {
    relationName: 'roleHierarchy_childRoleId_customRoles_id',
  }),
  roleHierarchies_parentRoleId: many(roleHierarchy, {
    relationName: 'roleHierarchy_parentRoleId_customRoles_id',
  }),
}));

export const automationRulesRelations = relations(automationRules, ({ one }) => ({
  user: one(users, {
    fields: [automationRules.userId],
    references: [users.id],
  }),
}));

export const audioEnhancementsRelations = relations(audioEnhancements, ({ one }) => ({
  audioProject: one(audioProjects, {
    fields: [audioEnhancements.audioProjectId],
    references: [audioProjects.id],
  }),
}));

export const audioProjectsRelations = relations(audioProjects, ({ many }) => ({
  audioEnhancements: many(audioEnhancements),
}));

export const cmsHistoryRelations = relations(cmsHistory, ({ one }) => ({
  cmsPage: one(cmsPages, {
    fields: [cmsHistory.pageId],
    references: [cmsPages.id],
  }),
}));

export const generatedContractsRelations = relations(generatedContracts, ({ one }) => ({
  contractTemplate: one(contractTemplates, {
    fields: [generatedContracts.templateId],
    references: [contractTemplates.id],
  }),
}));

export const contractTemplatesRelations = relations(contractTemplates, ({ many }) => ({
  generatedContracts: many(generatedContracts),
}));

export const presetSuggestionsRelations = relations(presetSuggestions, ({ one }) => ({
  projectPreset: one(projectPresets, {
    fields: [presetSuggestions.suggestedPresetId],
    references: [projectPresets.id],
  }),
}));

export const projectPresetsRelations = relations(projectPresets, ({ many }) => ({
  presetSuggestions: many(presetSuggestions),
  presetUsageHistories: many(presetUsageHistory),
}));

export const presetUsageHistoryRelations = relations(presetUsageHistory, ({ one }) => ({
  projectPreset: one(projectPresets, {
    fields: [presetUsageHistory.presetId],
    references: [projectPresets.id],
  }),
}));

export const printOrdersRelations = relations(printOrders, ({ one }) => ({
  clientGallery: one(clientGalleries, {
    fields: [printOrders.galleryId],
    references: [clientGalleries.id],
  }),
}));

export const roleFeaturesRelations = relations(roleFeatures, ({ one }) => ({
  systemFeature: one(systemFeatures, {
    fields: [roleFeatures.featureId],
    references: [systemFeatures.id],
  }),
  customRole: one(customRoles, {
    fields: [roleFeatures.roleId],
    references: [customRoles.id],
  }),
}));

export const systemFeaturesRelations = relations(systemFeatures, ({ many }) => ({
  roleFeatures: many(roleFeatures),
  userPermissionOverrides: many(userPermissionOverrides),
}));

export const roleHierarchyRelations = relations(roleHierarchy, ({ one }) => ({
  customRole_childRoleId: one(customRoles, {
    fields: [roleHierarchy.childRoleId],
    references: [customRoles.id],
    relationName: 'roleHierarchy_childRoleId_customRoles_id',
  }),
  customRole_parentRoleId: one(customRoles, {
    fields: [roleHierarchy.parentRoleId],
    references: [customRoles.id],
    relationName: 'roleHierarchy_parentRoleId_customRoles_id',
  }),
}));

export const subcontractorProjectsRelations = relations(subcontractorProjects, ({ one }) => ({
  vendor: one(vendors, {
    fields: [subcontractorProjects.vendorId],
    references: [vendors.id],
  }),
}));

export const vendorsRelations = relations(vendors, ({ many }) => ({
  subcontractorProjects: many(subcontractorProjects),
}));

export const timeEntriesRelations = relations(timeEntries, ({ one }) => ({
  task: one(tasks, {
    fields: [timeEntries.taskId],
    references: [tasks.id],
  }),
}));

export const userPermissionOverridesRelations = relations(userPermissionOverrides, ({ one }) => ({
  systemFeature: one(systemFeatures, {
    fields: [userPermissionOverrides.featureId],
    references: [systemFeatures.id],
  }),
}));

export const serviceActivationsRelations = relations(serviceActivations, ({ one }) => ({
  userSubscription: one(userSubscriptions, {
    fields: [serviceActivations.subscriptionId],
    references: [userSubscriptions.id],
  }),
}));

export const userSubscriptionsRelations = relations(userSubscriptions, ({ many }) => ({
  serviceActivations: many(serviceActivations),
  trialNotifications: many(trialNotifications),
  trialUsageTrackings: many(trialUsageTracking),
}));

export const trialNotificationsRelations = relations(trialNotifications, ({ one }) => ({
  userSubscription: one(userSubscriptions, {
    fields: [trialNotifications.subscriptionId],
    references: [userSubscriptions.id],
  }),
}));

export const trialUsageTrackingRelations = relations(trialUsageTracking, ({ one }) => ({
  userSubscription: one(userSubscriptions, {
    fields: [trialUsageTracking.subscriptionId],
    references: [userSubscriptions.id],
  }),
}));

export const clientSelectionsRelations = relations(clientSelections, ({ one }) => ({
  clientGallerySession: one(clientGallerySessions, {
    fields: [clientSelections.sessionId],
    references: [clientGallerySessions.id],
  }),
  showcaseItem: one(showcaseItems, {
    fields: [clientSelections.showcaseItemId],
    references: [showcaseItems.id],
  }),
}));

export const clientGallerySessionsRelations = relations(clientGallerySessions, ({ many }) => ({
  clientSelections: many(clientSelections),
  sessionNotifications: many(sessionNotifications),
  sessionActivityLogs: many(sessionActivityLog),
}));

export const sessionNotificationsRelations = relations(sessionNotifications, ({ one }) => ({
  clientGallerySession: one(clientGallerySessions, {
    fields: [sessionNotifications.sessionId],
    references: [clientGallerySessions.id],
  }),
}));

export const journeyStepsRelations = relations(journeySteps, ({ one, many }) => ({
  customerJourneyTemplate: one(customerJourneyTemplates, {
    fields: [journeySteps.templateId],
    references: [customerJourneyTemplates.id],
  }),
  aiContentGenerations: many(aiContentGenerations),
  journeyAnalytics: many(journeyAnalytics),
}));

export const customerJourneyTemplatesRelations = relations(
  customerJourneyTemplates,
  ({ many }) => ({
    journeySteps: many(journeySteps),
    journeyAnalytics: many(journeyAnalytics),
  }),
);

export const aiContentGenerationsRelations = relations(aiContentGenerations, ({ one }) => ({
  journeyStep: one(journeySteps, {
    fields: [aiContentGenerations.stepId],
    references: [journeySteps.id],
  }),
}));

export const journeyAnalyticsRelations = relations(journeyAnalytics, ({ one }) => ({
  journeyStep: one(journeySteps, {
    fields: [journeyAnalytics.stepId],
    references: [journeySteps.id],
  }),
  customerJourneyTemplate: one(customerJourneyTemplates, {
    fields: [journeyAnalytics.templateId],
    references: [customerJourneyTemplates.id],
  }),
}));

export const sessionActivityLogRelations = relations(sessionActivityLog, ({ one }) => ({
  clientGallerySession: one(clientGallerySessions, {
    fields: [sessionActivityLog.sessionId],
    references: [clientGallerySessions.id],
  }),
}));

export const draftVersionsRelations = relations(draftVersions, ({ one }) => ({
  pageDraft: one(pageDrafts, {
    fields: [draftVersions.draftId],
    references: [pageDrafts.id],
  }),
}));

export const workflowStatesRelations = relations(workflowStates, ({ one }) => ({
  cmsPage: one(cmsPages, {
    fields: [workflowStates.pageId],
    references: [cmsPages.id],
  }),
}));

export const apiIntegrationLogsRelations = relations(apiIntegrationLogs, ({ one }) => ({
  apiIntegrationProcess: one(apiIntegrationProcesses, {
    fields: [apiIntegrationLogs.processId],
    references: [apiIntegrationProcesses.id],
  }),
}));

export const apiIntegrationProcessesRelations = relations(apiIntegrationProcesses, ({ many }) => ({
  apiIntegrationLogs: many(apiIntegrationLogs),
}));

export const projectDraftVersionsRelations = relations(projectDraftVersions, ({ one }) => ({
  projectDraftAutosave: one(projectDraftAutosave, {
    fields: [projectDraftVersions.draftId],
    references: [projectDraftAutosave.id],
  }),
}));

export const projectDraftAutosaveRelations = relations(projectDraftAutosave, ({ many }) => ({
  projectDraftVersions: many(projectDraftVersions),
}));

export const smartAlbumItemsRelations = relations(smartAlbumItems, ({ one }) => ({
  smartAlbum: one(smartAlbums, {
    fields: [smartAlbumItems.albumId],
    references: [smartAlbums.id],
  }),
  showcaseItem: one(showcaseItems, {
    fields: [smartAlbumItems.showcaseItemId],
    references: [showcaseItems.id],
  }),
}));

export const smartAlbumsRelations = relations(smartAlbums, ({ many }) => ({
  smartAlbumItems: many(smartAlbumItems),
}));

export const userProvisioningRequestsRelations = relations(userProvisioningRequests, ({ one }) => ({
  user_reviewedBy: one(users, {
    fields: [userProvisioningRequests.reviewedBy],
    references: [users.id],
    relationName: 'userProvisioningRequests_reviewedBy_users_id',
  }),
  user_userId: one(users, {
    fields: [userProvisioningRequests.userId],
    references: [users.id],
    relationName: 'userProvisioningRequests_userId_users_id',
  }),
}));

export const provisioningWorkflowStepsRelations = relations(
  provisioningWorkflowSteps,
  ({ one }) => ({
    provisioningWorkflow: one(provisioningWorkflows, {
      fields: [provisioningWorkflowSteps.workflowId],
      references: [provisioningWorkflows.id],
    }),
  }),
);

export const provisioningWorkflowsRelations = relations(provisioningWorkflows, ({ many }) => ({
  provisioningWorkflowSteps: many(provisioningWorkflowSteps),
  adminProvisioningActions: many(adminProvisioningActions),
}));

export const userProvisioningStatusRelations = relations(userProvisioningStatus, ({ one }) => ({
  user: one(users, {
    fields: [userProvisioningStatus.userId],
    references: [users.id],
  }),
}));

export const adminProvisioningActionsRelations = relations(adminProvisioningActions, ({ one }) => ({
  user_adminUserId: one(users, {
    fields: [adminProvisioningActions.adminUserId],
    references: [users.id],
    relationName: 'adminProvisioningActions_adminUserId_users_id',
  }),
  user_targetUserId: one(users, {
    fields: [adminProvisioningActions.targetUserId],
    references: [users.id],
    relationName: 'adminProvisioningActions_targetUserId_users_id',
  }),
  provisioningWorkflow: one(provisioningWorkflows, {
    fields: [adminProvisioningActions.workflowId],
    references: [provisioningWorkflows.id],
  }),
}));

export const platformSettingsRelations = relations(platformSettings, ({ one }) => ({
  user: one(users, {
    fields: [platformSettings.updatedBy],
    references: [users.id],
  }),
}));
