/**
 * Page Scanner Utility
 * Automatically discovers and parses pages from the pages folder
 */

import { PageTreeNode } from './PageTreeNavigator';
import {
  Home,
  Description,
  ViewModule,
  Business,
  EventNote,
  Email,
  PhotoLibrary,
  Settings,
  People,
  ShoppingCart,
  CalendarToday,
  Dashboard,
  Article,
  Videocam,
  MusicNote,
  Info,
  ContactPage,
  Policy,
  Gavel,
  Store,
  School,
  Groups,
  AccountTree,
} from '@mui/icons-material';
import React from 'react';

// Map of page names to icons
const PAGE_ICONS: Record<string, React.ReactNode> = {
  // Main pages
  home: <Home fontSize="small" />,
  landing: <Home fontSize="small" />,
  about: <Info fontSize="small" />,
  contact: <ContactPage fontSize="small" />,

  // Academy
  academy: <School fontSize="small" />,

  // Community
  community: <Groups fontSize="small" />,

  // Business
  admin: <Settings fontSize="small" />,
  business: <Business fontSize="small" />,
  pricing: <ShoppingCart fontSize="small" />,
  vendor: <Store fontSize="small" />,
  company: <Business fontSize="small" />,
  
  // Orchestrator
  orchestrator: <AccountTree fontSize="small" />,

  // Media
  gallery: <PhotoLibrary fontSize="small" />,
  photo: <PhotoLibrary fontSize="small" />,
  video: <Videocam fontSize="small" />,
  music: <MusicNote fontSize="small" />,
  showcase: <PhotoLibrary fontSize="small" />,

  // Tools
  editor: <Description fontSize="small" />,
  builder: <ViewModule fontSize="small" />,
  designer: <Description fontSize="small" />,
  studio: <Videocam fontSize="small" />,

  // Events
  wedding: <EventNote fontSize="small" />,
  timeline: <CalendarToday fontSize="small" />,
  booking: <EventNote fontSize="small" />,

  // Communication
  email: <Email fontSize="small" />,
  chat: <People fontSize="small" />,

  // Documents
  contract: <Gavel fontSize="small" />,
  terms: <Gavel fontSize="small" />,
  privacy: <Policy fontSize="small" />,
  policy: <Policy fontSize="small" />,

  // Dashboard
  dashboard: <Dashboard fontSize="small" />,

  // Articles
  tips: <Article fontSize="small" />,
  news: <Article fontSize="small" />,

  // Default
  default: <Description fontSize="small" />,
};

// List of all pages found in your pages folder
const ALL_PAGES = [
  'VirtualStudioPage.tsx',
  'VisualEditorPage.tsx',
  'AdminPage.tsx',
  'BusinessBrandingPage.tsx',
  'ContractSigningPage.tsx',
  'EmailDesignerPage.tsx',
  'EquipmentAdminPage.tsx',
  'GoogleOAuthSetupPage.tsx',
  'LandingResponsive.tsx',
  'LightroomSimulator.tsx',
  'PersonalizedNews.tsx',
  'PhotoEnhancerTest.tsx',
  'PricingPage.tsx',
  'RequestAccess.tsx',
  'StoryArcStudioPage.tsx',
  'SubscriptionSelectionPage.tsx',
  'TestOpenAIChat.tsx',
  'UniversalVendorShowcasePage.tsx',
  'VendorOnboardingWithInvitePage.tsx',
  'VendorPricingTestPage.tsx',
  'VendorTypeManagementPage.tsx',
  'WeddingTimelineClientDesktop.tsx',
  'WeddingTimelineClientMobile.tsx',
  'WeddingTimelineClientResponsive.tsx',
  'WireMockDashboard.tsx',
  'about.tsx',
  'admin-invite-system.tsx',
  'advanced-page-builder.tsx',
  'background-upload-test.tsx',
  'client-gallery.tsx',
  'comprehensive-booking.tsx',
  'concurrent-operations-demo.tsx',
  'contextual-photography-tips.tsx',
  'contract-view.tsx',
  'enhanced-page-builder.tsx',
  'kompetansesenter.tsx',
  'landing-desktop.tsx',
  'landing-mobile.tsx',
  'meeting-workspace-simple.tsx',
  'music-producer-dashboard-material.tsx',
  'music-showcase.tsx',
  'not-found.tsx',
  'photo-showcase.tsx',
  'photography-tips-demo.tsx',
  'price-administration.tsx',
  'privacy-policy.tsx',
  'professional-page-builder.tsx',
  'showcase-admin.tsx',
  'showcase-client.tsx',
  'terms-and-conditions.tsx',
  'wedding-client.tsx',
  'wedding-timeline-client.tsx',
];

// Page categories for better organization
const PAGE_CATEGORIES = {
  // Public Landing Pages
  'Landing Pages': [
    'landing-desktop',
    'landing-mobile',
    'landing-responsive',
  ],
  // Academy
  'Academy': [
    'academy-landing',
    'academy-dashboard',
  ],
  // Community
  'Community': [
    'community-landing',
    'community-hub',
  ],
  // Company
  'Company': [
    'about',
  ],
  // Main Pages
  'Main Pages': ['landing', 'about', 'contact', 'not-found'],
  // Admin & Tools
  'Admin & Tools': ['admin', 'visual-editor', 'email-designer', 'equipment-admin'],
  // Business
  'Business': ['business-branding', 'pricing', 'vendor', 'company-profiles'],
  // Galleries & Showcases
  'Galleries & Showcases': [
    'client-gallery',
    'photo-showcase',
    'music-showcase',
    'universal-vendor-showcase',
  ],
  // Wedding
  'Weddings': ['wedding-timeline-client', 'wedding-client'],
  // Builders & Editors
  'Builders & Editors': [
    'advanced-page-builder',
    'enhanced-page-builder',
    'professional-page-builder',
  ],
  // Studios
  'Studios': ['virtual-studio', 'story-arc-studio', 'lightroom-simulator'],
  // Legal
  'Legal': [
    'terms-and-conditions',
    'privacy-policy',
    'data-deletion',
    'contract-signing',
    'contract-view',
  ],
  // Pricing
  'Pricing': [
    'pricing-page',
    'subscription-selection',
  ],
  // Showcase
  'Showcase': [
    'music-showcase',
    'vendor-showcase',
  ],
  // Tests & Demos
  'Tests & Demos': [
    'photo-enhancer-test',
    'background-upload-test',
    'concurrent-operations-demo',
    'test-openai-chat',
  ],
};

/**
 * Format page name from filename
 */
export function formatPageName(filename: string): string {
  return filename
    .replace(/\.tsx?$/g, '') // Remove extension
    .replace(/Page$/, '') // Remove "Page" suffix
    .replace(/([A-Z])/g, ' $1') // Add space before capitals
    .replace(/[-_]/g, ' ') // Replace dashes/underscores with spaces
    .trim()
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Get icon for page based on name
 */
export function getPageIcon(pageName: string): React.ReactNode {
  const lowerName = pageName.toLowerCase();

  for (const [key, icon] of Object.entries(PAGE_ICONS)) {
    if (lowerName.includes(key)) {
      return icon;
    }
  }

  return PAGE_ICONS.default;
}

/**
 * Extract page ID from filename
 */
export function getPageId(filename: string): string {
  return filename
    .replace(/\.tsx?$/, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-');
}

/**
 * Determine page category
 */
export function getPageCategory(pageId: string): string | null {
  for (const [category, pages] of Object.entries(PAGE_CATEGORIES)) {
    if (pages.some((p) => pageId.includes(p))) {
      return category;
    }
  }
  return null;
}

/**
 * Parse page structure and extract sections
 * This is a simplified version - in production you'd parse the actual React component
 */
export function extractPageSections(pageId: string): PageTreeNode[] {
  const sections: PageTreeNode[] = [];

  // Common sections for most pages
  const commonSections = [
    {
      id: `${pageId}-header`,
      name: 'Header',
      type: 'section' as const,
      icon: <ViewModule fontSize="small" />,
    },
    {
      id: `${pageId}-hero`,
      name: 'Hero Section',
      type: 'section' as const,
      icon: <Description fontSize="small" />,
    },
    {
      id: `${pageId}-content`,
      name: 'Main Content',
      type: 'section' as const,
      icon: <Description fontSize="small" />,
    },
    {
      id: `${pageId}-footer`,
      name: 'Footer',
      type: 'section' as const,
      icon: <ViewModule fontSize="small" />,
    },
  ];

  // Specific sections for certain page types
  if (pageId.includes('gallery') || pageId.includes('showcase')) {
    sections.push(
      {
        id: `${pageId}-grid`,
        name: 'Image Grid',
        type: 'section' as const,
        icon: <PhotoLibrary fontSize="small" />,
      },
      {
        id: `${pageId}-filters`,
        name: 'Filters',
        type: 'section' as const,
        icon: <ViewModule fontSize="small" />,
      },
    );
  } else if (pageId.includes('pricing')) {
    sections.push(
      {
        id: `${pageId}-plans`,
        name: 'Pricing Plans',
        type: 'section' as const,
        icon: <ShoppingCart fontSize="small" />,
      },
      {
        id: `${pageId}-comparison`,
        name: 'Comparison Table',
        type: 'section' as const,
        icon: <ViewModule fontSize="small" />,
      },
    );
  } else if (pageId.includes('dashboard') || pageId.includes('admin')) {
    sections.push(
      {
        id: `${pageId}-sidebar`,
        name: 'Sidebar',
        type: 'section' as const,
        icon: <ViewModule fontSize="small" />,
      },
      {
        id: `${pageId}-widgets`,
        name: 'Dashboard Widgets',
        type: 'section' as const,
        icon: <Dashboard fontSize="small" />,
      },
    );
  } else {
    // Use common sections
    return commonSections.slice(0, 3); // Header, Hero, Content
  }

  return sections;
}

/**
 * Scan all pages and create tree structure
 */
export function scanPages(): PageTreeNode[] {
  const pageNodes: PageTreeNode[] = [];

  // Group pages by category
  const categorizedPages: Record<string, string[]> = {};
  const uncategorizedPages: string[] = [];

  ALL_PAGES.forEach((filename) => {
    const pageId = getPageId(filename);
    const category = getPageCategory(pageId);

    if (category) {
      if (!categorizedPages[category]) {
        categorizedPages[category] = [];
      }
      categorizedPages[category].push(filename);
    } else {
      uncategorizedPages.push(filename);
    }
  });

  // Create nodes for each category
  Object.entries(categorizedPages).forEach(([category, files]) => {
    const categoryNode: PageTreeNode = {
      id: `category-${category.toLowerCase().replace(/\s+/g, '-')}`,
      name: category,
      type: 'section',
      icon: <ViewModule fontSize="small" />,
      visible: true,
      children: files.map((filename) => {
        const pageId = getPageId(filename);
        const pageName = formatPageName(filename);

        return {
          id: pageId,
          name: pageName,
          type: 'page',
          icon: getPageIcon(pageName),
          visible: true,
          children: extractPageSections(pageId),
        };
      }),
    };

    pageNodes.push(categoryNode);
  });

  // Add uncategorized pages at the end
  if (uncategorizedPages.length > 0) {
    uncategorizedPages.forEach((filename) => {
      const pageId = getPageId(filename);
      const pageName = formatPageName(filename);

      pageNodes.push({
        id: pageId,
        name: pageName,
        type: 'page',
        icon: getPageIcon(pageName),
        visible: true,
        children: extractPageSections(pageId),
      });
    });
  }

  return pageNodes;
}

/**
 * Get featured/main pages for quick access
 */
export function getFeaturedPages(): PageTreeNode[] {
  const featuredPageNames = [
    'LandingResponsive.tsx',
    'about.tsx',
    'PricingPage.tsx',
    'client-gallery.tsx',
  ];

  return featuredPageNames
    .filter((name) => ALL_PAGES.includes(name))
    .map((filename) => {
      const pageId = getPageId(filename);
      const pageName = formatPageName(filename);

      return {
        id: pageId,
        name: pageName,
        type: 'page' as const,
        icon: getPageIcon(pageName),
        visible: true,
        children: extractPageSections(pageId),
      };
    });
}

/**
 * Search pages by name
 */
export function searchPages(query: string): string[] {
  const lowerQuery = query.toLowerCase();

  return ALL_PAGES.filter((filename) => {
    const pageName = formatPageName(filename).toLowerCase();
    return pageName.includes(lowerQuery) || filename.toLowerCase().includes(lowerQuery);
  }).map(getPageId);
}

/**
 * Get page stats
 */
export function getPageStats() {
  return {
    totalPages: ALL_PAGES.length,
    categories: Object.keys(PAGE_CATEGORIES).length,
    withSections: ALL_PAGES.filter((f) => {
      const id = getPageId(f);
      return extractPageSections(id).length > 0;
    }).length,
  };
}
