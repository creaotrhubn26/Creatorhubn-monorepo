/**
 * Standardized Query Keys
 * Consistent query key management for React Query caching
 */

export const QUERY_KEYS = {
  // Marketing
  ANNOUNCEMENTS: ['/api/announcements'],
  SOCIAL_POSTS: ['/api/social-media/posts'],
  CALENDAR_EVENTS: ['/api/content-calendar'],
  EMAIL_TEMPLATES: ['/api/email-templates'],
  
  // Marketing Automation
  WORKFLOWS: ['/api/marketing-automation/workflows'],
  SEGMENTS: ['/api/marketing-automation/segments'],
  CAMPAIGNS: ['/api/marketing-automation/campaigns'],
  AUTOMATION_RULES: ['/api/marketing-automation/rules'],
  AUTOMATION_ANALYTICS: ['/api/marketing-automation/analytics'],
  
  // Social Media
  SOCIAL_ANALYTICS: ['/api/social-media/analytics'],
  
  // Content
  DRAFTS: ['/api/drafts'],
  DRAFT_VERSIONS: ['/api/drafts/versions'],
  
  // Approvals
  APPROVALS: ['/api/approvals'],
  APPROVAL_STAGES: ['/api/approvals/stages'],
  APPROVAL_COMMENTS: ['/api/approvals/comments'],
  
  // Media Library
  MEDIA: ['/api/media'],
  MEDIA_FOLDERS: ['/api/media/folders'],
  
  // A/B Testing
  AB_TESTS: ['/api/ab-tests'],
  
  // Helper functions
  announcementById: (id: string) => [...QUERY_KEYS.ANNOUNCEMENTS, id],
  socialPostById: (id: string) => [...QUERY_KEYS.SOCIAL_POSTS, id],
  calendarEventById: (id: string) => [...QUERY_KEYS.CALENDAR_EVENTS, id],
  emailTemplateById: (id: string) => [...QUERY_KEYS.EMAIL_TEMPLATES, id],
  workflowById: (id: string) => [...QUERY_KEYS.WORKFLOWS, id],
  campaignById: (id: string) => [...QUERY_KEYS.CAMPAIGNS, id],
  
  // Filtered queries
  calendarByMonth: (month: string) => [...QUERY_KEYS.CALENDAR_EVENTS, month],
  socialByPlatform: (platform: string) => [...QUERY_KEYS.SOCIAL_POSTS, platform],
  workflowsByStatus: (status: string) => [...QUERY_KEYS.WORKFLOWS, status],
} as const;

export default QUERY_KEYS;
