/**
 * Profession Dashboard Configuration System
 * Complete granular control over tabs, features, and components per profession
 */

export interface DashboardTabConfig {
  tabId: string;
  label: string;
  icon: string;
  enabled: boolean;
  required: boolean; // Cannot be disabled
  order: number;
  description: string;
  component: string; // Component to render
  features: {
    [featureId: string]: {
      enabled: boolean;
      label: string;
      description: string;
      optional: boolean;
    };
  };
}

export interface ProfessionDashboardConfig {
  professionId: string;
  displayName: string;
  tabs: DashboardTabConfig[];
  defaultProjectType?: string;
  projectTypes: {
    id: string;
    label: string;
    enabled: boolean;
  }[];
}

/**
 * Complete Dashboard Configuration Matrix
 * Every tab and feature for every profession
 */
export const PROFESSION_DASHBOARD_CONFIG: Record<string, ProfessionDashboardConfig> = {
  // 📸 PHOTOGRAPHER
  photographer: {
    professionId: 'photographer',
    displayName: 'Fotograf',
    defaultProjectType: 'bryllup',
    projectTypes: [
      { id: 'bryllup', label: 'Bryllup', enabled: true },
      { id: 'portrett', label: 'Portrett', enabled: true },
      { id: 'produkt', label: 'Produktfoto', enabled: true },
      { id: 'event', label: 'Event', enabled: true },
      { id: 'arkitektur', label: 'Arkitektur', enabled: true },
    ],
    tabs: [
      {
        tabId: 'overview',
        label: 'Oversikt',
        icon: 'Dashboard',
        enabled: true,
        required: true,
        order: 0,
        description: 'Hovedoversikt med statistikk og aktivitet',
        component: 'PhotographerOverview',
        features: {
          revenue_chart: {
            enabled: true,
            label: 'Inntektsgraf',
            description: 'Viser inntektsutvikling',
            optional: false,
          },
          project_stats: {
            enabled: true,
            label: 'Prosjektstatistikk',
            description: 'Antall prosjekter og status',
            optional: false,
          },
          calendar_widget: {
            enabled: true,
            label: 'Kalenderoversikt',
            description: 'Kommende avtaler',
            optional: true,
          },
          weather_widget: {
            enabled: true,
            label: 'Værvarsling',
            description: 'Vær for planlagte fotograferinger',
            optional: true,
          },
        },
      },
      {
        tabId: 'projects',
        label: 'Prosjekter',
        icon: 'PhotoLibrary',
        enabled: true,
        required: true,
        order: 1,
        description: 'Alle fotoprosjekter og oppdrag',
        component: 'ProjectManager',
        features: {
          project_list: {
            enabled: true,
            label: 'Prosjektliste',
            description: 'Alle prosjekter',
            optional: false,
          },
          project_templates: {
            enabled: true,
            label: 'Prosjektmaler',
            description: 'Forhåndsdefinerte maler',
            optional: true,
          },
          project_archive: {
            enabled: true,
            label: 'Arkiv',
            description: 'Arkiverte prosjekter',
            optional: true,
          },
        },
      },
      {
        tabId: 'wedding_timeline',
        label: 'Bryllupstidslinje',
        icon: 'Event',
        enabled: true,
        required: true, // Required for photographers
        order: 2,
        description: 'Bryllupsplanlegging med kulturtilpasning',
        component: 'WeddingTimelineAdmin',
        features: {
          timeline_editor: {
            enabled: true,
            label: 'Tidslinjeeditor',
            description: 'Rediger bryllupstidslinje',
            optional: false,
          },
          cultural_presets: {
            enabled: true,
            label: 'Kulturelle forhåndsinnstillinger',
            description: 'Norske, pakistanske, polske bryllup',
            optional: false,
          },
          vendor_sync: {
            enabled: true,
            label: 'Leverandørsynkronisering',
            description: 'Synk med andre leverandører',
            optional: true,
          },
          client_access: {
            enabled: true,
            label: 'Klienttilgang',
            description: 'Klienter kan se tidslinje',
            optional: true,
          },
        },
      },
      {
        tabId: 'photos',
        label: 'Bilder',
        icon: 'PhotoCamera',
        enabled: true,
        required: true,
        order: 3,
        description: 'Bildegalleri og fotoadministrasjon',
        component: 'PhotoGalleryManager',
        features: {
          photo_gallery: {
            enabled: true,
            label: 'Bildegalleri',
            description: 'Alle bilder',
            optional: false,
          },
          photo_enhancement: {
            enabled: true,
            label: 'Bildефorbedring',
            description: 'AI-drevet forbedring',
            optional: false,
          },
          bulk_editing: {
            enabled: true,
            label: 'Masseredigering',
            description: 'Rediger flere bilder samtidig',
            optional: true,
          },
          export_presets: {
            enabled: true,
            label: 'Eksportinnstillinger',
            description: 'Forhåndsdefinerte eksportformater',
            optional: true,
          },
        },
      },
      {
        tabId: 'contracts',
        label: 'Kontrakter',
        icon: 'Description',
        enabled: true,
        required: true,
        order: 4,
        description: 'Kontraktsadministrasjon og signeringer',
        component: 'ContractManagement',
        features: {
          contract_templates: {
            enabled: true,
            label: 'Kontraktmaler',
            description: 'Forhåndsdefinerte maler',
            optional: false,
          },
          digital_signing: {
            enabled: true,
            label: 'Digital signering',
            description: 'E-signatur via BankID',
            optional: true,
          },
          contract_archive: {
            enabled: true,
            label: 'Kontraktarkiv',
            description: 'Alle signerte kontrakter',
            optional: false,
          },
        },
      },
      {
        tabId: 'showcase',
        label: 'Showcase',
        icon: 'Star',
        enabled: true,
        required: false,
        order: 5,
        description: 'Portfolio showcase administrasjon',
        component: 'ShowcaseAdmin',
        features: {
          portfolio_editor: {
            enabled: true,
            label: 'Portfolio-editor',
            description: 'Rediger portfolio',
            optional: false,
          },
          public_gallery: {
            enabled: true,
            label: 'Offentlig galleri',
            description: 'Publiser bilder',
            optional: true,
          },
          seo_optimization: {
            enabled: true,
            label: 'SEO-optimalisering',
            description: 'Søkemotoroptimalisering',
            optional: true,
          },
        },
      },
      {
        tabId: 'gear',
        label: 'Utstyr',
        icon: 'CameraAlt',
        enabled: true,
        required: false,
        order: 6,
        description: 'Utstyrsadministrasjon og vedlikehold',
        component: 'EnhancedGearTab',
        features: {
          equipment_list: {
            enabled: true,
            label: 'Utstyrsliste',
            description: 'Alt utstyr',
            optional: false,
          },
          maintenance_log: {
            enabled: true,
            label: 'Vedlikeholdslogg',
            description: 'Spor vedlikehold',
            optional: true,
          },
          rental_tracking: {
            enabled: true,
            label: 'Leiesporing',
            description: 'Spor utleid utstyr',
            optional: true,
          },
        },
      },
      {
        tabId: 'business_intelligence',
        label: 'Forretningsanalyse',
        icon: 'Analytics',
        enabled: false, // Optional - can be enabled
        required: false,
        order: 7,
        description: 'SSB og Proff.no markedsanalyse',
        component: 'BusinessIntelligenceDashboard',
        features: {
          market_analysis: {
            enabled: true,
            label: 'Markedsanalyse',
            description: 'SSB-data for fotografer',
            optional: false,
          },
          competitor_analysis: {
            enabled: true,
            label: 'Konkurrentanalyse',
            description: 'Proff.no-data',
            optional: true,
          },
          revenue_forecast: {
            enabled: true,
            label: 'Inntektsprognose',
            description: 'AI-drevet prognose',
            optional: true,
          },
        },
      },
    ],
  },

  // 🎥 VIDEOGRAPHER
  videographer: {
    professionId: 'videographer',
    displayName: 'Videograf',
    defaultProjectType: 'bryllup',
    projectTypes: [
      { id: 'bryllup', label: 'Bryllupsvideo', enabled: true },
      { id: 'corporate', label: 'Bedriftsvideo', enabled: true },
      { id: 'musikkvideo', label: 'Musikkvideo', enabled: true },
      { id: 'dokumentar', label: 'Dokumentar', enabled: true },
      { id: 'reklame', label: 'Reklamevideo', enabled: true },
    ],
    tabs: [
      {
        tabId: 'overview',
        label: 'Oversikt',
        icon: 'Dashboard',
        enabled: true,
        required: true,
        order: 0,
        description: 'Hovedoversikt for videografer',
        component: 'VideographerOverview',
        features: {
          revenue_chart: {
            enabled: true,
            label: 'Inntektsgraf',
            description: 'Inntektsutvikling',
            optional: false,
          },
          project_stats: {
            enabled: true,
            label: 'Prosjektstatistikk',
            description: 'Videoer i produksjon',
            optional: false,
          },
          render_queue: {
            enabled: true,
            label: 'Rendering-kø',
            description: 'Aktive renderinger',
            optional: true,
          },
        },
      },
      {
        tabId: 'videos',
        label: 'Videoer',
        icon: 'VideoLibrary',
        enabled: true,
        required: true,
        order: 1,
        description: 'Alle videoprosjekter',
        component: 'VideoProjectManager',
        features: {
          video_list: {
            enabled: true,
            label: 'Videoliste',
            description: 'Alle videoer',
            optional: false,
          },
          video_ai: {
            enabled: true,
            label: 'Video AI',
            description: 'AI-forbedring og redigering',
            optional: false,
          },
          davinci_export: {
            enabled: true,
            label: 'DaVinci Resolve Export',
            description: 'Eksporter til DaVinci',
            optional: true,
          },
        },
      },
      {
        tabId: 'wedding_timeline',
        label: 'Bryllupstidslinje',
        icon: 'Event',
        enabled: false, // ⭐ CAN BE ENABLED BY ADMIN
        required: false,
        order: 2,
        description: 'Bryllupsplanlegging for videografer',
        component: 'WeddingTimelineAdmin',
        features: {
          timeline_editor: {
            enabled: true,
            label: 'Tidslinjeeditor',
            description: 'Rediger bryllupstidslinje',
            optional: false,
          },
          photographer_sync: {
            enabled: true,
            label: 'Fotograf-synkronisering',
            description: 'Synk med fotograf',
            optional: true,
          },
          shot_list: {
            enabled: true,
            label: 'Shot-liste',
            description: 'Planlegg videoshots',
            optional: true,
          },
        },
      },
      {
        tabId: 'story_arc',
        label: 'Story Arc Studio',
        icon: 'MovieFilter',
        enabled: true,
        required: true,
        order: 3,
        description: 'Story Arc Studio med AI',
        component: 'StoryArcStudio',
        features: {
          story_builder: {
            enabled: true,
            label: 'Story Builder',
            description: 'Bygg videofortelling',
            optional: false,
          },
          ai_suggestions: {
            enabled: true,
            label: 'AI-forslag',
            description: 'AI foreslår cuts og overganger',
            optional: true,
          },
          music_sync: {
            enabled: true,
            label: 'Musikksynkronisering',
            description: 'Synk med musikk',
            optional: true,
          },
        },
      },
      {
        tabId: 'contracts',
        label: 'Kontrakter',
        icon: 'Description',
        enabled: true,
        required: true,
        order: 4,
        description: 'Kontraktsadministrasjon',
        component: 'ContractManagement',
        features: {
          contract_templates: {
            enabled: true,
            label: 'Kontraktmaler',
            description: 'Videokontrakter',
            optional: false,
          },
          usage_rights: {
            enabled: true,
            label: 'Bruksrettigheter',
            description: 'Definer videolisenser',
            optional: true,
          },
        },
      },
      {
        tabId: 'showcase',
        label: 'Showcase',
        icon: 'Star',
        enabled: true,
        required: false,
        order: 5,
        description: 'Video portfolio showcase',
        component: 'ShowcaseAdmin',
        features: {
          video_portfolio: {
            enabled: true,
            label: 'Videoportfolio',
            description: 'Publiser videoer',
            optional: false,
          },
          streaming_integration: {
            enabled: true,
            label: 'Streaming-integrasjon',
            description: 'YouTube/Vimeo',
            optional: true,
          },
        },
      },
      {
        tabId: 'gear',
        label: 'Utstyr',
        icon: 'Videocam',
        enabled: true,
        required: false,
        order: 6,
        description: 'Videoutstyr og kameraer',
        component: 'EnhancedGearTab',
        features: {
          camera_database: {
            enabled: true,
            label: 'Kameradatabase',
            description: 'Alle kameraer',
            optional: false,
          },
          lens_database: {
            enabled: true,
            label: 'Objektivdatabase',
            description: 'Alle objektiver',
            optional: true,
          },
          gimbal_tracking: {
            enabled: true,
            label: 'Gimbal/Drone-sporing',
            description: 'Spesialisert utstyr',
            optional: true,
          },
        },
      },
    ],
  },

  // 🎵 MUSIC PRODUCER
  music_producer: {
    professionId: 'music_producer',
    displayName: 'Musikkprodusent',
    defaultProjectType: 'album',
    projectTypes: [
      { id: 'album', label: 'Album', enabled: true },
      { id: 'single', label: 'Single', enabled: true },
      { id: 'ep', label: 'EP', enabled: true },
      { id: 'remix', label: 'Remix', enabled: true },
      { id: 'mastering', label: 'Mastering', enabled: true },
    ],
    tabs: [
      {
        tabId: 'overview',
        label: 'Oversikt',
        icon: 'Dashboard',
        enabled: true,
        required: true,
        order: 0,
        description: 'Hovedoversikt for musikkprodusenter',
        component: 'MusicProducerOverview',
        features: {
          revenue_chart: {
            enabled: true,
            label: 'Inntektsgraf',
            description: 'Inntekt fra produksjoner',
            optional: false,
          },
          active_projects: {
            enabled: true,
            label: 'Aktive prosjekter',
            description: 'Pågående produksjoner',
            optional: false,
          },
          streaming_stats: {
            enabled: true,
            label: 'Streaming-statistikk',
            description: 'Spotify/Apple Music',
            optional: true,
          },
        },
      },
      {
        tabId: 'projects',
        label: 'Prosjekter',
        icon: 'MusicNote',
        enabled: true,
        required: true,
        order: 1,
        description: 'Musikkproduksjoner',
        component: 'MusicProjectManager',
        features: {
          project_list: {
            enabled: true,
            label: 'Prosjektliste',
            description: 'Alle musikkprosjekter',
            optional: false,
          },
          audio_ai: {
            enabled: true,
            label: 'Audio AI',
            description: 'AI mastering og forbedring',
            optional: false,
          },
          stem_management: {
            enabled: true,
            label: 'Stem-administrasjon',
            description: 'Administrer lydspor',
            optional: true,
          },
        },
      },
      {
        tabId: 'artists',
        label: 'Artister',
        icon: 'People',
        enabled: true,
        required: true,
        order: 2,
        description: 'Artist CRM og kontaktstyring',
        component: 'ArtistManagement',
        features: {
          artist_database: {
            enabled: true,
            label: 'Artistdatabase',
            description: 'Alle artister',
            optional: false,
          },
          collaboration_tracking: {
            enabled: true,
            label: 'Samarbeidssporing',
            description: 'Spor samarbeid',
            optional: true,
          },
          royalty_splits: {
            enabled: true,
            label: 'Royalty-fordeling',
            description: 'Automatisk royalty-beregning',
            optional: true,
          },
        },
      },
      {
        tabId: 'showcase',
        label: 'Showcase',
        icon: 'Star',
        enabled: true,
        required: false,
        order: 3,
        description: 'Musikkportfolio',
        component: 'ShowcaseAdmin',
        features: {
          music_portfolio: {
            enabled: true,
            label: 'Musikkportfolio',
            description: 'Publiser produksjoner',
            optional: false,
          },
          soundcloud_integration: {
            enabled: true,
            label: 'SoundCloud-integrasjon',
            description: 'Automatisk opplasting',
            optional: true,
          },
        },
      },
      {
        tabId: 'gear',
        label: 'Utstyr',
        icon: 'GraphicEq',
        enabled: true,
        required: false,
        order: 4,
        description: 'Studioutstyr og instrumenter',
        component: 'EnhancedGearTab',
        features: {
          studio_equipment: {
            enabled: true,
            label: 'Studioutstyr',
            description: 'Mikrofoner, interfaces, etc',
            optional: false,
          },
          plugin_inventory: {
            enabled: true,
            label: 'Plugin-inventar',
            description: 'Alle VST/AU plugins',
            optional: true,
          },
        },
      },
    ],
  },

  // 🏨 PET HOTEL
  pet_hotel: {
    professionId: 'pet_hotel',
    displayName: 'Dyrehotell',
    defaultProjectType: 'overnight',
    projectTypes: [
      { id: 'overnight', label: 'Overnatting', enabled: true },
      { id: 'daycare', label: 'Dagpass', enabled: true },
      { id: 'long_term', label: 'Langvarig opphold', enabled: true },
      { id: 'grooming', label: 'Grooming', enabled: true },
    ],
    tabs: [
      {
        tabId: 'overview',
        label: 'Oversikt',
        icon: 'Dashboard',
        enabled: true,
        required: true,
        order: 0,
        description: 'Hovedoversikt for dyrehotell',
        component: 'PetHotelOverview',
        features: {
          occupancy_chart: {
            enabled: true,
            label: 'Beleggsoversikt',
            description: 'Gjeldende belegg',
            optional: false,
          },
          booking_calendar: {
            enabled: true,
            label: 'Bookingkalender',
            description: 'Alle bookinger',
            optional: false,
          },
          daily_revenue: {
            enabled: true,
            label: 'Daglig inntekt',
            description: 'Inntekt per dag',
            optional: true,
          },
        },
      },
      {
        tabId: 'bookings',
        label: 'Bookinger',
        icon: 'CalendarToday',
        enabled: true,
        required: true,
        order: 1,
        description: 'Bookingadministrasjon',
        component: 'BookingManagement',
        features: {
          booking_system: {
            enabled: true,
            label: 'Bookingsystem',
            description: 'Administrer bookinger',
            optional: false,
          },
          online_booking: {
            enabled: true,
            label: 'Online booking',
            description: 'Kunder kan booke selv',
            optional: true,
          },
          waitlist_management: {
            enabled: true,
            label: 'Venteliste',
            description: 'Administrer venteliste',
            optional: true,
          },
        },
      },
      {
        tabId: 'pets',
        label: 'Dyreprofiler',
        icon: 'Pets',
        enabled: true,
        required: true,
        order: 2,
        description: 'Alle dyreprofiler',
        component: 'PetProfileManager',
        features: {
          pet_database: {
            enabled: true,
            label: 'Dyredatabase',
            description: 'Alle dyr',
            optional: false,
          },
          medical_records: {
            enabled: true,
            label: 'Medisinske journaler',
            description: 'Vaksiner, medisiner',
            optional: false,
          },
          dietary_needs: {
            enabled: true,
            label: 'Kostbehov',
            description: 'Spesielle dietter',
            optional: true,
          },
          behavioral_notes: {
            enabled: true,
            label: 'Atferdsnotater',
            description: 'Spesialatferd',
            optional: true,
          },
        },
      },
      {
        tabId: 'facility',
        label: 'Fasiliteter',
        icon: 'Home',
        enabled: true,
        required: true,
        order: 3,
        description: 'Fasilitetsadministrasjon',
        component: 'FacilityManagement',
        features: {
          room_management: {
            enabled: true,
            label: 'Rom-administrasjon',
            description: 'Administrer rom og bur',
            optional: false,
          },
          cleaning_schedule: {
            enabled: true,
            label: 'Renholdsplan',
            description: 'Planlegg renhold',
            optional: true,
          },
          maintenance_log: {
            enabled: true,
            label: 'Vedlikeholdslogg',
            description: 'Spor vedlikehold',
            optional: true,
          },
        },
      },
      {
        tabId: 'live_cameras',
        label: 'Live Kameraer',
        icon: 'Videocam',
        enabled: false, // ⭐ PREMIUM FEATURE - CAN BE ENABLED
        required: false,
        order: 4,
        description: 'Live kameraer for eiere',
        component: 'LiveCameraManagement',
        features: {
          camera_feeds: {
            enabled: true,
            label: 'Kamera-feeder',
            description: 'Administrer kameraer',
            optional: false,
          },
          owner_access: {
            enabled: true,
            label: 'Eiertilgang',
            description: 'Eiere kan se live',
            optional: false,
          },
          recording: {
            enabled: true,
            label: 'Opptak',
            description: 'Lagre opptak',
            optional: true,
          },
        },
      },
      {
        tabId: 'daily_logs',
        label: 'Daglige Logger',
        icon: 'Assignment',
        enabled: true,
        required: true,
        order: 5,
        description: 'Daglige omsorgslogger',
        component: 'DailyLogManagement',
        features: {
          activity_logs: {
            enabled: true,
            label: 'Aktivitetslogger',
            description: 'Daglige aktiviteter',
            optional: false,
          },
          feeding_logs: {
            enabled: true,
            label: 'Fôringslogger',
            description: 'Matinntak',
            optional: false,
          },
          photo_updates: {
            enabled: true,
            label: 'Bildeoppdateringer',
            description: 'Send bilder til eiere',
            optional: true,
          },
        },
      },
    ],
  },

  // 🏢 ENTERPRISE (Combined Photo + Video Team)
  enterprise: {
    professionId: 'enterprise',
    displayName: 'Enterprise Team',
    defaultProjectType: 'bryllup',
    projectTypes: [
      { id: 'bryllup', label: 'Bryllup (Foto+Video)', enabled: true },
      { id: 'corporate', label: 'Bedriftsoppdrag', enabled: true },
      { id: 'event', label: 'Event', enabled: true },
      { id: 'musikkvideo', label: 'Musikkvideo', enabled: true },
      { id: 'portrett', label: 'Portrett', enabled: true },
      { id: 'reklame', label: 'Reklame', enabled: true },
    ],
    tabs: [
      {
        tabId: 'overview',
        label: 'Team Oversikt',
        icon: 'Dashboard',
        enabled: true,
        required: true,
        order: 0,
        description: 'Teamoversikt med samlet statistikk for foto og video',
        component: 'EnterpriseOverview',
        features: {
          team_revenue_chart: {
            enabled: true,
            label: 'Team Inntektsgraf',
            description: 'Samlet inntekt for hele teamet',
            optional: false,
          },
          team_members: {
            enabled: true,
            label: 'Teammedlemmer',
            description: 'Oversikt over alle teammedlemmer og roller',
            optional: false,
          },
          project_stats: {
            enabled: true,
            label: 'Prosjektstatistikk',
            description: 'Foto + video prosjekter samlet',
            optional: false,
          },
          calendar_widget: {
            enabled: true,
            label: 'Teamkalender',
            description: 'Felles kalender for hele teamet',
            optional: true,
          },
        },
      },
      {
        tabId: 'projects',
        label: 'Prosjekter',
        icon: 'PhotoLibrary',
        enabled: true,
        required: true,
        order: 1,
        description: 'Alle foto- og videoprosjekter for teamet',
        component: 'ProjectManager',
        features: {
          project_list: {
            enabled: true,
            label: 'Prosjektliste',
            description: 'Alle prosjekter (foto + video)',
            optional: false,
          },
          project_templates: {
            enabled: true,
            label: 'Prosjektmaler',
            description: 'Maler for kombinerte foto/video-oppdrag',
            optional: true,
          },
          team_assignment: {
            enabled: true,
            label: 'Teamtildeling',
            description: 'Tildel teammedlemmer til prosjekter',
            optional: false,
          },
        },
      },
      {
        tabId: 'wedding_timeline',
        label: 'Bryllupstidslinje',
        icon: 'Event',
        enabled: true,
        required: true,
        order: 2,
        description: 'Bryllupsplanlegging for foto + video team',
        component: 'WeddingTimelineAdmin',
        features: {
          timeline_editor: {
            enabled: true,
            label: 'Tidslinjeeditor',
            description: 'Rediger bryllupstidslinje',
            optional: false,
          },
          team_shot_list: {
            enabled: true,
            label: 'Team Shot-liste',
            description: 'Felles shot-liste for fotograf og videograf',
            optional: false,
          },
          cultural_presets: {
            enabled: true,
            label: 'Kulturelle forhåndsinnstillinger',
            description: 'Norske, pakistanske, polske bryllup',
            optional: false,
          },
        },
      },
      {
        tabId: 'photos',
        label: 'Bilder',
        icon: 'PhotoCamera',
        enabled: true,
        required: true,
        order: 3,
        description: 'Bildegalleri og fotoadministrasjon',
        component: 'PhotoGalleryManager',
        features: {
          photo_gallery: {
            enabled: true,
            label: 'Bildegalleri',
            description: 'Alle bilder',
            optional: false,
          },
          photo_enhancement: {
            enabled: true,
            label: 'Bildeforbedring',
            description: 'AI-drevet forbedring',
            optional: false,
          },
          bulk_editing: {
            enabled: true,
            label: 'Masseredigering',
            description: 'Rediger flere bilder samtidig',
            optional: true,
          },
        },
      },
      {
        tabId: 'videos',
        label: 'Videoer',
        icon: 'VideoLibrary',
        enabled: true,
        required: true,
        order: 4,
        description: 'Alle videoprosjekter',
        component: 'VideoProjectManager',
        features: {
          video_list: {
            enabled: true,
            label: 'Videoliste',
            description: 'Alle videoer',
            optional: false,
          },
          video_ai: {
            enabled: true,
            label: 'Video AI',
            description: 'AI-forbedring og redigering',
            optional: false,
          },
          davinci_export: {
            enabled: true,
            label: 'DaVinci Resolve Export',
            description: 'Eksporter til DaVinci',
            optional: true,
          },
        },
      },
      {
        tabId: 'team_management',
        label: 'Teamadministrasjon',
        icon: 'Groups',
        enabled: true,
        required: true,
        order: 5,
        description: 'Administrer teammedlemmer, roller og tilganger',
        component: 'TeamManagement',
        features: {
          member_roles: {
            enabled: true,
            label: 'Roller og tilganger',
            description: 'Definer teamroller',
            optional: false,
          },
          activity_log: {
            enabled: true,
            label: 'Aktivitetslogg',
            description: 'Spor teamaktivitet',
            optional: true,
          },
          workload_balance: {
            enabled: true,
            label: 'Arbeidslastbalansering',
            description: 'Fordel arbeid jevnt',
            optional: true,
          },
        },
      },
      {
        tabId: 'contracts',
        label: 'Kontrakter',
        icon: 'Description',
        enabled: true,
        required: true,
        order: 6,
        description: 'Kontraktsadministrasjon for teamoppdrag',
        component: 'ContractManagement',
        features: {
          contract_templates: {
            enabled: true,
            label: 'Kontraktmaler',
            description: 'Maler for kombinerte oppdrag',
            optional: false,
          },
          digital_signing: {
            enabled: true,
            label: 'Digital signering',
            description: 'E-signatur via BankID',
            optional: true,
          },
        },
      },
      {
        tabId: 'showcase',
        label: 'Showcase',
        icon: 'Star',
        enabled: true,
        required: false,
        order: 7,
        description: 'Team portfolio showcase',
        component: 'ShowcaseAdmin',
        features: {
          team_portfolio: {
            enabled: true,
            label: 'Team Portfolio',
            description: 'Felles portfolio for foto + video',
            optional: false,
          },
          seo_optimization: {
            enabled: true,
            label: 'SEO-optimalisering',
            description: 'Søkemotoroptimalisering',
            optional: true,
          },
        },
      },
      {
        tabId: 'gear',
        label: 'Utstyr',
        icon: 'CameraAlt',
        enabled: true,
        required: false,
        order: 8,
        description: 'Felles utstyrsadministrasjon',
        component: 'EnhancedGearTab',
        features: {
          shared_equipment: {
            enabled: true,
            label: 'Delt utstyr',
            description: 'Felles utstyrsliste for teamet',
            optional: false,
          },
          equipment_booking: {
            enabled: true,
            label: 'Utstyrsbooking',
            description: 'Book utstyr mellom teammedlemmer',
            optional: true,
          },
        },
      },
      {
        tabId: 'business_intelligence',
        label: 'Forretningsanalyse',
        icon: 'Analytics',
        enabled: true,
        required: false,
        order: 9,
        description: 'Team forretningsanalyse og rapporter',
        component: 'BusinessIntelligenceDashboard',
        features: {
          team_analytics: {
            enabled: true,
            label: 'Teamanalyse',
            description: 'Samlet analyse for teamet',
            optional: false,
          },
          revenue_forecast: {
            enabled: true,
            label: 'Inntektsprognose',
            description: 'AI-drevet teamprognose',
            optional: true,
          },
        },
      },
    ],
  },

  // 🏢 VENDOR
  vendor: {
    professionId: 'vendor',
    displayName: 'Leverandør',
    defaultProjectType: 'order',
    projectTypes: [
      { id: 'order', label: 'Ordre', enabled: true },
      { id: 'subscription', label: 'Abonnement', enabled: true },
      { id: 'rental', label: 'Utleie', enabled: true },
    ],
    tabs: [
      {
        tabId: 'overview',
        label: 'Oversikt',
        icon: 'Dashboard',
        enabled: true,
        required: true,
        order: 0,
        description: 'Leverandøroversikt',
        component: 'VendorOverview',
        features: {
          sales_chart: {
            enabled: true,
            label: 'Salgsgraf',
            description: 'Salgsutvikling',
            optional: false,
          },
          inventory_alerts: {
            enabled: true,
            label: 'Lagervarsler',
            description: 'Lavt lager',
            optional: true,
          },
        },
      },
      {
        tabId: 'products',
        label: 'Produkter',
        icon: 'Inventory',
        enabled: true,
        required: true,
        order: 1,
        description: 'Produktkatalog',
        component: 'ProductManagement',
        features: {
          product_catalog: {
            enabled: true,
            label: 'Produktkatalog',
            description: 'Alle produkter',
            optional: false,
          },
          inventory_management: {
            enabled: true,
            label: 'Lagerstyring',
            description: 'Spor lager',
            optional: false,
          },
          pricing_rules: {
            enabled: true,
            label: 'Prisregler',
            description: 'Dynamisk prissetting',
            optional: true,
          },
        },
      },
      {
        tabId: 'vendor_types',
        label: 'Vendor Typer',
        icon: 'Category',
        enabled: true,
        required: true,
        order: 2,
        description: 'Administrer vendor-typer',
        component: 'VendorTypeManager',
        features: {
          type_expansion: {
            enabled: true,
            label: 'Type-ekspansjon',
            description: 'Aktiver nye typer',
            optional: false,
          },
          multi_type_support: {
            enabled: true,
            label: 'Multi-type støtte',
            description: 'Flere typer samtidig',
            optional: false,
          },
        },
      },
    ],
  },
};

/**
 * Get all tabs for a profession
 */
export function getProfessionTabs(professionId: string): DashboardTabConfig[] {
  const config = PROFESSION_DASHBOARD_CONFIG[professionId];
  if (!config) return [];

  return config.tabs.filter((tab) => tab.enabled).sort((a, b) => a.order - b.order);
}

/**
 * Get a specific tab configuration
 */
export function getProfessionTab(professionId: string, tabId: string): DashboardTabConfig | null {
  const config = PROFESSION_DASHBOARD_CONFIG[professionId];
  if (!config) return null;

  return config.tabs.find((tab) => tab.tabId === tabId) || null;
}

/**
 * Check if a tab is enabled for a profession
 */
export function isTabEnabled(professionId: string, tabId: string): boolean {
  const tab = getProfessionTab(professionId, tabId);
  return tab?.enabled || false;
}

/**
 * Check if a feature within a tab is enabled
 */
export function isTabFeatureEnabled(
  professionId: string,
  tabId: string,
  featureId: string,
): boolean {
  const tab = getProfessionTab(professionId, tabId);
  if (!tab) return false;

  return tab.features[featureId]?.enabled || false;
}

/**
 * Enable/disable a tab for a profession
 */
export function toggleProfessionTab(
  professionId: string,
  tabId: string,
  enabled: boolean,
): boolean {
  const config = PROFESSION_DASHBOARD_CONFIG[professionId];
  if (!config) return false;

  const tab = config.tabs.find((t) => t.tabId === tabId);
  if (!tab) return false;

  // Cannot disable required tabs
  if (!enabled && tab.required) return false;

  tab.enabled = enabled;
  return true;
}

/**
 * Enable/disable a feature within a tab
 */
export function toggleTabFeature(
  professionId: string,
  tabId: string,
  featureId: string,
  enabled: boolean,
): boolean {
  const tab = getProfessionTab(professionId, tabId);
  if (!tab) return false;

  const feature = tab.features[featureId];
  if (!feature) return false;

  // Cannot disable non-optional features
  if (!enabled && !feature.optional) return false;

  feature.enabled = enabled;
  return true;
}

/**
 * Get project types for a profession
 */
export function getProfessionProjectTypes(professionId: string) {
  const config = PROFESSION_DASHBOARD_CONFIG[professionId];
  if (!config) return [];

  return config.projectTypes.filter((pt) => pt.enabled);
}

/**
 * Get stats for a profession's dashboard config
 */
export function getProfessionDashboardStats(professionId: string) {
  const config = PROFESSION_DASHBOARD_CONFIG[professionId];
  if (!config) return { totalTabs: 0, enabledTabs: 0, requiredTabs: 0, optionalTabs: 0 };

  return {
    totalTabs: config.tabs.length,
    enabledTabs: config.tabs.filter((t) => t.enabled).length,
    requiredTabs: config.tabs.filter((t) => t.required).length,
    optionalTabs: config.tabs.filter((t) => !t.required).length,
  };
}

/**
 * Get all professions with dashboard configs
 */
export function getAllProfessionDashboardConfigs() {
  return Object.values(PROFESSION_DASHBOARD_CONFIG);
}
