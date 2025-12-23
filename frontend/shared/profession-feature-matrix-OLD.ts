/**
 * Profession Feature Matrix
 * Defines which features are available for which professions
 * Enables profession-specific feature toggling
 */

export interface ProfessionFeatureConfig {
  professionId: string;
  availableFeatures: {
    [featureId: string]: {
      enabled: boolean;
      optional: boolean; // Can admin toggle?
      required: boolean; // Always on for this profession?
      description: string;
      impact: 'low' | 'medium' | 'high' | 'critical';
    };
  };
}

export const PROFESSION_FEATURE_MATRIX: Record<string, ProfessionFeatureConfig> = {
  photographer: {
    professionId: 'photographer',
    availableFeatures: {
      wedding_timeline: {
        enabled: true,
        optional: false,
        required: true,
        description: 'Bryllupstidslinje med kulturtilpasning og klienttilgang',
        impact: 'high',
      },
      photo_enhancement: {
        enabled: true,
        optional: false,
        required: true,
        description: 'AI-drevet fotoforbedring og redigering',
        impact: 'high',
      },
      showcase_admin: {
        enabled: true,
        optional: true,
        required: false,
        description: 'Portfolio showcase administrasjon',
        impact: 'medium',
      },
      client_gallery: {
        enabled: true,
        optional: true,
        required: false,
        description: 'Klientgalleri for bildedeling',
        impact: 'medium',
      },
      video_ai: {
        enabled: false,
        optional: true,
        required: false,
        description: 'Video AI forbedring (for fotografer som også gjør video)',
        impact: 'medium',
      },
      audio_ai: {
        enabled: false,
        optional: false,
        required: false,
        description: 'Audio AI (ikke relevant for fotografer)',
        impact: 'low',
      },
    },
  },

  videographer: {
    professionId: 'videographer',
    availableFeatures: {
      wedding_timeline: {
        enabled: false,
        optional: true,
        required: false,
        description: 'Bryllupstidslinje for videografer (koordiner med fotograf)',
        impact: 'medium',
      },
      video_ai: {
        enabled: true,
        optional: false,
        required: true,
        description: 'Video AI forbedring og redigering',
        impact: 'critical',
      },
      story_arc_studio: {
        enabled: true,
        optional: false,
        required: true,
        description: 'Story Arc Studio med DaVinci Resolve export',
        impact: 'high',
      },
      showcase_admin: {
        enabled: true,
        optional: true,
        required: false,
        description: 'Video portfolio showcase',
        impact: 'medium',
      },
      photo_enhancement: {
        enabled: false,
        optional: true,
        required: false,
        description: 'Fotoforbedring (for video thumbnails)',
        impact: 'low',
      },
      audio_ai: {
        enabled: false,
        optional: true,
        required: false,
        description: 'Audio forbedring for videoprosjekter',
        impact: 'medium',
      },
    },
  },

  music_producer: {
    professionId: 'music_producer',
    availableFeatures: {
      wedding_timeline: {
        enabled: false,
        optional: false,
        required: false,
        description: 'Bryllupstidslinje (ikke relevant for musikkprodusenter)',
        impact: 'low',
      },
      audio_ai: {
        enabled: true,
        optional: false,
        required: true,
        description: 'Audio AI mastering og forbedring',
        impact: 'critical',
      },
      music_showcase: {
        enabled: true,
        optional: false,
        required: true,
        description: 'Musikk showcase med streaming integrasjon',
        impact: 'high',
      },
      artist_management: {
        enabled: true,
        optional: false,
        required: true,
        description: 'Artist CRM og kontraktstyring',
        impact: 'high',
      },
      video_ai: {
        enabled: false,
        optional: true,
        required: false,
        description: 'Video AI (for musikkvideoer)',
        impact: 'medium',
      },
      photo_enhancement: {
        enabled: false,
        optional: true,
        required: false,
        description: 'Fotoforbedring (for album cover)',
        impact: 'low',
      },
    },
  },

  vendor: {
    professionId: 'vendor',
    availableFeatures: {
      wedding_timeline: {
        enabled: false,
        optional: false,
        required: false,
        description: 'Bryllupstidslinje (ikke relevant for leverandører)',
        impact: 'low',
      },
      product_manager: {
        enabled: true,
        optional: false,
        required: true,
        description: 'Produktkatalog og lagerstyring',
        impact: 'critical',
      },
      inventory_system: {
        enabled: true,
        optional: false,
        required: true,
        description: 'Avansert lagerstyring med varsler',
        impact: 'high',
      },
      vendor_type_manager: {
        enabled: true,
        optional: false,
        required: true,
        description: 'Vendor type ekspansjonssystem',
        impact: 'high',
      },
      photo_enhancement: {
        enabled: false,
        optional: true,
        required: false,
        description: 'Fotoforbedring for produktbilder',
        impact: 'medium',
      },
    },
  },

  pet_hotel: {
    professionId: 'pet_hotel',
    availableFeatures: {
      booking_calendar: {
        enabled: true,
        optional: false,
        required: true,
        description: 'Bookingkalender med beleggsoversikt',
        impact: 'critical',
      },
      pet_profiles: {
        enabled: true,
        optional: false,
        required: true,
        description: 'Dyreprofiler med medisinsk informasjon',
        impact: 'critical',
      },
      live_cameras: {
        enabled: true,
        optional: true,
        required: false,
        description: 'Live kameraer for eiere (premium funksjon)',
        impact: 'medium',
      },
      daily_logs: {
        enabled: true,
        optional: false,
        required: true,
        description: 'Daglige omsorglogger og rapporter',
        impact: 'high',
      },
      facility_management: {
        enabled: true,
        optional: false,
        required: true,
        description: 'Fasilitetsadministrasjon og vedlikehold',
        impact: 'high',
      },
      wedding_timeline: {
        enabled: false,
        optional: false,
        required: false,
        description: 'Bryllupstidslinje (ikke relevant for dyrehotell)',
        impact: 'low',
      },
    },
  },

  yoga_studio: {
    professionId: 'yoga_studio',
    availableFeatures: {
      class_schedule: {
        enabled: true,
        optional: false,
        required: true,
        description: 'Timeplan for yoga-klasser',
        impact: 'critical',
      },
      membership_management: {
        enabled: true,
        optional: false,
        required: true,
        description: 'Medlemskapsstyring med abonnement',
        impact: 'high',
      },
      online_classes: {
        enabled: false,
        optional: true,
        required: false,
        description: 'Online yoga-klasser via video',
        impact: 'medium',
      },
      video_ai: {
        enabled: false,
        optional: true,
        required: false,
        description: 'Video AI (for online klasser)',
        impact: 'low',
      },
    },
  },

  // Add other professions...
  tattoo_artist: {
    professionId: 'tattoo_artist',
    availableFeatures: {
      portfolio: {
        enabled: true,
        optional: false,
        required: true,
        description: 'Tatoveringsportfolio',
        impact: 'critical',
      },
      appointment_booking: {
        enabled: true,
        optional: false,
        required: true,
        description: 'Avtalebooking',
        impact: 'critical',
      },
      design_gallery: {
        enabled: true,
        optional: true,
        required: false,
        description: 'Designgalleri',
        impact: 'medium',
      },
      photo_enhancement: {
        enabled: false,
        optional: true,
        required: false,
        description: 'Fotoforbedring for portfolio',
        impact: 'low',
      },
    },
  },

  hairdresser: {
    professionId: 'hairdresser',
    availableFeatures: {
      appointment_booking: {
        enabled: true,
        optional: false,
        required: true,
        description: 'Avtalebooking',
        impact: 'critical',
      },
      client_history: {
        enabled: true,
        optional: false,
        required: true,
        description: 'Kundehistorikk',
        impact: 'high',
      },
      product_sales: {
        enabled: true,
        optional: true,
        required: false,
        description: 'Produktsalg',
        impact: 'medium',
      },
      photo_enhancement: {
        enabled: false,
        optional: true,
        required: false,
        description: 'Fotoforbedring for før/etter bilder',
        impact: 'low',
      },
    },
  },
};

/**
 * Check if feature is available for profession
 */
export function isProfessionFeatureAvailable(professionId: string, featureId: string): boolean {
  const professionConfig = PROFESSION_FEATURE_MATRIX[professionId];
  if (!professionConfig) return false;

  const feature = professionConfig.availableFeatures[featureId];
  return !!feature && (feature.enabled || feature.optional);
}

/**
 * Check if feature is enabled for profession
 */
export function isProfessionFeatureEnabled(professionId: string, featureId: string): boolean {
  const professionConfig = PROFESSION_FEATURE_MATRIX[professionId];
  if (!professionConfig) return false;

  return professionConfig.availableFeatures[featureId]?.enabled || false;
}

/**
 * Check if feature can be toggled (is optional)
 */
export function isProfessionFeatureOptional(professionId: string, featureId: string): boolean {
  const professionConfig = PROFESSION_FEATURE_MATRIX[professionId];
  if (!professionConfig) return false;

  return professionConfig.availableFeatures[featureId]?.optional || false;
}

/**
 * Enable feature for specific profession
 */
export function enableProfessionFeature(professionId: string, featureId: string): boolean {
  const professionConfig = PROFESSION_FEATURE_MATRIX[professionId];
  if (!professionConfig) return false;

  const feature = professionConfig.availableFeatures[featureId];
  if (!feature || !feature.optional) return false; // Can only enable optional features

  feature.enabled = true;
  return true;
}

/**
 * Disable feature for specific profession
 */
export function disableProfessionFeature(professionId: string, featureId: string): boolean {
  const professionConfig = PROFESSION_FEATURE_MATRIX[professionId];
  if (!professionConfig) return false;

  const feature = professionConfig.availableFeatures[featureId];
  if (!feature || !feature.optional || feature.required) return false; // Cannot disable required features

  feature.enabled = false;
  return true;
}

/**
 * Get all optional features for a profession
 */
export function getOptionalFeaturesForProfession(professionId: string) {
  const professionConfig = PROFESSION_FEATURE_MATRIX[professionId];
  if (!professionConfig) return [];

  return Object.entries(professionConfig.availableFeatures)
    .filter(([, feature]) => feature.optional)
    .map(([featureId, feature]) => ({
      featureId,
      ...feature,
    }));
}

/**
 * Get all required features for a profession
 */
export function getRequiredFeaturesForProfession(professionId: string) {
  const professionConfig = PROFESSION_FEATURE_MATRIX[professionId];
  if (!professionConfig) return [];

  return Object.entries(professionConfig.availableFeatures)
    .filter(([, feature]) => feature.required)
    .map(([featureId, feature]) => ({
      featureId,
      ...feature,
    }));
}

/**
 * Get profession feature stats
 */
export function getProfessionFeatureStats(professionId: string) {
  const professionConfig = PROFESSION_FEATURE_MATRIX[professionId];
  if (!professionConfig) return { total: 0, enabled: 0, optional: 0, required: 0 };

  const features = Object.values(professionConfig.availableFeatures);

  return {
    total: features.length,
    enabled: features.filter((f) => f.enabled).length,
    optional: features.filter((f) => f.optional).length,
    required: features.filter((f) => f.required).length,
  };
}
