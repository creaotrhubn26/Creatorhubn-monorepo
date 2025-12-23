/**
 * Profession Types and Specializations
 * 
 * Defines photographer and videographer types with their
 * associated environments, templates, and workflows.
 */

export type ProfessionType = 'photographer' | 'videographer';

export interface Specialization {
  id: string;
  name: string;
  description: string;
  icon: string; // MUI icon name
  defaultEnvironment: string;
  defaultTemplates: string[];
  recommendedEquipment: string[];
  recommendedModifiers: string[];
  workflows: string[];
  tags?: string[];
}

// ============================================================================
// Photographer Specializations
// ============================================================================
export const PHOTOGRAPHER_SPECIALIZATIONS: Specialization[] = [
  // Portrait & People
  {
    id: 'portrait',
    name: 'Portrait',
    description: 'Headshots, individual portraits, and personal branding',
    icon: 'Face',
    defaultEnvironment: 'studio_portrait',
    defaultTemplates: ['portrait_3point','portrait_rembrandt','portrait_butterfly'],
    recommendedEquipment: ['profoto_b10','canon_eos_r5','sony_a7iv'],
    recommendedModifiers: ['profoto-beauty-dish-white-22','profoto-softbox-3x4'],
    workflows: ['client_consultation','lighting_setup','retouching'],
    tags: ['headshot','personal','branding'],
  },
  {
    id: 'school_photography',
    name: 'School Photography',
    description: 'School portraits, class photos, yearbook, and graduation',
    icon: 'School',
    defaultEnvironment: 'school_studio',
    defaultTemplates: ['school_portrait','school_group','school_yearbook'],
    recommendedEquipment: ['canon_eos_r6','nikon_z6ii','godox_ad600'],
    recommendedModifiers: ['godox-softbox-80x120','godox-octa-120'],
    workflows: ['volume_workflow','batch_editing','print_ordering'],
    tags: ['school','yearbook','graduation','class'],
  },
  {
    id: 'fashion',
    name: 'Fashion',
    description: 'Editorial, lookbooks, runway, and beauty photography',
    icon: 'Checkroom',
    defaultEnvironment: 'studio_fashion',
    defaultTemplates: ['fashion_editorial','fashion_runway','fashion_beauty'],
    recommendedEquipment: ['profoto_d2','phase_one_iq4','hasselblad_x2d'],
    recommendedModifiers: ['profoto-octa-5','profoto-stripbox-1x6'],
    workflows: ['mood_board','styling','retouching_high_end'],
    tags: ['editorial','beauty','lookbook','runway'],
  },
  {
    id: 'commercial',
    name: 'Commercial',
    description: 'Advertising, campaigns, and brand photography',
    icon: 'Campaign',
    defaultEnvironment: 'studio_commercial',
    defaultTemplates: ['commercial_hero','commercial_lifestyle','commercial_product'],
    recommendedEquipment: ['broncolor_siros','profoto_pro_11','hasselblad_h6d'],
    recommendedModifiers: ['profoto-softbox-3x4','elinchrom-rotalux-135'],
    workflows: ['creative_brief','art_direction','compositing'],
    tags: ['advertising','campaigns','brand'],
  },
  {
    id: 'product',
    name: 'Product',
    description: 'E-commerce, packshots, and catalog photography',
    icon: 'Inventory2',
    defaultEnvironment: 'studio_product',
    defaultTemplates: ['product_clean_white','product_360','product_lifestyle'],
    recommendedEquipment: ['canon_eos_r5','sigma_105mm_macro','godox_ms300'],
    recommendedModifiers: ['godox-softbox-60x90','godox-stripbox-30x120'],
    workflows: ['batch_shooting','background_removal','color_matching'],
    tags: ['ecommerce','packshot','catalog'],
  },
  {
    id: 'food',
    name: 'Food',
    description: 'Restaurant, cookbook, and culinary photography',
    icon: 'Restaurant',
    defaultEnvironment: 'studio_food',
    defaultTemplates: ['food_overhead','food_hero','food_lifestyle'],
    recommendedEquipment: ['sony_a7riv','canon_ts_e_90mm','profoto_b10'],
    recommendedModifiers: ['profoto-softbox-2x3','profoto-stripbox-1x4'],
    workflows: ['food_styling','prop_styling','color_grading'],
    tags: ['culinary','restaurant','cookbook'],
  },
  {
    id: 'real_estate',
    name: 'Real Estate',
    description: 'Property, interior, and architectural photography',
    icon: 'Home',
    defaultEnvironment: 'location_interior',
    defaultTemplates: ['real_estate_wide','real_estate_detail','real_estate_twilight'],
    recommendedEquipment: ['canon_eos_r5','canon_ts_e_17mm','godox_ad200'],
    recommendedModifiers: [],
    workflows: ['hdr_bracketing','perspective_correction','virtual_staging'],
    tags: ['property','interior','architecture'],
  },
  {
    id: 'sports',
    name: 'Sports',
    description: 'Action, athletic, and fitness photography',
    icon: 'SportsScore',
    defaultEnvironment: 'gym_studio',
    defaultTemplates: ['sports_action','sports_portrait','fitness_dramatic'],
    recommendedEquipment: ['sony_a1','canon_eos_r3','nikon_z9'],
    recommendedModifiers: ['profoto-magnum-reflector','godox-standard-reflector-7'],
    workflows: ['high_speed_sync','burst_shooting','action_editing'],
    tags: ['action','athletic','fitness'],
  },
  {
    id: 'event',
    name: 'Event',
    description: 'Corporate events, conferences, and parties',
    icon: 'Celebration',
    defaultEnvironment: 'event_venue',
    defaultTemplates: ['event_coverage','event_portrait','event_candid'],
    recommendedEquipment: ['sony_a7iv','canon_eos_r6','godox_v860iii'],
    recommendedModifiers: [],
    workflows: ['event_coverage','quick_turnaround','gallery_delivery'],
    tags: ['corporate','conference','party'],
  },
  {
    id: 'newborn',
    name: 'Newborn & Family',
    description: 'Newborn, maternity, and family portraits',
    icon: 'ChildCare',
    defaultEnvironment: 'studio_newborn',
    defaultTemplates: ['newborn_soft','newborn_lifestyle','family_portrait'],
    recommendedEquipment: ['canon_eos_r6','sony_a7iv','profoto_b10'],
    recommendedModifiers: ['profoto-octa-3','profoto-softbox-2x3'],
    workflows: ['safety_protocols','posing_guide','gentle_editing'],
    tags: ['newborn','maternity','family','baby'],
  },
  {
    id: 'boudoir',
    name: 'Boudoir',
    description: 'Intimate, glamour, and empowerment photography',
    icon: 'Favorite',
    defaultEnvironment: 'studio_boudoir',
    defaultTemplates: ['boudoir_soft','boudoir_dramatic','glamour_beauty'],
    recommendedEquipment: ['sony_a7iv','canon_rf_85mm','profoto_b10'],
    recommendedModifiers: ['profoto-beauty-dish-white-22','profoto-stripbox-1x4'],
    workflows: ['client_comfort','posing_guide','artistic_editing'],
    tags: ['intimate','glamour','empowerment'],
  },
  {
    id: 'fine_art',
    name: 'Fine Art',
    description: 'Conceptual, gallery, and artistic photography',
    icon: 'Palette',
    defaultEnvironment: 'studio_fine_art',
    defaultTemplates: ['fine_art_dramatic','fine_art_minimal','conceptual'],
    recommendedEquipment: ['hasselblad_x2d','phase_one_iq4','profoto_pro_11'],
    recommendedModifiers: ['profoto-octa-5','profoto-stripbox-1x6'],
    workflows: ['concept_development','artistic_vision','print_preparation'],
    tags: ['conceptual','gallery','artistic'],
  },
];

// ============================================================================
// Videographer Specializations
// ============================================================================
export const VIDEOGRAPHER_SPECIALIZATIONS: Specialization[] = [
  {
    id: 'cinematographer',
    name: 'Cinematographer',
    description: 'Narrative films, short films, and cinematic productions',
    icon: 'Movie',
    defaultEnvironment: 'film_set',
    defaultTemplates: ['cinema_3point','cinema_dramatic','cinema_natural'],
    recommendedEquipment: ['arri_alexa_mini','red_v_raptor','blackmagic_ursa'],
    recommendedModifiers: ['kino_flo_celeb','arri_skypanel'],
    workflows: ['storyboarding','shot_list','color_grading_cinema'],
    tags: ['narrative','film','cinematic'],
  },
  {
    id: 'commercial_video',
    name: 'Commercial',
    description: 'TV commercials, brand videos, and advertising',
    icon: 'Tv',
    defaultEnvironment: 'studio_commercial_video',
    defaultTemplates: ['commercial_hero_video','commercial_interview','commercial_product_video'],
    recommendedEquipment: ['sony_fx6','canon_c70','blackmagic_pocket_6k'],
    recommendedModifiers: ['aputure_600d','litepanels_gemini'],
    workflows: ['creative_brief_video','client_review','delivery_specs'],
    tags: ['tv','advertising','brand'],
  },
  {
    id: 'documentary',
    name: 'Documentary',
    description: 'Documentaries, interviews, and journalistic content',
    icon: 'Article',
    defaultEnvironment: 'interview_setup',
    defaultTemplates: ['doc_interview_2cam','doc_natural','doc_dramatic'],
    recommendedEquipment: ['sony_a7siii','canon_c300_mkiii','blackmagic_pocket_6k'],
    recommendedModifiers: ['aputure_300d','godox_sl200'],
    workflows: ['interview_technique','broll_capture','story_editing'],
    tags: ['documentary','interview','journalism'],
  },
  {
    id: 'music_video',
    name: 'Music Video',
    description: 'Music videos, performance, and artist content',
    icon: 'MusicNote',
    defaultEnvironment: 'music_video_set',
    defaultTemplates: ['mv_performance','mv_dramatic','mv_narrative'],
    recommendedEquipment: ['red_komodo','sony_fx3','blackmagic_pocket_6k'],
    recommendedModifiers: ['aputure_mc_rgb','nanlite_pavotube'],
    workflows: ['music_sync','performance_capture','creative_editing'],
    tags: ['music','performance','artist'],
  },
  {
    id: 'corporate_video',
    name: 'Corporate',
    description: 'Training, internal comms, and corporate content',
    icon: 'Business',
    defaultEnvironment: 'corporate_studio',
    defaultTemplates: ['corporate_interview','corporate_presentation','corporate_talking_head'],
    recommendedEquipment: ['sony_a7iv','canon_eos_r5','panasonic_gh6'],
    recommendedModifiers: ['godox-softbox-80x120','aputure_amaran_200d'],
    workflows: ['script_teleprompter','branded_templates','quick_turnaround'],
    tags: ['corporate','training','internal'],
  },
  {
    id: 'social_media',
    name: 'Social Media',
    description: 'YouTube, TikTok, Instagram, and online content',
    icon: 'Share',
    defaultEnvironment: 'creator_studio',
    defaultTemplates: ['youtube_talking_head','tiktok_vertical','instagram_reels'],
    recommendedEquipment: ['sony_zv_e1','canon_eos_r8','dji_pocket_3'],
    recommendedModifiers: ['elgato_key_light','aputure_mc'],
    workflows: ['quick_content','vertical_format','platform_optimization'],
    tags: ['youtube','tiktok','instagram','creator'],
  },
  {
    id: 'wedding_video',
    name: 'Wedding',
    description: 'Wedding films, highlights, and ceremony coverage',
    icon: 'Favorite',
    defaultEnvironment: 'wedding_venue',
    defaultTemplates: ['wedding_ceremony','wedding_reception','wedding_cinematic'],
    recommendedEquipment: ['sony_a7siii','canon_eos_r5','dji_ronin_4d'],
    recommendedModifiers: ['aputure_300d','godox_vl300'],
    workflows: ['multi_cam_sync','audio_capture','cinematic_editing'],
    tags: ['wedding','ceremony','highlights'],
  },
  {
    id: 'live_streaming',
    name: 'Live Streaming',
    description: 'Live events, broadcasts, and streaming productions',
    icon: 'Livestream',
    defaultEnvironment: 'broadcast_studio',
    defaultTemplates: ['stream_multi_cam','stream_interview','stream_presentation'],
    recommendedEquipment: ['blackmagic_atem','ptz_camera','sony_a7iv'],
    recommendedModifiers: ['elgato_key_light_air','aputure_amaran_100d'],
    workflows: ['multi_cam_switching','graphics_overlay','chat_interaction'],
    tags: ['streaming','broadcast','live'],
  },
  {
    id: 'drone',
    name: 'Drone/Aerial',
    description: 'Aerial cinematography and drone operations',
    icon: 'FlightTakeoff',
    defaultEnvironment: 'outdoor_aerial',
    defaultTemplates: ['drone_reveal','drone_tracking','drone_orbit'],
    recommendedEquipment: ['dji_inspire_3','dji_mavic_3_pro','freefly_alta_x'],
    recommendedModifiers: [],
    workflows: ['flight_planning','airspace_check','stabilization'],
    tags: ['aerial','drone','fpv'],
  },
  {
    id: 'vfx',
    name: 'VFX/Motion Graphics',
    description: 'Visual effects, motion graphics, and compositing',
    icon: 'AutoAwesome',
    defaultEnvironment: 'green_screen_studio',
    defaultTemplates: ['greenscreen_full','greenscreen_partial','motion_graphics'],
    recommendedEquipment: ['blackmagic_ursa_mini','red_komodo','sony_fx6'],
    recommendedModifiers: ['kino_flo_4bank','arri_skypanel'],
    workflows: ['keying_setup','tracking_markers','compositing'],
    tags: ['vfx','motion','compositing','greenscreen'],
  },
];

// ============================================================================
// Environment Definitions
// ============================================================================
export interface EnvironmentConfig {
  id: string;
  name: string;
  description: string;
  hdri: string;
  backdrop: string;
  defaultLights: Array<{
    type: string;
    power: number;
    position: [number, number, number];
    cct?: number;
    modifier?: string;
  }>;
  defaultCamera: {
    focalLength: number;
    aperture: number;
    iso: number;
    position: [number, number, number];
  };
  props?: string[];
}

export const ENVIRONMENTS: Record<string, EnvironmentConfig> = {
  // School Photography Environments
  school_studio: {
    id: 'school_studio',
    name: 'School Photo Studio',
    description: 'Optimized for high-volume school portrait sessions',
    hdri: 'studio_neutral',
    backdrop: 'cyclorama-gray',
    defaultLights: [
      { type: 'softbox', power: 400, position: [1.5, 2.2, 2], cct: 5500, modifier: 'godox-softbox-80x120' },
      { type: 'softbox', power: 250, position: [-1.5, 2, 2], cct: 5500, modifier: 'godox-softbox-60x90' },
      { type: 'hair', power: 200, position: [0, 2.5, -1], cct: 5500 },
    ],
    defaultCamera: {
      focalLength: 85,
      aperture: 5.6,
      iso: 100,
      position: [0, 1.5, 3],
    },
    props: ['stool_posing','apple_box'],
  },

  // Portrait Environments
  studio_portrait: {
    id: 'studio_portrait',
    name: 'Portrait Studio',
    description: 'Classic portrait studio setup',
    hdri: 'studio_small_09',
    backdrop: 'cyclorama-white',
    defaultLights: [
      { type: 'key', power: 500, position: [2, 2, 2], cct: 5500, modifier: 'profoto-beauty-dish-white-22' },
      { type: 'fill', power: 250, position: [-2, 1.5, 2], cct: 5500, modifier: 'profoto-softbox-3x4' },
      { type: 'rim', power: 300, position: [0, 2, -2], cct: 5500 },
    ],
    defaultCamera: {
      focalLength: 85,
      aperture: 2.8,
      iso: 100,
      position: [0, 1.6, 3],
    },
  },

  // Fashion Environments
  studio_fashion: {
    id: 'studio_fashion',
    name: 'Fashion Studio',
    description: 'High-end fashion photography setup',
    hdri: 'studio_small_09',
    backdrop: 'cyclorama-white',
    defaultLights: [
      { type: 'key', power: 800, position: [3, 2, 2], cct: 5600, modifier: 'profoto-octa-5' },
      { type: 'rim', power: 600, position: [-2, 2, -1], cct: 5600, modifier: 'profoto-stripbox-1x6' },
      { type: 'hair', power: 400, position: [0, 3, -1], cct: 5600 },
    ],
    defaultCamera: {
      focalLength: 70,
      aperture: 4,
      iso: 200,
      position: [0, 1.4, 5],
    },
  },

  // Product Environments
  studio_product: {
    id: 'studio_product',
    name: 'Product Studio',
    description: 'E-commerce and product photography',
    hdri: 'studio_neutral',
    backdrop: 'cyclorama-white',
    defaultLights: [
      { type: 'overhead', power: 400, position: [0, 3, 0], cct: 5500 },
      { type: 'left', power: 300, position: [-2, 1, 1], cct: 5500, modifier: 'godox-softbox-60x90' },
      { type: 'right', power: 300, position: [2, 1, 1], cct: 5500, modifier: 'godox-softbox-60x90' },
      { type: 'background', power: 600, position: [0, 1, -2], cct: 5500 },
    ],
    defaultCamera: {
      focalLength: 100,
      aperture: 11,
      iso: 100,
      position: [0, 1, 2],
    },
    props: ['product_table'],
  },

  // Film/Cinema Environments
  film_set: {
    id: 'film_set',
    name: 'Film Set',
    description: 'Cinematic production environment',
    hdri: 'indoor_dramatic',
    backdrop: 'abstract-bokeh',
    defaultLights: [
      { type: 'key', power: 1000, position: [3, 3, 3], cct: 5600 },
      { type: 'fill', power: 400, position: [-2, 2, 2], cct: 5600 },
      { type: 'rim', power: 600, position: [0, 2.5, -2], cct: 5600 },
      { type: 'practical', power: 200, position: [-3, 1, 0], cct: 3200 },
    ],
    defaultCamera: {
      focalLength: 35,
      aperture: 2.8,
      iso: 800,
      position: [0, 1.2, 4],
    },
  },

  // Interview Setup
  interview_setup: {
    id: 'interview_setup',
    name: 'Interview Setup',
    description: 'Professional interview and documentary setup',
    hdri: 'office_interior',
    backdrop: 'indoor-office-modern',
    defaultLights: [
      { type: 'key', power: 500, position: [2, 2, 2], cct: 5600, modifier: 'aputure_600d' },
      { type: 'fill', power: 300, position: [-1.5, 1.5, 2], cct: 5600 },
      { type: 'hair', power: 250, position: [0, 2.5, -1], cct: 5600 },
      { type: 'background', power: 150, position: [-2, 1, -2], cct: 4000 },
    ],
    defaultCamera: {
      focalLength: 50,
      aperture: 2.8,
      iso: 800,
      position: [0, 1.5, 2.5],
    },
  },

  // Green Screen
  green_screen_studio: {
    id: 'green_screen_studio',
    name: 'Green Screen Studio',
    description: 'Chroma key setup for VFX',
    hdri: 'studio_neutral',
    backdrop: 'green-screen-cyclorama',
    defaultLights: [
      { type: 'key', power: 600, position: [2, 2.5, 2], cct: 5600 },
      { type: 'fill', power: 400, position: [-2, 2, 2], cct: 5600 },
      { type: 'bg_left', power: 300, position: [-3, 1.5, -1], cct: 5600 },
      { type: 'bg_right', power: 300, position: [3, 1.5, -1], cct: 5600 },
    ],
    defaultCamera: {
      focalLength: 35,
      aperture: 4,
      iso: 400,
      position: [0, 1.4, 4],
    },
  },

  // Creator/Social Media Studio
  creator_studio: {
    id: 'creator_studio',
    name: 'Creator Studio',
    description: 'Optimized for YouTube and social content',
    hdri: 'studio_neutral',
    backdrop: 'abstract-neon',
    defaultLights: [
      { type: 'key', power: 400, position: [1.5, 2, 2], cct: 5600 },
      { type: 'fill', power: 250, position: [-1.5, 1.8, 2], cct: 5600 },
      { type: 'rgb_accent', power: 150, position: [2, 1, -1], cct: 6500 },
    ],
    defaultCamera: {
      focalLength: 24,
      aperture: 2.8,
      iso: 800,
      position: [0, 1.5, 2],
    },
  },
};

// ============================================================================
// School Photography Templates
// ============================================================================
export const SCHOOL_TEMPLATES = {
  school_portrait: {
    id: 'school_portrait',
    name: 'School Portrait',
    description: 'Standard individual school portrait',
    lights: [
      { type: 'key', power: 400, position: [1.5, 2.2, 2], angle: 45 },
      { type: 'fill', power: 200, position: [-1.5, 1.8, 2], angle: 50 },
      { type: 'hair', power: 150, position: [0, 2.5, -1], angle: 30 },
    ],
    camera: { focalLength: 85, aperture: 5.6, iso: 100 },
    backdrop: 'cyclorama-gray',
    posePreset: 'portrait-three-quarter',
  },
  school_group: {
    id: 'school_group',
    name: 'Class Group Photo',
    description: 'Group photo setup for class photos',
    lights: [
      { type: 'key_left', power: 500, position: [-3, 3, 4], angle: 45 },
      { type: 'key_right', power: 500, position: [3, 3, 4], angle: 45 },
      { type: 'fill_center', power: 350, position: [0, 2.5, 4], angle: 30 },
      { type: 'background', power: 400, position: [0, 2, -2], angle: 0 },
    ],
    camera: { focalLength: 35, aperture: 8, iso: 200 },
    backdrop: 'cyclorama-white',
  },
  school_yearbook: {
    id: 'school_yearbook',
    name: 'Yearbook Portrait',
    description: 'Traditional yearbook-style portrait',
    lights: [
      { type: 'key', power: 450, position: [2, 2, 2], angle: 45 },
      { type: 'fill', power: 250, position: [-1.5, 1.5, 2], angle: 60 },
    ],
    camera: { focalLength: 105, aperture: 5.6, iso: 100 },
    backdrop: 'cyclorama-gray',
    posePreset: 'portrait-three-quarter',
  },
  school_sports: {
    id: 'school_sports',
    name: 'Sports Team Photo',
    description: 'Team photo setup with dramatic lighting',
    lights: [
      { type: 'key', power: 600, position: [0, 3, 5], angle: 30 },
      { type: 'rim_left', power: 400, position: [-4, 2, -1], angle: 45 },
      { type: 'rim_right', power: 400, position: [4, 2, -1], angle: 45 },
    ],
    camera: { focalLength: 24, aperture: 8, iso: 200 },
    backdrop: 'cyclorama-black',
  },
  school_graduation: {
    id: 'school_graduation',
    name: 'Graduation Portrait',
    description: 'Cap and gown graduation portrait',
    lights: [
      { type: 'key', power: 450, position: [1.5, 2.5, 2], angle: 45 },
      { type: 'fill', power: 200, position: [-1.5, 2, 2], angle: 55 },
      { type: 'hair', power: 180, position: [0, 2.8, -0.5], angle: 25 },
    ],
    camera: { focalLength: 85, aperture: 4, iso: 100 },
    backdrop: 'cyclorama-gray',
    posePreset: 'standing-confident',
  },
};

// ============================================================================
// Helper Functions
// ============================================================================
export function getSpecializationById(id: string, profession: ProfessionType): Specialization | undefined {
  const list = profession ==='photographer' ? PHOTOGRAPHER_SPECIALIZATIONS : VIDEOGRAPHER_SPECIALIZATIONS;
  return list.find(s => s.id === id);
}

export function getEnvironmentById(id: string): EnvironmentConfig | undefined {
  return ENVIRONMENTS[id];
}

export function getDefaultEnvironment(profession: ProfessionType, specializationId: string): EnvironmentConfig | undefined {
  const spec = getSpecializationById(specializationId, profession);
  if (!spec) return undefined;
  return ENVIRONMENTS[spec.defaultEnvironment];
}

