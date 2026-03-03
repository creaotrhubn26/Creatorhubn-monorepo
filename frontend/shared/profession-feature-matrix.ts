/**
 * EXPANDED Profession Feature Matrix
 * Maps all 105+ platform features to professions
 * Auto-generated from creatorhub-features.ts
 */

import { CREATORHUB_FEATURES, CreatorHubFeature } from './creatorhub-features';

export interface ProfessionFeatureConfig {
  professionId: string;
  availableFeatures: {
    [featureId: string]: {
      enabled: boolean;
      optional: boolean;
      required: boolean;
      description: string;
      impact: 'low' | 'medium' | 'high' | 'critical';
      plan: 'basic' | 'pro' | 'enterprise' | 'marketplace'; // ✅ Added 'marketplace'
      beta?: boolean;
      dependencies?: string[]; // ✅ Feature IDs that must be enabled for this feature to work
      // ✅ Development Status Tracking
      developmentStatus?:
        | 'complete'
        | 'beta'
        | 'alpha'
        | 'in-development'
        | 'planned'
        | 'needs-work';
      completionPercentage?: number; // 0-100
      missingFeatures?: string[]; // List of features that need implementation
      technicalDebt?: string[]; // Known issues or improvements needed
      // ✅ Marketplace-specific fields
      marketplacePrice?: number; // Monthly price in NOK
      marketplaceCategory?:
        | 'ai-tools'
        | 'integrations'
        | 'automation'
        | 'analytics'
        | 'premium-templates'
        | 'advanced-features';
      marketplaceTrial?: number; // Trial days (0 = no trial)
      marketplacePopular?: boolean; // Is this a popular marketplace item?
    };
  };
}

/**
 * Auto-generate profession feature matrix from CREATORHUB_FEATURES
 */
function generateProfessionFeatureMatrix(): Record<string, ProfessionFeatureConfig> {
  const matrix: Record<string, ProfessionFeatureConfig> = {};

  // All professions
  const professions = [
    'photographer',
    'videographer',
    'music_producer',
    'vendor',
    'enterprise',
    'pet_hotel',
    'yoga_studio',
    'tattoo_artist',
    'hairdresser',
    'personal_trainer',
    'restaurant',
    'florist',
    'childcare',
    'psychologist',
    'driving_school',
    'spa_wellness',
    'admin',
  ];

  // Initialize each profession
  professions.forEach((profession) => {
    matrix[profession] = {
      professionId: profession,
      availableFeatures: {},
    };
  });

  // Map features from CREATORHUB_FEATURES
  CREATORHUB_FEATURES.forEach((feature: CreatorHubFeature) => {
    const impactLevel = feature.isCore
      ? 'critical'
      : feature.requiredPlan === 'enterprise'
        ? 'high'
        : feature.requiredPlan === 'pro'
          ? 'medium'
          : 'low';

    // Normalize profession names
    const professionMapping: Record<string, string> = {
      photographer: 'photographer',
      videographer: 'videographer',
      musicproducer: 'music_producer',
      vendor: 'vendor',
      enterprise: 'enterprise',
      admin: 'admin',
    };

    feature.professions.forEach((prof) => {
      const normalizedProf = professionMapping[prof] || prof;

      if (matrix[normalizedProf]) {
        matrix[normalizedProf].availableFeatures[feature.id] = {
          enabled: feature.isCore, // Core features enabled by default
          optional: !feature.isCore, // Non-core features are optional
          required: feature.isCore, // Core features are required
          description: feature.description,
          impact: impactLevel,
          plan: feature.requiredPlan,
          beta: feature.metadata?.betaFeature || false,
        };
      }

      // Enterprise inherits photographer + videographer features
      if ((normalizedProf === 'photographer' || normalizedProf === 'videographer') && matrix['enterprise']) {
        if (!matrix['enterprise'].availableFeatures[feature.id]) {
          matrix['enterprise'].availableFeatures[feature.id] = {
            enabled: feature.isCore,
            optional: !feature.isCore,
            required: feature.isCore,
            description: feature.description,
            impact: impactLevel,
            plan: feature.requiredPlan,
            beta: feature.metadata?.betaFeature || false,
          };
        }
      }
    });
  });

  // Add profession-specific features not in CREATORHUB_FEATURES

  // Pet Hotel specific
  if (matrix.pet_hotel) {
    matrix.pet_hotel.availableFeatures = {
      ...matrix.pet_hotel.availableFeatures,
      // ============================================
      // PET HOTEL + DEPENDENCY TRACKING
      // ============================================
      'booking-calendar': {
        enabled: true,
        optional: false,
        required: true,
        description: 'Bookingkalender med beleggsoversikt',
        impact: 'critical',
        plan: 'basic',
        dependencies: [],
      },
      'pet-profiles': {
        enabled: true,
        optional: false,
        required: true,
        description: 'Dyreprofiler med medisinsk informasjon',
        impact: 'critical',
        plan: 'basic',
        dependencies: [],
      },
      'live-cameras': {
        enabled: false,
        optional: true,
        required: false,
        description: 'Live kameraer for eiere (premium funksjon)',
        impact: 'medium',
        plan: 'pro',
        dependencies: ['pet-profiles'],
      },
      'daily-logs': {
        enabled: true,
        optional: false,
        required: true,
        description: 'Daglige omsorglogger og rapporter',
        impact: 'high',
        plan: 'basic',
        dependencies: ['pet-profiles'],
      },
      'facility-management': {
        enabled: true,
        optional: false,
        required: true,
        description: 'Fasilitetsadministrasjon og vedlikehold',
        impact: 'high',
        plan: 'basic',
        dependencies: [],
      },
    };
  }

  // Yoga Studio specific
  if (matrix.yoga_studio) {
    matrix.yoga_studio.availableFeatures = {
      ...matrix.yoga_studio.availableFeatures,
      // ============================================
      // YOGA STUDIO + DEPENDENCY TRACKING
      // ============================================
      'class-schedule': {
        enabled: true,
        optional: false,
        required: true,
        description: 'Timeplan for yoga-klasser',
        impact: 'critical',
        plan: 'basic',
        dependencies: [],
      },
      'membership-management': {
        enabled: true,
        optional: false,
        required: true,
        description: 'Medlemskapsstyring med abonnement',
        impact: 'high',
        plan: 'basic',
        dependencies: [],
      },
      'online-classes': {
        enabled: false,
        optional: true,
        required: false,
        description: 'Online yoga-klasser via video',
        impact: 'medium',
        plan: 'pro',
        dependencies: ['class-schedule'],
      },
    };
  }

  // Photographer specific
  if (matrix.photographer) {
    matrix.photographer.availableFeatures = {
      ...matrix.photographer.availableFeatures,
      // ============================================
      // PHOTOGRAPHER FEATURES + DEPENDENCY TRACKING
      // ============================================
      'fotograf-orchestrator': {
        enabled: true,
        optional: false,
        required: true,
        description: 'Smart arbeidsflyt orkestrator for fotografer med automatiserte workflows',
        impact: 'critical',
        plan: 'basic',
        dependencies: [],
      },
      'universal-showcase': {
        enabled: true,
        optional: false,
        required: true,
        description: 'Universal showcase system for portfolio display',
        impact: 'critical',
        plan: 'basic',
        dependencies: [],
      },
      'showcase-creation': {
        enabled: true,
        optional: false,
        required: true,
        description: 'Create and manage showcases',
        impact: 'high',
        plan: 'basic',
        dependencies: ['universal-showcase'],
      },
      'showcase-management': {
        enabled: true,
        optional: false,
        required: true,
        description: 'Manage showcase settings and content',
        impact: 'high',
        plan: 'basic',
        dependencies: ['universal-showcase'],
      },
      'client-proofing': {
        enabled: true,
        optional: false,
        required: true,
        description: 'Client image selection and proofing system',
        impact: 'critical',
        plan: 'basic',
        dependencies: ['universal-showcase'],
      },
      'photo-enhancement': {
        enabled: true,
        optional: true,
        required: false,
        description: 'AI-powered photo enhancement suite',
        impact: 'high',
        plan: 'pro',
        dependencies: ['universal-showcase'],
      },
      'ai-suggestions-toggle': {
        enabled: true,
        optional: false,
        required: false,
        description:
          'AI research-backed suggestions toggle for PhotographerPhotoSuite (6,086 papers)',
        impact: 'high',
        plan: 'basic',
        dependencies: [],
      },
      watermarking: {
        enabled: true,
        optional: false,
        required: true,
        description: 'Professional watermarking system',
        impact: 'high',
        plan: 'basic',
        dependencies: ['universal-showcase'],
      },
      'showcase-pricing': {
        enabled: true,
        optional: false,
        required: true,
        description: 'Integrated pricing and checkout for image sales',
        impact: 'high',
        plan: 'basic',
        dependencies: ['universal-showcase'],
      },
      'showcase-analytics': {
        enabled: true,
        optional: true,
        required: false,
        description: 'Showcase analytics and insights',
        impact: 'medium',
        plan: 'pro',
        dependencies: ['universal-showcase'],
      },
      'google-photos-integration': {
        enabled: false,
        optional: true,
        required: false,
        description: 'Google Photos sync and import',
        impact: 'medium',
        plan: 'pro',
        dependencies: ['universal-showcase'],
      },
      'custom-categories': {
        enabled: true,
        optional: true,
        required: false,
        description: 'Custom showcase categories and organization',
        impact: 'medium',
        plan: 'basic',
        dependencies: ['universal-showcase'],
      },
      'lightroom-plugin': {
        enabled: false,
        optional: true,
        required: false,
        description: 'Adobe Lightroom plugin integration',
        impact: 'medium',
        plan: 'pro',
        dependencies: ['universal-showcase', 'bulk-image-operations'],
      },
      'bulk-image-operations': {
        enabled: true,
        optional: true,
        required: false,
        description: 'Bulk edit, watermark, and process images',
        impact: 'high',
        plan: 'basic',
        dependencies: ['universal-showcase'],
      },
      'metadata-editor': {
        enabled: true,
        optional: true,
        required: false,
        description: 'Bulk metadata editing for images',
        impact: 'medium',
        plan: 'basic',
        dependencies: ['bulk-image-operations'],
      },
      // Wedding Day Execution Features
      'auto-adjust-timeline': {
        enabled: true,
        optional: false,
        required: true,
        description: 'Auto-adjusting wedding timeline - delays ripple to all downstream events',
        impact: 'critical',
        plan: 'basic',
        dependencies: [],
      },
      'timeline-revert': {
        enabled: true,
        optional: false,
        required: true,
        description: 'One-click revert timeline to original schedule',
        impact: 'high',
        plan: 'basic',
        dependencies: ['auto-adjust-timeline'],
      },
      'mobile-shot-list': {
        enabled: true,
        optional: false,
        required: true,
        description: 'Mobile-optimized shot list with cultural templates and progress tracking',
        impact: 'critical',
        plan: 'basic',
        dependencies: [],
      },
      'wedding-day-mobile-timeline': {
        enabled: true,
        optional: true,
        required: false,
        description: 'Mobile-first vertical timeline view for wedding day execution',
        impact: 'high',
        plan: 'basic',
        dependencies: ['auto-adjust-timeline'],
      },
      'website-builder': {
        enabled: false,
        optional: true,
        required: false,
        description: 'Drag-and-drop website builder with custom domain support',
        impact: 'high',
        plan: 'marketplace',
        dependencies: [],
        marketplacePrice: 199,
        marketplaceCategory: 'advanced-features',
        marketplaceTrial: 14,
        marketplacePopular: true,
      },
      'website-hosting': {
        enabled: false,
        optional: true,
        required: false,
        description: 'Managed website hosting with SSL, CDN, and custom domains',
        impact: 'high',
        plan: 'marketplace',
        dependencies: ['website-builder'],
        marketplacePrice: 99,
        marketplaceCategory: 'advanced-features',
        marketplaceTrial: 14,
        marketplacePopular: true,
      },
      'quick-message-templates': {
        enabled: true,
        optional: true,
        required: false,
        description: 'One-tap wedding day message templates for team coordination',
        impact: 'medium',
        plan: 'basic',
        dependencies: [],
      },
      'offline-wedding-mode': {
        enabled: true,
        optional: false,
        required: true,
        description: 'PWA offline support with background sync for wedding day execution',
        impact: 'critical',
        plan: 'basic',
        dependencies: ['pwa-install'],
      },
      'timeline-delay-tracking': {
        enabled: true,
        optional: false,
        required: false,
        description: 'Track delay reasons and patterns for timeline adjustments',
        impact: 'medium',
        plan: 'basic',
        dependencies: ['auto-adjust-timeline'],
      },
      'shot-list-cultural-templates': {
        enabled: true,
        optional: false,
        required: true,
        description:
          '12+ cultural wedding shot list templates (Norwegian, Indian, Pakistani, etc.)',
        impact: 'high',
        plan: 'basic',
        dependencies: ['mobile-shot-list'],
      },
      'haptic-feedback': {
        enabled: true,
        optional: true,
        required: false,
        description: 'Mobile haptic feedback for shot completion and notifications',
        impact: 'low',
        plan: 'basic',
        dependencies: ['mobile-shot-list'],
      },
      'timeline-client-view': {
        enabled: true,
        optional: false,
        required: true,
        description: 'Client timeline view with PIN access and change requests',
        impact: 'critical',
        plan: 'basic',
        dependencies: ['auto-adjust-timeline'],
      },
      'client-timeline-requests': {
        enabled: true,
        optional: false,
        required: true,
        description: 'Clients can request timeline changes with one-click approval',
        impact: 'high',
        plan: 'basic',
        dependencies: ['timeline-client-view'],
      },
      'wedding-timeline-notifications': {
        enabled: true,
        optional: false,
        required: true,
        description: 'Real-time WebSocket and push notifications for timeline changes',
        impact: 'high',
        plan: 'basic',
        dependencies: ['websocket-realtime', 'push-notifications'],
      },
      'background-sync': {
        enabled: true,
        optional: false,
        required: true,
        description: 'Background sync for offline timeline and shot list changes',
        impact: 'high',
        plan: 'basic',
        dependencies: ['service-worker-offline'],
      },
      // ============================================
      // VIRTUAL STUDIO FEATURES (PHOTOGRAPHER)
      // ============================================
      'virtual-studio': {
        enabled: true,
        optional: true,
        required: false,
        description: 'CreatorHub Virtual Studio - 3D lighting preview and studio setup planning',
        impact: 'high',
        plan: 'pro',
        dependencies: [],
      },
      'virtual-studio-3d': {
        enabled: true,
        optional: true,
        required: false,
        description: '3D viewport with real-time lighting preview',
        impact: 'high',
        plan: 'pro',
        dependencies: ['virtual-studio'],
      },
      'virtual-studio-camera': {
        enabled: true,
        optional: true,
        required: false,
        description: 'Professional camera controls with exposure triangle',
        impact: 'high',
        plan: 'pro',
        dependencies: ['virtual-studio'],
      },
      'virtual-studio-animation': {
        enabled: true,
        optional: true,
        required: false,
        description: 'Camera path animation and timeline recording',
        impact: 'medium',
        plan: 'pro',
        dependencies: ['virtual-studio'],
      },
      'virtual-studio-lut-grading': {
        enabled: true,
        optional: true,
        required: false,
        description: '627 professional LUTs with GPU-accelerated color grading',
        impact: 'high',
        plan: 'pro',
        dependencies: ['virtual-studio'],
      },
      'virtual-studio-hdri': {
        enabled: true,
        optional: true,
        required: false,
        description: 'HDRI environment lighting with Poly Haven library',
        impact: 'medium',
        plan: 'pro',
        dependencies: ['virtual-studio'],
      },
      'virtual-studio-equipment-browser': {
        enabled: true,
        optional: true,
        required: false,
        description: 'Professional equipment catalog with MSRP pricing',
        impact: 'medium',
        plan: 'pro',
        dependencies: ['virtual-studio'],
      },
      'virtual-studio-scene-templates': {
        enabled: true,
        optional: true,
        required: false,
        description: '7 pre-configured studio scene templates',
        impact: 'low',
        plan: 'pro',
        dependencies: ['virtual-studio'],
      },
      'virtual-studio-ai-analysis': {
        enabled: true,
        optional: true,
        required: false,
        description: 'AI-powered scene analysis and lighting suggestions',
        impact: 'high',
        plan: 'pro',
        dependencies: ['virtual-studio'],
      },
      'camera-path-recording': {
        enabled: true,
        optional: true,
        required: false,
        description: 'Record camera movements with keyframe animation',
        impact: 'medium',
        plan: 'pro',
        dependencies: ['virtual-studio-animation'],
      },
      'camera-path-sync': {
        enabled: true,
        optional: true,
        required: false,
        description: 'Cloud sync camera paths via Google Drive',
        impact: 'low',
        plan: 'pro',
        dependencies: ['camera-path-recording'],
      },
      // ============================================
      // SCROLL STORY - ADVANCED STORYTELLING
      // ============================================
      'scroll-story': {
        enabled: false,
        optional: true,
        required: false,
        description:
          'Advanced scroll-based storytelling component with animations, parallax, keyboard navigation, and media preloading',
        impact: 'high',
        plan: 'marketplace',
        dependencies: ['universal-showcase'],
        marketplacePrice: 149,
        marketplaceCategory: 'advanced-features',
        marketplaceTrial: 14,
        marketplacePopular: true,
        developmentStatus: 'complete',
        completionPercentage: 100,
      },
      'scroll-story-animations': {
        enabled: false,
        optional: true,
        required: false,
        description: 'GPU-accelerated scroll animations with custom easing and timing',
        impact: 'medium',
        plan: 'marketplace',
        dependencies: ['scroll-story'],
        marketplacePrice: 49,
        marketplaceCategory: 'advanced-features',
        marketplaceTrial: 7,
        marketplacePopular: false,
      },
      'scroll-story-parallax': {
        enabled: false,
        optional: true,
        required: false,
        description: 'Parallax scrolling effects for immersive storytelling',
        impact: 'medium',
        plan: 'marketplace',
        dependencies: ['scroll-story'],
        marketplacePrice: 39,
        marketplaceCategory: 'advanced-features',
        marketplaceTrial: 7,
        marketplacePopular: false,
      },
      'scroll-story-media-preload': {
        enabled: false,
        optional: true,
        required: false,
        description: 'Smart media preloading for smooth video/image playback',
        impact: 'medium',
        plan: 'marketplace',
        dependencies: ['scroll-story'],
        marketplacePrice: 29,
        marketplaceCategory: 'advanced-features',
        marketplaceTrial: 7,
        marketplacePopular: false,
      },
    };
  }

  // Videographer specific showcase features
  if (matrix.videographer) {
    matrix.videographer.availableFeatures = {
      ...matrix.videographer.availableFeatures,
      // ============================================
      // VIDEOGRAPHER SHOWCASE + DEPENDENCY TRACKING
      // ============================================
      'universal-showcase': {
        enabled: true,
        optional: false,
        required: true,
        description: 'Universal showcase system for video portfolio',
        impact: 'critical',
        plan: 'basic',
        dependencies: [],
      },
      'video-editor-suite': {
        enabled: true,
        optional: true,
        required: false,
        description: 'Advanced video editing tools',
        impact: 'high',
        plan: 'pro',
        dependencies: ['universal-showcase'],
      },
      'video-proofing': {
        enabled: true,
        optional: false,
        required: true,
        description: 'Client video proofing with timecoded comments',
        impact: 'critical',
        plan: 'basic',
        dependencies: ['universal-showcase'],
      },
      'sequence-management': {
        enabled: true,
        optional: true,
        required: false,
        description: 'Video sequence and chapter management',
        impact: 'high',
        plan: 'pro',
        dependencies: ['universal-showcase'],
      },
      'proxy-generation': {
        enabled: false,
        optional: true,
        required: false,
        description: 'Automatic proxy file generation',
        impact: 'medium',
        plan: 'pro',
        dependencies: ['universal-showcase'],
      },
      'multicam-sync': {
        enabled: false,
        optional: true,
        required: false,
        description: 'Multi-camera audio sync',
        impact: 'medium',
        plan: 'pro',
        dependencies: ['universal-showcase'],
      },
      'version-comparison': {
        enabled: true,
        optional: true,
        required: false,
        description: 'Side-by-side version comparison',
        impact: 'high',
        plan: 'pro',
        dependencies: ['universal-showcase', 'video-proofing'],
      },
      'render-presets': {
        enabled: true,
        optional: true,
        required: false,
        description: 'Professional render presets (4K, Web, Social)',
        impact: 'high',
        plan: 'basic',
        dependencies: ['universal-showcase'],
      },
      'streaming-setup': {
        enabled: false,
        optional: true,
        required: false,
        description: 'HLS/DASH streaming configuration',
        impact: 'medium',
        plan: 'enterprise',
        dependencies: ['universal-showcase'],
      },
      'wedding-packages': {
        enabled: true,
        optional: true,
        required: false,
        description: 'Wedding video package templates',
        impact: 'medium',
        plan: 'basic',
        dependencies: ['universal-showcase'],
      },
      'video-analytics': {
        enabled: true,
        optional: true,
        required: false,
        description: 'Video quality analytics and reports',
        impact: 'medium',
        plan: 'pro',
        dependencies: ['universal-showcase'],
      },
      'davinci-resolve-integration': {
        enabled: false,
        optional: true,
        required: false,
        description: 'DaVinci Resolve integration',
        impact: 'low',
        plan: 'enterprise',
        dependencies: ['universal-showcase'],
      },
      'audio-enhancement-suite': {
        enabled: true,
        optional: true,
        required: false,
        description:
          'AI-powered audio enhancement for video projects (denoise, speech enhance, source separation)',
        impact: 'high',
        plan: 'pro',
        dependencies: ['universal-showcase'],
      },
      'ai-suggestions-toggle': {
        enabled: true,
        optional: false,
        required: false,
        description:
          'AI research-backed suggestions toggle for StoryArcStudio, AudioEnhancementSuite, VirtualStudio (6,086 papers)',
        impact: 'high',
        plan: 'basic',
        dependencies: [],
      },
      // Wedding Day Execution Features (for videographers)
      'auto-adjust-timeline': {
        enabled: true,
        optional: false,
        required: true,
        description: 'Auto-adjusting wedding timeline - delays ripple to all downstream events',
        impact: 'critical',
        plan: 'basic',
        dependencies: [],
      },
      'timeline-revert': {
        enabled: true,
        optional: false,
        required: true,
        description: 'One-click revert timeline to original schedule',
        impact: 'high',
        plan: 'basic',
        dependencies: ['auto-adjust-timeline'],
      },
      'mobile-shot-list': {
        enabled: true,
        optional: false,
        required: true,
        description: 'Mobile-optimized shot list with scene-based organization',
        impact: 'critical',
        plan: 'basic',
        dependencies: [],
      },
      'wedding-day-mobile-timeline': {
        enabled: true,
        optional: true,
        required: false,
        description: 'Mobile-first vertical timeline view for wedding day execution',
        impact: 'high',
        plan: 'basic',
        dependencies: ['auto-adjust-timeline'],
      },
      'quick-message-templates': {
        enabled: true,
        optional: true,
        required: false,
        description: 'One-tap wedding day message templates for team coordination',
        impact: 'medium',
        plan: 'basic',
        dependencies: [],
      },
      'offline-wedding-mode': {
        enabled: true,
        optional: false,
        required: true,
        description: 'PWA offline support with background sync for wedding day execution',
        impact: 'critical',
        plan: 'basic',
        dependencies: ['pwa-install'],
      },
      'timeline-client-view': {
        enabled: true,
        optional: false,
        required: true,
        description: 'Client timeline view with PIN access and change requests',
        impact: 'critical',
        plan: 'basic',
        dependencies: ['auto-adjust-timeline'],
      },
      'wedding-timeline-notifications': {
        enabled: true,
        optional: false,
        required: true,
        description: 'Real-time WebSocket and push notifications for timeline changes',
        impact: 'high',
        plan: 'basic',
        dependencies: ['websocket-realtime', 'push-notifications'],
      },
      // ============================================
      // STORY ARC STUDIO - PROFESSIONAL VIDEO EDITOR
      // ✅ CUSTOM PLAN DISTRIBUTION + DEPENDENCY TRACKING
      // ============================================

      // 🟢 BASIC PLAN (FREE) - Core Editor (5 features)
      'story-arc-studio': {
        enabled: true,
        optional: false,
        required: true,
        description:
          'Professional video editor with 485 transitions, 627 LUTs, AI story generation',
        impact: 'critical',
        plan: 'basic', // ✅ FREE - Core feature
        dependencies: [],
      },
      'real-video-playback': {
        enabled: true,
        optional: false,
        required: true,
        description: 'WebCodecs-powered real video playback engine',
        impact: 'critical',
        plan: 'basic', // ✅ FREE - Core feature
        dependencies: [],
      },
      'frame-accurate-editing': {
        enabled: true,
        optional: false,
        required: true,
        description: 'Frame-accurate timeline editing (25fps PAL standard)',
        impact: 'critical',
        plan: 'basic', // ✅ FREE - Core feature
        dependencies: [],
      },
      'multitrack-timeline': {
        enabled: true,
        optional: false,
        required: true,
        description: 'Multi-track video/audio editing with drag & drop',
        impact: 'critical',
        plan: 'basic', // ✅ FREE - Core feature
        dependencies: [],
      },
      'jkl-controls': {
        enabled: true,
        optional: false,
        required: true,
        description: 'Professional J/K/L transport controls (1x-8x speed)',
        impact: 'high',
        plan: 'basic', // ✅ FREE - Core feature
        dependencies: ['real-video-playback'],
      },

      // 🟢 BASIC PLAN (FREE) - Essential Tools (5 features)
      '485-transitions': {
        enabled: true,
        optional: false,
        required: true,
        description: '485 professional transitions (Canvas2D + WebGL)',
        impact: 'critical',
        plan: 'basic', // ✅ FREE - vs CapCut's 25 transitions!
        dependencies: ['story-arc-studio'],
      },
      'text-overlays': {
        enabled: true,
        optional: false,
        required: true,
        description: 'Professional text overlays with Fabric.js + GSAP animations',
        impact: 'high',
        plan: 'basic', // ✅ FREE
        dependencies: ['story-arc-studio'],
      },
      'speed-ramps': {
        enabled: true,
        optional: false,
        required: true,
        description: 'Variable speed control & smooth slow-motion (17 presets)',
        impact: 'high',
        plan: 'basic', // ✅ FREE
        dependencies: ['story-arc-studio', 'frame-accurate-editing'],
      },
      'color-grading': {
        enabled: true,
        optional: false,
        required: true,
        description: 'DaVinci Resolve-style color wheels (temp, tint, exposure, contrast)',
        impact: 'critical',
        plan: 'basic', // ✅ FREE
        dependencies: ['story-arc-studio'],
      },
      'gpu-filters': {
        enabled: true,
        optional: false,
        required: true,
        description: 'GPU-accelerated filters with PixiJS (blur, bloom, color matrix)',
        impact: 'high',
        plan: 'basic', // ✅ FREE
        dependencies: ['story-arc-studio'],
      },

      // 🟢 BASIC PLAN (FREE) - Export & Integration (5 features)
      'mobile-export-presets': {
        enabled: true,
        optional: false,
        required: true,
        description: 'Mobile export presets (9:16 Reels, 1:1 Instagram, 4:5 Portrait)',
        impact: 'high',
        plan: 'basic', // ✅ FREE
        dependencies: ['story-arc-studio'],
      },
      'mp4-muxer-export': {
        enabled: true,
        optional: false,
        required: true,
        description: '10x faster export with mp4-muxer (WebCodecs)',
        impact: 'critical',
        plan: 'basic', // ✅ FREE - 10x faster than CapCut!
        dependencies: ['story-arc-studio'],
      },
      'video-editor-workflow': {
        enabled: true,
        optional: false,
        required: true,
        description: 'Seamless Project → Video Editor → Export workflow',
        impact: 'critical',
        plan: 'basic', // ✅ FREE
        dependencies: ['story-arc-studio'],
      },
      'video-google-drive-import': {
        enabled: true,
        optional: false,
        required: true,
        description: 'Direct import video from Google Drive project folders',
        impact: 'critical',
        plan: 'basic', // ✅ FREE
        dependencies: ['story-arc-studio'],
      },
      '627-luts': {
        enabled: true,
        optional: false,
        required: true,
        description: 'Professional 3D LUT library (440 Cultural + 187 Script)',
        impact: 'critical',
        plan: 'basic', // ✅ FREE - ⭐ UNIQUE VALUE PROP! Nobody else has this!
        dependencies: ['color-grading'],
      },

      // 🔵 PRO PLAN ($15/month) - AI Suite (4 features)
      'ai-story-generation': {
        enabled: true,
        optional: false,
        required: true,
        description: 'GPT-4 Vision auto-generates 3-act narrative timeline',
        impact: 'critical',
        plan: 'pro', // 💎 PRO - MAIN UPGRADE HOOK!
        dependencies: ['story-arc-studio'],
      },
      'cultural-ai-analysis': {
        enabled: true,
        optional: false,
        required: true,
        description: 'AI cultural context awareness (Sikh, Indian, Norwegian weddings)',
        impact: 'critical',
        plan: 'pro', // 💎 PRO
        dependencies: ['ai-story-generation'],
      },
      'emotional-pacing': {
        enabled: true,
        optional: false,
        required: true,
        description: 'AI emotional pacing curve for perfect narrative flow',
        impact: 'high',
        plan: 'pro', // 💎 PRO
        dependencies: ['ai-story-generation'],
      },
      '3-act-structure': {
        enabled: true,
        optional: false,
        required: true,
        description: 'AI 3-act narrative structure generation',
        impact: 'high',
        plan: 'pro', // 💎 PRO
        dependencies: ['ai-story-generation'],
      },

      // 🔵 PRO PLAN ($15/month) - Cultural Color (2 features)
      'cultural-luts': {
        enabled: true,
        optional: false,
        required: true,
        description: '440 cultural wedding LUTs (Sikh, Indian, Norwegian, Pakistani, etc.)',
        impact: 'critical',
        plan: 'pro', // 💎 PRO
        dependencies: ['627-luts'],
      },
      'script-luts': {
        enabled: true,
        optional: false,
        required: true,
        description: '187 camera LOG conversion LUTs (S-Log3, C-Log, V-Log, etc.)',
        impact: 'critical',
        plan: 'pro', // 💎 PRO
        dependencies: ['627-luts'],
      },

      // 🔵 PRO PLAN ($15/month) - Audio Suite (3 features)
      'professional-waveforms': {
        enabled: true,
        optional: false,
        required: true,
        description: 'Professional audio waveforms with wavesurfer.js',
        impact: 'high',
        plan: 'pro', // 💎 PRO
        dependencies: ['story-arc-studio'],
      },
      'beat-detection': {
        enabled: true,
        optional: true,
        required: false,
        description: 'Auto-detect music beats and sync clips (meyda analysis)',
        impact: 'high',
        plan: 'pro', // 💎 PRO
        dependencies: ['professional-waveforms'],
      },
      'auto-captions': {
        enabled: true,
        optional: false,
        required: true,
        description: 'AI auto-captions with OpenAI Whisper (80+ languages, SRT/VTT)',
        impact: 'critical',
        plan: 'pro', // 💎 PRO
        dependencies: ['story-arc-studio'],
      },

      // 🔵 PRO PLAN ($15/month) - Professional Export (3 features)
      'davinci-resolve-export': {
        enabled: true,
        optional: false,
        required: true,
        description: 'Export EDL/XML/AAF + 627 LUTs for DaVinci Resolve finishing',
        impact: 'critical',
        plan: 'pro', // 💎 PRO
        dependencies: ['627-luts'],
      },
      'video-worklog-automation': {
        enabled: true,
        optional: false,
        required: true,
        description: 'Auto-generate worklog entries from editing sessions',
        impact: 'high',
        plan: 'pro', // 💎 PRO
        dependencies: ['video-editor-workflow'],
      },

      // 🟣 ENTERPRISE PLAN ($50/month) - Advanced Effects (2 features)
      'optical-flow': {
        enabled: true,
        optional: true,
        required: false,
        description: 'Frame interpolation for buttery-smooth slow-motion',
        impact: 'medium',
        plan: 'enterprise', // 💼 ENTERPRISE
        dependencies: ['speed-ramps'],
      },
      'background-removal': {
        enabled: true,
        optional: true,
        required: false,
        description: 'AI-powered background removal (RemBG, U2-Net)',
        impact: 'medium',
        plan: 'enterprise', // 💼 ENTERPRISE
        dependencies: ['story-arc-studio'],
      },

      // 🟣 ENTERPRISE PLAN ($50/month) - Enterprise Import (2 features)
      'hls-import': {
        enabled: true,
        optional: true,
        required: false,
        description: 'Import from YouTube/Vimeo via HLS streaming',
        impact: 'medium',
        plan: 'enterprise', // 💼 ENTERPRISE
        dependencies: ['story-arc-studio'],
      },
      'custom-fonts': {
        enabled: true,
        optional: true,
        required: false,
        description: 'Parse custom fonts with opentype.js for text overlays',
        impact: 'medium',
        plan: 'enterprise', // 💼 ENTERPRISE
        dependencies: ['text-overlays'],
      },

      // NOTE: svg-logo-import removed from matrix as it was redundant with text-overlays

      // ============================================
      // VIRTUAL STUDIO FEATURES (VIDEOGRAPHER)
      // ============================================
      'virtual-studio': {
        enabled: true,
        optional: true,
        required: false,
        description:
          'CreatorHub Virtual Studio - 3D lighting preview, video export, and scene setup',
        impact: 'high',
        plan: 'pro',
        dependencies: [],
      },
      'virtual-studio-3d': {
        enabled: true,
        optional: true,
        required: false,
        description: '3D viewport with real-time lighting preview',
        impact: 'high',
        plan: 'pro',
        dependencies: ['virtual-studio'],
      },
      'virtual-studio-camera': {
        enabled: true,
        optional: true,
        required: false,
        description: 'Professional camera controls with exposure triangle',
        impact: 'high',
        plan: 'pro',
        dependencies: ['virtual-studio'],
      },
      'virtual-studio-animation': {
        enabled: true,
        optional: true,
        required: false,
        description: 'Camera path animation and timeline recording',
        impact: 'high',
        plan: 'pro',
        dependencies: ['virtual-studio'],
      },
      'virtual-studio-export': {
        enabled: true,
        optional: true,
        required: false,
        description: 'MP4 video export with FFmpeg.wasm (1080p/4K/60fps)',
        impact: 'critical',
        plan: 'pro',
        dependencies: ['virtual-studio'],
      },
      'virtual-studio-lut-grading': {
        enabled: true,
        optional: true,
        required: false,
        description: '627 professional LUTs with GPU-accelerated color grading',
        impact: 'critical',
        plan: 'pro',
        dependencies: ['virtual-studio'],
      },
      'virtual-studio-hdri': {
        enabled: true,
        optional: true,
        required: false,
        description: 'HDRI environment lighting with Poly Haven library',
        impact: 'high',
        plan: 'pro',
        dependencies: ['virtual-studio'],
      },
      'virtual-studio-character-models': {
        enabled: true,
        optional: true,
        required: false,
        description: '9 character models with pose library for scene planning',
        impact: 'medium',
        plan: 'pro',
        dependencies: ['virtual-studio'],
      },
      'virtual-studio-equipment-browser': {
        enabled: true,
        optional: true,
        required: false,
        description: 'Professional equipment catalog with MSRP pricing',
        impact: 'medium',
        plan: 'pro',
        dependencies: ['virtual-studio'],
      },
      'virtual-studio-scene-templates': {
        enabled: true,
        optional: true,
        required: false,
        description: '7 pre-configured studio scene templates',
        impact: 'low',
        plan: 'pro',
        dependencies: ['virtual-studio'],
      },
      'virtual-studio-ai-analysis': {
        enabled: true,
        optional: true,
        required: false,
        description: 'AI-powered scene analysis and lighting suggestions',
        impact: 'high',
        plan: 'pro',
        dependencies: ['virtual-studio'],
      },
      'camera-path-recording': {
        enabled: true,
        optional: true,
        required: false,
        description: 'Record camera movements with keyframe animation',
        impact: 'high',
        plan: 'pro',
        dependencies: ['virtual-studio-animation'],
      },
      'camera-path-sync': {
        enabled: true,
        optional: true,
        required: false,
        description: 'Cloud sync camera paths via Google Drive',
        impact: 'low',
        plan: 'pro',
        dependencies: ['camera-path-recording'],
      },
      // ============================================
      // DAVINCI RESOLVE ADVANCED INTEGRATION
      // ============================================
      'davinci-resolve-script-bank': {
        enabled: false,
        optional: true,
        required: false,
        description: 'Script Bank Manager with 50+ professional DaVinci Resolve scripts',
        impact: 'high',
        plan: 'pro',
        dependencies: ['davinci-resolve-export'],
      },
      'davinci-resolve-configurator': {
        enabled: false,
        optional: true,
        required: false,
        description: 'Advanced Script Configurator for custom DaVinci workflows',
        impact: 'medium',
        plan: 'pro',
        dependencies: ['davinci-resolve-export'],
      },
      'davinci-resolve-project-creator': {
        enabled: false,
        optional: true,
        required: false,
        description: 'Resolve Project Creator with automated setup and templates',
        impact: 'high',
        plan: 'pro',
        dependencies: ['davinci-resolve-export'],
      },
      'davinci-resolve-smart-downloader': {
        enabled: false,
        optional: true,
        required: false,
        description: 'Smart Script Downloader with version management',
        impact: 'low',
        plan: 'pro',
        dependencies: ['davinci-resolve-export'],
      },
      // ============================================
      // SCROLL STORY - ADVANCED STORYTELLING
      // ============================================
      'scroll-story': {
        enabled: false,
        optional: true,
        required: false,
        description:
          'Advanced scroll-based storytelling component with animations, parallax, keyboard navigation, and media preloading',
        impact: 'high',
        plan: 'marketplace',
        dependencies: ['universal-showcase'],
        marketplacePrice: 149,
        marketplaceCategory: 'advanced-features',
        marketplaceTrial: 14,
        marketplacePopular: true,
        developmentStatus: 'complete',
        completionPercentage: 100,
      },
      'scroll-story-animations': {
        enabled: false,
        optional: true,
        required: false,
        description: 'GPU-accelerated scroll animations with custom easing and timing',
        impact: 'medium',
        plan: 'marketplace',
        dependencies: ['scroll-story'],
        marketplacePrice: 49,
        marketplaceCategory: 'advanced-features',
        marketplaceTrial: 7,
        marketplacePopular: false,
      },
      'scroll-story-parallax': {
        enabled: false,
        optional: true,
        required: false,
        description: 'Parallax scrolling effects for immersive storytelling',
        impact: 'medium',
        plan: 'marketplace',
        dependencies: ['scroll-story'],
        marketplacePrice: 39,
        marketplaceCategory: 'advanced-features',
        marketplaceTrial: 7,
        marketplacePopular: false,
      },
      'scroll-story-media-preload': {
        enabled: false,
        optional: true,
        required: false,
        description: 'Smart media preloading for smooth video/image playback',
        impact: 'medium',
        plan: 'marketplace',
        dependencies: ['scroll-story'],
        marketplacePrice: 29,
        marketplaceCategory: 'advanced-features',
        marketplaceTrial: 7,
        marketplacePopular: false,
      },
    };
  }

  // Music Producer specific showcase features
  if (matrix.music_producer) {
    matrix.music_producer.availableFeatures = {
      ...matrix.music_producer.availableFeatures,
      // ============================================
      // MUSIC PRODUCER + DEPENDENCY TRACKING
      // ============================================
      'universal-showcase': {
        enabled: true,
        optional: false,
        required: true,
        description: 'Universal showcase for music portfolio',
        impact: 'critical',
        plan: 'basic',
        dependencies: [],
      },
      'audio-watermarking': {
        enabled: true,
        optional: false,
        required: true,
        description: 'Advanced audio watermarking (steganography)',
        impact: 'critical',
        plan: 'basic',
        dependencies: ['universal-showcase'],
      },
      'ai-audio-analysis': {
        enabled: false,
        optional: true,
        required: false,
        description: 'AI-powered audio content analysis',
        impact: 'medium',
        plan: 'pro',
        dependencies: ['universal-showcase'],
      },
      'music-showcase-display': {
        enabled: true,
        optional: false,
        required: true,
        description: 'Professional music showcase display',
        impact: 'high',
        plan: 'basic',
        dependencies: ['universal-showcase'],
      },
      'audio-enhancement-suite': {
        enabled: true,
        optional: false,
        required: true,
        description:
          'AI-powered audio enhancement with RNNoise, DCCRN, and Demucs (denoise, speech enhance, source separation)',
        impact: 'critical',
        plan: 'basic',
        dependencies: [],
      },
      'ai-suggestions-toggle': {
        enabled: true,
        optional: false,
        required: false,
        description:
          'AI research-backed suggestions toggle for AudioEnhancementSuite (6,086 papers)',
        impact: 'high',
        plan: 'basic',
        dependencies: [],
      },
      // ============================================
      // SPOTIFY INTEGRATION
      // ============================================
      'spotify-integration': {
        enabled: false,
        optional: true,
        required: false,
        description: 'Spotify Music Producer Dashboard with analytics and royalties',
        impact: 'critical',
        plan: 'pro',
        dependencies: [],
      },
      'spotify-royalties-management': {
        enabled: false,
        optional: true,
        required: false,
        description: 'Track and manage Spotify royalties and streaming revenue',
        impact: 'high',
        plan: 'pro',
        dependencies: ['spotify-integration'],
      },
      'spotify-analytics': {
        enabled: false,
        optional: true,
        required: false,
        description: 'Music streaming analytics and performance insights',
        impact: 'high',
        plan: 'pro',
        dependencies: ['spotify-integration'],
      },
    };
  }

  // Vendor specific showcase features
  if (matrix.vendor) {
    matrix.vendor.availableFeatures = {
      ...matrix.vendor.availableFeatures,
      // ============================================
      // VENDOR + DEPENDENCY TRACKING
      // ============================================
      'universal-showcase': {
        enabled: true,
        optional: false,
        required: true,
        description: 'Universal showcase for product catalog',
        impact: 'critical',
        plan: 'basic',
        dependencies: [],
      },
      'product-showcase': {
        enabled: true,
        optional: false,
        required: true,
        description: 'Product catalog and showcase',
        impact: 'high',
        plan: 'basic',
        dependencies: ['universal-showcase'],
      },
    };
  }

  // Universal showcase features for all professions
  professions.forEach((profession) => {
    if (matrix[profession]) {
      matrix[profession].availableFeatures = {
        ...matrix[profession].availableFeatures,
        // ============================================
        // RESUME BUILDER SUITE + DEPENDENCY TRACKING
        // ============================================
        'resume-builder': {
          enabled: true,
          optional: false,
          required: false,
          description:
            'Professional CV/Resume builder with Norwegian templates and ATS optimization',
          impact: 'high',
          plan: 'basic',
          dependencies: [],
        },
        'resume-templates': {
          enabled: true,
          optional: false,
          required: true,
          description:
            '7+ Norwegian-optimized CV templates (two-column, creative, modern, healthcare, academic, executive, sales)',
          impact: 'critical',
          plan: 'basic',
          dependencies: ['resume-builder'],
        },
        'resume-export': {
          enabled: true,
          optional: false,
          required: true,
          description: 'Export CV to PDF, DOCX, TXT, JSON formats',
          impact: 'critical',
          plan: 'basic',
          dependencies: ['resume-builder'],
        },
        'resume-analytics': {
          enabled: true,
          optional: true,
          required: false,
          description: 'CV analytics and performance tracking',
          impact: 'medium',
          plan: 'pro',
          dependencies: ['resume-builder'],
        },
        'ats-optimization': {
          enabled: true,
          optional: false,
          required: true,
          description: 'ATS (Applicant Tracking System) score and optimization suggestions',
          impact: 'critical',
          plan: 'basic',
          dependencies: ['resume-builder'],
        },
        'google-drive-integration': {
          enabled: true,
          optional: true,
          required: false,
          description: 'Google Drive Picker API for portfolio file management',
          impact: 'high',
          plan: 'basic',
          dependencies: ['resume-builder'],
        },
        'portfolio-management': {
          enabled: true,
          optional: false,
          required: true,
          description: 'Portfolio items with Google Drive links and project showcase',
          impact: 'high',
          plan: 'basic',
          dependencies: ['resume-builder', 'google-drive-integration'],
        },
        'resume-versioning': {
          enabled: true,
          optional: false,
          required: true,
          description: 'Version control for CV with history and restore functionality',
          impact: 'high',
          plan: 'basic',
          dependencies: ['resume-builder'],
        },
        'resume-auto-save': {
          enabled: true,
          optional: false,
          required: true,
          description: 'Auto-save with 2-second debouncing and draft mode',
          impact: 'critical',
          plan: 'basic',
          dependencies: ['resume-builder'],
        },
        'ai-resume-writing': {
          enabled: true,
          optional: false,
          required: false,
          description: 'AI-powered resume content generation and enhancement',
          impact: 'critical',
          plan: 'pro',
          dependencies: ['resume-builder'],
        },
        'ai-content-suggestions': {
          enabled: true,
          optional: false,
          required: false,
          description: 'AI suggestions for improving CV content (paraphrase, grammar, summarize)',
          impact: 'high',
          plan: 'pro',
          dependencies: ['resume-builder', 'ai-resume-writing'],
        },
        'ai-paraphrase-modes': {
          enabled: true,
          optional: false,
          required: false,
          description:
            '7 AI paraphrase modes (Standard, Fluency, Creative, Academic, Formal, Shorten, Expand)',
          impact: 'high',
          plan: 'pro',
          dependencies: ['ai-content-suggestions'],
        },
        'ai-grammar-check': {
          enabled: true,
          optional: false,
          required: false,
          description: 'AI-powered Norwegian grammar and spelling check',
          impact: 'high',
          plan: 'pro',
          dependencies: ['ai-content-suggestions'],
        },
        'norwegian-spell-checker': {
          enabled: true,
          optional: false,
          required: false,
          description:
            'Full-featured Norwegian spell checker panel with contextual suggestions (Bokmål & Nynorsk)',
          impact: 'high',
          plan: 'pro',
          dependencies: [],
        },
        'inline-norwegian-spell-checker': {
          enabled: true,
          optional: false,
          required: false,
          description:
            'Real-time inline Norwegian spell checker with floating suggestions while typing',
          impact: 'high',
          plan: 'pro',
          dependencies: ['norwegian-spell-checker'],
        },
        'ai-cover-letter-generator': {
          enabled: true,
          optional: false,
          required: false,
          description: 'AI-generated Norwegian cover letters tailored to job descriptions',
          impact: 'critical',
          plan: 'pro',
          dependencies: ['ai-resume-writing'],
        },
        'job-application-tracking': {
          enabled: true,
          optional: true,
          required: false,
          description: 'Track job applications with status, notes, and follow-up reminders',
          impact: 'high',
          plan: 'basic',
          dependencies: ['resume-builder'],
        },
        'norwegian-job-portals': {
          enabled: true,
          optional: true,
          required: false,
          description: 'Integration with Norwegian job portals (finn.no, nav.no, etc.)',
          impact: 'high',
          plan: 'pro',
          dependencies: ['job-application-tracking'],
        },
        'resume-sharing': {
          enabled: true,
          optional: false,
          required: true,
          description: 'Share CV via public URL or private link',
          impact: 'high',
          plan: 'basic',
          dependencies: ['resume-builder'],
        },
        'resume-collaboration': {
          enabled: false,
          optional: true,
          required: false,
          description: 'Real-time collaboration on CV editing (mentors, career coaches)',
          impact: 'medium',
          plan: 'enterprise',
          dependencies: ['resume-builder', 'websocket-realtime'],
        },
        'project-cv-integration': {
          enabled: true,
          optional: false,
          required: true,
          description: 'Auto-import completed projects to CV as work experience',
          impact: 'critical',
          plan: 'basic',
          dependencies: ['resume-builder'],
        },
        'resume-keywords': {
          enabled: true,
          optional: false,
          required: true,
          description: 'Keyword optimization for ATS compatibility',
          impact: 'high',
          plan: 'basic',
          dependencies: ['ats-optimization'],
        },
        'resume-multilingual': {
          enabled: false,
          optional: true,
          required: false,
          description: 'Multi-language CV support (Norwegian, English, etc.)',
          impact: 'medium',
          plan: 'pro',
          dependencies: ['resume-builder'],
        },

        // ============================================
        // MARKETPLACE - EXTRA TOOLS (PAY-AS-YOU-GO)
        // ============================================
        // These features are NOT part of any plan - users purchase separately

        // AI Premium Tools (Marketplace)
        'ai-advanced-paraphrase': {
          enabled: false,
          optional: true,
          required: false,
          description: 'Advanced paraphrase with 15+ modes including industry-specific styles',
          impact: 'high',
          plan: 'marketplace',
          dependencies: ['ai-resume-writing'],
          marketplacePrice: 49, // NOK per month
          marketplaceCategory: 'ai-tools',
          marketplaceTrial: 7,
          marketplacePopular: true,
        },
        'ai-cv-optimizer-pro': {
          enabled: false,
          optional: true,
          required: false,
          description:
            'Professional AI CV optimization with industry benchmarking and competitive analysis',
          impact: 'critical',
          plan: 'marketplace',
          dependencies: ['resume-builder'],
          marketplacePrice: 99,
          marketplaceCategory: 'ai-tools',
          marketplaceTrial: 14,
          marketplacePopular: true,
        },
        'ai-interview-prep': {
          enabled: false,
          optional: true,
          required: false,
          description: 'AI-powered interview preparation based on your CV and job description',
          impact: 'high',
          plan: 'marketplace',
          dependencies: ['resume-builder'],
          marketplacePrice: 79,
          marketplaceCategory: 'ai-tools',
          marketplaceTrial: 7,
          marketplacePopular: false,
        },

        // Integration Tools (Marketplace)
        'linkedin-auto-sync': {
          enabled: false,
          optional: true,
          required: false,
          description:
            'Auto-sync CV with LinkedIn profile - Import profile data, experience, education, skills, and certifications',
          impact: 'high',
          plan: 'marketplace',
          dependencies: ['resume-builder'],
          marketplacePrice: 59,
          marketplaceCategory: 'integrations',
          marketplaceTrial: 14,
          marketplacePopular: true,
        },
        'linkedin-oauth-integration': {
          enabled: false,
          optional: true,
          required: false,
          description: 'LinkedIn OAuth authentication and profile sync with selective import',
          impact: 'high',
          plan: 'marketplace',
          dependencies: ['resume-builder'],
          marketplacePrice: 59,
          marketplaceCategory: 'integrations',
          marketplaceTrial: 14,
          marketplacePopular: true,
        },
        'indeed-quick-apply': {
          enabled: false,
          optional: true,
          required: false,
          description: 'One-click apply to Indeed.com jobs with auto-filled CV',
          impact: 'high',
          plan: 'marketplace',
          dependencies: ['resume-builder', 'job-application-tracking'],
          marketplacePrice: 39,
          marketplaceCategory: 'integrations',
          marketplaceTrial: 7,
          marketplacePopular: false,
        },
        'finn-no-integration': {
          enabled: false,
          optional: true,
          required: false,
          description: 'Direct integration with finn.no job portal for Norwegian market',
          impact: 'high',
          plan: 'marketplace',
          dependencies: ['resume-builder', 'norwegian-job-portals'],
          marketplacePrice: 69,
          marketplaceCategory: 'integrations',
          marketplaceTrial: 14,
          marketplacePopular: true,
        },
        'nav-no-integration': {
          enabled: false,
          optional: true,
          required: false,
          description:
            'NAV.no integration for Norwegian unemployment benefits and job applications',
          impact: 'high',
          plan: 'marketplace',
          dependencies: ['resume-builder', 'norwegian-job-portals'],
          marketplacePrice: 49,
          marketplaceCategory: 'integrations',
          marketplaceTrial: 14,
          marketplacePopular: false,
        },

        // Automation Tools (Marketplace)
        'auto-job-alerts': {
          enabled: false,
          optional: true,
          required: false,
          description: 'AI-powered job alerts matching your CV profile across multiple portals',
          impact: 'high',
          plan: 'marketplace',
          dependencies: ['resume-builder', 'job-application-tracking'],
          marketplacePrice: 89,
          marketplaceCategory: 'automation',
          marketplaceTrial: 14,
          marketplacePopular: true,
        },
        'auto-cv-tailoring': {
          enabled: false,
          optional: true,
          required: false,
          description: 'Automatically tailor your CV to each job description with AI',
          impact: 'critical',
          plan: 'marketplace',
          dependencies: ['ai-resume-writing'],
          marketplacePrice: 129,
          marketplaceCategory: 'automation',
          marketplaceTrial: 7,
          marketplacePopular: true,
        },
        'follow-up-automation': {
          enabled: false,
          optional: true,
          required: false,
          description: 'Automated follow-up emails after job applications',
          impact: 'medium',
          plan: 'marketplace',
          dependencies: ['job-application-tracking'],
          marketplacePrice: 59,
          marketplaceCategory: 'automation',
          marketplaceTrial: 14,
          marketplacePopular: false,
        },

        // Analytics Tools (Marketplace)
        'cv-performance-dashboard': {
          enabled: false,
          optional: true,
          required: false,
          description:
            'Advanced analytics dashboard with application success rate, view tracking, and insights',
          impact: 'high',
          plan: 'marketplace',
          dependencies: ['resume-builder', 'resume-analytics'],
          marketplacePrice: 79,
          marketplaceCategory: 'analytics',
          marketplaceTrial: 14,
          marketplacePopular: false,
        },
        'recruiter-insights': {
          enabled: false,
          optional: true,
          required: false,
          description:
            'Track who viewed your CV, time spent, and sections viewed (requires public URL)',
          impact: 'high',
          plan: 'marketplace',
          dependencies: ['resume-sharing'],
          marketplacePrice: 99,
          marketplaceCategory: 'analytics',
          marketplaceTrial: 7,
          marketplacePopular: true,
        },
        'industry-benchmarking': {
          enabled: false,
          optional: true,
          required: false,
          description: 'Compare your CV against industry standards and get competitive insights',
          impact: 'medium',
          plan: 'marketplace',
          dependencies: ['resume-builder'],
          marketplacePrice: 69,
          marketplaceCategory: 'analytics',
          marketplaceTrial: 14,
          marketplacePopular: false,
        },

        // Premium Templates (Marketplace)
        'premium-designer-templates': {
          enabled: false,
          optional: true,
          required: false,
          description: 'Access to 50+ premium designer CV templates',
          impact: 'medium',
          plan: 'marketplace',
          dependencies: ['resume-builder'],
          marketplacePrice: 149, // One-time payment
          marketplaceCategory: 'premium-templates',
          marketplaceTrial: 0,
          marketplacePopular: true,
        },
        'industry-specific-templates': {
          enabled: false,
          optional: true,
          required: false,
          description:
            'Industry-specific CV templates (Tech, Healthcare, Finance, Creative, Legal, etc.)',
          impact: 'high',
          plan: 'marketplace',
          dependencies: ['resume-builder'],
          marketplacePrice: 99, // One-time payment
          marketplaceCategory: 'premium-templates',
          marketplaceTrial: 0,
          marketplacePopular: false,
        },
        'video-cv-builder': {
          enabled: false,
          optional: true,
          required: false,
          description: 'Create video CVs with recording, editing, and hosting',
          impact: 'high',
          plan: 'marketplace',
          dependencies: ['resume-builder'],
          marketplacePrice: 199,
          marketplaceCategory: 'advanced-features',
          marketplaceTrial: 7,
          marketplacePopular: false,
        },

        // Advanced Features (Marketplace)
        'cv-website-generator': {
          enabled: false,
          optional: true,
          required: false,
          description: 'Generate a professional personal website from your CV',
          impact: 'high',
          plan: 'marketplace',
          dependencies: ['resume-builder'],
          marketplacePrice: 149,
          marketplaceCategory: 'advanced-features',
          marketplaceTrial: 14,
          marketplacePopular: true,
        },
        'professional-headshot-ai': {
          enabled: false,
          optional: true,
          required: false,
          description: 'AI-generated professional headshots for your CV',
          impact: 'medium',
          plan: 'marketplace',
          dependencies: ['resume-builder'],
          marketplacePrice: 49, // One-time per generation
          marketplaceCategory: 'advanced-features',
          marketplaceTrial: 0,
          marketplacePopular: true,
        },
        'career-path-analyzer': {
          enabled: false,
          optional: true,
          required: false,
          description: 'AI career path analysis and salary predictions based on your CV',
          impact: 'high',
          plan: 'marketplace',
          dependencies: ['resume-builder'],
          marketplacePrice: 89,
          marketplaceCategory: 'analytics',
          marketplaceTrial: 7,
          marketplacePopular: false,
        },
        'skill-gap-analysis': {
          enabled: false,
          optional: true,
          required: false,
          description: 'Identify skill gaps and get learning recommendations for target roles',
          impact: 'high',
          plan: 'marketplace',
          dependencies: ['resume-builder'],
          marketplacePrice: 79,
          marketplaceCategory: 'analytics',
          marketplaceTrial: 14,
          marketplacePopular: false,
        },

        // ============================================
        // SCROLL STORY - ADVANCED CONTENT FEATURE
        // ============================================
        'scroll-story': {
          enabled: false,
          optional: true,
          required: false,
          description:
            'Advanced scroll-based storytelling component with animations, parallax, keyboard navigation, and media preloading',
          impact: 'high',
          plan: 'marketplace',
          dependencies: ['universal-showcase'],
          marketplacePrice: 149,
          marketplaceCategory: 'advanced-features',
          marketplaceTrial: 14,
          marketplacePopular: true,
          developmentStatus: 'complete',
          completionPercentage: 100,
          missingFeatures: [],
          technicalDebt: [],
        },
        'scroll-story-animations': {
          enabled: false,
          optional: true,
          required: false,
          description: 'GPU-accelerated scroll animations with custom easing and timing',
          impact: 'medium',
          plan: 'marketplace',
          dependencies: ['scroll-story'],
          marketplacePrice: 49,
          marketplaceCategory: 'advanced-features',
          marketplaceTrial: 7,
          marketplacePopular: false,
        },
        'scroll-story-parallax': {
          enabled: false,
          optional: true,
          required: false,
          description: 'Parallax scrolling effects for immersive storytelling',
          impact: 'medium',
          plan: 'marketplace',
          dependencies: ['scroll-story'],
          marketplacePrice: 39,
          marketplaceCategory: 'advanced-features',
          marketplaceTrial: 7,
          marketplacePopular: false,
        },
        'scroll-story-media-preload': {
          enabled: false,
          optional: true,
          required: false,
          description: 'Smart media preloading for smooth video/image playback',
          impact: 'medium',
          plan: 'marketplace',
          dependencies: ['scroll-story'],
          marketplacePrice: 29,
          marketplaceCategory: 'advanced-features',
          marketplaceTrial: 7,
          marketplacePopular: false,
        },

        // ============================================
        // SEO AUTOMATION SUITE + DEPENDENCY TRACKING
        // ============================================
        'seo-schema-validation': {
          enabled: true,
          optional: false,
          required: false,
          description: 'Schema.org validation with Google Rich Results Test API',
          impact: 'high',
          plan: 'basic',
          dependencies: [],
        },
        'seo-google-business-extraction': {
          enabled: false,
          optional: true,
          required: false,
          description: 'Auto-extract address, phone, reviews from Google Business Profile',
          impact: 'critical',
          plan: 'pro',
          dependencies: ['seo-schema-validation'],
        },
        'seo-auto-fix': {
          enabled: false,
          optional: true,
          required: false,
          description: 'AI-powered auto-fix for missing schema fields',
          impact: 'high',
          plan: 'basic',
          dependencies: ['seo-schema-validation'],
        },
        'seo-bot-detection': {
          enabled: true,
          optional: true,
          required: false,
          description: 'Detect and analyze 50+ bots (Googlebot, Screaming Frog, etc.)',
          impact: 'medium',
          plan: 'basic',
          dependencies: [],
        },
        'seo-render-tests': {
          enabled: false,
          optional: true,
          required: false,
          description: 'JavaScript rendering tests with real browsers',
          impact: 'medium',
          plan: 'basic',
          dependencies: ['seo-bot-detection'],
        },
        'seo-mobile-usability': {
          enabled: false,
          optional: true,
          required: false,
          description: 'Mobile usability testing (3 device emulations)',
          impact: 'medium',
          plan: 'basic',
          dependencies: ['seo-render-tests'],
        },
        'seo-best-practices-research': {
          enabled: false,
          optional: true,
          required: false,
          description: 'Research top brand SEO patterns (Amazon, Finn.no, etc.)',
          impact: 'high',
          plan: 'pro',
          dependencies: ['seo-auto-fix'],
        },
        'seo-norwegian-optimization': {
          enabled: true,
          optional: false,
          required: false,
          description: 'Norwegian-specific SEO optimization (language, address, phone)',
          impact: 'critical',
          plan: 'basic',
          dependencies: ['seo-schema-validation'],
        },
        'seo-cloudflare-bypass': {
          enabled: false,
          optional: true,
          required: false,
          description: 'Bypass Cloudflare protection for data extraction',
          impact: 'high',
          plan: 'pro',
          dependencies: ['seo-schema-validation'],
        },
        'seo-crawl-budget-optimizer': {
          enabled: false,
          optional: true,
          required: false,
          description: 'Optimize crawl budget and bot efficiency',
          impact: 'medium',
          plan: 'pro',
          dependencies: ['seo-bot-detection'],
        },
        'seo-monthly-reports': {
          enabled: false,
          optional: true,
          required: false,
          description: 'Automated monthly SEO performance reports',
          impact: 'medium',
          plan: 'pro',
          dependencies: ['seo-schema-validation'],
        },
        'seo-interactive-tutorial': {
          enabled: true,
          optional: false,
          required: false,
          description: 'Interactive 6-step SEO optimization tutorial',
          impact: 'low',
          plan: 'basic',
          dependencies: [],
        },
        'seo-multi-client-management': {
          enabled: false,
          optional: true,
          required: false,
          description: 'Manage SEO for up to 10 client websites',
          impact: 'high',
          plan: 'enterprise',
          dependencies: ['seo-schema-validation'],
        },
        'seo-white-label-reports': {
          enabled: false,
          optional: true,
          required: false,
          description: 'White-label SEO reports with custom branding',
          impact: 'medium',
          plan: 'enterprise',
          dependencies: ['seo-monthly-reports', 'seo-multi-client-management'],
        },
        'seo-api-access': {
          enabled: false,
          optional: true,
          required: false,
          description: 'REST API access for SEO automation',
          impact: 'medium',
          plan: 'enterprise',
          dependencies: ['seo-schema-validation'],
        },
        // ============================================
        // FIKEN ACCOUNTING INTEGRATION (PRO PLAN ONLY)
        // ============================================
        'fiken-integration': {
          enabled: false,
          optional: true,
          required: false,
          description: 'Connect to Fiken.no for automated accounting and invoicing',
          impact: 'critical',
          plan: 'pro',
          dependencies: [],
          beta: true,
        },
        'fiken-invoice-sync': {
          enabled: false,
          optional: true,
          required: false,
          description: 'Automatically sync quotes and contracts to Fiken invoices',
          impact: 'high',
          plan: 'pro',
          dependencies: ['fiken-integration'],
        },
        'fiken-customer-sync': {
          enabled: false,
          optional: true,
          required: false,
          description: 'Sync client profiles with Fiken customer registry',
          impact: 'medium',
          plan: 'pro',
          dependencies: ['fiken-integration'],
        },
        'fiken-product-catalog': {
          enabled: false,
          optional: true,
          required: false,
          description: 'Import Fiken products as service templates',
          impact: 'medium',
          plan: 'pro',
          dependencies: ['fiken-integration'],
        },
        'fiken-accounting-reports': {
          enabled: false,
          optional: true,
          required: false,
          description: 'View accounting reports and financial analytics from Fiken',
          impact: 'high',
          plan: 'pro',
          dependencies: ['fiken-integration'],
        },
        'fiken-auto-payment-tracking': {
          enabled: false,
          optional: true,
          required: false,
          description: 'Automatically mark invoices as paid when payment received in Fiken',
          impact: 'high',
          plan: 'pro',
          dependencies: ['fiken-invoice-sync'],
        },
        'fiken-tax-calculation': {
          enabled: false,
          optional: true,
          required: false,
          description: 'Norwegian VAT and tax calculation using Fiken rules',
          impact: 'critical',
          plan: 'pro',
          dependencies: ['fiken-integration'],
        },
        'fiken-bankid-signing': {
          enabled: false,
          optional: true,
          required: false,
          description: 'BankID signing integration for contracts (via Fiken partner)',
          impact: 'critical',
          plan: 'pro',
          dependencies: ['fiken-integration', 'fiken-invoice-sync'],
        },

        // ============================================
        // UNIVERSAL FEATURES + DEPENDENCY TRACKING
        // ============================================
        'showcase-sharing': {
          enabled: true,
          optional: false,
          required: false,
          description: 'Share showcases with clients via email',
          impact: 'high',
          plan: 'basic',
          dependencies: [],
        },
        'google-drive-sync': {
          enabled: false,
          optional: true,
          required: false,
          description: 'Google Drive automatic sync with folder structure',
          impact: 'medium',
          plan: 'pro',
          dependencies: [],
        },
        'google-contacts-sync': {
          enabled: false,
          optional: true,
          required: false,
          description: 'Google Contacts/People API integration',
          impact: 'low',
          plan: 'pro',
          dependencies: [],
        },
        'real-time-collaboration': {
          enabled: false,
          optional: true,
          required: false,
          description: 'Real-time collaboration and co-editing',
          impact: 'medium',
          plan: 'enterprise',
          dependencies: ['websocket-realtime'],
        },
        'command-palette': {
          enabled: true,
          optional: true,
          required: false,
          description: 'Command palette for quick actions',
          impact: 'low',
          plan: 'basic',
          dependencies: [],
        },
        'keyboard-shortcuts': {
          enabled: true,
          optional: true,
          required: false,
          description: 'Keyboard shortcuts for power users',
          impact: 'low',
          plan: 'basic',
          dependencies: [],
        },
        'showcase-customization': {
          enabled: true,
          optional: true,
          required: false,
          description: 'Extensive showcase customization options',
          impact: 'medium',
          plan: 'basic',
          dependencies: [],
        },
        'overage-management': {
          enabled: true,
          optional: true,
          required: false,
          description: 'Contract overage detection and management',
          impact: 'medium',
          plan: 'basic',
          dependencies: [],
        },
        'publish-to-academy': {
          enabled: false,
          optional: true,
          required: false,
          description: 'Publish showcase content to Academy courses',
          impact: 'high',
          plan: 'pro',
          dependencies: [],
        },
        // PWA & Mobile Features (Universal)
        'pwa-install': {
          enabled: true,
          optional: false,
          required: true,
          description: 'Progressive Web App with install to home screen',
          impact: 'high',
          plan: 'basic',
          dependencies: [],
        },
        'service-worker-offline': {
          enabled: true,
          optional: false,
          required: true,
          description: 'Service worker with offline support and background sync',
          impact: 'high',
          plan: 'basic',
          dependencies: ['pwa-install'],
        },
        'push-notifications': {
          enabled: true,
          optional: false,
          required: true,
          description: 'Browser push notifications for real-time updates',
          impact: 'high',
          plan: 'basic',
          dependencies: ['pwa-install', 'service-worker-offline'],
        },
        'websocket-realtime': {
          enabled: true,
          optional: false,
          required: true,
          description: 'WebSocket real-time communication and updates',
          impact: 'critical',
          plan: 'basic',
          dependencies: [],
        },
        'ai-suggestions-toggle': {
          enabled: true,
          optional: false,
          required: false,
          description: 'AI research-backed suggestions toggle (6,086 papers, 30 categories)',
          impact: 'high',
          plan: 'basic',
          dependencies: [],
        },

        // ============================================
        // EMAIL MARKETING SUITE
        // ============================================
        'email-marketing-manager': {
          enabled: false,
          optional: true,
          required: false,
          description: 'Email marketing campaign manager with templates and automation',
          impact: 'high',
          plan: 'pro',
          dependencies: [],
        },
        'email-designer': {
          enabled: false,
          optional: true,
          required: false,
          description: 'Visual email designer with drag-and-drop builder',
          impact: 'high',
          plan: 'pro',
          dependencies: ['email-marketing-manager'],
        },
        'lead-generation-system': {
          enabled: false,
          optional: true,
          required: false,
          description: 'Lead capture, qualification, and nurturing automation',
          impact: 'critical',
          plan: 'pro',
          dependencies: [],
        },
        'email-analytics-dashboard': {
          enabled: false,
          optional: true,
          required: false,
          description: 'Email campaign analytics with open rates, clicks, and conversions',
          impact: 'high',
          plan: 'pro',
          dependencies: ['email-marketing-manager'],
        },
        'customer-inquiry-center': {
          enabled: true,
          optional: false,
          required: false,
          description: 'Customer inquiry management and response system',
          impact: 'high',
          plan: 'basic',
          dependencies: [],
        },

        // ============================================
        // SOCIAL MEDIA MANAGEMENT SUITE
        // ============================================
        'social-media-integration': {
          enabled: false,
          optional: true,
          required: false,
          description: 'Instagram, Facebook, TikTok, YouTube integration',
          impact: 'critical',
          plan: 'pro',
          dependencies: [],
        },
        'social-media-algorithm-optimizer': {
          enabled: false,
          optional: true,
          required: false,
          description: 'AI-powered algorithm optimizer for maximum reach',
          impact: 'high',
          plan: 'pro',
          dependencies: ['social-media-integration'],
        },
        'social-media-scheduler': {
          enabled: false,
          optional: true,
          required: false,
          description: 'Content scheduler with best-time posting',
          impact: 'high',
          plan: 'pro',
          dependencies: ['social-media-integration'],
        },
        'social-media-formats': {
          enabled: false,
          optional: true,
          required: false,
          description: 'Pre-configured formats for Reels, Stories, Posts, TikTok',
          impact: 'high',
          plan: 'pro',
          dependencies: ['social-media-integration'],
        },
        'viral-content-creator': {
          enabled: false,
          optional: true,
          required: false,
          description: 'AI viral content creator with trend analysis',
          impact: 'high',
          plan: 'enterprise',
          dependencies: ['social-media-integration'],
        },
        'influencer-partnership-platform': {
          enabled: false,
          optional: true,
          required: false,
          description: 'Influencer discovery, outreach, and partnership management',
          impact: 'medium',
          plan: 'enterprise',
          dependencies: ['social-media-integration'],
        },

        // ============================================
        // ACADEMY / LEARNING MANAGEMENT SYSTEM (LMS)
        // ============================================
        'academy-platform': {
          enabled: false,
          optional: true,
          required: false,
          description: 'Complete Learning Management System for course creation',
          impact: 'critical',
          plan: 'enterprise',
          dependencies: [],
        },
        'academy-course-creator': {
          enabled: false,
          optional: true,
          required: false,
          description: 'Course creation and management tools',
          impact: 'critical',
          plan: 'enterprise',
          dependencies: ['academy-platform'],
        },
        'academy-video-chapters': {
          enabled: false,
          optional: true,
          required: false,
          description: 'Video chapter management and annotations',
          impact: 'high',
          plan: 'enterprise',
          dependencies: ['academy-platform'],
        },
        'academy-enrollment-payments': {
          enabled: false,
          optional: true,
          required: false,
          description: 'Student enrollment system with payment processing',
          impact: 'critical',
          plan: 'enterprise',
          dependencies: ['academy-platform'],
        },
        'academy-instructor-revenue': {
          enabled: false,
          optional: true,
          required: false,
          description: 'Instructor revenue dashboard with analytics',
          impact: 'high',
          plan: 'enterprise',
          dependencies: ['academy-platform', 'academy-enrollment-payments'],
        },
        'academy-cta-overlays': {
          enabled: false,
          optional: true,
          required: false,
          description: 'CTA overlays and animated lower thirds for video content',
          impact: 'medium',
          plan: 'enterprise',
          dependencies: ['academy-platform'],
        },
        'academy-asset-browser': {
          enabled: false,
          optional: true,
          required: false,
          description: 'Asset browser for course materials and resources',
          impact: 'high',
          plan: 'enterprise',
          dependencies: ['academy-platform'],
        },

        // ============================================
        // BUSINESS INTELLIGENCE & ANALYTICS
        // ============================================
        'business-intelligence-dashboard': {
          enabled: false,
          optional: true,
          required: false,
          description: 'Comprehensive business intelligence dashboard with KPIs',
          impact: 'critical',
          plan: 'pro',
          dependencies: [],
        },
        'client-insights-dashboard': {
          enabled: false,
          optional: true,
          required: false,
          description: 'Client behavior insights and analytics',
          impact: 'high',
          plan: 'pro',
          dependencies: ['business-intelligence-dashboard'],
        },
        'performance-analytics-dashboard': {
          enabled: false,
          optional: true,
          required: false,
          description: 'Performance metrics and productivity analytics',
          impact: 'high',
          plan: 'pro',
          dependencies: ['business-intelligence-dashboard'],
        },
        'equipment-analytics': {
          enabled: false,
          optional: true,
          required: false,
          description: 'Equipment usage tracking and ROI analysis',
          impact: 'medium',
          plan: 'pro',
          dependencies: [],
        },

        // ============================================
        // MARKETING AUTOMATION ENGINE
        // ============================================
        'marketing-automation-engine': {
          enabled: false,
          optional: true,
          required: false,
          description: 'Complete marketing automation with workflows and triggers',
          impact: 'critical',
          plan: 'enterprise',
          dependencies: [],
        },
        'content-marketing-engine': {
          enabled: false,
          optional: true,
          required: false,
          description: 'Content marketing planning and distribution automation',
          impact: 'high',
          plan: 'enterprise',
          dependencies: ['marketing-automation-engine'],
        },
        'referral-growth-system': {
          enabled: false,
          optional: true,
          required: false,
          description: 'Referral program management with tracking and rewards',
          impact: 'high',
          plan: 'pro',
          dependencies: [],
        },
        'events-management-platform': {
          enabled: false,
          optional: true,
          required: false,
          description: 'Event planning, promotion, and attendance tracking',
          impact: 'high',
          plan: 'pro',
          dependencies: [],
        },
        'viral-portfolio-engine': {
          enabled: false,
          optional: true,
          required: false,
          description: 'AI-powered viral portfolio optimization and sharing',
          impact: 'high',
          plan: 'enterprise',
          dependencies: ['social-media-integration'],
        },

        // ============================================
        // ADVANCED NOTES SYSTEM
        // ============================================
        'advanced-notes-system': {
          enabled: false,
          optional: true,
          required: false,
          description: 'Advanced notes with AI enhancement and collaboration',
          impact: 'high',
          plan: 'basic',
          dependencies: [],
        },
        'ai-content-analyzer': {
          enabled: false,
          optional: true,
          required: false,
          description: 'AI content analysis for notes and documents',
          impact: 'high',
          plan: 'pro',
          dependencies: ['advanced-notes-system'],
        },
        'ai-writing-suggestions': {
          enabled: false,
          optional: true,
          required: false,
          description: 'AI-powered writing suggestions and improvements',
          impact: 'high',
          plan: 'pro',
          dependencies: ['advanced-notes-system'],
        },
        'smart-content-generator': {
          enabled: false,
          optional: true,
          required: false,
          description: 'AI smart content generation for notes and documents',
          impact: 'high',
          plan: 'pro',
          dependencies: ['advanced-notes-system'],
        },
        'document-importer': {
          enabled: false,
          optional: true,
          required: false,
          description: 'Import documents from Word, PDF, Google Docs',
          impact: 'medium',
          plan: 'basic',
          dependencies: ['advanced-notes-system'],
        },
        'notes-version-control': {
          enabled: false,
          optional: true,
          required: false,
          description: 'Version control for notes with history and restore',
          impact: 'medium',
          plan: 'pro',
          dependencies: ['advanced-notes-system'],
        },

        // ============================================
        // CMS & VISUAL EDITOR
        // ============================================
        'visual-cms-template-system': {
          enabled: false,
          optional: true,
          required: false,
          description: 'Visual CMS template system for profession customization',
          impact: 'critical',
          plan: 'enterprise',
          dependencies: [],
        },
        'feature-management-panel': {
          enabled: false,
          optional: true,
          required: false,
          description: 'Feature management and toggle system for admins',
          impact: 'high',
          plan: 'enterprise',
          dependencies: [],
        },
        'profession-cms-manager': {
          enabled: false,
          optional: true,
          required: false,
          description: 'Profession-specific CMS management and configuration',
          impact: 'high',
          plan: 'enterprise',
          dependencies: ['visual-cms-template-system'],
        },

        // ============================================
        // BRING SHIPPING INTEGRATION (Norwegian)
        // ============================================
        'bring-shipping-integration': {
          enabled: false,
          optional: true,
          required: false,
          description: 'Bring.no shipping integration for Norwegian market',
          impact: 'high',
          plan: 'pro',
          dependencies: [],
        },
        'bring-package-tracking': {
          enabled: false,
          optional: true,
          required: false,
          description: 'Real-time package tracking with Bring API',
          impact: 'high',
          plan: 'pro',
          dependencies: ['bring-shipping-integration'],
        },
        'bring-postal-code-validator': {
          enabled: false,
          optional: true,
          required: false,
          description: 'Norwegian postal code validation',
          impact: 'medium',
          plan: 'pro',
          dependencies: ['bring-shipping-integration'],
        },
        'bring-shipping-calculator': {
          enabled: false,
          optional: true,
          required: false,
          description: 'Shipping cost calculator with Bring rates',
          impact: 'high',
          plan: 'pro',
          dependencies: ['bring-shipping-integration'],
        },

        // ============================================
        // OTHER ADVANCED FEATURES
        // ============================================
        'toll-calculation-travel': {
          enabled: false,
          optional: true,
          required: false,
          description: 'Automatic toll calculation for travel expenses',
          impact: 'medium',
          plan: 'pro',
          dependencies: [],
        },
        'vehicle-registry': {
          enabled: false,
          optional: true,
          required: false,
          description: 'Vehicle registry with maintenance tracking',
          impact: 'medium',
          plan: 'basic',
          dependencies: [],
        },
        'gdpr-compliance-panel': {
          enabled: true,
          optional: false,
          required: false,
          description: 'GDPR compliance management and data protection',
          impact: 'critical',
          plan: 'basic',
          dependencies: [],
        },
        'memory-card-backup-pricing': {
          enabled: false,
          optional: true,
          required: false,
          description: 'Memory card backup management with pricing calculator',
          impact: 'medium',
          plan: 'pro',
          dependencies: [],
        },
        'firmware-management': {
          enabled: false,
          optional: true,
          required: false,
          description: 'Camera and equipment firmware management',
          impact: 'medium',
          plan: 'pro',
          dependencies: [],
        },
        'neural-engine-analyzer': {
          enabled: false,
          optional: true,
          required: false,
          description: 'Apple Neural Engine performance analyzer',
          impact: 'low',
          plan: 'enterprise',
          dependencies: [],
        },
        'property-analysis': {
          enabled: false,
          optional: true,
          required: false,
          description: 'Real estate property analysis for location shoots',
          impact: 'low',
          plan: 'pro',
          dependencies: [],
        },

        // ============================================
        // WHITE-LABEL BRANDING SYSTEM
        // ============================================
        'white-label-branding': {
          enabled: true,
          optional: false,
          required: false,
          description:
            'Complete white-label branding system with custom logo, colors, and business identity',
          impact: 'critical',
          plan: 'pro',
          dependencies: [],
        },
        'custom-logo-upload': {
          enabled: true,
          optional: false,
          required: false,
          description: 'Upload and manage custom business logo for branding',
          impact: 'high',
          plan: 'pro',
          dependencies: ['white-label-branding'],
        },
        'brand-color-customization': {
          enabled: true,
          optional: false,
          required: false,
          description: 'Customize brand colors with automatic light/dark mode variants',
          impact: 'high',
          plan: 'pro',
          dependencies: ['white-label-branding'],
        },
        'custom-domain-setup': {
          enabled: true,
          optional: true,
          required: false,
          description: 'Configure custom domain with DNS verification and SSL',
          impact: 'critical',
          plan: 'enterprise',
          dependencies: ['white-label-branding'],
        },
        'dns-verification-system': {
          enabled: true,
          optional: true,
          required: false,
          description: 'Automated DNS verification with step-by-step instructions',
          impact: 'high',
          plan: 'enterprise',
          dependencies: ['custom-domain-setup'],
        },
        'branded-theme-generator': {
          enabled: true,
          optional: false,
          required: false,
          description: 'Auto-generate MUI theme from brand colors with full component styling',
          impact: 'critical',
          plan: 'pro',
          dependencies: ['white-label-branding', 'brand-color-customization'],
        },
        'branded-client-portal': {
          enabled: true,
          optional: false,
          required: false,
          description: 'Fully branded client portal with custom logo and colors',
          impact: 'critical',
          plan: 'pro',
          dependencies: ['white-label-branding', 'branded-theme-generator'],
        },
        'branded-contracts': {
          enabled: true,
          optional: false,
          required: false,
          description: 'Branded contract templates with custom logo and colors',
          impact: 'critical',
          plan: 'pro',
          dependencies: ['white-label-branding'],
        },
        'branded-invoices': {
          enabled: true,
          optional: false,
          required: false,
          description: 'Branded invoice templates with business identity',
          impact: 'high',
          plan: 'pro',
          dependencies: ['white-label-branding'],
        },
        'branded-email-templates': {
          enabled: true,
          optional: false,
          required: false,
          description: 'Branded email templates for client communication',
          impact: 'high',
          plan: 'pro',
          dependencies: ['white-label-branding'],
        },
        'hide-creatorhub-branding': {
          enabled: true,
          optional: true,
          required: false,
          description: 'Option to hide CreatorHub branding on client-facing pages',
          impact: 'high',
          plan: 'enterprise',
          dependencies: ['white-label-branding'],
        },
        'custom-footer-text': {
          enabled: true,
          optional: true,
          required: false,
          description: 'Customize footer text on client-facing pages',
          impact: 'medium',
          plan: 'pro',
          dependencies: ['white-label-branding'],
        },
        'branded-galleries': {
          enabled: true,
          optional: false,
          required: false,
          description: 'Fully branded photo/video galleries with custom domain support',
          impact: 'critical',
          plan: 'pro',
          dependencies: ['white-label-branding', 'branded-theme-generator'],
        },
        'branding-preview': {
          enabled: true,
          optional: false,
          required: false,
          description: 'Real-time branding preview during onboarding',
          impact: 'medium',
          plan: 'pro',
          dependencies: ['white-label-branding'],
        },
        'white-label-analytics': {
          enabled: false,
          optional: true,
          required: false,
          description: 'Analytics for branded pages (views, engagement, conversions)',
          impact: 'high',
          plan: 'enterprise',
          dependencies: ['white-label-branding', 'branded-client-portal'],
        },

        // ============================================
        // LIGHTROOM & PHOTO PLUGINS
        // ============================================
        'lightroom-plugin-integration': {
          enabled: false,
          optional: true,
          required: false,
          description: 'Adobe Lightroom plugin integration with CreatorHub',
          impact: 'high',
          plan: 'pro',
          dependencies: ['bulk-image-operations'],
        },
        'lightroom-sync-export': {
          enabled: false,
          optional: true,
          required: false,
          description: 'Lightroom sync and export to CreatorHub showcases',
          impact: 'high',
          plan: 'pro',
          dependencies: ['lightroom-plugin-integration'],
        },
        'lightroom-interactive-demo': {
          enabled: false,
          optional: true,
          required: false,
          description: 'Interactive Lightroom workflow demonstration and tutorials',
          impact: 'low',
          plan: 'pro',
          dependencies: ['lightroom-plugin-integration'],
        },

        // ============================================
        // SMART MEETING NOTES
        // ============================================
        'smart-meeting-notes': {
          enabled: false,
          optional: true,
          required: false,
          description: 'AI-powered meeting notes with real-time transcription',
          impact: 'high',
          plan: 'pro',
          dependencies: [],
          developmentStatus: 'complete',
          completionPercentage: 100,
        },

        // ============================================
        // COMMUNICATION & CHAT
        // ============================================
        'chat-widget': {
          enabled: false,
          optional: true,
          required: false,
          description: 'Universal chat widget for client communication',
          impact: 'medium',
          plan: 'basic',
          dependencies: [],
          developmentStatus: 'complete',
          completionPercentage: 100,
        },
        'chat-with-privacy': {
          enabled: false,
          optional: true,
          required: false,
          description: 'Privacy-focused chat with end-to-end encryption',
          impact: 'high',
          plan: 'pro',
          dependencies: ['chat-widget'],
          developmentStatus: 'complete',
          completionPercentage: 100,
        },
        'universal-chat-widget': {
          enabled: false,
          optional: true,
          required: false,
          description: 'Unified chat widget supporting multiple channels',
          impact: 'medium',
          plan: 'basic',
          dependencies: [],
          developmentStatus: 'complete',
          completionPercentage: 100,
        },
        'crm-assistant': {
          enabled: false,
          optional: true,
          required: false,
          description: 'AI-powered CRM assistant for client management',
          impact: 'high',
          plan: 'pro',
          dependencies: ['universal-chat-widget'],
          developmentStatus: 'complete',
          completionPercentage: 100,
        },

        // ============================================
        // CALENDAR & EVENTS
        // ============================================
        'calendar-conflict-checker': {
          enabled: false,
          optional: true,
          required: false,
          description: 'Automatic calendar conflict detection and resolution',
          impact: 'high',
          plan: 'basic',
          dependencies: [],
          developmentStatus: 'complete',
          completionPercentage: 100,
        },
        'universal-calendar-widget': {
          enabled: false,
          optional: true,
          required: false,
          description: 'Universal calendar widget with multi-calendar support',
          impact: 'medium',
          plan: 'basic',
          dependencies: [],
          developmentStatus: 'complete',
          completionPercentage: 100,
        },
        'upcoming-events-countdown-view': {
          enabled: false,
          optional: true,
          required: false,
          description: 'Countdown view for upcoming events and deadlines',
          impact: 'low',
          plan: 'basic',
          dependencies: ['universal-calendar-widget'],
          developmentStatus: 'complete',
          completionPercentage: 100,
        },
        'countdown-widget': {
          enabled: false,
          optional: true,
          required: false,
          description: 'Customizable countdown widget for important dates',
          impact: 'low',
          plan: 'basic',
          dependencies: [],
          developmentStatus: 'complete',
          completionPercentage: 100,
        },

        // ============================================
        // ANALYTICS & DASHBOARDS
        // ============================================
        'analytics-dashboard': {
          enabled: false,
          optional: true,
          required: false,
          description: 'Comprehensive analytics dashboard with real-time data',
          impact: 'high',
          plan: 'pro',
          dependencies: [],
          developmentStatus: 'in-development',
          completionPercentage: 70,
        },
        'google-analytics-dashboard': {
          enabled: false,
          optional: true,
          required: false,
          description: 'Google Analytics integration and visualization',
          impact: 'medium',
          plan: 'pro',
          dependencies: [],
          developmentStatus: 'in-development',
          completionPercentage: 70,
        },
        'seo-analytics-dashboard': {
          enabled: false,
          optional: true,
          required: false,
          description: 'SEO metrics and search performance analytics',
          impact: 'high',
          plan: 'pro',
          dependencies: ['google-analytics-dashboard'],
          developmentStatus: 'in-development',
          completionPercentage: 70,
        },

        // ============================================
        // CONTRACT & CRM
        // ============================================
        'contract-manager': {
          enabled: false,
          optional: true,
          required: false,
          description: 'Contract management with templates and versioning',
          impact: 'high',
          plan: 'pro',
          dependencies: [],
          developmentStatus: 'beta',
          completionPercentage: 80,
        },
        'contract-signing': {
          enabled: false,
          optional: true,
          required: false,
          description: 'Electronic signature integration for contracts',
          impact: 'critical',
          plan: 'pro',
          dependencies: ['contract-manager'],
          developmentStatus: 'beta',
          completionPercentage: 80,
        },
        'universal-contract-hub': {
          enabled: false,
          optional: true,
          required: false,
          description: 'Centralized contract management hub',
          impact: 'high',
          plan: 'pro',
          dependencies: ['contract-manager'],
          developmentStatus: 'beta',
          completionPercentage: 80,
        },
        'contract-pricing-integration': {
          enabled: false,
          optional: true,
          required: false,
          description: 'Contract pricing calculator and package integration',
          impact: 'medium',
          plan: 'pro',
          dependencies: ['contract-manager'],
          developmentStatus: 'beta',
          completionPercentage: 80,
        },
        'universal-crm-dashboard': {
          enabled: false,
          optional: true,
          required: false,
          description: 'Universal CRM dashboard with client pipeline management',
          impact: 'high',
          plan: 'pro',
          dependencies: [],
          developmentStatus: 'beta',
          completionPercentage: 80,
        },

        // ============================================
        // WEDDING TIMELINE
        // ============================================
        'wedding-timeline-admin': {
          enabled: false,
          optional: true,
          required: false,
          description: 'Admin interface for wedding timeline management',
          impact: 'medium',
          plan: 'basic',
          dependencies: [],
          developmentStatus: 'complete',
          completionPercentage: 100,
        },
        'wedding-timeline-client': {
          enabled: false,
          optional: true,
          required: false,
          description: 'Client-facing wedding timeline viewer',
          impact: 'medium',
          plan: 'basic',
          dependencies: ['wedding-timeline-admin'],
          developmentStatus: 'complete',
          completionPercentage: 100,
        },
        'wedding-timeline-client-view': {
          enabled: false,
          optional: true,
          required: false,
          description: 'Enhanced wedding timeline client view with real-time updates',
          impact: 'medium',
          plan: 'basic',
          dependencies: ['wedding-timeline-client'],
          developmentStatus: 'complete',
          completionPercentage: 100,
        },
        'wedding-timeline-changes-overview': {
          enabled: false,
          optional: true,
          required: false,
          description: 'Timeline change tracking and notification system',
          impact: 'low',
          plan: 'basic',
          dependencies: ['wedding-timeline-admin'],
          developmentStatus: 'complete',
          completionPercentage: 100,
        },
        'wedding-code-entry': {
          enabled: false,
          optional: true,
          required: false,
          description: 'Wedding access code entry and authentication',
          impact: 'medium',
          plan: 'basic',
          dependencies: ['wedding-timeline-client'],
          developmentStatus: 'complete',
          completionPercentage: 100,
        },
      };
    }
  });

  return matrix;
}

// Generate the matrix
export const PROFESSION_FEATURE_MATRIX = generateProfessionFeatureMatrix();

// Helper functions
export function isProfessionFeatureAvailable(professionId: string, featureId: string): boolean {
  const professionConfig = PROFESSION_FEATURE_MATRIX[professionId];
  if (!professionConfig) return false;

  const feature = professionConfig.availableFeatures[featureId];
  return !!feature && (feature.enabled || feature.optional);
}

export function isProfessionFeatureEnabled(professionId: string, featureId: string): boolean {
  const professionConfig = PROFESSION_FEATURE_MATRIX[professionId];
  if (!professionConfig) return false;

  return professionConfig.availableFeatures[featureId]?.enabled || false;
}

export function isProfessionFeatureOptional(professionId: string, featureId: string): boolean {
  const professionConfig = PROFESSION_FEATURE_MATRIX[professionId];
  if (!professionConfig) return false;

  return professionConfig.availableFeatures[featureId]?.optional || false;
}

export function enableProfessionFeature(professionId: string, featureId: string): boolean {
  const professionConfig = PROFESSION_FEATURE_MATRIX[professionId];
  if (!professionConfig) return false;

  const feature = professionConfig.availableFeatures[featureId];
  if (!feature || !feature.optional) return false;

  feature.enabled = true;
  return true;
}

export function disableProfessionFeature(professionId: string, featureId: string): boolean {
  const professionConfig = PROFESSION_FEATURE_MATRIX[professionId];
  if (!professionConfig) return false;

  const feature = professionConfig.availableFeatures[featureId];
  if (!feature || !feature.optional || feature.required) return false;

  feature.enabled = false;
  return true;
}

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

export function getAllProfessionFeatures(professionId: string) {
  const professionConfig = PROFESSION_FEATURE_MATRIX[professionId];
  if (!professionConfig) return [];

  return Object.entries(professionConfig.availableFeatures).map(([featureId, feature]) => ({
    featureId,
    ...feature,
  }));
}

export function getFeaturesByCategory(professionId: string) {
  const professionConfig = PROFESSION_FEATURE_MATRIX[professionId];
  if (!professionConfig) return {};

  const features = Object.entries(professionConfig.availableFeatures);
  const categorized: Record<string, any[]> = {};

  features.forEach(([featureId, feature]) => {
    // Find original feature from CREATORHUB_FEATURES to get category
    const original = CREATORHUB_FEATURES.find((f) => f.id === featureId);
    const category = original?.category || 'Other';

    if (!categorized[category]) {
      categorized[category] = [];
    }

    categorized[category].push({
      featureId,
      ...feature,
    });
  });

  return categorized;
}

// ============================================
// MARKETPLACE HELPER FUNCTIONS
// ============================================

/**
 * Get all marketplace features for a profession
 */
export function getMarketplaceFeatures(professionId: string) {
  const professionConfig = PROFESSION_FEATURE_MATRIX[professionId];
  if (!professionConfig) return [];

  return Object.entries(professionConfig.availableFeatures)
    .filter(([, feature]) => feature.plan === 'marketplace')
    .map(([featureId, feature]) => ({
      featureId,
      ...feature,
    }))
    .sort((a, b) => {
      // Sort by popular first, then by price
      if (a.marketplacePopular && !b.marketplacePopular) return -1;
      if (!a.marketplacePopular && b.marketplacePopular) return 1;
      return (a.marketplacePrice || 0) - (b.marketplacePrice || 0);
    });
}

/**
 * Get marketplace features by category
 */
export function getMarketplaceFeaturesByCategory(professionId: string) {
  const marketplaceFeatures = getMarketplaceFeatures(professionId);
  const categorized: Record<string, any[]> = {};

  marketplaceFeatures.forEach((feature) => {
    const category = feature.marketplaceCategory || 'other';
    if (!categorized[category]) {
      categorized[category] = [];
    }
    categorized[category].push(feature);
  });

  return categorized;
}

/**
 * Get popular marketplace features
 */
export function getPopularMarketplaceFeatures(professionId: string, limit: number = 5) {
  return getMarketplaceFeatures(professionId)
    .filter((f) => f.marketplacePopular)
    .slice(0, limit);
}

/**
 * Check if feature is marketplace item
 */
export function isMarketplaceFeature(professionId: string, featureId: string): boolean {
  const professionConfig = PROFESSION_FEATURE_MATRIX[professionId];
  if (!professionConfig) return false;

  return professionConfig.availableFeatures[featureId]?.plan === 'marketplace';
}

/**
 * Get marketplace feature price
 */
export function getMarketplaceFeaturePrice(professionId: string, featureId: string): number | null {
  const professionConfig = PROFESSION_FEATURE_MATRIX[professionId];
  if (!professionConfig) return null;

  const feature = professionConfig.availableFeatures[featureId];
  if (feature?.plan !== 'marketplace') return null;

  return feature.marketplacePrice || null;
}

/**
 * Purchase marketplace feature (enable it for user)
 */
export function purchaseMarketplaceFeature(professionId: string, featureId: string): boolean {
  const professionConfig = PROFESSION_FEATURE_MATRIX[professionId];
  if (!professionConfig) return false;

  const feature = professionConfig.availableFeatures[featureId];
  if (!feature || feature.plan !== 'marketplace') return false;

  // Check dependencies are met
  if (feature.dependencies && feature.dependencies.length > 0) {
    const dependenciesMet = feature.dependencies.every((depId) =>
      isProfessionFeatureEnabled(professionId, depId),
    );

    if (!dependenciesMet) {
      console.warn(`Cannot purchase ${featureId} - dependencies not met:`, feature.dependencies);
      return false;
    }
  }

  feature.enabled = true;
  return true;
}

/**
 * Calculate total marketplace spend for a profession
 */
export function calculateMarketplaceCost(professionId: string): number {
  const professionConfig = PROFESSION_FEATURE_MATRIX[professionId];
  if (!professionConfig) return 0;

  return Object.values(professionConfig.availableFeatures)
    .filter((f) => f.plan === 'marketplace' && f.enabled)
    .reduce((sum, f) => sum + (f.marketplacePrice || 0), 0);
}

/**
 * Get marketplace recommendations for user based on their current features
 */
export function getMarketplaceRecommendations(professionId: string, limit: number = 3) {
  const professionConfig = PROFESSION_FEATURE_MATRIX[professionId];
  if (!professionConfig) return [];

  const enabledFeatures = Object.entries(professionConfig.availableFeatures)
    .filter(([, f]) => f.enabled)
    .map(([id]) => id);

  return Object.entries(professionConfig.availableFeatures)
    .filter(([, feature]) => {
      if (feature.plan !== 'marketplace') return false;
      if (feature.enabled) return false; // Already purchased

      // Check if dependencies are met
      if (feature.dependencies && feature.dependencies.length > 0) {
        return feature.dependencies.every((depId) => enabledFeatures.includes(depId));
      }

      return true;
    })
    .map(([featureId, feature]) => ({
      featureId,
      ...feature,
      recommendationScore: feature.marketplacePopular ? 1 : 0.5,
    }))
    .sort((a, b) => b.recommendationScore - a.recommendationScore)
    .slice(0, limit);
}

/**
 * Get accessible folders for a user based on profession and plan
 */
export function getAccessibleFoldersForUser(profession: string, plan: 'basic' | 'pro' | 'enterprise') {
  const professionConfig = PROFESSION_FEATURE_MATRIX[profession] || PROFESSION_FEATURE_MATRIX.photographer;
  
  const baseFolders = ['projects', 'clients', 'contracts'];
  const proFolders = ['analytics', 'team', 'reports'];
  const enterpriseFolders = ['admin', 'audit', 'integrations'];
  
  let allFolders = [...baseFolders];
  if (plan === 'pro' || plan === 'enterprise') {
    allFolders = [...allFolders, ...proFolders];
  }
  if (plan === 'enterprise') {
    allFolders = [...allFolders, ...enterpriseFolders];
  }
  
  const featureFolders: Record<string, string[]> = {};
  Object.entries(professionConfig.availableFeatures).forEach(([featureId, feature]) => {
    if (feature.enabled) {
      featureFolders[featureId] = [`${featureId}-data`, `${featureId}-assets`];
    }
  });
  
  return {
    baseFolders: allFolders,
    featureFolders,
    totalCount: allFolders.length + Object.values(featureFolders).flat().length,
  };
}

/**
 * Get folder access overview for a profession
 */
export function getFolderAccessOverview(profession: string) {
  const professionConfig = PROFESSION_FEATURE_MATRIX[profession] || PROFESSION_FEATURE_MATRIX.photographer;
  
  const featureFolders = Object.entries(professionConfig.availableFeatures).map(([featureId, feature]) => ({
    featureId,
    featureName: feature.description || featureId,
    folders: [`${featureId}-data`, `${featureId}-assets`],
    isEnabled: feature.enabled,
    plan: feature.plan,
  }));
  
  return {
    profession,
    featureFolders,
    totalFeatures: featureFolders.length,
    enabledFeatures: featureFolders.filter(f => f.isEnabled).length,
  };
}
