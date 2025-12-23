// Comprehensive role definitions with permissions and descriptions
export interface RoleDefinition {
  id: string;
  name: string;
  description: string;
  category: string;
  permissions: string[];
  level: number; // 1-10, higher = more access
  color: string;
  icon: string;
}

export const ROLE_DEFINITIONS: Record<string, RoleDefinition> = {
  super_admin: {
    id: 'super_admin',
    name: 'Super Administrator',
    description:
      'Full platform control with all permissions. Can manage all users, content, settings, and system configuration.',
    category: 'Administration',
    permissions: ['*'], // All permissions
    level: 10,
    color: 'purple',
    icon: 'crown',
  },
  admin: {
    id: 'admin',
    name: 'Administrator',
    description:
      'High-level platform management. Can manage users, content, and most platform features except system settings.',
    category: 'Administration',
    permissions: [
      'user.read',
      'user.write',
      'user.invite',
      'user.manage_roles',
      'content.read',
      'content.write',
      'content.publish',
      'analytics.read',
      'moderator.all',
    ],
    level: 9,
    color: 'blue',
    icon: 'shield',
  },
  editor: {
    id: 'editor',
    name: 'Content Editor',
    description:
      'Manages all platform content including blogs, pages, tutorials, and marketing materials. Can create, edit, and publish content.',
    category: 'Content Management',
    permissions: [
      'content.read',
      'content.write',
      'content.publish',
      'content.seo',
      'media.upload',
      'media.manage',
      'blog.write',
      'pages.edit',
      'tutorials.create',
      'marketing.content',
    ],
    level: 6,
    color: 'green',
    icon: 'edit',
  },
  marketer: {
    id: 'marketer',
    name: 'Marketing Manager',
    description:
      'Handles all marketing activities, campaigns, email marketing, social media, and promotional content creation.',
    category: 'Marketing',
    permissions: [
      'marketing.campaigns',
      'marketing.email',
      'marketing.social',
      'analytics.marketing',
      'content.promotional',
      'seo.manage',
      'partnerships.read',
      'events.promote',
      'newsletters.send',
    ],
    level: 6,
    color: 'orange',
    icon: 'megaphone',
  },
  photographer_manager: {
    id: 'photographer_manager',
    name: 'Photography Manager',
    description:
      'Oversees photographer community, manages photography features, portfolios, and photography-related content.',
    category: 'Community Management',
    permissions: [
      'photographers.manage',
      'portfolios.moderate',
      'photography.features',
      'galleries.manage',
      'contracts.photography',
      'tutorials.photography',
      'equipment.manage',
      'bookings.photography',
    ],
    level: 7,
    color: 'violet',
    icon: 'camera',
  },
  vendor_manager: {
    id: 'vendor_manager',
    name: 'Vendor Manager',
    description:
      'Manages vendor partnerships, marketplace, vendor verification, and partner-related features.',
    category: 'Business Development',
    permissions: [
      'vendors.manage',
      'marketplace.moderate',
      'partnerships.manage',
      'verification.vendors',
      'products.approve',
      'vendor.analytics',
      'commissions.manage',
      'directories.vendors',
    ],
    level: 7,
    color: 'teal',
    icon: 'building',
  },
  content_manager: {
    id: 'content_manager',
    name: 'Content Manager',
    description:
      'Focuses on content strategy, curation, and organization. Manages content calendars and publishing workflows.',
    category: 'Content Management',
    permissions: [
      'content.read',
      'content.write',
      'content.schedule',
      'content.strategy',
      'media.organize',
      'categories.manage',
      'tags.manage',
      'seo.content',
    ],
    level: 5,
    color: 'indigo',
    icon: 'folder',
  },
  analytics_manager: {
    id: 'analytics_manager',
    name: 'Analytics Manager',
    description:
      'Access to all platform analytics, reports, user insights, and data analysis tools.',
    category: 'Analytics',
    permissions: [
      'analytics.read',
      'analytics.reports',
      'analytics.export',
      'metrics.user',
      'metrics.content',
      'metrics.business',
      'insights.platform',
      'data.trends',
    ],
    level: 5,
    color: 'cyan',
    icon: 'bar-chart',
  },
  support_specialist: {
    id: 'support_specialist',
    name: 'Support Specialist',
    description:
      'Handles customer support, user assistance, FAQ management, and community moderation.',
    category: 'Customer Support',
    permissions: [
      'support.tickets',
      'support.chat',
      'users.help',
      'faq.manage',
      'community.moderate',
      'feedback.read',
      'issues.resolve',
      'documentation.read',
    ],
    level: 4,
    color: 'pink',
    icon: 'headphones',
  },
  moderator: {
    id: 'moderator',
    name: 'Community Moderator',
    description:
      'Moderates user-generated content, manages community guidelines, and handles content approval.',
    category: 'Moderation',
    permissions: [
      'content.moderate',
      'comments.moderate',
      'users.warn',
      'reports.review',
      'community.guidelines',
      'content.flag',
      'discussions.moderate',
    ],
    level: 3,
    color: 'yellow',
    icon: 'flag',
  },
};

export const PERMISSION_DESCRIPTIONS: Record<string, string> = {
  // User Management
  'user.read': 'View user profiles and information',
  'user.write': 'Edit user profiles and settings',
  'user.invite': 'Send invitations to new users',
  'user.manage_roles': 'Assign and modify user roles',
  'users.help': 'Provide user support and assistance',
  'users.warn': 'Issue warnings to users',

  // Content Management
  'content.read': 'View all content',
  'content.write': 'Create and edit content',
  'content.publish': 'Publish content to live site',
  'content.schedule': 'Schedule content publication',
  'content.strategy': 'Access content strategy tools',
  'content.moderate': 'Moderate user-generated content',
  'content.seo': 'Manage SEO settings for content',
  'content.promotional': 'Create promotional content',
  'content.flag': 'Flag inappropriate content',

  // Media Management
  'media.upload': 'Upload media files',
  'media.manage': 'Organize and manage media library',
  'media.organize': 'Organize media collections',

  // Analytics & Reports
  'analytics.read': 'View analytics dashboards',
  'analytics.reports': 'Generate detailed reports',
  'analytics.export': 'Export analytics data',
  'analytics.marketing': 'Access marketing analytics',
  'metrics.user': 'View user metrics',
  'metrics.content': 'View content performance',
  'metrics.business': 'View business metrics',

  // Marketing
  'marketing.campaigns': 'Create and manage campaigns',
  'marketing.email': 'Manage email marketing',
  'marketing.social': 'Manage social media',
  'seo.manage': 'Manage SEO settings',
  'newsletters.send': 'Send newsletters',
  'events.promote': 'Promote events',

  // Photography Features
  'photographers.manage': 'Manage photographer accounts',
  'portfolios.moderate': 'Moderate photography portfolios',
  'photography.features': 'Access photography tools',
  'galleries.manage': 'Manage photo galleries',
  'contracts.photography': 'Handle photography contracts',
  'tutorials.photography': 'Create photography tutorials',
  'equipment.manage': 'Manage equipment listings',
  'bookings.photography': 'Handle photography bookings',

  // Vendor Management
  'vendors.manage': 'Manage vendor accounts',
  'marketplace.moderate': 'Moderate marketplace content',
  'partnerships.manage': 'Manage business partnerships',
  'verification.vendors': 'Verify vendor accounts',
  'products.approve': 'Approve vendor products',
  'vendor.analytics': 'View vendor analytics',
  'commissions.manage': 'Manage commission settings',
  'directories.vendors': 'Manage vendor directories',

  // Support & Community
  'support.tickets': 'Handle support tickets',
  'support.chat': 'Provide chat support',
  'faq.manage': 'Manage FAQ content',
  'community.moderate': 'Moderate community discussions',
  'community.guidelines': 'Manage community guidelines',
  'feedback.read': 'View user feedback',
  'issues.resolve': 'Resolve user issues',
  'documentation.read': 'Access documentation',

  // Moderation
  'comments.moderate': 'Moderate user comments',
  'reports.review': 'Review user reports',
  'discussions.moderate': 'Moderate discussions',

  // Specialized
  'partnerships.read': 'View partnership information',
  'insights.platform': 'Access platform insights',
  'data.trends': 'View data trends',
};

export function getRoleDefinition(roleId: string): RoleDefinition | undefined {
  return ROLE_DEFINITIONS[roleId];
}

export function getAllRoles(): RoleDefinition[] {
  return Object.values(ROLE_DEFINITIONS);
}

export function getRolesByCategory(): Record<string, RoleDefinition[]> {
  const roles = getAllRoles();
  return roles.reduce(
    (acc, role) => {
      if (!acc[role.category]) {
        acc[role.category] = [];
      }
      acc[role.category].push(role);
      return acc;
    },
    {} as Record<string, RoleDefinition[]>,
  );
}

export function hasPermission(userPermissions: string[], requiredPermission: string): boolean {
  // Super admin has all permissions
  if (userPermissions.includes('*')) {
    return true;
  }

  return userPermissions.includes(requiredPermission);
}

export function canAssignRole(assignerRole: string, targetRole: string): boolean {
  const assigner = getRoleDefinition(assignerRole);
  const target = getRoleDefinition(targetRole);

  if (!assigner || !target) return false;

  // Super admin can assign any role
  if (assignerRole === 'super_admin') return true;

  // Users can only assign roles of lower level than their own
  return assigner.level > target.level;
}
