// @ts-nocheck
/**
 * Enhanced Feedback Location Tracker Utility
 * Provides granular location tracking for prototype feedback and tester applications.
 */

export interface LocationContext {
  profession: string;
  dashboardType: string;
  currentTab: string;
  currentSection: string;
  specificFeature?: string;
  pageUrl: string;
  userAgent: string;
  timestamp: string;
}

type ComponentContext = {
  tab?: string;
  section?: string;
  feature?: string;
  component?: string;
};

type LocationContextContainer = { locationContext?: LocationContext };

const professionFeatures: Record<string, Record<string, string[]>> = {
  photographer: {
    universal_dashboard: ['photo_editing', 'portfolio_management', 'client_gallery'],
    photo_dashboard: ['lightroom_integration', 'photo_upload', 'metadata_management'],
    equipment_dashboard: ['camera_settings', 'lens_database', 'gear_tracking'],
  },
  videographer: {
    universal_dashboard: ['video_editing', 'project_management', 'timeline_view'],
    video_dashboard: ['premiere_integration', 'video_upload', 'rendering_queue'],
    equipment_dashboard: ['camera_rigs', 'audio_gear', 'lighting_setup'],
  },
  music_producer: {
    universal_dashboard: ['audio_editing', 'project_management', 'session_recording'],
    music_dashboard: ['daw_integration', 'audio_upload', 'mixing_console'],
    equipment_dashboard: ['audio_interfaces', 'microphones', 'monitors'],
  },
  vendor: {
    universal_dashboard: ['product_management', 'order_processing', 'inventory_tracking'],
    vendor_dashboard: ['product_catalog', 'sales_analytics', 'customer_management'],
    equipment_dashboard: ['product_listings', 'pricing_management', 'stock_levels'],
  },
  admin: {
    universal_dashboard: ['system_management', 'user_administration', 'analytics'],
    admin_dashboard: ['platform_health', 'performance_monitoring', 'security_audit'],
    equipment_dashboard: ['system_equipment', 'maintenance_scheduling', 'resource_allocation'],
  },
};

const urlPatterns: Record<string, string> = {
  '/dashboard': 'universal_dashboard',
  '/photo-dashboard': 'photo_dashboard',
  '/video-dashboard': 'video_dashboard',
  '/music-dashboard': 'music_dashboard',
  '/vendor-dashboard': 'vendor_dashboard',
  '/admin-dashboard': 'admin_dashboard',
  '/equipment': 'equipment_dashboard',
  '/prototype-testing': 'prototype_testing',
  '/feedback': 'feedback_system',
  '/settings': 'settings_panel',
  '/profile': 'user_profile',
  '/projects': 'project_management',
  '/communication': 'communication_panel',
  '/email': 'email_center',
  '/analytics': 'analytics_dashboard',
  '/reports': 'reporting_system',
};

const isDevelopmentEnvironment = () => {
  if (typeof import.meta !== 'undefined' && import.meta.env?.MODE) {
    return import.meta.env.MODE === 'development';
  }

  return typeof process !== 'undefined' && process.env.NODE_ENV === 'development';
};

const getCurrentTabFromUrl = (url: string): string => {
  try {
    const pathname = new URL(url).pathname;

    for (const [pattern, tab] of Object.entries(urlPatterns)) {
      if (pathname.includes(pattern)) {
        return tab;
      }
    }

    const segments = pathname.split('/').filter(Boolean);
    if (segments.length > 0) {
      return `${segments[0]}_dashboard`;
    }

    return 'unknown_tab';
  } catch (error) {
    console.warn('Error parsing URL for tab detection:', error);
    return 'unknown_tab';
  }
};

const detectCurrentFeature = (
  url: string,
  profession: string,
  currentTab: string,
): string | undefined => {
  try {
    const urlObject = new URL(url);
    const pathname = urlObject.pathname;
    const searchParams = urlObject.searchParams;

    const featurePatterns = [
      /\/edit\/([^/]+)/,
      /\/view\/([^/]+)/,
      /\/create\/([^/]+)/,
      /\/manage\/([^/]+)/,
      /\/settings\/([^/]+)/,
      /\/analytics\/([^/]+)/,
      /\/reports\/([^/]+)/,
      /\/communication\/([^/]+)/,
      /\/feedback\/([^/]+)/,
      /\/prototype\/([^/]+)/,
    ];

    for (const pattern of featurePatterns) {
      const match = pathname.match(pattern);
      if (match?.[1]) {
        return match[1];
      }
    }

    const featureParam =
      searchParams.get('feature') ??
      searchParams.get('tab') ??
      searchParams.get('section');
    if (featureParam) {
      return featureParam;
    }

    const featuresForTab = professionFeatures[profession]?.[currentTab] ?? [];
    return featuresForTab.find((feature) => pathname.includes(feature));
  } catch (error) {
    console.warn('Error detecting current feature:', error);
    return undefined;
  }
};

const resolveLocationContext = (
  context: LocationContext | LocationContextContainer,
): LocationContext | undefined => {
  if ('locationContext' in context) {
    return context.locationContext;
  }

  return context;
};

export const createFeedbackLocationContext = (
  profession: string,
  dashboardType: string,
  componentContext?: ComponentContext,
): LocationContext => {
  const pageUrl = window.location.href;
  const userAgent = navigator.userAgent;
  const timestamp = new Date().toISOString();

  const currentTab = componentContext?.tab ?? getCurrentTabFromUrl(pageUrl);
  const currentSection = componentContext?.section ?? currentTab;
  const specificFeature =
    componentContext?.feature ?? detectCurrentFeature(pageUrl, profession, currentTab);

  return {
    profession,
    dashboardType,
    currentTab,
    currentSection,
    specificFeature,
    pageUrl,
    userAgent,
    timestamp,
  };
};

export const generateLocationDescription = (
  context: LocationContext | LocationContextContainer,
): string => {
  const locationContext = resolveLocationContext(context);
  if (!locationContext) {
    return 'Ukjent lokasjon';
  }

  const { profession, dashboardType, currentTab, currentSection, specificFeature } = locationContext;

  const professionNames: Record<string, string> = {
    photographer: 'Fotograf',
    videographer: 'Videograf',
    music_producer: 'Musikkprodusent',
    vendor: 'Leverandør',
    admin: 'Administrator',
  };

  const labelMap: Record<string, string> = {
    universal_dashboard: 'Universal Dashboard',
    photo_dashboard: 'Foto Dashboard',
    video_dashboard: 'Video Dashboard',
    music_dashboard: 'Musikk Dashboard',
    vendor_dashboard: 'Leverandør Dashboard',
    admin_dashboard: 'Admin Dashboard',
    equipment_dashboard: 'Utstyr Dashboard',
    prototype_testing: 'Prototype Testing',
    feedback_system: 'Feedback System',
    settings_panel: 'Innstillinger',
    user_profile: 'Brukerprofil',
    project_management: 'Prosjektledelse',
    communication_panel: 'Kommunikasjonspanel',
    email_center: 'E-postsenter',
    analytics_dashboard: 'Analytics Dashboard',
    reporting_system: 'Rapportsystem',
    prototype_tester_application: 'Prototype Tester Application',
    application_form: 'Application Form',
  };

  const professionName = professionNames[profession] ?? profession;
  const dashboardName = labelMap[dashboardType] ?? dashboardType;
  const tabName = labelMap[currentTab] ?? currentTab;
  const sectionName = labelMap[currentSection] ?? currentSection;

  let description = `${professionName} - ${dashboardName}`;

  if (currentTab !== dashboardType) {
    description += ` -> ${tabName}`;
  }

  if (currentSection !== currentTab && currentSection !== dashboardType) {
    description += ` -> ${sectionName}`;
  }

  if (specificFeature) {
    description += ` -> ${specificFeature}`;
  }

  return description;
};

export const logPrototypeInteraction = (action: string, context: unknown): void => {
  if (!isDevelopmentEnvironment()) {
    return;
  }

  console.log(`Prototype Interaction: ${action}`, {
    timestamp: new Date().toISOString(),
    context,
    url: window.location.href,
    userAgent: navigator.userAgent,
  });
};

export const validateLocationContext = (
  context: LocationContext,
): { isValid: boolean; missingFields: string[] } => {
  const requiredFields: Array<keyof LocationContext> = [
    'profession',
    'dashboardType',
    'currentTab',
    'currentSection',
    'pageUrl',
    'userAgent',
    'timestamp',
  ];

  const missingFields = requiredFields.filter((field) => {
    const value = context[field];
    return value === undefined || value === null || String(value).trim() === '';
  });

  return {
    isValid: missingFields.length === 0,
    missingFields,
  };
};
